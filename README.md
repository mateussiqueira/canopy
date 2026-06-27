<p align="center">
  <picture>
    <source srcset="public/logo.svg" media="(prefers-color-scheme: dark)">
    <img src="public/logo.svg" alt="Canopy logo" width="120">
  </picture>
</p>
<p align="center"><strong>Canopy</strong> — AI coding agent built for stability, memory efficiency, and developer experience.</p>
<p align="center">
  <a href="https://github.com/mateussiqueira/canopy"><img alt="GitHub" src="https://img.shields.io/github/stars/mateussiqueira/canopy?style=flat-square" /></a>
  <a href="https://github.com/mateussiqueira/canopy/blob/dev/LICENSE"><img alt="License" src="https://img.shields.io/github/license/mateussiqueira/canopy?style=flat-square" /></a>
</p>

---

An AI coding agent focused on:

- **Overflow recovery** — Long sessions don't kill context
- **Memory** — Lower RSS in sessions with many tool calls
- **Security** — Protection against accidental file deletion
- **Extended thinking** — Bedrock Converse support
- **Multi-project** — Work on multiple projects simultaneously
- **Global context** — Persist context on external SSD

## Installation

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

## Multi-Project Support

Canopy supports working on multiple projects simultaneously with isolated contexts.

### Project Commands

```bash
# List all projects
canopy projects list

# Create a new project
canopy projects create "my-app" /path/to/project

# Switch to a project
canopy projects switch <project-id>

# Show current project
canopy projects current

# Delete a project
canopy projects delete <project-id>

# Manage project context
canopy projects context get [project-id]
canopy projects context set <key> <value> [project-id]
```

### Global Context on External SSD

Canopy can store all context on an external SSD for persistence across sessions:

```bash
# Set global data directory
export CANOPY_GLOBAL_DATA=/Volumes/BACKUP/canopy

# Or use the launcher script
/Volumes/BACKUP/canopy/canopy-global.sh
```

## Features

### Performance

- **Ultra-fast project switching**: 0.12ms average (8,333 switches/second)
- **Context reads**: 0.02ms average (50,000 reads/second)
- **Memory efficient**: ~85MB RSS, zero memory leak

### Multi-Project Isolation

Each project has its own isolated context:
- Database connections
- Redis instances
- Environment variables
- Custom configuration

### Global Context

All project data persists on your external SSD:
- Session history
- Project configurations
- Context variables
- Metrics and logs

## Development

```bash
bun install
bun run dev
```

## Testing

```bash
bun run test              # unit tests
bun run test:e2e          # e2e with Playwright
```

## Benchmark

Run the performance benchmark:

```bash
cd packages/core
CANOPY_GLOBAL_DATA=/Volumes/BACKUP/canopy bun run benchmark.ts
```

## Structure

```
packages/
├── core/         # Main logic (agent, session, tools, multi-project)
├── llm/          # LLM client (providers, streaming)
├── opencode/     # CLI/TUI
├── app/          # Web UI
├── ui/           # Components
└── sdk/          # SDK for integrations
```

## License

[MIT](LICENSE)
