# MLX Benchmark

Performance results for all 10 MLX models tested locally on Apple Silicon. Same prompt (~100 token output), measured in isolated subprocesses.

## Tokens per Second

| Model | Tok/s | Load Time | RAM |
|-------|-------|-----------|-----|
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

RAM varies between runs due to macOS memory compression and GPU sharing.

## Auto Mode Routing

When Auto (MLX) is selected via `/models`, each prompt is routed to the best model:

| Input | Model | Speed |
|-------|-------|-------|
| Images | Qwen 2.5 VL 7B | 23 tok/s |
| Code (refactor, implement, debug, API, docker...) | Qwen 2.5 Coder 14B | 11 tok/s |
| Math / logic / reasoning | DeepSeek R1 7B | 23 tok/s |
| General conversation | Mistral 7B | 24 tok/s |
