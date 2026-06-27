---
layout: home
hero:
  name: Canopy
  text: AI coding agent
  tagline: Built for stability, memory efficiency, and developer experience.
  actions:
    - theme: brand
      text: Get Started
      link: /en/guides/getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/mateussiqueira/canopy
features:
  - title: Context Overflow Recovery
    details: Long sessions don't kill context. Automatic recovery.
  - title: Data Safe Agent
    details: Protection against accidental deletion of critical files.
  - title: Extended Thinking
    details: Bedrock Converse support for Claude extended thinking.
  - title: MLX Local
    details: Run local models via MLX. No external API dependencies.
---

# Canopy

An AI coding agent focused on reliability and developer experience.

## What's included

- **Overflow recovery** — Long sessions don't crash anymore
- **Efficient memory** — Lower RSS with many tool calls
- **Data protection** — No accidental backup deletion
- **Extended thinking** — Claude with extended reasoning via Bedrock
- **Desktop side sessions** — Parallel conversations in desktop app

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

# From source
git clone https://github.com/mateussiqueira/canopy.git
cd canopy
bun install
bun run build
```

## Usage

```bash
canopy                    # starts in current directory
canopy /path/to/project   # opens specific project
```
