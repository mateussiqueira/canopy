export * as AccountV2 from "./account"

import { Cache, Clock, Context, Duration, Effect, Layer, Option, Schedule, Schema, SchemaGetter } from "effect"
import { eq } from "drizzle-orm"
import {
  FetchHttpClient,
  HttpClient,
  HttpClientError,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http"
import { AccountStateTable, AccountTable } from "./account/sql"
import { Database } from "./database/database"
import { serviceUse } from "./effect/service-use"

export const ID = Schema.String.pipe(Schema.brand("AccountID"))
export type ID = Schema.Schema.Type<typeof ID>

export const OrgID = Schema.String.pipe(Schema.brand("OrgID"))
export type OrgID = Schema.Schema.Type<typeof OrgID>

export const AccessToken = Schema.String.pipe(Schema.brand("AccessToken"))
export type AccessToken = Schema.Schema.Type<typeof AccessToken>

export const RefreshToken = Schema.String.pipe(Schema.brand("RefreshToken"))
export type RefreshToken = Schema.Schema.Type<typeof RefreshToken>

export const DeviceCode = Schema.String.pipe(Schema.brand("DeviceCode"))
export type DeviceCode = Schema.Schema.Type<typeof DeviceCode>

export const UserCode = Schema.String.pipe(Schema.brand("UserCode"))
export type UserCode = Schema.Schema.Type<typeof UserCode>

export class Info extends Schema.Class<Info>("Account")({
  id: ID,
  email: Schema.String,
  url: Schema.String,
  active_org_id: Schema.NullOr(OrgID),
}) {}

export class Org extends Schema.Class<Org>("Org")({
  id: OrgID,
  name: Schema.String,
}) {}

export class AccountRepoError extends Schema.TaggedErrorClass<AccountRepoError>()("AccountRepoError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect),
}) {}

export class AccountServiceError extends Schema.TaggedErrorClass<AccountServiceError>()("AccountServiceError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect),
}) {}

export class AccountTransportError extends Schema.TaggedErrorClass<AccountTransportError>()("AccountTransportError", {
  method: Schema.String,
  url: Schema.String,
  description: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Defect),
}) {
  static fromHttpClientError(error: HttpClientError.TransportError): AccountTransportError {
    return new AccountTransportError({
      method: error.request.method,
      url: error.request.url,
      description: error.description,
      cause: error.cause,
    })
  }

  override get message(): string {
    return [
      `Could not reach ${this.method} ${this.url}.`,
      `This failed before the server returned an HTTP response.`,
      this.description,
      `Check your network, proxy, or VPN configuration and try again.`,
    ]
      .filter(Boolean)
      .join("\n")
  }
}

export type AccountError = AccountRepoError | AccountServiceError | AccountTransportError

export class Login extends Schema.Class<Login>("Login")({
  code: DeviceCode,
  user: UserCode,
  url: Schema.String,
  server: Schema.String,
  expiry: Schema.Duration,
  interval: Schema.Duration,
}) {}

export class PollSuccess extends Schema.TaggedClass<PollSuccess>()("PollSuccess", {
  email: Schema.String,
}) {}

export class PollPending extends Schema.TaggedClass<PollPending>()("PollPending", {}) {}

export class PollSlow extends Schema.TaggedClass<PollSlow>()("PollSlow", {}) {}

export class PollExpired extends Schema.TaggedClass<PollExpired>()("PollExpired", {}) {}

export class PollDenied extends Schema.TaggedClass<PollDenied>()("PollDenied", {}) {}

export class PollError extends Schema.TaggedClass<PollError>()("PollError", {
  cause: Schema.Defect,
}) {}

export const PollResult = Schema.Union([PollSuccess, PollPending, PollSlow, PollExpired, PollDenied, PollError])
export type PollResult = Schema.Schema.Type<typeof PollResult>

export type AccountOrgs = {
  account: Info
  orgs: readonly Org[]
}

export type ActiveOrg = {
  account: Info
  org: Org
}

class RemoteConfig extends Schema.Class<RemoteConfig>("RemoteConfig")({
  config: Schema.Record(Schema.String, Schema.Json),
}) {}

const DurationFromSeconds = Schema.Number.pipe(
  Schema.decodeTo(Schema.Duration, {
    decode: SchemaGetter.transform((n) => Duration.seconds(n)),
    encode: SchemaGetter.transform((d) => Duration.toSeconds(d)),
  }),
)

class TokenRefresh extends Schema.Class<TokenRefresh>("TokenRefresh")({
  access_token: AccessToken,
  refresh_token: RefreshToken,
  expires_in: DurationFromSeconds,
}) {}

class DeviceAuth extends Schema.Class<DeviceAuth>("DeviceAuth")({
  device_code: DeviceCode,
  user_code: UserCode,
  verification_uri_complete: Schema.String,
  expires_in: DurationFromSeconds,
  interval: DurationFromSeconds,
}) {}

class DeviceTokenSuccess extends Schema.Class<DeviceTokenSuccess>("DeviceTokenSuccess")({
  access_token: AccessToken,
  refresh_token: RefreshToken,
  token_type: Schema.Literal("Bearer"),
  expires_in: DurationFromSeconds,
}) {}

class DeviceTokenError extends Schema.Class<DeviceTokenError>("DeviceTokenError")({
  error: Schema.String,
  error_description: Schema.String,
}) {
  toPollResult(): PollResult {
    if (this.error === "authorization_pending") return new PollPending()
    if (this.error === "slow_down") return new PollSlow()
    if (this.error === "expired_token") return new PollExpired()
    if (this.error === "access_denied") return new PollDenied()
    return new PollError({ cause: this.error })
  }
}

const DeviceToken = Schema.Union([DeviceTokenSuccess, DeviceTokenError])

class User extends Schema.Class<User>("User")({
  id: ID,
  email: Schema.String,
}) {}

class ClientId extends Schema.Class<ClientId>("ClientId")({ client_id: Schema.String }) {}

class DeviceTokenRequest extends Schema.Class<DeviceTokenRequest>("DeviceTokenRequest")({
  grant_type: Schema.String,
  device_code: DeviceCode,
  client_id: Schema.String,
}) {}

class TokenRefreshRequest extends Schema.Class<TokenRefreshRequest>("TokenRefreshRequest")({
  grant_type: Schema.String,
  refresh_token: RefreshToken,
  client_id: Schema.String,
}) {}

type AccountRow = typeof AccountTable.$inferSelect
const ACCOUNT_STATE_ID = 1
const clientId = "opencode-cli"
const eagerRefreshThresholdMs = Duration.toMillis(Duration.minutes(5))

function normalizeServerUrl(input: string) {
  const url = new URL(input)
  url.search = ""
  url.hash = ""
  const pathname = url.pathname.replace(/\/+$/, "")
  return pathname.length === 0 ? url.origin : `${url.origin}${pathname}`
}

const isTokenFresh = (tokenExpiry: number | null, now: number) =>
  tokenExpiry != null && tokenExpiry > now + eagerRefreshThresholdMs

const mapAccountServiceError =
  (message = "Account service operation failed") =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, AccountError, R> =>
    effect.pipe(Effect.mapError((cause) => accountErrorFromCause(cause, message)))

function accountErrorFromCause(cause: unknown, message: string): AccountError {
  if (cause instanceof AccountServiceError || cause instanceof AccountTransportError) return cause
  if (HttpClientError.isHttpClientError(cause)) {
    if (cause.reason._tag === "TransportError") return AccountTransportError.fromHttpClientError(cause.reason)
    return new AccountServiceError({ message, cause })
  }
  return new AccountServiceError({ message, cause })
}

export interface Interface {
  readonly active: () => Effect.Effect<Option.Option<Info>, AccountError>
  readonly activeOrg: () => Effect.Effect<Option.Option<ActiveOrg>, AccountError>
  readonly list: () => Effect.Effect<Info[], AccountError>
  readonly orgsByAccount: () => Effect.Effect<readonly AccountOrgs[], AccountError>
  readonly remove: (accountID: ID) => Effect.Effect<void, AccountError>
  readonly use: (accountID: ID, orgID: Option.Option<OrgID>) => Effect.Effect<void, AccountError>
  readonly orgs: (accountID: ID) => Effect.Effect<readonly Org[], AccountError>
  readonly config: (accountID: ID, orgID: OrgID) => Effect.Effect<Option.Option<Record<string, unknown>>, AccountError>
  readonly token: (accountID: ID) => Effect.Effect<Option.Option<AccessToken>, AccountError>
  readonly login: (url: string) => Effect.Effect<Login, AccountError>
  readonly poll: (input: Login) => Effect.Effect<PollResult, AccountError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/Account") {}

export const use = serviceUse(Service)

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    const http = yield* HttpClient.HttpClient
    const httpRead = http.pipe(
      HttpClient.retryTransient({
        retryOn: "errors-and-responses",
        times: 2,
        schedule: Schedule.exponential(200).pipe(Schedule.jittered),
      }),
    )
    const httpOk = HttpClient.filterStatusOk(http)
    const httpReadOk = HttpClient.filterStatusOk(httpRead)
    const decode = Schema.decodeUnknownSync(Info)

    const query = <A, E>(effect: Effect.Effect<A, E>) =>
      effect.pipe(Effect.mapError((cause) => new AccountRepoError({ message: "Database operation failed", cause })))

    const current = Effect.fnUntraced(function* () {
      const state = yield* db.select().from(AccountStateTable).where(eq(AccountStateTable.id, ACCOUNT_STATE_ID)).get()
      if (!state?.active_account_id) return
      const account = yield* db.select().from(AccountTable).where(eq(AccountTable.id, state.active_account_id)).get()
      if (!account) return
      return { ...account, active_org_id: state.active_org_id ?? null }
    })

    const state = (accountID: ID, orgID: Option.Option<OrgID>) =>
      db
        .insert(AccountStateTable)
        .values({ id: ACCOUNT_STATE_ID, active_account_id: accountID, active_org_id: Option.getOrNull(orgID) })
        .onConflictDoUpdate({
          target: AccountStateTable.id,
          set: { active_account_id: accountID, active_org_id: Option.getOrNull(orgID) },
        })
        .run()

    const active = Effect.fn("AccountV2.active")(() =>
      query(current()).pipe(Effect.map((row) => (row ? Option.some(decode(row)) : Option.none()))),
    )
    const list = Effect.fn("AccountV2.list")(() =>
      query(
        db
          .select()
          .from(AccountTable)
          .all()
          .pipe(Effect.map((rows) => rows.map((row) => decode({ ...row, active_org_id: null })))),
      ),
    )
    const remove = Effect.fn("AccountV2.remove")((accountID: ID) =>
      query(
        db.transaction((tx) =>
          Effect.gen(function* () {
            yield* tx
              .update(AccountStateTable)
              .set({ active_account_id: null, active_org_id: null })
              .where(eq(AccountStateTable.active_account_id, accountID))
              .run()
            yield* tx.delete(AccountTable).where(eq(AccountTable.id, accountID)).run()
          }),
        ),
      ).pipe(Effect.asVoid),
    )
    const select = Effect.fn("AccountV2.use")((accountID: ID, orgID: Option.Option<OrgID>) =>
      query(state(accountID, orgID)).pipe(Effect.asVoid),
    )
    const getRow = (accountID: ID) =>
      query(db.select().from(AccountTable).where(eq(AccountTable.id, accountID)).get()).pipe(
        Effect.map(Option.fromNullishOr),
      )

    const persistToken = Effect.fnUntraced(function* (input: {
      accountID: ID
      accessToken: AccessToken
      refreshToken: RefreshToken
      expiry: Option.Option<number>
    }) {
      yield* query(
        db
          .update(AccountTable)
          .set({
            access_token: input.accessToken,
            refresh_token: input.refreshToken,
            token_expiry: Option.getOrNull(input.expiry),
          })
          .where(eq(AccountTable.id, input.accountID))
          .run(),
      )
    })
    const persistAccount = Effect.fnUntraced(function* (input: {
      id: ID
      email: string
      url: string
      accessToken: AccessToken
      refreshToken: RefreshToken
      expiry: number
      orgID: Option.Option<OrgID>
    }) {
      const url = normalizeServerUrl(input.url)
      yield* query(
        db.transaction((tx) =>
          Effect.gen(function* () {
            yield* tx
              .insert(AccountTable)
              .values({
                id: input.id,
                email: input.email,
                url,
                access_token: input.accessToken,
                refresh_token: input.refreshToken,
                token_expiry: input.expiry,
              })
              .onConflictDoUpdate({
                target: AccountTable.id,
                set: {
                  email: input.email,
                  url,
                  access_token: input.accessToken,
                  refresh_token: input.refreshToken,
                  token_expiry: input.expiry,
                },
              })
              .run()
            yield* state(input.id, input.orgID)
          }),
        ),
      )
    })
    const executeRead = (request: HttpClientRequest.HttpClientRequest) =>
      httpRead.execute(request).pipe(mapAccountServiceError("HTTP request failed"))
    const executeReadOk = (request: HttpClientRequest.HttpClientRequest) =>
      httpReadOk.execute(request).pipe(mapAccountServiceError("HTTP request failed"))
    const executeEffectOk = <E>(request: Effect.Effect<HttpClientRequest.HttpClientRequest, E>) =>
      request.pipe(
        Effect.flatMap((req) => httpOk.execute(req)),
        mapAccountServiceError("HTTP request failed"),
      )
    const executeEffect = <E>(request: Effect.Effect<HttpClientRequest.HttpClientRequest, E>) =>
      request.pipe(
        Effect.flatMap((req) => http.execute(req)),
        mapAccountServiceError("HTTP request failed"),
      )

    const refreshToken = Effect.fnUntraced(function* (row: AccountRow) {
      const now = yield* Clock.currentTimeMillis
      const response = yield* executeEffectOk(
        HttpClientRequest.post(`${row.url}/auth/device/token`).pipe(
          HttpClientRequest.acceptJson,
          HttpClientRequest.schemaBodyJson(TokenRefreshRequest)(
            new TokenRefreshRequest({
              grant_type: "refresh_token",
              refresh_token: row.refresh_token,
              client_id: clientId,
            }),
          ),
        ),
      )
      const parsed = yield* HttpClientResponse.schemaBodyJson(TokenRefresh)(response).pipe(
        mapAccountServiceError("Failed to decode response"),
      )
      yield* persistToken({
        accountID: row.id,
        accessToken: parsed.access_token,
        refreshToken: parsed.refresh_token,
        expiry: Option.some(now + Duration.toMillis(parsed.expires_in)),
      })
      return parsed.access_token
    })
    const refreshTokenCache = yield* Cache.make<ID, AccessToken, AccountError>({
      capacity: Number.POSITIVE_INFINITY,
      timeToLive: Duration.zero,
      lookup: Effect.fnUntraced(function* (accountID) {
        const maybeAccount = yield* getRow(accountID)
        if (Option.isNone(maybeAccount))
          return yield* new AccountServiceError({ message: "Account not found during token refresh" })
        const now = yield* Clock.currentTimeMillis
        if (isTokenFresh(maybeAccount.value.token_expiry, now)) return maybeAccount.value.access_token
        return yield* refreshToken(maybeAccount.value)
      }),
    })
    const resolveToken = Effect.fnUntraced(function* (row: AccountRow) {
      const now = yield* Clock.currentTimeMillis
      if (isTokenFresh(row.token_expiry, now)) return row.access_token
      return yield* Cache.get(refreshTokenCache, row.id)
    })
    const resolveAccess = Effect.fnUntraced(function* (accountID: ID) {
      const maybeAccount = yield* getRow(accountID)
      if (Option.isNone(maybeAccount)) return Option.none()
      return Option.some({ account: maybeAccount.value, accessToken: yield* resolveToken(maybeAccount.value) })
    })
    const fetchOrgs = Effect.fnUntraced(function* (url: string, accessToken: AccessToken) {
      const response = yield* executeReadOk(
        HttpClientRequest.get(`${url}/api/orgs`).pipe(
          HttpClientRequest.acceptJson,
          HttpClientRequest.bearerToken(accessToken),
        ),
      )
      return yield* HttpClientResponse.schemaBodyJson(Schema.Array(Org))(response).pipe(
        mapAccountServiceError("Failed to decode response"),
      )
    })
    const fetchUser = Effect.fnUntraced(function* (url: string, accessToken: AccessToken) {
      const response = yield* executeReadOk(
        HttpClientRequest.get(`${url}/api/user`).pipe(
          HttpClientRequest.acceptJson,
          HttpClientRequest.bearerToken(accessToken),
        ),
      )
      return yield* HttpClientResponse.schemaBodyJson(User)(response).pipe(
        mapAccountServiceError("Failed to decode response"),
      )
    })
    const token = Effect.fn("AccountV2.token")((accountID: ID) =>
      resolveAccess(accountID).pipe(Effect.map(Option.map((item) => item.accessToken))),
    )
    const orgs = Effect.fn("AccountV2.orgs")(function* (accountID: ID) {
      const resolved = yield* resolveAccess(accountID)
      if (Option.isNone(resolved)) return []
      return yield* fetchOrgs(resolved.value.account.url, resolved.value.accessToken)
    })
    const activeOrg = Effect.fn("AccountV2.activeOrg")(function* () {
      const value = yield* active()
      if (Option.isNone(value) || !value.value.active_org_id) return Option.none<ActiveOrg>()
      const org = (yield* orgs(value.value.id)).find((item) => item.id === value.value.active_org_id)
      return org ? Option.some({ account: value.value, org }) : Option.none<ActiveOrg>()
    })
    const orgsByAccount = Effect.fn("AccountV2.orgsByAccount")(function* () {
      return yield* Effect.forEach(
        yield* list(),
        (account) =>
          orgs(account.id).pipe(
            Effect.catch(() => Effect.succeed([] as readonly Org[])),
            Effect.map((orgs) => ({ account, orgs })),
          ),
        { concurrency: 3 },
      )
    })
    const config = Effect.fn("AccountV2.config")(function* (accountID: ID, orgID: OrgID) {
      const resolved = yield* resolveAccess(accountID)
      if (Option.isNone(resolved)) return Option.none()
      const response = yield* executeRead(
        HttpClientRequest.get(`${resolved.value.account.url}/api/config`).pipe(
          HttpClientRequest.acceptJson,
          HttpClientRequest.bearerToken(resolved.value.accessToken),
          HttpClientRequest.setHeaders({ "x-org-id": orgID }),
        ),
      )
      if (response.status === 404) return Option.none()
      const ok = yield* HttpClientResponse.filterStatusOk(response).pipe(mapAccountServiceError())
      const parsed = yield* HttpClientResponse.schemaBodyJson(RemoteConfig)(ok).pipe(
        mapAccountServiceError("Failed to decode response"),
      )
      return Option.some(parsed.config)
    })
    const login = Effect.fn("AccountV2.login")(function* (server: string) {
      const normalizedServer = normalizeServerUrl(server)
      const response = yield* executeEffectOk(
        HttpClientRequest.post(`${normalizedServer}/auth/device/code`).pipe(
          HttpClientRequest.acceptJson,
          HttpClientRequest.schemaBodyJson(ClientId)(new ClientId({ client_id: clientId })),
        ),
      )
      const parsed = yield* HttpClientResponse.schemaBodyJson(DeviceAuth)(response).pipe(
        mapAccountServiceError("Failed to decode response"),
      )
      return new Login({
        code: parsed.device_code,
        user: parsed.user_code,
        url: `${normalizedServer}${parsed.verification_uri_complete}`,
        server: normalizedServer,
        expiry: parsed.expires_in,
        interval: parsed.interval,
      })
    })
    const poll = Effect.fn("AccountV2.poll")(function* (input: Login) {
      const response = yield* executeEffect(
        HttpClientRequest.post(`${input.server}/auth/device/token`).pipe(
          HttpClientRequest.acceptJson,
          HttpClientRequest.schemaBodyJson(DeviceTokenRequest)(
            new DeviceTokenRequest({
              grant_type: "urn:ietf:params:oauth:grant-type:device_code",
              device_code: input.code,
              client_id: clientId,
            }),
          ),
        ),
      )
      const parsed = yield* HttpClientResponse.schemaBodyJson(DeviceToken)(response).pipe(
        mapAccountServiceError("Failed to decode response"),
      )
      if (parsed instanceof DeviceTokenError) return parsed.toPollResult()
      const [account, remoteOrgs] = yield* Effect.all(
        [fetchUser(input.server, parsed.access_token), fetchOrgs(input.server, parsed.access_token)],
        { concurrency: 2 },
      )
      const now = yield* Clock.currentTimeMillis
      yield* persistAccount({
        id: account.id,
        email: account.email,
        url: input.server,
        accessToken: parsed.access_token,
        refreshToken: parsed.refresh_token,
        expiry: now + Duration.toMillis(parsed.expires_in),
        orgID: remoteOrgs.length ? Option.some(remoteOrgs[0].id) : Option.none(),
      })
      return new PollSuccess({ email: account.email })
    })

    return Service.of({ active, activeOrg, list, orgsByAccount, remove, use: select, orgs, config, token, login, poll })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer), Layer.provide(FetchHttpClient.layer))
