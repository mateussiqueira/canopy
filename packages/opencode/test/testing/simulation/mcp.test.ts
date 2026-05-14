import { describe, expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { TuiSimulation } from "../../../src/cli/cmd/tui/simulation"
import { TuiSimulationMcp } from "../../../src/cli/cmd/tui/simulation-mcp"

describe("TuiSimulationMcp", () => {
  test("exposes simulation tools over MCP", async () => {
    const renderer = await TuiSimulation.createSimulationRenderer()
    const server = await TuiSimulationMcp.createSimulationMcpServer({
      mode: "remote",
      harness: TuiSimulationMcp.harnessFromSimulationRenderer(renderer),
      controlUrl: "http://127.0.0.1:1",
    })
    const client = new Client({ name: "simulation-test", version: "0.0.0" })
    const transport = new StreamableHTTPClientTransport(new URL(server.url!))

    try {
      await client.connect(transport)
      const tools = await client.listTools()
      expect(tools.tools.map((tool) => tool.name)).toContain("simulation_ui_state_get")
      expect(tools.tools.map((tool) => tool.name)).toContain("simulation_control_llm_enqueue")

      const screen = await client.callTool({ name: "simulation_screen_get", arguments: {} })
      expect(screen.content).toBeArray()
    } finally {
      await client.close()
      await server.stop()
      renderer.destroy()
    }
  })
})
