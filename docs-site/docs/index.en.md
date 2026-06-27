# Canopy

The open source AI coding agent for Apple Silicon.

Canopy is a fork of [OpenCode](https://github.com/anomalyco/opencode) with focused improvements on reliability, data safety, and native Apple Silicon support via MLX.

---

## Why Canopy?

| Problem | Canopy Solution |
|---------|----------------|
| OpenCode errors kill sessions | Context overflow recovery (automatic compaction) |
| AI deletes backups | Data-safe agent (trash protection) |
| Cloud models cost money | Run locally on Apple Silicon via MLX |
| One model doesn't fit all tasks | Auto model selection (code, vision, general) |
| Terminal-only is limiting | Native macOS app (Canopy Manager) |

## Key Features

- **🍎 Local MLX Models** — Run 5 models on Apple Silicon GPU, no cloud needed
- **🤖 Auto Model Selection** — `canopy-auto` picks the best model for your task
- **🖥️ Canopy Manager** — Native macOS SwiftUI app ([source](https://github.com/mateussiqueira/canopy-manager))
- **🛡️ Context Overflow Recovery** — Errors that kill other agents trigger compaction here
- **🔒 Data-Safe Agent** — Backup and credential files are trashed, not permanently deleted
- **⚡ Extended Thinking** — Bedrock Converse support for Claude reasoning
- **📦 Pre-compiled Binary** — Ready to use macOS ARM64 binary

## Quick Start

```bash
# Install Canopy
git clone https://github.com/mateussiqueira/canopy.git
cd canopy
bun install
bun run build
ln -sf $(pwd)/packages/opencode/dist/opencode-darwin-arm64/bin/opencode ~/.local/bin/canopy

# Start coding
canopy
```

## Ecosystem

Canopy is part of a larger open-source ecosystem:

| Project | Description | Links |
|---------|-------------|-------|
| **Canopy** | AI coding agent (CLI + Desktop) | [GitHub](https://github.com/mateussiqueira/canopy) |
| **Canopy Manager** | Native macOS app for MLX management | [GitHub](https://github.com/mateussiqueira/canopy-manager) · [Guide](manager.md) |
| **Nidus** | Open-source PaaS (Vercel/Railway alternative) | [GitHub](https://github.com/mateussiqueira/nidus) |
| **Omni CLI** | CLI of CLIs — unified dev tool hub | [GitHub](https://github.com/mateussiqueira/omni-cli) · [Docs](https://omni-cli.vercel.app) |

## Local MLX Setup

Canopy runs models locally on Apple Silicon via [MLX](https://github.com/ml-explore/mlx).

| Model | Size | Best for |
|-------|------|----------|
| Llama 3.2 3B | 1.7 GB | Ultra-fast, classification, summarization |
| Mistral 7B | 3.8 GB | Fast replies, simple Q&A |
| Llama 3.1 8B | 4.2 GB | General conversation, reasoning |
| Qwen 2.5 7B | 4.0 GB | Creative writing, multilingual |
| DeepSeek R1 7B | 4.0 GB | Chain-of-thought, math, logic |
| Gemma 2 9B | 4.9 GB | Instruction following, structured output |
| Qwen 2.5 VL 7B | 5.3 GB | Vision/multimodal (images, OCR) |
| Qwen 2.5 Coder 14B | 7.7 GB | Code, refactoring, debugging |
| DeepSeek Coder V2 Lite | 8.2 GB | Complex code, large refactors |
| Qwen 2.5 14B | 9.4 GB | High-quality reasoning, complex tasks |

See the [MLX guide](mlx.md) for full setup.

## Canopy Manager

Native macOS app (SwiftUI) to manage models, server, and send prompts.

```bash
# Download DMG
open https://github.com/mateussiqueira/canopy-manager/releases

# Or build from source
git clone https://github.com/mateussiqueira/canopy-manager.git
cd canopy-manager
swift build -c release
open .build/release/CanopyManager.app
```

[→ Full Canopy Manager Guide](manager.md)

## Open Source

All projects are MIT-licensed and open on GitHub:

- **Canopy**: [github.com/mateussiqueira/canopy](https://github.com/mateussiqueira/canopy)
- **Canopy Manager**: [github.com/mateussiqueira/canopy-manager](https://github.com/mateussiqueira/canopy-manager)
- **Nidus**: [github.com/mateussiqueira/nidus](https://github.com/mateussiqueira/nidus)

