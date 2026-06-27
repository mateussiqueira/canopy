# MLX Local — Modelos Apple Silicon

Canopy suporta modelos locais rodando via MLX (Apple Silicon GPU).

## Requisitos

- Mac com Apple Silicon (M1/M2/M3/M4)
- 8GB+ RAM (16GB+ recomendado para modelos 14B)

## Modelos Disponíveis

| Modelo | Tamanho | Ideal para |
|--------|---------|------------|
| Llama 3.2 3B | 1.7 GB | Respostas ultra-rápidas, classificação, sumarização leve — roda em 8GB RAM |
| Mistral 7B | 3.8 GB | Respostas rápidas, perguntas simples, consultas diretas |
| Llama 3.1 8B | 4.2 GB | Conversas gerais, raciocínio, equilíbrio qualidade/velocidade |
| Qwen 2.5 7B | 4.0 GB | Tarefas gerais, escrita criativa, multilíngue |
| DeepSeek R1 7B | 4.0 GB | Cadeia de pensamento, matemática, lógica — pensa antes de responder |
| Gemma 2 9B | 4.9 GB | Instruções seguras, saída estruturada |
| Qwen 2.5 VL 7B | 5.3 GB | Visão/multimodal — descrever imagens, OCR, perguntas visuais |
| Qwen 2.5 Coder 14B | 7.7 GB | Geração de código, refatoração, debugging, revisão de arquitetura |
| DeepSeek Coder V2 Lite | 8.2 GB | Código complexo, refatorações grandes, revisão de código em escala |
| Qwen 2.5 14B | 9.4 GB | Raciocínio de alta qualidade, conversas com nuance, instruções complexas — precisa 16GB+ |

## Seleção Automática de Modelo

O comando `canopy-auto` escolhe o modelo ideal baseado na tarefa:

```bash
canopy-auto "refatore essa classe"          # → Qwen2.5-Coder-14B
canopy-auto "me explique X"                 # → Mistral-7B
canopy-auto --image foto.jpg "descreva"     # → Qwen2.5-VL-7B
canopy-auto --code "implemente uma API"     # → força código
canopy-auto --fast "qual a capital"         # → força rápido
canopy-auto --dry-run "teste"               # → só mostra o modelo
```

### Regras de Seleção

- **Código** (refactor, implement, class, API, docker, etc.) → Qwen2.5-Coder-14B
- **Refatoração grande / arquitetura complexa** → DeepSeek-Coder-V2-Lite
- **Matemática / raciocínio / lógica** → DeepSeek-R1-7B
- **Visão / imagem** (`--image`) → Qwen2.5-VL-7B
- **Prompt longo** (>500 chars) → Qwen2.5-14B (ou Llama-3.1-8B se <16GB RAM)
- **Tarefas leves / rápidas** → Llama-3.2-3B ou Mistral-7B
- **Padrão** → Mistral-7B (mais rápido)

## Uso Manual

Instalar MLX:
```bash
pip install mlx-lm
```

Iniciar servidor:
```bash
mlx_lm.server --model mlx-community/Meta-Llama-3.1-8B-Instruct-4bit --port 8080
```

Usar com Canopy:
```bash
canopy run "sua tarefa" --model "mlx-local/default_model"
```

## Configuração do Provider

O provider `mlx-local` vai no seu config do Canopy:

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
