# Changelog

## v0.1.0

Initial release of Canopy, a fork of [OpenCode](https://github.com/anomalyco/opencode).

### Key Improvements Over Upstream

- **Context overflow recovery** — Errors misclassified as "network lost" now trigger compaction instead of killing the session
- **Memory-efficient** — Reduced RSS growth during long tool-calling sessions
- **Data-safe agent** — Protection against accidental deletion of backups and critical files
- **Extended thinking** — Bedrock Converse protocol support for Claude extended thinking
- **Desktop side sessions** — Side conversation support in the desktop app (not just TUI)
