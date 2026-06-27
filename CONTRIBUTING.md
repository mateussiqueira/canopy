# Contributing to Canopy

## Setup

```bash
git clone https://github.com/mateussiqueira/canopy.git
cd canopy
bun install
bun run dev
```

## Monorepo structure

- `packages/core/` — Core logic
- `packages/llm/` — LLM client
- `packages/opencode/` — CLI/TUI
- `packages/app/` — Web UI
- `packages/ui/` — React components

## Development

```bash
bun run dev          # dev mode
bun run build        # full build
bun run test         # unit tests
bun run test:e2e     # e2e tests
bun run typecheck    # type checking
bun run lint         # linting
```

## Commits

```
feat: new feature
fix: bug fix
refactor: refactoring
perf: performance improvement
docs: documentation
test: tests
```

## PR Rules

1. Branch from `main`
2. Tests passing
3. Typecheck ok
4. Clear description

## Code

- Effect for async/concurrency
- Schema for validation
- No `any` when possible
- Pure functions when feasible
