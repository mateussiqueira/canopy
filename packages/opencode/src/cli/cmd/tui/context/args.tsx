import { createSimpleContext } from "./helper"

export interface Args {
  model?: string
  agent?: string
  prompt?: string
  simulationMcpUrl?: () => string | undefined
  continue?: boolean
  sessionID?: string
  fork?: boolean
}

export const { use: useArgs, provider: ArgsProvider } = createSimpleContext({
  name: "Args",
  init: (props: Args) => props,
})
