<p align="center">
  <a href="https://canopy.dev">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Canopy logo">
    </picture>
  </a>
</p>
<p align="center">Otwartoźródłowy agent kodujący AI.</p>
<p align="center">
  <a href="https://canopy.dev/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/canopy"><img alt="npm" src="https://img.shields.io/npm/v/canopy?style=flat-square" /></a>
  <a href="https://github.com/mateussiqueira/canopy/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/mateussiqueira/canopy/publish.yml?style=flat-square&branch=dev" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

[![Canopy Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://canopy.dev)

---

### Instalacja

```bash
# YOLO
curl -fsSL https://canopy.dev/install | bash

# Menedżery pakietów
npm i -g canopy@latest        # albo bun/pnpm/yarn
scoop install canopy             # Windows
choco install canopy             # Windows
brew install mateussiqueira/tap/canopy # macOS i Linux (polecane, zawsze aktualne)
brew install canopy              # macOS i Linux (oficjalna formuła brew, rzadziej aktualizowana)
sudo pacman -S canopy            # Arch Linux (Stable)
paru -S canopy-bin               # Arch Linux (Latest from AUR)
mise use -g canopy               # dowolny system
nix run nixpkgs#canopy           # lub github:mateussiqueira/canopy dla najnowszej gałęzi dev
```

> [!TIP]
> Przed instalacją usuń wersje starsze niż 0.1.x.

### Aplikacja desktopowa (BETA)

Canopy jest także dostępny jako aplikacja desktopowa. Pobierz ją bezpośrednio ze strony [releases](https://github.com/mateussiqueira/canopy/releases) lub z [canopy.dev/download](https://canopy.dev/download).

| Platforma             | Pobieranie                         |
| --------------------- | ---------------------------------- |
| macOS (Apple Silicon) | `canopy-desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `canopy-desktop-mac-x64.dmg`     |
| Windows               | `canopy-desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm` lub AppImage        |

```bash
# macOS (Homebrew)
brew install --cask canopy-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/canopy-desktop
```

#### Katalog instalacji

Skrypt instalacyjny stosuje następujący priorytet wyboru ścieżki instalacji:

1. `$CANOPY_INSTALL_DIR` - Własny katalog instalacji
2. `$XDG_BIN_DIR` - Ścieżka zgodna ze specyfikacją XDG Base Directory
3. `$HOME/bin` - Standardowy katalog binarny użytkownika (jeśli istnieje lub można go utworzyć)
4. `$HOME/.canopy/bin` - Domyślny fallback

```bash
# Przykłady
CANOPY_INSTALL_DIR=/usr/local/bin curl -fsSL https://canopy.dev/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://canopy.dev/install | bash
```

### Agents

Canopy zawiera dwóch wbudowanych agentów, między którymi możesz przełączać się klawiszem `Tab`.

- **build** - Domyślny agent z pełnym dostępem do pracy developerskiej
- **plan** - Agent tylko do odczytu do analizy i eksploracji kodu
  - Domyślnie odmawia edycji plików
  - Pyta o zgodę przed uruchomieniem komend bash
  - Idealny do poznawania nieznanych baz kodu lub planowania zmian

Dodatkowo jest subagent **general** do złożonych wyszukiwań i wieloetapowych zadań.
Jest używany wewnętrznie i można go wywołać w wiadomościach przez `@general`.

Dowiedz się więcej o [agents](https://canopy.dev/docs/agents).

### Dokumentacja

Więcej informacji o konfiguracji Canopy znajdziesz w [**dokumentacji**](https://canopy.dev/docs).

### Współtworzenie

Jeśli chcesz współtworzyć Canopy, przeczytaj [contributing docs](./CONTRIBUTING.md) przed wysłaniem pull requesta.

### Budowanie na Canopy

Jeśli pracujesz nad projektem związanym z Canopy i używasz "canopy" jako części nazwy (na przykład "canopy-dashboard" lub "canopy-mobile"), dodaj proszę notatkę do swojego README, aby wyjaśnić, że projekt nie jest tworzony przez zespół Canopy i nie jest z nami w żaden sposób powiązany.

---

**Dołącz do naszej społeczności** [Discord](https://discord.gg/canopy) | [X.com](https://x.com/canopy)
