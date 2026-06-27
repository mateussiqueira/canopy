# Canopy

O agente de IA para programação open-source com suporte nativo a Apple Silicon.

Canopy é um fork do [OpenCode](https://github.com/anomalyco/opencode) com melhorias focadas em confiabilidade, segurança de dados e suporte nativo a Apple Silicon via MLX.

---

## Por que Canopy?

| Problema | Solução Canopy |
|----------|----------------|
| Erros no OpenCode matam sessões | Recuperação de contexto excedido (compactação automática) |
| IA deleta backups | Agente seguro (proteção com lixeira) |
| Modelos na nuvem custam caro | Rode localmente no Apple Silicon via MLX |
| Um modelo não serve pra tudo | Seleção automática (código, visão, geral) |
| Só terminal é limitante | App macOS nativo (Canopy Manager) |

## Funcionalidades

- **🍎 Modelos MLX Locais** — 5 modelos no GPU Apple Silicon, sem nuvem
- **🤖 Seleção Automática** — `canopy-auto` escolhe o melhor modelo pra cada tarefa
- **🖥️ Canopy Manager** — App macOS nativo em SwiftUI ([código](https://github.com/mateussiqueira/canopy-manager))
- **🛡️ Recuperação de Contexto** — Erros que matam outros agentes disparam compactação aqui
- **🔒 Agente Seguro** — Backups e credenciais vão pra lixeira, não são deletados
- **⚡ Extended Thinking** — Suporte a raciocínio Claude via Bedrock
- **📦 Binário Compilado** — Pronto pra usar no macOS ARM64

## Começar

```bash
# Instalar Canopy
git clone https://github.com/mateussiqueira/canopy.git
cd canopy
bun install
bun run build
ln -sf $(pwd)/packages/opencode/dist/opencode-darwin-arm64/bin/opencode ~/.local/bin/canopy

# Começar a programar
canopy
```

## Ecossistema

Canopy faz parte de um ecossistema open-source maior:

| Projeto | Descrição | Links |
|---------|-----------|-------|
| **Canopy** | Agente de IA para programação (CLI + Desktop) | [GitHub](https://github.com/mateussiqueira/canopy) |
| **Canopy Manager** | App macOS nativo para MLX | [GitHub](https://github.com/mateussiqueira/canopy-manager) · [Guia](manager.md) |
| **Nidus** | PaaS open-source (alternativa a Vercel/Railway) | [GitHub](https://github.com/mateussiqueira/nidus) |
| **Omni CLI** | CLI das CLIs — hub unificado de ferramentas dev | [GitHub](https://github.com/mateussiqueira/omni-cli) · [Docs](https://omni-cli.vercel.app) |

## MLX Local

Canopy roda modelos localmente no Apple Silicon via [MLX](https://github.com/ml-explore/mlx).

| Modelo | Tamanho | Ideal para |
|--------|---------|------------|
| Llama 3.2 3B | 1.7 GB | Ultra-rápido, classificação, sumarização |
| Mistral 7B | 3.8 GB | Respostas rápidas, perguntas simples |
| Llama 3.1 8B | 4.2 GB | Conversas gerais, raciocínio |
| Qwen 2.5 7B | 4.0 GB | Escrita criativa, multilíngue |
| DeepSeek R1 7B | 4.0 GB | Cadeia de pensamento, matemática, lógica |
| Gemma 2 9B | 4.9 GB | Instruções seguras, saída estruturada |
| Qwen 2.5 VL 7B | 5.3 GB | Visão/multimodal (imagens, OCR) |
| Qwen 2.5 Coder 14B | 7.7 GB | Código, refatoração, debugging |
| DeepSeek Coder V2 Lite | 8.2 GB | Código complexo, refatorações grandes |
| Qwen 2.5 14B | 9.4 GB | Raciocínio de alta qualidade, tarefas complexas |

Veja o [guia MLX](mlx.md) para configuração completa.

## Canopy Manager

App macOS nativo (SwiftUI) para gerenciar modelos, servidor e enviar prompts.

```bash
# Download DMG
open https://github.com/mateussiqueira/canopy-manager/releases

# Ou build da fonte
git clone https://github.com/mateussiqueira/canopy-manager.git
cd canopy-manager
swift build -c release
open .build/release/CanopyManager.app
```

[→ Guia Completo do Canopy Manager](manager.md)

## Código Aberto

Todos os projetos são licença MIT e estão no GitHub:

- **Canopy**: [github.com/mateussiqueira/canopy](https://github.com/mateussiqueira/canopy)
- **Canopy Manager**: [github.com/mateussiqueira/canopy-manager](https://github.com/mateussiqueira/canopy-manager)
- **Nidus**: [github.com/mateussiqueira/nidus](https://github.com/mateussiqueira/nidus)

