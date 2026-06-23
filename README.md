<p align="center">
  <picture>
    <source srcset="public/logo.svg" media="(prefers-color-scheme: dark)">
    <img src="public/logo.svg" alt="Canopy logo" width="120">
  </picture>
</p>
<p align="center"><strong>Canopy</strong> — The open source AI coding agent.</p>
<p align="center">
  <a href="https://github.com/mateussiqueira/canopy"><img alt="GitHub" src="https://img.shields.io/github/stars/mateussiqueira/canopy?style=flat-square" /></a>
  <a href="https://github.com/mateussiqueira/canopy/blob/dev/LICENSE"><img alt="License" src="https://img.shields.io/github/license/mateussiqueira/canopy?style=flat-square" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.br.md">Português (Brasil)</a>
</p>

---

Canopy is a fork of [OpenCode](https://github.com/anomalyco/opencode) with focused improvements on reliability, data safety, and developer experience.

### Key Improvements Over Upstream

- **🛡️ Context overflow recovery** — Errors misclassified as "network lost" now trigger compaction instead of killing the session
- **🧠 Memory-efficient** — Reduced RSS growth during long tool-calling sessions
- **🔒 Data-safe agent** — Protection against accidental deletion of backups and critical files
- **⚡ Extended thinking** — Bedrock Converse protocol support for Claude extended thinking
- **🖥️ Desktop side sessions** — Side conversation support in the desktop app (not just TUI)

### Installation

```bash
# YOLO
curl -fsSL https://canopy.dev/install | bash

# From source
git clone https://github.com/mateussiqueira/canopy.git
cd canopy
 bun install
 bun run build
```

### Usage

```bash
# Start coding
canopy

# Open in a specific directory
canopy /path/to/project
```

### Development

```bash
bun install
bun run dev
```

### License

[MIT](LICENSE)
