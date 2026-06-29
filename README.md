<p align="center">
  <picture>
    <source srcset="packages/web/src/assets/logo-dark.svg" media="(prefers-color-scheme: dark)">
    <img src="packages/web/src/assets/logo-light.svg" alt="Canopy logo" width="200">
  </picture>
</p>
<p align="center"><strong>Canopy</strong> — AI coding agent. Smarter, leaner, yours.</p>
<p align="center">
  <a href="https://github.com/mateussiqueira/canopy"><img alt="GitHub" src="https://img.shields.io/github/stars/mateussiqueira/canopy?style=flat-square" /></a>
  <a href="https://github.com/mateussiqueira/canopy/blob/dev/LICENSE"><img alt="License" src="https://img.shields.io/github/license/mateussiqueira/canopy?style=flat-square" /></a>
  <a href="https://canopy-cli.vercel.app/docs"><img alt="Docs" src="https://img.shields.io/badge/docs-canopy--cli-22C55E?style=flat-square" /></a>
</p>

---

Canopy é um fork do [OpenCode](https://github.com/anomalyco/opencode) com foco em **economia de tokens**, **model routing inteligente**, e **skills modulares**.

📖 Documentação: **[canopy-cli.vercel.app/docs](https://canopy-cli.vercel.app/docs)**

## Diferenciais

- **🧠 Model Routing** — Seleciona automaticamente o modelo mais barato e capaz para cada tarefa: DeepSeek/MiMo para scripts, Kimi para dev, Qwen para investigação, GLM para planejamento.
- **💰 Token Economy** — Prompts otimizados (-66%), descrições de ferramentas enxutas (-30%), compressão de contexto agressiva (-25% por turno).
- **🎓 Skills Modulares** — `job-search` (recolocação), `customize-canopy` (config). Suporte PT-BR (CV Aprovado) e EN (Resume Doctor).
- **🔧 System prompts reescritos** — Instruções mais diretas, zero referências mortas, foco em eficiência.
- **⚙️ Config otimizada** — Compaction automático, tool output truncado, primary tools configurados.
- **🔄 Dual env vars** — `CANOPY_*` e `OPENCODE_*` suportados simultaneamente (migração gradual).
- **🌿 Independente** — zero dependência de infra anomalyco. Deploy Vercel próprio.

## Instalação

```bash
# Via script
curl -fsSL https://canopy.dev/install | bash
```

```bash
# Desenvolvimento local
git clone https://github.com/mateussiqueira/canopy.git
cd canopy
bun install
bun run --cwd packages/canopy --conditions=browser src/index.ts
```

```bash
# Via npm/bun global
npm install -g @canopystack/canopy
bun install -g @canopystack/canopy
```

```bash
# Via Homebrew
brew install mateussiqueira/tap/canopy
```

## Comece por aqui

```bash
# Ajuda
canopy --help

# Iniciar TUI no diretório atual
canopy

# Escolher modelo específico
canopy -m openai/gpt-4o

# Ver documentação completa
open https://canopy-cli.vercel.app/docs
```

## Projeto

```
mateussiqueira/canopy
├── packages/
│   ├── canopy/        ← CLI principal (bin: canopy)
│   ├── core/          ← Engine e tipos compartilhados
│   ├── web/           ← Site e documentação (Astro + Starlight)
│   ├── app/           ← Desktop (Electron)
│   ├── tui/           ← Terminal UI
│   └── ...            ← +12 pacotes @canopystack/*
├── canopy-cli.vercel.app  ← Docs online
└── github.com/mateussiqueira/canopy  ← Repositório
```

## Licença

Apache 2.0 — veja [LICENSE](LICENSE).
