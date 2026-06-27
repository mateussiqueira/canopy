import { Config } from "effect"

export function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

const copy = process.env["CANOPY_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
const fff = process.env["CANOPY_DISABLE_FFF"]

function enabledByExperimental(key: string) {
  return process.env[key] === undefined ? truthy("CANOPY_EXPERIMENTAL") : truthy(key)
}

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  CANOPY_AUTO_HEAP_SNAPSHOT: truthy("CANOPY_AUTO_HEAP_SNAPSHOT"),
  CANOPY_GIT_BASH_PATH: process.env["CANOPY_GIT_BASH_PATH"],
  CANOPY_CONFIG: process.env["CANOPY_CONFIG"],
  CANOPY_CONFIG_CONTENT: process.env["CANOPY_CONFIG_CONTENT"],
  CANOPY_DISABLE_AUTOUPDATE: truthy("CANOPY_DISABLE_AUTOUPDATE"),
  CANOPY_ALWAYS_NOTIFY_UPDATE: truthy("CANOPY_ALWAYS_NOTIFY_UPDATE"),
  CANOPY_DISABLE_PRUNE: truthy("CANOPY_DISABLE_PRUNE"),
  CANOPY_DISABLE_TERMINAL_TITLE: truthy("CANOPY_DISABLE_TERMINAL_TITLE"),
  CANOPY_SHOW_TTFD: truthy("CANOPY_SHOW_TTFD"),
  CANOPY_DISABLE_AUTOCOMPACT: truthy("CANOPY_DISABLE_AUTOCOMPACT"),
  CANOPY_DISABLE_MODELS_FETCH: truthy("CANOPY_DISABLE_MODELS_FETCH"),
  CANOPY_DISABLE_MOUSE: truthy("CANOPY_DISABLE_MOUSE"),
  CANOPY_FAKE_VCS: process.env["CANOPY_FAKE_VCS"],
  CANOPY_SERVER_PASSWORD: process.env["CANOPY_SERVER_PASSWORD"],
  CANOPY_SERVER_USERNAME: process.env["CANOPY_SERVER_USERNAME"],
  CANOPY_DISABLE_FFF: fff === undefined ? process.platform === "win32" : truthy("CANOPY_DISABLE_FFF"),

  // Experimental
  CANOPY_EXPERIMENTAL_FILEWATCHER: Config.boolean("CANOPY_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  CANOPY_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("CANOPY_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  CANOPY_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("CANOPY_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  CANOPY_MODELS_URL: process.env["CANOPY_MODELS_URL"],
  CANOPY_MODELS_PATH: process.env["CANOPY_MODELS_PATH"],
  CANOPY_DB: process.env["CANOPY_DB"],
  CANOPY_GLOBAL_DATA: process.env["CANOPY_GLOBAL_DATA"],

  CANOPY_WORKSPACE_ID: process.env["CANOPY_WORKSPACE_ID"],
  CANOPY_EXPERIMENTAL_WORKSPACES: enabledByExperimental("CANOPY_EXPERIMENTAL_WORKSPACES"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.
  get CANOPY_DISABLE_PROJECT_CONFIG() {
    return truthy("CANOPY_DISABLE_PROJECT_CONFIG")
  },
  get CANOPY_EXPERIMENTAL_REFERENCES() {
    return enabledByExperimental("CANOPY_EXPERIMENTAL_REFERENCES")
  },
  get CANOPY_TUI_CONFIG() {
    return process.env["CANOPY_TUI_CONFIG"]
  },
  get CANOPY_CONFIG_DIR() {
    return process.env["CANOPY_CONFIG_DIR"]
  },
  get CANOPY_PURE() {
    return truthy("CANOPY_PURE")
  },
  get CANOPY_PERMISSION() {
    return process.env["CANOPY_PERMISSION"]
  },
  get CANOPY_PLUGIN_META_FILE() {
    return process.env["CANOPY_PLUGIN_META_FILE"]
  },
  get CANOPY_CLIENT() {
    return process.env["CANOPY_CLIENT"] ?? "cli"
  },
}
