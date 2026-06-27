# 🍎 MLX Local — Apple Silicon Models

Canopy supports local models running via MLX (Apple Silicon GPU) with automatic model selection.

## Requirements

- Mac with Apple Silicon (M1/M2/M3/M4)
- 8GB+ RAM (16GB+ recommended for 14B models)
- Thunderbolt 4 external SSD for model storage

## Available Models

| Model | Size | Best for |
|-------|------|----------|
| Llama-3.2-3B | 1.7 GB | Ultra-fast responses, classification, light summarization — runs on 8GB RAM |
| Mistral-7B | 3.8 GB | Fast replies, simple Q&A, quick lookups |
| Llama-3.1-8B | 4.2 GB | General conversation, reasoning, balanced quality/speed |
| Qwen2.5-7B | 4.0 GB | General tasks, creative writing, multilingual |
| DeepSeek-R1-7B | 4.0 GB | Chain-of-thought, math, logic puzzles — thinks before answering |
| Gemma-2-9B | 4.9 GB | Safe instruction following, structured output, Google ecosystem |
| Qwen2.5-VL-7B | 5.3 GB | Vision/multimodal — describe images, OCR, visual Q&A |
| Qwen2.5-Coder-14B | 7.7 GB | Code generation, refactoring, debugging, architecture review |
| DeepSeek-Coder-V2-Lite | 8.2 GB | Complex code, large refactors, code review at scale |
| Qwen2.5-14B | 9.4 GB | High-quality reasoning, nuanced conversation, complex instructions — needs 16GB+ |

## Automatic Model Selection

The `canopy-auto` command picks the best model based on your task:

```bash
# Examples:
canopy-auto "refactor this class"           # → Qwen2.5-Coder-14B
canopy-auto "explain X"                     # → Mistral-7B
canopy-auto --image photo.jpg "describe"    # → Qwen2.5-VL-7B
canopy-auto --code "implement an API"       # → force code model
canopy-auto --fast "what's the capital"     # → force fast model
canopy-auto --dry-run "test"                # → show model only
```

### Selection Rules

- **Code keywords** (refactor, implement, class, API, docker, etc.) → Qwen2.5-Coder-14B
- **Large refactor / complex architecture** → DeepSeek-Coder-V2-Lite
- **Math / reasoning / logic** → DeepSeek-R1-7B
- **Vision / image** (`--image` flag) → Qwen2.5-VL-7B
- **Long prompt** (>500 chars) → Qwen2.5-14B (or Llama-3.1-8B if <16GB RAM)
- **Lightweight / fast tasks** → Llama-3.2-3B or Mistral-7B
- **Default** → Mistral-7B (fastest)

## Manual Usage

```bash
# 1. Start MLX server:
/Volumes/BACKUP/mlx/start-server.sh

# 2. Use Canopy:
canopy run "your task" --model "mlx-local/default_model"
```

## Provider Config

The `mlx-local` provider is configured at `~/.opencode/opencode.json`:

```json
{
  "provider": {
    "mlx-local": {
      "name": "MLX Local",
      "options": {
        "baseURL": "http://localhost:8080/v1",
        "apiKey": "not-needed"
      },
      "models": {
        "default_model": {
          "id": "default_model",
          "name": "MLX Local",
          "family": "mlx",
          "limit": { "context": 16384, "output": 8192 },
          "cost": { "input": 0, "output": 0 },
          "modalities": { "input": ["text"], "output": ["text"] },
          "status": "active"
        }
      }
    }
  }
}
```
