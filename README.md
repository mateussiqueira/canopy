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
</p>

---

Canopy é um fork do [OpenCode](https://github.com/anomalyco/opencode) com foco em **economia de tokens**, **model routing inteligente**, e **skills modulares**.

## Diferenciais

- **🧠 Model Routing** — Seleciona automaticamente o modelo mais barato e capaz para cada tarefa: DeepSeek/MiMo para scripts, Kimi para dev, Qwen para investigação, GLM para planejamento.
- **💰 Token Economy** — Prompts otimizados (-66%), descrições de ferramentas enxutas (-30%), compressão de contexto agressiva (-25% por turno).
- **🎓 Skills Modulares** — Skill `job-search` built-in com templates de currículo ATS, otimização de LinkedIn, preparação para entrevista. Suporte PT-BR (CV Aprovado) e EN (Resume Doctor).
- **🔧 System prompts reescritos** — Instruções mais diretas, zero referências mortas, foco em eficiência.
- **⚙️ Config otimizada** — Compaction automático, tool output truncado, primary tools configurados.
- **🔄 Dual env vars** — `CANOPY_*` e `OPENCODE_*` suportados simultaneamente (migração gradual).

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

## Comece por aqui

```bash
# Ajuda
canopy --help

# Iniciar TUI no diretório atual
canopy

# Escolher modelo específico
canopy -m openai/gpt-4o

# Usar skill de recolocação
# Configure em .opencode/opencode.json:
# "skills": { "paths": [".opencode/skills"] }
```

## Licença

Apache 2.0 — veja [LICENSE](LICENSE).
