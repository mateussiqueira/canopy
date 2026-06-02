export * as ConfigAgentPlugin from "./agent"

import path from "path"
import matter from "gray-matter"
import { Effect, Option, Schema } from "effect"
import { AgentV2 } from "../../agent"
import { Config } from "../../config"
import { ConfigAgent } from "../agent"
import { AppFileSystem } from "../../filesystem"
import { ModelV2 } from "../../model"
import { PermissionV2 } from "../../permission"
import { PluginV2 } from "../../plugin"

export const Plugin = PluginV2.define({
  id: PluginV2.ID.make("config-agent"),
  effect: Effect.gen(function* () {
    const agent = yield* AgentV2.Service
    const config = yield* Config.Service
    const fs = yield* AppFileSystem.Service
    const documents = yield* config.get()
    const loadFile = Effect.fnUntraced(function* (directory: string, filepath: string) {
      const text = yield* fs.readFileString(filepath).pipe(Effect.orDie)
      const document = yield* Effect.try({ try: () => matter(text), catch: () => undefined }).pipe(
        Effect.catch(() => Effect.void),
      )
      if (!document) return

      const info = Option.getOrUndefined(
        Schema.decodeUnknownOption(ConfigAgent.Info)(
          { ...document.data, system: document.content.trim() },
          { errors: "all", onExcessProperty: "ignore" },
        ),
      )
      if (!info) return

      const relative = path.relative(directory, filepath).split(path.sep).slice(1).join("/")
      return {
        id: AgentV2.ID.make(relative.slice(0, -path.extname(relative).length)),
        info,
      }
    })
    const files = (yield* Effect.forEach(yield* config.directories(), (directory) =>
      fs.glob("{agent,agents}/**/*.md", { cwd: directory, absolute: true, dot: true, symlink: true }).pipe(
        Effect.orDie,
        Effect.flatMap((items) => Effect.forEach(items, (item) => loadFile(directory, item))),
        Effect.map((items) => items.filter((item): item is NonNullable<typeof item> => item !== undefined)),
      ),
    )).flat()

    yield* agent.update((editor) => {
      const permissions = new Map<AgentV2.ID, PermissionV2.Ruleset>()

      function update(agentID: AgentV2.ID, item: ConfigAgent.Info, disabled: boolean, rules: PermissionV2.Ruleset) {
        if (disabled) {
          editor.remove(agentID)
          permissions.delete(agentID)
          return
        }

        editor.update(agentID, (agent) => {
          if (item.model !== undefined) {
            const model = ModelV2.parse(item.model)
            agent.model = { id: model.modelID, providerID: model.providerID, variant: agent.model?.variant }
          }
          if (item.variant !== undefined && agent.model !== undefined) {
            agent.model.variant = ModelV2.VariantID.make(item.variant)
          }
          if (item.options !== undefined) {
            Object.assign(agent.options.headers, item.options.headers ?? {})
            Object.assign(agent.options.body, item.options.body ?? {})
            Object.assign(agent.options.aisdk.provider, item.options.aisdk?.provider ?? {})
            Object.assign(agent.options.aisdk.request, item.options.aisdk?.request ?? {})
          }
          if (item.system !== undefined) agent.system = item.system
          if (item.description !== undefined) agent.description = item.description
          if (item.mode !== undefined) agent.mode = item.mode
          if (item.hidden !== undefined) agent.hidden = item.hidden
          if (item.color !== undefined) agent.color = item.color
          if (item.steps !== undefined) agent.steps = item.steps
        })

        if (rules.length) permissions.set(agentID, [...(permissions.get(agentID) ?? []), ...rules])
      }

      for (const file of documents) {
        for (const [id, item] of Object.entries(file.info.agents ?? {})) {
          update(AgentV2.ID.make(id), item, item.disabled ?? false, item.permissions ?? [])
        }
      }

      for (const file of files) {
        update(file.id, file.info, file.info.disabled ?? false, file.info.permissions ?? [])
      }

      const global = documents.flatMap((file) => file.info.permissions ?? [])
      for (const current of editor.list()) {
        editor.update(current.id, (agent) => {
          agent.permissions.push(...global, ...(permissions.get(current.id) ?? []))
        })
      }
    })
  }),
})
