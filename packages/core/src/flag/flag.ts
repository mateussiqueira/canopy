import { Config } from "effect"

function env(key: string): string | undefined {
  const alt = key.startsWith("OPENCODE_") ? key.replace("OPENCODE_", "CANOPY_") : undefined
  return alt ? (process.env[alt] ?? process.env[key]) : process.env[key]
}

export function truthyEither(key: string) {
  const value = env(key)?.toLowerCase()
  return value === "true" || value === "1"
}

export function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

const copy = env("OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT")
const fff = env("OPENCODE_DISABLE_FFF")

function enabledByExperimental(key: string) {
  const val = env(key)
  const experimental = env("OPENCODE_EXPERIMENTAL")
  return val === undefined ? (experimental?.toLowerCase() === "true" || experimental === "1") : truthyEither(key)
}

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: env("OTEL_EXPORTER_OTLP_ENDPOINT"),
  OTEL_EXPORTER_OTLP_HEADERS: env("OTEL_EXPORTER_OTLP_HEADERS"),

  CANOPY_AUTO_HEAP_SNAPSHOT: truthyEither("OPENCODE_AUTO_HEAP_SNAPSHOT"),
  CANOPY_GIT_BASH_PATH: env("OPENCODE_GIT_BASH_PATH"),
  CANOPY_CONFIG: env("OPENCODE_CONFIG"),
  CANOPY_CONFIG_CONTENT: env("OPENCODE_CONFIG_CONTENT"),
  CANOPY_DISABLE_AUTOUPDATE: truthyEither("OPENCODE_DISABLE_AUTOUPDATE"),
  CANOPY_ALWAYS_NOTIFY_UPDATE: truthyEither("OPENCODE_ALWAYS_NOTIFY_UPDATE"),
  CANOPY_DISABLE_PRUNE: truthyEither("OPENCODE_DISABLE_PRUNE"),
  CANOPY_DISABLE_TERMINAL_TITLE: truthyEither("OPENCODE_DISABLE_TERMINAL_TITLE"),
  CANOPY_SHOW_TTFD: truthyEither("OPENCODE_SHOW_TTFD"),
  CANOPY_DISABLE_AUTOCOMPACT: truthyEither("OPENCODE_DISABLE_AUTOCOMPACT"),
  CANOPY_DISABLE_MODELS_FETCH: truthyEither("OPENCODE_DISABLE_MODELS_FETCH"),
  CANOPY_DISABLE_MOUSE: truthyEither("OPENCODE_DISABLE_MOUSE"),
  CANOPY_FAKE_VCS: env("OPENCODE_FAKE_VCS"),
  CANOPY_SERVER_PASSWORD: env("OPENCODE_SERVER_PASSWORD"),
  CANOPY_SERVER_USERNAME: env("OPENCODE_SERVER_USERNAME"),
  CANOPY_DISABLE_FFF: fff === undefined ? process.platform === "win32" : truthyEither("OPENCODE_DISABLE_FFF"),

  OPENCODE_AUTO_HEAP_SNAPSHOT: truthyEither("OPENCODE_AUTO_HEAP_SNAPSHOT"),
  OPENCODE_GIT_BASH_PATH: env("OPENCODE_GIT_BASH_PATH"),
  OPENCODE_CONFIG: env("OPENCODE_CONFIG"),
  OPENCODE_CONFIG_CONTENT: env("OPENCODE_CONFIG_CONTENT"),
  OPENCODE_DISABLE_AUTOUPDATE: truthyEither("OPENCODE_DISABLE_AUTOUPDATE"),
  OPENCODE_ALWAYS_NOTIFY_UPDATE: truthyEither("OPENCODE_ALWAYS_NOTIFY_UPDATE"),
  OPENCODE_DISABLE_PRUNE: truthyEither("OPENCODE_DISABLE_PRUNE"),
  OPENCODE_DISABLE_TERMINAL_TITLE: truthyEither("OPENCODE_DISABLE_TERMINAL_TITLE"),
  OPENCODE_SHOW_TTFD: truthyEither("OPENCODE_SHOW_TTFD"),
  OPENCODE_DISABLE_AUTOCOMPACT: truthyEither("OPENCODE_DISABLE_AUTOCOMPACT"),
  OPENCODE_DISABLE_MODELS_FETCH: truthyEither("OPENCODE_DISABLE_MODELS_FETCH"),
  OPENCODE_DISABLE_MOUSE: truthyEither("OPENCODE_DISABLE_MOUSE"),
  OPENCODE_FAKE_VCS: env("OPENCODE_FAKE_VCS"),
  OPENCODE_SERVER_PASSWORD: env("OPENCODE_SERVER_PASSWORD"),
  OPENCODE_SERVER_USERNAME: env("OPENCODE_SERVER_USERNAME"),
  OPENCODE_DISABLE_FFF: fff === undefined ? process.platform === "win32" : truthyEither("OPENCODE_DISABLE_FFF"),

  // Experimental
  OPENCODE_EXPERIMENTAL_FILEWATCHER: Config.boolean("OPENCODE_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthyEither("OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  CANOPY_EXPERIMENTAL_FILEWATCHER: Config.boolean("CANOPY_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  CANOPY_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("CANOPY_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  CANOPY_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthyEither("OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),

  OPENCODE_MODELS_URL: env("OPENCODE_MODELS_URL"),
  OPENCODE_MODELS_PATH: env("OPENCODE_MODELS_PATH"),
  OPENCODE_DB: env("OPENCODE_DB"),
  CANOPY_MODELS_URL: env("OPENCODE_MODELS_URL"),
  CANOPY_MODELS_PATH: env("OPENCODE_MODELS_PATH"),
  CANOPY_DB: env("OPENCODE_DB"),

  OPENCODE_WORKSPACE_ID: env("OPENCODE_WORKSPACE_ID"),
  CANOPY_WORKSPACE_ID: env("OPENCODE_WORKSPACE_ID"),
  OPENCODE_EXPERIMENTAL_WORKSPACES: enabledByExperimental("OPENCODE_EXPERIMENTAL_WORKSPACES"),
  CANOPY_EXPERIMENTAL_WORKSPACES: enabledByExperimental("OPENCODE_EXPERIMENTAL_WORKSPACES"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.
  get OPENCODE_DISABLE_PROJECT_CONFIG() {
    return truthyEither("OPENCODE_DISABLE_PROJECT_CONFIG")
  },
  get CANOPY_DISABLE_PROJECT_CONFIG() {
    return truthyEither("OPENCODE_DISABLE_PROJECT_CONFIG")
  },
  get OPENCODE_EXPERIMENTAL_REFERENCES() {
    return enabledByExperimental("OPENCODE_EXPERIMENTAL_REFERENCES")
  },
  get CANOPY_EXPERIMENTAL_REFERENCES() {
    return enabledByExperimental("OPENCODE_EXPERIMENTAL_REFERENCES")
  },
  get OPENCODE_TUI_CONFIG() {
    return env("OPENCODE_TUI_CONFIG")
  },
  get CANOPY_TUI_CONFIG() {
    return env("OPENCODE_TUI_CONFIG")
  },
  get OPENCODE_CONFIG_DIR() {
    return env("OPENCODE_CONFIG_DIR")
  },
  get CANOPY_CONFIG_DIR() {
    return env("OPENCODE_CONFIG_DIR")
  },
  get OPENCODE_PURE() {
    return truthyEither("OPENCODE_PURE")
  },
  get CANOPY_PURE() {
    return truthyEither("OPENCODE_PURE")
  },
  get OPENCODE_PERMISSION() {
    return env("OPENCODE_PERMISSION")
  },
  get CANOPY_PERMISSION() {
    return env("OPENCODE_PERMISSION")
  },
  get OPENCODE_PLUGIN_META_FILE() {
    return env("OPENCODE_PLUGIN_META_FILE")
  },
  get CANOPY_PLUGIN_META_FILE() {
    return env("OPENCODE_PLUGIN_META_FILE")
  },
  get OPENCODE_CLIENT() {
    return env("OPENCODE_CLIENT") ?? "cli"
  },
  get CANOPY_CLIENT() {
    return env("OPENCODE_CLIENT") ?? "cli"
  },
}
