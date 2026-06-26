# Providers

## Configurar provider

```bash
canopy config set provider openrouter
canopy config set apiKey sua-chave
```

## Providers disponíveis

### OpenRouter (recomendado)

```bash
canopy config set provider openrouter
canopy config set apiKey sk-or-...
```

Suporta: Claude, GPT-4, Gemini, Llama, Mistral, etc.

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

Rodar modelos locais sem API key.

## Listar modelos

```bash
canopy models
```

## Trocar modelo

```bash
canopy config set model anthropic/claude-3.5-sonnet
```
