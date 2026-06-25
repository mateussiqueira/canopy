# Contribuindo com o Canopy

## Setup

```bash
git clone https://github.com/mateussiqueira/canopy.git
cd canopy
bun install
bun run dev
```

## Estrutura do monorepo

- `packages/core/` — Lógica principal
- `packages/llm/` — Client LLM
- `packages/opencode/` — CLI/TUI
- `packages/app/` — Web UI
- `packages/ui/` — Componentes React

## Desenvolvimento

```bash
bun run dev          # dev mode
bun run build        # build completo
bun run test         # unitários
bun run test:e2e     # e2e
bun run typecheck    # verifica tipos
bun run lint         # lint
```

## Commits

```
feat: feature nova
fix: correção de bug
refactor: refatoração
perf: melhoria de performance
docs: documentação
test: testes
```

## PR Rules

1. Branch da `main`
2. Testes passando
3. Typecheck ok
4. Descrição clara

## Código

- Effect pra async/concorrência
- Schema pra validação
- Sem `any` quando possível
- Funções puras quando dá
