export * as MultiProject from "./multi-project"

import { Context, Effect, Layer } from "effect"
import path from "path"
import fs from "fs"
import { Global } from "./global"
import { LayerNode } from "./effect/layer-node"

// Project ID
export type ProjectID = string

// Project info interface
export interface ProjectInfo {
  readonly id: ProjectID
  readonly name: string
  readonly path: string
  readonly createdAt: number
  readonly lastAccessedAt: number
  readonly context?: Record<string, string>
}

// Mutable project store for internal use
interface MutableProjectStore {
  projects: Record<string, ProjectInfo>
  currentProject: string | null
}

// Multi-project service interface
export interface Interface {
  readonly listProjects: () => ProjectInfo[]
  readonly getProject: (id: string) => ProjectInfo | undefined
  readonly createProject: (input: { name: string; path: string }) => ProjectInfo
  readonly deleteProject: (id: string) => void
  readonly switchProject: (id: string) => ProjectInfo | undefined
  readonly getCurrentProject: () => ProjectInfo | undefined
  readonly updateProjectContext: (id: string, context: Record<string, string>) => boolean
  readonly getProjectContext: (id: string) => Record<string, string>
}

export class Service extends Context.Service<Service, Interface>()("@canopy/MultiProject") {}

// Store file path
const getStorePath = () => path.join(Global.Path.projects, "projects.json")

// In-memory cache to avoid repeated disk reads
let cachedStore: MutableProjectStore | null = null
let lastModified = 0

// Load store from disk with caching
const loadStore = (): MutableProjectStore => {
  try {
    const stat = fs.statSync(getStorePath())
    const mtime = stat.mtimeMs

    // Return cache if file hasn't changed
    if (cachedStore && mtime === lastModified) {
      return cachedStore
    }

    const data = fs.readFileSync(getStorePath(), "utf-8")
    cachedStore = JSON.parse(data)
    lastModified = mtime
    return cachedStore
  } catch {
    cachedStore = { projects: {}, currentProject: null }
    return cachedStore
  }
}

// Save store to disk and update cache
const saveStore = (store: MutableProjectStore): void => {
  fs.writeFileSync(getStorePath(), JSON.stringify(store, null, 2))
  cachedStore = store
  lastModified = Date.now()
}

// Invalidate cache
const invalidateCache = (): void => {
  cachedStore = null
}

// Generate project ID
const generateProjectID = (): ProjectID => `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

// Singleton instance
let serviceInstance: Interface | null = null

const createService = (): Interface => {
  if (serviceInstance) {
    return serviceInstance
  }

  serviceInstance = {
    listProjects: () => {
      const store = loadStore()
      return Object.values(store.projects).sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
    },

    getProject: (id: string) => {
      const store = loadStore()
      return store.projects[id]
    },

    createProject: (input: { name: string; path: string }) => {
      const store = loadStore()
      const id = generateProjectID()
      const now = Date.now()

      const project: ProjectInfo = {
        id,
        name: input.name,
        path: input.path,
        createdAt: now,
        lastAccessedAt: now,
        context: {},
      }

      store.projects[id] = project
      saveStore(store)

      // Create project directory
      try {
        fs.mkdirSync(path.join(Global.Path.projects, id), { recursive: true })
      } catch (e) {
        // Ignore directory creation errors
      }

      return project
    },

    deleteProject: (id: string) => {
      const store = loadStore()
      delete store.projects[id]
      if (store.currentProject === id) {
        store.currentProject = null
      }
      saveStore(store)

      // Remove project directory
      try {
        fs.rmSync(path.join(Global.Path.projects, id), { recursive: true, force: true })
      } catch (e) {
        // Ignore removal errors
      }
    },

    switchProject: (id: string) => {
      const store = loadStore()
      const project = store.projects[id]
      if (!project) {
        return undefined
      }

      store.currentProject = id
      const updatedProject: ProjectInfo = {
        ...project,
        lastAccessedAt: Date.now(),
      }
      store.projects[id] = updatedProject
      saveStore(store)

      return updatedProject
    },

    getCurrentProject: () => {
      const store = loadStore()
      if (!store.currentProject) return undefined
      return store.projects[store.currentProject]
    },

    updateProjectContext: (id: string, context: Record<string, string>) => {
      const store = loadStore()
      const project = store.projects[id]
      if (!project) {
        return false
      }

      const updatedProject: ProjectInfo = {
        ...project,
        context: { ...project.context, ...context },
        lastAccessedAt: Date.now(),
      }
      store.projects[id] = updatedProject
      saveStore(store)

      // Save context to project directory
      try {
        fs.writeFileSync(
          path.join(Global.Path.projects, id, "context.json"),
          JSON.stringify(updatedProject.context, null, 2)
        )
      } catch (e) {
        // Ignore file write errors
      }

      return true
    },

    getProjectContext: (id: string) => {
      const store = loadStore()
      const project = store.projects[id]
      if (!project) {
        return {}
      }

      // Try to load context from file
      try {
        const contextPath = path.join(Global.Path.projects, id, "context.json")
        const data = fs.readFileSync(contextPath, "utf-8")
        return JSON.parse(data)
      } catch {
        return project.context || {}
      }
    },
  }

  return serviceInstance
}

export const layer = Layer.succeed(Service, {
  ...createService(),
})

export const defaultLayer = layer
export const node = LayerNode.make(layer, [])

// Export for direct usage without Effect
export const createMultiProjectService = createService
