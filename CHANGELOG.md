# Changelog

All notable changes to Canopy will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Model selection persistence in TUI (fixes #34207)
- Install script for Canopy CLI
- Documentation site

### Changed
- Complete rebranding from OpenCode to Canopy
- Environment variables renamed from `OPENCODE_*` to `CANOPY_*`
- Config directory renamed from `.opencode` to `.canopy`
- Package namespace renamed from `@opencode-ai/*` to `@canopystack/*`
- Binary name renamed from `opencode` to `canopy`
- Install directory changed from `~/.opencode/bin` to `~/.canopy/bin`

### Fixed
- Model selection silently reverting after answering (#34207)

## [0.1.0] - 2026-06-27

### Added
- Initial release of Canopy
- Fork of OpenCode with stability and DX improvements
- Overflow recovery for long sessions
- Memory efficiency optimizations
- Security protections against accidental file deletion
- Extended thinking support for Bedrock Converse
