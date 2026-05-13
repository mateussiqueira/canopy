# Property-Based TUI Testing

Status: split planning docs. The first doc is the one to refine before implementation.

The goal is to drive the TUI against the real opencode app/backend while replacing external effects with deterministic simulation boundaries. We should load the normal app by default and keep overrides narrow.

## Decisions

- No JSON-in-prompt control protocol.
- Use a backend control endpoint for LLM scripts and simulation state.
- Force `OPENCODE_DB=:memory:` in simulation runs before backend modules load.
- Reuse the old branch's `sandbox-exec` wrapper/policy as the local safety boundary.
- Build a first-class mock filesystem by overriding `AppFileSystem.Service`.
- Build a mock `FetchHttpClient` boundary for outbound network responses.
- First built-in property: the app does not crash.

## Implementation Docs

- [01 First Pass](./property-based-tui-testing/01-first-pass.md): concrete implementation plan for mock filesystem, mock HTTP client, control endpoint, mock LLM provider, OpenTUI fake renderer research, and a basic TUI action generator.
- [02 Semantic Discovery](./property-based-tui-testing/02-semantic-discovery.md): speculative UI/backend semantic graph work. Refine before implementation.
- [03 Properties And Replay](./property-based-tui-testing/03-properties-and-replay.md): speculative property API, traces, reports, and shrinking. Refine before implementation.
- [04 DST Hardening](./property-based-tui-testing/04-dst-hardening.md): speculative deterministic clock/timer/async work. Refine before implementation.
- [05 Reference Notes](./property-based-tui-testing/05-reference-notes.md): current code map and prior-branch notes.

## Project Todos

- [ ] Finish and approve `01-first-pass.md`.
- [ ] Implement the first-pass simulation environment.
- [ ] Run a TUI-driven no-crash smoke generator against the simulated backend.
- [ ] Revisit and refine `02-semantic-discovery.md` before semantic graph work.
- [ ] Revisit and refine `03-properties-and-replay.md` before adding more properties.
- [ ] Revisit and refine `04-dst-hardening.md` before adding fake time or async interleaving control.
