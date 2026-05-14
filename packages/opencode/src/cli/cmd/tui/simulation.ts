import type { CliRenderer } from "@opentui/core"
import type { CapturedFrame } from "@opentui/core"

export interface SimulationRenderer {
  readonly renderer: CliRenderer
  readonly renderOnce: () => Promise<void>
  readonly screen: () => string
  readonly spans: () => CapturedFrame
  readonly destroy: () => void
}

export async function createSimulationRenderer(): Promise<SimulationRenderer> {
  const { createTestRenderer } = await import("@opentui/core/testing")
  const setup = await createTestRenderer({
    width: Number(process.env.OPENCODE_SIMULATION_TUI_WIDTH) || 100,
    height: Number(process.env.OPENCODE_SIMULATION_TUI_HEIGHT) || 40,
    screenMode: "main-screen",
    consoleMode: "disabled",
  })

  return {
    renderer: setup.renderer,
    renderOnce: setup.renderOnce,
    screen: setup.captureCharFrame,
    spans: setup.captureSpans,
    destroy: () => setup.renderer.destroy(),
  }
}

export * as TuiSimulation from "./simulation"
