# Getting Started

## Pré-requisitos

- Bun 1.0+
- Git

## Instalação

### Via script (recomendado)

```bash
curl -fsSL https://canopy.dev/install | bash
```

### Do zero

```bash
git clone https://github.com/mateussiqueira/canopy.git
cd canopy
bun install
bun run build
```

## Configuração

O Canopy usa `~/.canopy/config.json`:

```json
{
  "provider": "openrouter",
  "model": "anthropic/claude-3.5-sonnet",
  "apiKey": "sua-chave-aqui"
}
```

## Rodar

```bash
canopy
```

## Providers suportados

- OpenRouter
- OpenAI
- Anthropic
- Bedrock
- DeepSeek
- GLM
- MLX Local
