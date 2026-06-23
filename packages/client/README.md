# @opencode-ai/client

Private generation target for clients derived directly from OpenCode's authoritative Effect `HttpApi`.

## Entrypoints

- `@opencode-ai/client`: zero-Effect Promise client using `fetch`.
- `@opencode-ai/client/effect`: rich Effect network client using an environment-provided `HttpClient`.
- `@opencode-ai/client/effect/embedded`: scoped embedded OpenCode host backed by Core and the in-memory HTTP router.

The entry modules are intentionally empty until the authoritative public `HttpApi` is composed. Do not generate clients from the current internal server API.
