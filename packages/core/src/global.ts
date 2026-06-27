import path from "path"
import fs from "fs/promises"
import { xdgData, xdgCache, xdgConfig, xdgState } from "xdg-basedir"
import os from "os"
import { Context, Effect, Layer } from "effect"
import { Flock } from "./util/flock"
import { Flag } from "./flag/flag"
import { LayerNode } from "./effect/layer-node"

const app = "canopy"

// Support global data on external SSD via CANOPY_GLOBAL_DATA env var
const globalData = process.env.CANOPY_GLOBAL_DATA
const data = globalData ?? path.join(xdgData!, app)
const cache = globalData ? path.join(globalData, "cache") : path.join(xdgCache!, app)
const config = globalData ? path.join(globalData, "config") : path.join(xdgConfig!, app)
const state = globalData ? path.join(globalData, "state") : path.join(xdgState!, app)
const tmp = path.join(os.tmpdir(), app)

const paths = {
  get home() {
    return process.env.CANOPY_TEST_HOME ?? os.homedir()
  },
  data,
  bin: path.join(cache, "bin"),
  log: path.join(data, "log"),
  repos: path.join(data, "repos"),
  cache,
  config,
  state,
  tmp,
  // Global context paths for multi-project support
  sessions: globalData ? path.join(globalData, "sessions") : path.join(data, "sessions"),
  projects: globalData ? path.join(globalData, "projects") : path.join(data, "projects"),
  context: globalData ? path.join(globalData, "context") : path.join(data, "context"),
}

export const Path = paths

Flock.setGlobal({ state })

await Promise.all([
  fs.mkdir(Path.data, { recursive: true }),
  fs.mkdir(Path.config, { recursive: true }),
  fs.mkdir(Path.state, { recursive: true }),
  fs.mkdir(Path.tmp, { recursive: true }),
  fs.mkdir(Path.log, { recursive: true }),
  fs.mkdir(Path.bin, { recursive: true }),
  fs.mkdir(Path.repos, { recursive: true }),
  fs.mkdir(Path.sessions, { recursive: true }),
  fs.mkdir(Path.projects, { recursive: true }),
  fs.mkdir(Path.context, { recursive: true }),
])

export class Service extends Context.Service<Service, Interface>()("@canopy/Global") {}

export interface Interface {
  readonly home: string
  readonly data: string
  readonly cache: string
  readonly config: string
  readonly state: string
  readonly tmp: string
  readonly bin: string
  readonly log: string
  readonly repos: string
  readonly sessions: string
  readonly projects: string
  readonly context: string
}

export function make(input: Partial<Interface> = {}): Interface {
  return {
    home: Path.home,
    data: Path.data,
    cache: Path.cache,
    config: Flag.CANOPY_CONFIG_DIR ?? Path.config,
    state: Path.state,
    tmp: Path.tmp,
    bin: Path.bin,
    log: Path.log,
    repos: Path.repos,
    sessions: Path.sessions,
    projects: Path.projects,
    context: Path.context,
    ...input,
  }
}

export const layer = Layer.effect(
  Service,
  Effect.sync(() => Service.of(make())),
)

export const defaultLayer = layer
export const node = LayerNode.make(layer, [])

export const layerWith = (input: Partial<Interface>) =>
  Layer.effect(
    Service,
    Effect.sync(() => Service.of(make(input))),
  )

export * as Global from "./global"
