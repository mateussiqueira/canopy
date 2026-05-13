# 01 First Pass

Status: concrete implementation plan. Refine this document before coding.

This pass should produce the smallest end-to-end system that can drive the TUI against the real app/backend in a deterministic simulation environment and assert only that the app does not crash.

## Scope

Build these pieces first:

- Mock `AppFileSystem.Service` layer.
- Mock `FetchHttpClient` layer with schema-generated responses through `toArbitrary()`.
- Backend simulation control endpoint.
- Mock LLM provider controlled by the endpoint.
- OpenTUI fake renderer/screen-buffer/interactable-element access.
- Basic action generator that drives the TUI forward.

## Non-Goals

- No semantic graph yet.
- No advanced properties beyond no-crash.
- No fake clock/timer control yet.
- No shrinking yet.
- No broad replacement of app services.

## Architecture Rules

- Load the normal app by default.
- Keep overrides narrow and explicit.
- The first core overrides are `AppFileSystem.Service` and `FetchHttpClient.layer`.
- Do not replace `Provider.Service`, `SessionPrompt.Service`, `ToolRegistry.Service`, or the route tree wholesale unless we prove a narrow seam is impossible.
- Force `OPENCODE_DB=:memory:` before any code imports `storage/db.ts`.
- Run local simulation under `sandbox-exec` using the old branch setup as the starting point.
- Do not use prompt text for simulation control.

## Target End-To-End Flow

1. Start opencode through the simulation runner.
2. Runner sets `OPENCODE_DB=:memory:` before backend modules load.
3. Runner installs the mock filesystem and mock HTTP client as narrow core overrides.
4. Runner starts under `sandbox-exec` with host writes denied and external network denied.
5. Runner mounts the TUI with a fake OpenTUI renderer instead of a real terminal.
6. Test calls the simulation endpoint to seed filesystem/network/LLM state.
7. Action generator performs one TUI action.
8. Backend handles real app requests and uses endpoint-provided LLM scripts.
9. Runner waits for quiescence.
10. Built-in no-crash property checks TUI and backend errors.

## Step 1: Mock AppFileSystem

Goal: backend-visible project/config/state files live in memory and never hit the host filesystem.

Implementation shape:

- Add `packages/opencode/src/testing/simulation/filesystem.ts`.
- Implement an in-memory filesystem that can back `AppFileSystem.Service`.
- Seed it from JSON fixtures supplied through the simulation endpoint or runner config.
- Serialize it into replay traces.
- Fail unsupported operations with typed simulation errors instead of silently falling back to host FS.
- Add a minimal route/server startup override for `AppFileSystem.Service` only.
- Use the old branch's Bun preload/plugin redirection only for code paths that bypass `AppFileSystem.Service`.
- Let `sandbox-exec` catch any remaining direct `fs`, `Bun.file`, or process-level filesystem access.

Required capabilities:

- Files and directories.
- Text and binary content.
- Deterministic `stat` metadata.
- Deterministic path resolution for workspace root, cwd, home, config, state, and temp.
- Reads and writes used by tools and config loading.
- Directory listing and recursive traversal for glob/grep equivalents.
- Snapshot/diff support or enough primitives for existing snapshot code to work.

Todos:

- [x] Inspect `AppFileSystem.Service` interface and all methods used by backend code.
- [x] List direct `@/util/filesystem`, `fs`, and `Bun.file` bypasses that matter in simulation mode.
- [x] Define mock filesystem data model and fixture JSON format.
- [x] Implement the `AppFileSystem.Service` layer.
- [x] Add typed errors for unsupported operations and host-FS escapes.
- [x] Add activation path from the simulation runner into app startup.
- [x] Add a tiny fixture that includes `opencode.json`, a workspace root, and a few files.
- [ ] Verify read/glob/grep/write/edit use the mock filesystem.
- [ ] Verify sandbox denies host writes when a bypass is introduced.

## Step 2: Mock FetchHttpClient

Goal: no backend code makes external network calls. Calls either return generated deterministic mock data or fail with a typed simulation error.

Implementation shape:

- Add `packages/opencode/src/testing/simulation/network.ts`.
- Provide a narrow replacement for `FetchHttpClient.layer` / `HttpClient.HttpClient` in simulation startup.
- Allow loopback only when needed for local app/TUI communication.
- Deny all non-loopback network by default.
- Add a response registry controlled by the simulation endpoint.
- For registered schemas, generate deterministic data with `toArbitrary()` and the run seed.

Schema inference problem:

- Raw HTTP requests do not always carry the desired response schema.
- First implementation should find where schema information exists for each network call path.
- If the schema is not available from the raw `HttpClient` call, add a small registry keyed by request matcher and schema.
- The endpoint can register `{ matcher, schema, seedOffset }`, and the mock client can call `toArbitrary(schema)` to generate the response.
- Unknown requests should fail loudly instead of returning generic data.

Todos:

- [ ] Locate all backend uses of `HttpClient.HttpClient`, raw `fetch`, provider SDK fetches, webfetch/websearch/share/update paths.
- [ ] Decide where `toArbitrary()` lives or which package exports it.
- [ ] Define request matcher shape: method, URL pattern, headers, body predicate.
- [ ] Define schema registration shape for generated responses.
- [ ] Implement seeded response generation with `toArbitrary()`.
- [ ] Add loopback allowlist handling.
- [ ] Add typed simulation error for unregistered non-loopback request.
- [ ] Verify sandbox also blocks external network if mock client is bypassed.

## Step 3: Control Endpoint And Mock LLM Provider

Goal: tests control backend behavior through an endpoint, and the model follows endpoint-provided scripts through the real prompt/session pipeline.

Implementation shape:

- Add simulation control state under `packages/opencode/src/testing/simulation/service.ts`.
- Add HTTP routes under a simulation-gated path like `/experimental/simulation/*`.
- Keep the route inaccessible unless simulation mode is explicitly enabled.
- Register/configure a local mock provider/model through the normal provider path.
- The mock model reads scripts from simulation control state.
- No JSON-in-prompt fallback.
- Missing script means typed simulation error.

Initial endpoints:

- `POST /experimental/simulation/reset`
- `POST /experimental/simulation/filesystem/seed`
- `POST /experimental/simulation/network/register`
- `POST /experimental/simulation/llm/enqueue`
- `GET /experimental/simulation/snapshot`

Initial LLM script:

```ts
type LLMScriptAction =
  | { type: "text"; content: string }
  | { type: "thinking"; content: string }
  | { type: "tool_call"; name: string; input: Record<string, unknown> }
  | { type: "list_tools" }
  | { type: "error"; message: string }

type LLMScript = {
  steps: LLMScriptAction[][]
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
  finish?: "stop" | "tool-calls" | "error" | "length" | "unknown"
}
```

Keep the old useful rule: step `0` runs before tool results, step `N` runs after `N` tool-result rounds.

Todos:

- [ ] Define simulation mode activation flag/env.
- [ ] Add simulation control state and reset semantics.
- [ ] Add gated simulation endpoints.
- [ ] Decide raw route vs typed HttpApi route. If typed, regenerate JS SDK.
- [ ] Implement mock provider/model on the normal provider path.
- [ ] Port the useful stream chunk behavior from the old branch to the current AI SDK interface.
- [ ] Make missing scripts fail with a typed simulation error.
- [ ] Record consumed script step in simulation snapshot.
- [ ] Verify `session.prompt_async` exercises real `SessionPrompt` and `SessionProcessor`.

## Step 4: OpenTUI Fake Renderer And Interactable Elements

Goal: run the TUI without a real terminal, inspect the screen buffer, and discover/act on interactable elements.

Known starting points:

- Current TUI creates a real renderer in `packages/opencode/src/cli/cmd/tui/app.tsx` through `createCliRenderer(...)`.
- Existing tests use `@opentui/solid` `testRender(...)`.
- Existing tests use `@opentui/core/testing` `createTestRenderer(...)` for renderer snapshots.

Implementation shape:

- Add a renderer factory/testing hook to `tui(...)` so tests can pass a fake renderer.
- Do not render to a real terminal in simulation mode.
- Investigate OpenTUI APIs for walking the render tree and extracting focusable/clickable/editable elements.
- Investigate OpenTUI APIs for reading the screen buffer from the fake renderer.
- If OpenTUI does not expose enough semantic information, add a small TUI semantic registry later. Do not block first pass on a full registry.

Todos:

- [ ] Inspect `@opentui/core/testing` `createTestRenderer` capabilities.
- [ ] Inspect `@opentui/solid` `testRender` capabilities.
- [ ] Determine how to get a screen buffer string/snapshot from the fake renderer.
- [ ] Determine how to iterate renderables and identify interactable elements.
- [ ] Add a minimal renderer factory override to `tui(...)` or app startup.
- [ ] Expose prompt ref, route, sync state, keymap, and renderer to the simulation harness.
- [ ] Verify TUI starts in fake renderer with no real terminal output.
- [ ] Verify screen buffer can be captured after a render.

## Step 5: Basic Action Generator

Goal: drive the TUI forward with generated actions and assert only that the app does not crash.

Implementation shape:

- Add a seeded action generator under `packages/opencode/test/property` or `packages/opencode/src/testing/simulation` depending on whether it needs production imports.
- Start with a tiny action set: submit prompt, key command, paste/type text, click/select visible interactable.
- Prefer OpenTUI/fake-renderer interactions over direct component refs where possible.
- Allow direct prompt ref use for the very first smoke path if OpenTUI interaction APIs are not ready.
- After each action, wait for basic quiescence.
- Built-in property is only `app.does-not-crash`.

Initial no-crash check:

```ts
property({
  name: "app.does-not-crash",
  domains: ["tui", "backend"],
  async check(ctx) {
    ctx.expect(ctx.tui.errors).toEqual([])
    ctx.expect(ctx.backend.errors).toEqual([])
  },
})
```

Todos:

- [ ] Define `UIAction` union for the first pass.
- [ ] Implement seeded RNG for action selection.
- [ ] Generate ordinary prompt text and enqueue matching LLM scripts through the control endpoint.
- [ ] Execute actions through fake renderer/OpenTUI APIs where available.
- [ ] Add temporary prompt-ref execution path if needed for first smoke.
- [ ] Wait for quiescence after each action.
- [ ] Capture screen buffer and backend snapshot after each action.
- [ ] Check only `app.does-not-crash`.
- [ ] Persist a simple replay trace with seed, filesystem fixture, network registrations, LLM scripts, actions, and observations.

## First Milestone

The first milestone is one deterministic run that:

- Starts under `sandbox-exec`.
- Uses `OPENCODE_DB=:memory:`.
- Seeds the mock filesystem.
- Mounts the TUI using a fake renderer.
- Enqueues an LLM script through the control endpoint.
- Submits an ordinary prompt through the TUI.
- Receives a mocked model response through the real session pipeline.
- Captures a screen buffer.
- Passes the no-crash property.

## First-Pass Todos

- [x] Mock filesystem layer works.
- [ ] Mock FetchHttpClient works for registered schemas and fails unknown network.
- [ ] Control endpoint can seed filesystem, register network schemas, enqueue LLM scripts, and snapshot state.
- [ ] Mock provider/model consumes endpoint scripts through the real LLM path.
- [ ] TUI runs with fake renderer.
- [ ] Runner can inspect screen buffer.
- [ ] Runner can identify at least one interactable path to submit a prompt.
- [ ] Basic action generator executes multiple deterministic steps.
- [ ] No-crash property runs after each step.
- [ ] Replay trace is written outside the sandbox.
