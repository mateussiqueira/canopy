# Plugins

## How it works

Plugins extend Canopy with new functionality.

## Built-in plugins

- **GitHub Copilot** — Autocomplete
- **OpenAI** — OpenAI provider
- **TUI** — Terminal interface
- **Web** — Web interface

## Create plugin

```typescript
// plugins/my-plugin/index.ts
export default {
  name: "my-plugin",
  setup(api) {
    api.on("message", (msg) => {
      console.log("New message:", msg)
    })
  }
}
```

## Install plugin

```bash
canopy plugin install ./my-plugin
```

## List plugins

```bash
canopy plugin list
```
