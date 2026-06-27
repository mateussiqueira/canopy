# Benchmark MLX

Resultados de performance dos 10 modelos MLX testados localmente no Apple Silicon. Mesmo prompt (~100 tokens de saída), medido em subprocessos isolados.

## Tokens por Segundo

| Modelo | Tok/s | Load | RAM |
|--------|-------|------|-----|
| Llama 3.2 3B | 55.0 | 2.7s | 2.3 GB |
| Mistral 7B | 23.5 | 4.2s | 325 MB |
| Qwen 2.5 7B | 23.7 | 4.6s | 3.0 GB |
| DeepSeek R1 7B | 22.6 | 5.2s | 467 MB |
| Llama 3.1 8B | 22.1 | 5.1s | 401 MB |
| Gemma 2 9B | 14.7 | 6.1s | 522 MB |
| Qwen 2.5 VL 7B | 23.2 | 4.9s | 955 MB |
| Qwen 2.5 Coder 14B | 11.4 | 8.7s | 403 MB |
| DeepSeek Coder V2 Lite | 16.5 | 9.4s | 235 MB |
| Qwen 2.5 14B | 11.7 | 8.8s | 655 MB |

RAM varia entre execuções devido à compressão de memória do macOS e compartilhamento com GPU.

## Roteamento do Modo Auto

Quando o Auto (MLX) está selecionado via `/models`, cada prompt é roteado pro modelo ideal:

| Entrada | Modelo | Velocidade |
|---------|--------|------------|
| Imagens | Qwen 2.5 VL 7B | 23 tok/s |
| Código (refactor, implement, debug, API, docker...) | Qwen 2.5 Coder 14B | 11 tok/s |
| Matemática / lógica / raciocínio | DeepSeek R1 7B | 23 tok/s |
| Conversa geral | Mistral 7B | 24 tok/s |
