# Plugins

## Como funciona

Plugins estendem o Canopy com novas funcionalidades.

## Plugins内置

- **GitHub Copilot** — Autocomplete
- **OpenAI** — Provider OpenAI
- **TUI** — Interface terminal
- **Web** — Interface web

## Criar plugin

```typescript
// plugins/meu-plugin/index.ts
export default {
  name: "meu-plugin",
  setup(api) {
    api.on("message", (msg) => {
      console.log("Nova mensagem:", msg)
    })
  }
}
```

## Instalar plugin

```bash
canopy plugin install ./meu-plugin
```

## Listar plugins

```bash
canopy plugin list
```
