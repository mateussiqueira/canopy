# Getting Started

## Prerequisites

- Bun 1.0+
- Git

## Installation

### Via script (recommended)

```bash
curl -fsSL https://canopy.dev/install | bash
```

### From source

```bash
git clone https://github.com/mateussiqueira/canopy.git
cd canopy
bun install
bun run build
```

## Configuration

Canopy uses `~/.canopy/config.json`:

```json
{
  "provider": "openrouter",
  "model": "anthropic/claude-3.5-sonnet",
  "apiKey": "your-api-key-here"
}
```

## Run

```bash
canopy
```

## Supported Providers

- OpenRouter
- OpenAI
- Anthropic
- Bedrock
- DeepSeek
- GLM
- MLX Local
