# Providers

## Configure provider

```bash
canopy config set provider openrouter
canopy config set apiKey your-api-key
```

## Available providers

### OpenRouter (recommended)

```bash
canopy config set provider openrouter
canopy config set apiKey sk-or-...
```

Supports: Claude, GPT-4, Gemini, Llama, Mistral, etc.

### OpenAI

```bash
canopy config set provider openai
canopy config set apiKey sk-...
```

### Anthropic

```bash
canopy config set provider anthropic
canopy config set apiKey sk-ant-...
```

### MLX Local

```bash
canopy config set provider mlx-local
canopy config set baseURL http://localhost:8080/v1
```

Run local models without API key.

## List models

```bash
canopy models
```

## Change model

```bash
canopy config set model anthropic/claude-3.5-sonnet
```
