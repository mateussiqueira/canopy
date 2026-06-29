import { run as runTui, type TuiInput } from "@canopystack/tui"
import { Global } from "@canopystack/core/global"
import { Effect } from "effect"

export function run(input: TuiInput) {
  return runTui(input).pipe(Effect.provide(Global.defaultLayer))
}
