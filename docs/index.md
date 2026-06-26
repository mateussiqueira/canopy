---
layout: home
hero:
  name: Canopy
  text: AI coding agent
  tagline: Fork do OpenCode com melhorias em estabilidade, segurança e performance.
  actions:
    - theme: brand
      text: Começar
      link: /guides/getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/mateussiqueira/canopy
features:
  - title: Context Overflow Recovery
    details: Sessões longas não matam o contexto. Recuperação automática.
  - title: Data Safe Agent
    details: Proteção contra delete acidental de arquivos críticos.
  - title: Extended Thinking
    details: Suporte a Bedrock Converse para Claude extended thinking.
  - title: MLX Local
    details: Roda modelos locais via MLX. Sem dependência de APIs externas.
---

# Canopy

Canopy é um fork do OpenCode focado em confiabilidade e experiência do desenvolvedor.

## O que mudou

- **Overflow recovery** — Sessões longas não crasham mais
- **Memória eficiente** — RSS menor em sessões com muitas tool calls
- **Proteção de dados** — Não deleta backups acidentalmente
- **Extended thinking** — Claude com raciocínio estendido via Bedrock
- **Desktop side sessions** — Conversas paralelas no app desktop

## Stack

- **Runtime:** Bun
- **Language:** TypeScript
- **UI:** SolidJS + Tailwind
- **Server:** Hono
- **Database:** SQLite (Drizzle)
- **LLM:** Vercel AI SDK

## Quick start

```bash
# Via script
curl -fsSL https://canopy.dev/install | bash

# Do zero
git clone https://github.com/mateussiqueira/canopy.git
cd canopy
bun install
bun run build
```

## Uso

```bash
canopy                    # inicia no diretório atual
canopy /path/to/project   # abre projeto específico
```
