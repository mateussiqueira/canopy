import { expect } from "bun:test"
import { Duration, Effect, Layer, Option, Schema } from "effect"
import { eq, sql } from "drizzle-orm"
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/unstable/http"

import { AccountV2 } from "@opencode-ai/core/account"
import { AccountStateTable, AccountTable } from "@opencode-ai/core/account/sql"
import { Database } from "@opencode-ai/core/database/database"
import { testEffect } from "./lib/effect"

const database = Database.layerFromPath(":memory:")

const truncate = Layer.effectDiscard(
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    yield* db.run(sql`DELETE FROM account_state`)
    yield* db.run(sql`DELETE FROM account`)
  }),
).pipe(Layer.provide(database))

const it = testEffect(Layer.mergeAll(database, truncate))

const insideEagerRefreshWindow = Duration.toMillis(Duration.minutes(1))
const outsideEagerRefreshWindow = Duration.toMillis(Duration.minutes(10))

const live = (client: HttpClient.HttpClient) =>
  AccountV2.layer.pipe(Layer.provide(database), Layer.provide(Layer.succeed(HttpClient.HttpClient, client)))

const persist = (input: {
  id: AccountV2.ID
  email: string
  url: string
  accessToken: AccountV2.AccessToken
  refreshToken: AccountV2.RefreshToken
  expiry: number
  orgID: Option.Option<AccountV2.OrgID>
}) =>
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    yield* db
      .insert(AccountTable)
      .values({
        id: input.id,
        email: input.email,
        url: input.url,
        access_token: input.accessToken,
        refresh_token: input.refreshToken,
        token_expiry: input.expiry,
      })
      .onConflictDoUpdate({
        target: AccountTable.id,
        set: { access_token: input.accessToken, refresh_token: input.refreshToken, token_expiry: input.expiry },
      })
      .run()
      .pipe(Effect.orDie)
    yield* db
      .insert(AccountStateTable)
      .values({ id: 1, active_account_id: input.id, active_org_id: Option.getOrNull(input.orgID) })
      .onConflictDoUpdate({
        target: AccountStateTable.id,
        set: { active_account_id: input.id, active_org_id: Option.getOrNull(input.orgID) },
      })
      .run()
      .pipe(Effect.orDie)
  })

const row = (id: AccountV2.ID) =>
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    return yield* db.select().from(AccountTable).where(eq(AccountTable.id, id)).get().pipe(Effect.orDie)
  })

const active = Effect.gen(function* () {
  const { db } = yield* Database.Service
  const state = yield* db.select().from(AccountStateTable).where(eq(AccountStateTable.id, 1)).get().pipe(Effect.orDie)
  if (!state?.active_account_id) return undefined
  const account = yield* row(state.active_account_id)
  return account ? { ...account, active_org_id: state.active_org_id } : undefined
})

const json = (req: Parameters<typeof HttpClientResponse.fromWeb>[0], body: unknown, status = 200) =>
  HttpClientResponse.fromWeb(
    req,
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  )

const encodeOrg = Schema.encodeSync(AccountV2.Org)

const org = (id: string, name: string) => encodeOrg(new AccountV2.Org({ id: AccountV2.OrgID.make(id), name }))

const login = () =>
  new AccountV2.Login({
    code: AccountV2.DeviceCode.make("device-code"),
    user: AccountV2.UserCode.make("user-code"),
    url: "https://one.example.com/verify",
    server: "https://one.example.com",
    expiry: Duration.seconds(600),
    interval: Duration.seconds(5),
  })

const deviceTokenClient = (body: unknown, status = 400) =>
  HttpClient.make((req) =>
    Effect.succeed(
      req.url === "https://one.example.com/auth/device/token" ? json(req, body, status) : json(req, {}, 404),
    ),
  )

const poll = (body: unknown, status = 400) =>
  AccountV2.Service.use((s) => s.poll(login())).pipe(Effect.provide(live(deviceTokenClient(body, status))))

it.live("login normalizes trailing slashes in the provided server URL", () =>
  Effect.gen(function* () {
    const seen: Array<string> = []
    const client = HttpClient.make((req) =>
      Effect.gen(function* () {
        seen.push(`${req.method} ${req.url}`)

        if (req.url === "https://one.example.com/auth/device/code") {
          return json(req, {
            device_code: "device-code",
            user_code: "user-code",
            verification_uri_complete: "/device?user_code=user-code",
            expires_in: 600,
            interval: 5,
          })
        }

        return json(req, {}, 404)
      }),
    )

    const result = yield* AccountV2.use.login("https://one.example.com/").pipe(Effect.provide(live(client)))

    expect(seen).toEqual(["POST https://one.example.com/auth/device/code"])
    expect(result.server).toBe("https://one.example.com")
    expect(result.url).toBe("https://one.example.com/device?user_code=user-code")
  }),
)

it.live("login maps transport failures to account transport errors", () =>
  Effect.gen(function* () {
    const client = HttpClient.make((req) =>
      Effect.fail(
        new HttpClientError.HttpClientError({
          reason: new HttpClientError.TransportError({ request: req }),
        }),
      ),
    )

    const error = yield* Effect.flip(AccountV2.use.login("https://one.example.com").pipe(Effect.provide(live(client))))

    expect(error).toBeInstanceOf(AccountV2.AccountTransportError)
    if (error instanceof AccountV2.AccountTransportError) {
      expect(error.method).toBe("POST")
      expect(error.url).toBe("https://one.example.com/auth/device/code")
    }
  }),
)

it.live("orgsByAccount groups orgs per account", () =>
  Effect.gen(function* () {
    yield* persist({
      id: AccountV2.ID.make("user-1"),
      email: "one@example.com",
      url: "https://one.example.com",
      accessToken: AccountV2.AccessToken.make("at_1"),
      refreshToken: AccountV2.RefreshToken.make("rt_1"),
      expiry: Date.now() + outsideEagerRefreshWindow,
      orgID: Option.none(),
    })

    yield* persist({
      id: AccountV2.ID.make("user-2"),
      email: "two@example.com",
      url: "https://two.example.com",
      accessToken: AccountV2.AccessToken.make("at_2"),
      refreshToken: AccountV2.RefreshToken.make("rt_2"),
      expiry: Date.now() + outsideEagerRefreshWindow,
      orgID: Option.none(),
    })

    const seen: Array<string> = []
    const client = HttpClient.make((req) =>
      Effect.gen(function* () {
        seen.push(`${req.method} ${req.url}`)

        if (req.url === "https://one.example.com/api/orgs") {
          return json(req, [org("org-1", "One")])
        }

        if (req.url === "https://two.example.com/api/orgs") {
          return json(req, [org("org-2", "Two A"), org("org-3", "Two B")])
        }

        return json(req, [], 404)
      }),
    )

    const rows = yield* AccountV2.use.orgsByAccount().pipe(Effect.provide(live(client)))

    expect(rows.map((row) => [row.account.id, row.orgs.map((org) => org.id)]).map(([id, orgs]) => [id, orgs])).toEqual([
      [AccountV2.ID.make("user-1"), [AccountV2.OrgID.make("org-1")]],
      [AccountV2.ID.make("user-2"), [AccountV2.OrgID.make("org-2"), AccountV2.OrgID.make("org-3")]],
    ])
    expect(seen).toEqual(["GET https://one.example.com/api/orgs", "GET https://two.example.com/api/orgs"])
  }),
)

it.live("token refresh persists the new token", () =>
  Effect.gen(function* () {
    const id = AccountV2.ID.make("user-1")

    yield* persist({
      id,
      email: "user@example.com",
      url: "https://one.example.com",
      accessToken: AccountV2.AccessToken.make("at_old"),
      refreshToken: AccountV2.RefreshToken.make("rt_old"),
      expiry: Date.now() - 1_000,
      orgID: Option.none(),
    })

    const client = HttpClient.make((req) =>
      Effect.succeed(
        req.url === "https://one.example.com/auth/device/token"
          ? json(req, {
              access_token: "at_new",
              refresh_token: "rt_new",
              expires_in: 60,
            })
          : json(req, {}, 404),
      ),
    )

    const token = yield* AccountV2.use.token(id).pipe(Effect.provide(live(client)))

    expect(Option.getOrThrow(token)).toBeDefined()
    expect(String(Option.getOrThrow(token))).toBe("at_new")

    const value = yield* row(id)
    expect(value).toBeDefined()
    if (!value) return
    expect(value.access_token).toBe(AccountV2.AccessToken.make("at_new"))
    expect(value.refresh_token).toBe(AccountV2.RefreshToken.make("rt_new"))
    expect(value.token_expiry).toBeGreaterThan(Date.now())
  }),
)

it.live("token refreshes before expiry when inside the eager refresh window", () =>
  Effect.gen(function* () {
    const id = AccountV2.ID.make("user-1")

    yield* persist({
      id,
      email: "user@example.com",
      url: "https://one.example.com",
      accessToken: AccountV2.AccessToken.make("at_old"),
      refreshToken: AccountV2.RefreshToken.make("rt_old"),
      expiry: Date.now() + insideEagerRefreshWindow,
      orgID: Option.none(),
    })

    let refreshCalls = 0
    const client = HttpClient.make((req) =>
      Effect.promise(async () => {
        if (req.url === "https://one.example.com/auth/device/token") {
          refreshCalls += 1
          return json(req, {
            access_token: "at_new",
            refresh_token: "rt_new",
            expires_in: 60,
          })
        }

        return json(req, {}, 404)
      }),
    )

    const token = yield* AccountV2.use.token(id).pipe(Effect.provide(live(client)))

    expect(String(Option.getOrThrow(token))).toBe("at_new")
    expect(refreshCalls).toBe(1)

    const value = yield* row(id)
    expect(value).toBeDefined()
    if (!value) return
    expect(value.access_token).toBe(AccountV2.AccessToken.make("at_new"))
    expect(value.refresh_token).toBe(AccountV2.RefreshToken.make("rt_new"))
  }),
)

it.live("concurrent config and token requests coalesce token refresh", () =>
  Effect.gen(function* () {
    const id = AccountV2.ID.make("user-1")

    yield* persist({
      id,
      email: "user@example.com",
      url: "https://one.example.com",
      accessToken: AccountV2.AccessToken.make("at_old"),
      refreshToken: AccountV2.RefreshToken.make("rt_old"),
      expiry: Date.now() - 1_000,
      orgID: Option.some(AccountV2.OrgID.make("org-9")),
    })

    let refreshCalls = 0
    const client = HttpClient.make((req) =>
      Effect.promise(async () => {
        if (req.url === "https://one.example.com/auth/device/token") {
          refreshCalls += 1

          if (refreshCalls === 1) {
            await new Promise((resolve) => setTimeout(resolve, 25))
            return json(req, {
              access_token: "at_new",
              refresh_token: "rt_new",
              expires_in: 60,
            })
          }

          return json(
            req,
            {
              error: "invalid_grant",
              error_description: "refresh token already used",
            },
            400,
          )
        }

        if (req.url === "https://one.example.com/api/config") {
          return json(req, { config: { theme: "light", seats: 5 } })
        }

        return json(req, {}, 404)
      }),
    )

    const [cfg, token] = yield* AccountV2.Service.use((s) =>
      Effect.all([s.config(id, AccountV2.OrgID.make("org-9")), s.token(id)], { concurrency: 2 }),
    ).pipe(Effect.provide(live(client)))

    expect(Option.getOrThrow(cfg)).toEqual({ theme: "light", seats: 5 })
    expect(String(Option.getOrThrow(token))).toBe("at_new")
    expect(refreshCalls).toBe(1)

    const value = yield* row(id)
    expect(value).toBeDefined()
    if (!value) return
    expect(value.access_token).toBe(AccountV2.AccessToken.make("at_new"))
    expect(value.refresh_token).toBe(AccountV2.RefreshToken.make("rt_new"))
  }),
)

it.live("config sends the selected org header", () =>
  Effect.gen(function* () {
    const id = AccountV2.ID.make("user-1")

    yield* persist({
      id,
      email: "user@example.com",
      url: "https://one.example.com",
      accessToken: AccountV2.AccessToken.make("at_1"),
      refreshToken: AccountV2.RefreshToken.make("rt_1"),
      expiry: Date.now() + outsideEagerRefreshWindow,
      orgID: Option.none(),
    })

    const seen: { auth?: string; org?: string } = {}
    const client = HttpClient.make((req) =>
      Effect.gen(function* () {
        seen.auth = req.headers.authorization
        seen.org = req.headers["x-org-id"]

        if (req.url === "https://one.example.com/api/config") {
          return json(req, { config: { theme: "light", seats: 5 } })
        }

        return json(req, {}, 404)
      }),
    )

    const cfg = yield* AccountV2.Service.use((s) => s.config(id, AccountV2.OrgID.make("org-9"))).pipe(
      Effect.provide(live(client)),
    )

    expect(Option.getOrThrow(cfg)).toEqual({ theme: "light", seats: 5 })
    expect(seen).toEqual({
      auth: "Bearer at_1",
      org: "org-9",
    })
  }),
)

it.live("poll stores the account and first org on success", () =>
  Effect.gen(function* () {
    const client = HttpClient.make((req) =>
      Effect.succeed(
        req.url === "https://one.example.com/auth/device/token"
          ? json(req, {
              access_token: "at_1",
              refresh_token: "rt_1",
              token_type: "Bearer",
              expires_in: 60,
            })
          : req.url === "https://one.example.com/api/user"
            ? json(req, { id: "user-1", email: "user@example.com" })
            : req.url === "https://one.example.com/api/orgs"
              ? json(req, [org("org-1", "One")])
              : json(req, {}, 404),
      ),
    )

    const res = yield* AccountV2.Service.use((s) => s.poll(login())).pipe(Effect.provide(live(client)))

    expect(res._tag).toBe("PollSuccess")
    if (res._tag === "PollSuccess") {
      expect(res.email).toBe("user@example.com")
    }

    const current = yield* active
    expect(current).toEqual(
      expect.objectContaining({
        id: "user-1",
        email: "user@example.com",
        active_org_id: "org-1",
      }),
    )
  }),
)

for (const [name, body, expectedTag] of [
  [
    "pending",
    {
      error: "authorization_pending",
      error_description: "The authorization request is still pending",
    },
    "PollPending",
  ],
  [
    "slow",
    {
      error: "slow_down",
      error_description: "Polling too frequently, please slow down",
    },
    "PollSlow",
  ],
  [
    "denied",
    {
      error: "access_denied",
      error_description: "The authorization request was denied",
    },
    "PollDenied",
  ],
  [
    "expired",
    {
      error: "expired_token",
      error_description: "The device code has expired",
    },
    "PollExpired",
  ],
] as const) {
  it.live(`poll returns ${name} for ${body.error}`, () =>
    Effect.gen(function* () {
      const result = yield* poll(body)
      expect(result._tag).toBe(expectedTag)
    }),
  )
}

it.live("poll returns poll error for other OAuth errors", () =>
  Effect.gen(function* () {
    const result = yield* poll({
      error: "server_error",
      error_description: "An unexpected error occurred",
    })

    expect(result._tag).toBe("PollError")
    if (result._tag === "PollError") {
      expect(String(result.cause)).toContain("server_error")
    }
  }),
)
