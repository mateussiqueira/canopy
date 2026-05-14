# Simulation MCP Server

Status: first-pass implementation plan.

The simulation MCP server gives agents a simulation-only control surface for the TUI. It lives in the TUI process because only the frontend has direct access to the OpenTUI renderer, captured screen buffer, focused editor, interactable elements, and input/mouse drivers.

## Goals

- Support local stdio mode for agents that launch opencode as an MCP server.
- Support remote loopback HTTP mode for users that want to run the server themselves.
- Expose current TUI state to agents: screen text, structured spans, interactable elements, focused editor, and generated actions.
- Let agents drive the UI through the same `SimulationActions` execution path used by property tests.
- Proxy backend simulation control operations through the existing `/experimental/simulation/*` endpoint.

## Non-Goals

- Do not start this server outside simulation modes.
- Do not add a general remote-control API to production TUI mode.
- Do not replace the property-test action generator; MCP should call the same action generator.
- Do not expose arbitrary host filesystem or network access.

## Location

- Server module: `packages/opencode/src/cli/cmd/tui/simulation-mcp.ts`.
- Startup: `packages/opencode/src/cli/cmd/tui/thread.ts`, next to fake renderer creation.
- Action/state source: `packages/opencode/src/testing/simulation/actions.ts`.
- Backend mutation source: existing simulation control endpoints.

## Modes

Local stdio mode:

- Enabled by `OPENCODE_SIMULATION=1`.
- Uses an OpenTUI test renderer and stdio MCP transport.
- Prints nothing to stdout except MCP protocol messages.
- Intended for agent MCP configs where the agent launches `opencode` as a local command.

Remote headless mode:

- Enabled by `OPENCODE_SIMULATION_BACKEND=1` when `OPENCODE_SIMULATION` is not set.
- Uses an OpenTUI test renderer and streamable HTTP MCP transport.
- Prints the running MCP URL to stdout once.
- Intended for users or harnesses that want to start opencode and connect to the URL manually.

Remote visible TUI mode:

- Enabled by `OPENCODE_SIMULATION_BACKEND=1` when `OPENCODE_SIMULATION` is not set and the user is running the TUI.
- Uses the normal visible TUI renderer and streamable HTTP MCP transport.
- Does not print the URL to stdout because stdout belongs to the TUI.
- Shows `Simulation mode MCP: <url>` at the bottom of the home screen.

## Transport

- Local stdio mode uses `StdioServerTransport`.
- Remote modes use streamable HTTP over loopback.
- Remote modes bind host `127.0.0.1`.
- Remote port is ephemeral by default and configurable through `OPENCODE_SIMULATION_MCP_PORT`.

## Initial Tools

Observation:

- `simulation_screen_get`: return the current captured character frame.
- `simulation_spans_get`: return OpenTUI captured spans.
- `simulation_ui_state_get`: return elements, available generated actions, and focus state.

Driving:

- `simulation_action_execute`: execute one generated action and render once.
- `simulation_action_sequence_execute`: execute a bounded sequence and return the final state.
- `simulation_render_once`: force one render and return the screen/state.

Backend control proxy:

- `simulation_control_reset`
- `simulation_control_filesystem_seed`
- `simulation_control_network_register`
- `simulation_control_llm_enqueue`
- `simulation_control_snapshot`

## Initial Resources

- `simulation://screen`
- `simulation://spans`
- `simulation://ui-state`
- `simulation://backend-snapshot`

## Initial Prompt

- `simulation-driver`: short instructions for agents to inspect state, choose available generated actions, drive the UI, then inspect again.

## Safety

- Guard startup with `OPENCODE_SIMULATION` or `OPENCODE_SIMULATION_BACKEND`.
- Bind to loopback only.
- Close the MCP server before destroying the renderer.
- Keep backend state changes routed through the existing simulation control endpoint.

## Todos

- [x] Add this design document.
- [x] Implement a first-pass TUI-side MCP server.
- [x] Support local stdio mode.
- [x] Support remote loopback mode.
- [x] Print remote headless URL to stdout.
- [x] Show remote background TUI URL on the home screen.
- [x] Expose screen/spans/UI-state observation tools.
- [x] Expose action execution tools using `SimulationActions.execute`.
- [x] Expose backend control proxy tools.
- [x] Add an automated smoke test that starts the MCP server and calls `tools/list` plus one observation tool.
- [ ] Add richer action generation with generated text and bounded sequence traces.
- [ ] Add trace capture for every MCP-driven action.
- [ ] Add protocol-level docs for external agent authors.
