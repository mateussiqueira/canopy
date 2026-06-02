import { Effect, Layer, Option } from "effect"
import { AccountV2 } from "@opencode-ai/core/account"

export const empty = Layer.mock(AccountV2.Service)({
  active: () => Effect.succeed(Option.none()),
  activeOrg: () => Effect.succeed(Option.none()),
})

export * as AccountTest from "./account"
