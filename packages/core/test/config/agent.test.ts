import fs from "fs/promises"
import path from "path"
import { describe, expect } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import { AgentV2 } from "@opencode-ai/core/agent"
import { Config } from "@opencode-ai/core/config"
import { ConfigAgentPlugin } from "@opencode-ai/core/config/plugin/agent"
import { AppFileSystem } from "@opencode-ai/core/filesystem"
import { PermissionV2 } from "@opencode-ai/core/permission"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { tmpdir } from "../fixture/tmpdir"
import { testEffect } from "../lib/effect"

const it = testEffect(Layer.mergeAll(AgentV2.locationLayer, AppFileSystem.defaultLayer))
const decode = Schema.decodeUnknownSync(Config.Info)

describe("ConfigAgentPlugin.Plugin", () => {
  it.effect("applies global permissions between built-in and agent-specific permissions", () =>
    Effect.gen(function* () {
      const agents = yield* AgentV2.Service
      const build = AgentV2.ID.make("build")
      const defaults = yield* agents.transform()

      yield* defaults((editor) =>
        editor.update(build, (agent) => {
          agent.mode = "primary"
          agent.permissions.push({ action: "bash", resource: "*", effect: "allow" })
        }),
      )

      const config = Config.Service.of({
        directories: () => Effect.succeed([]),
        get: () =>
          Effect.succeed([
            new Config.Loaded({
              source: { type: "memory" },
              info: decode({
                permissions: [{ action: "bash", resource: "*", effect: "ask" }],
                agents: {
                  build: {
                    permissions: [{ action: "bash", resource: "git *", effect: "allow" }],
                  },
                  reviewer: {
                    model: "openrouter/openai/gpt-5",
                    description: "Review changes",
                    mode: "subagent",
                    permissions: [{ action: "edit", resource: "*", effect: "deny" }],
                  },
                  removed: { description: "Removed later" },
                },
              }),
            }),
            new Config.Loaded({
              source: { type: "memory" },
              info: decode({
                agents: {
                  reviewer: { variant: "high", hidden: true },
                  removed: { disabled: true },
                },
              }),
            }),
          ]),
      })

      yield* ConfigAgentPlugin.Plugin.effect.pipe(
        Effect.provideService(Config.Service, config),
        Effect.provideService(AgentV2.Service, agents),
      )

      const buildAgent = yield* agents.get(build)
      if (!buildAgent) throw new Error("expected configured build agent")
      expect(buildAgent.permissions).toEqual([
        { action: "bash", resource: "*", effect: "allow" },
        { action: "bash", resource: "*", effect: "ask" },
        { action: "bash", resource: "git *", effect: "allow" },
      ])
      expect(PermissionV2.evaluate("bash", "git status", buildAgent.permissions).effect).toBe("allow")
      expect(PermissionV2.evaluate("bash", "bun test", buildAgent.permissions).effect).toBe("ask")

      const reviewer = yield* agents.get(AgentV2.ID.make("reviewer"))
      if (!reviewer) throw new Error("expected configured reviewer agent")
      expect(reviewer).toMatchObject({
        description: "Review changes",
        mode: "subagent",
        hidden: true,
        model: { providerID: "openrouter", id: "openai/gpt-5", variant: "high" },
      })
      expect(reviewer.permissions).toEqual([
        { action: "bash", resource: "*", effect: "ask" },
        { action: "edit", resource: "*", effect: "deny" },
      ])
      expect(yield* agents.get(AgentV2.ID.make("removed"))).toBeUndefined()
    }),
  )

  it.effect("maps configured agent fields and preserves an unspecified model variant", () =>
    Effect.gen(function* () {
      const agents = yield* AgentV2.Service
      const config = Config.Service.of({
        directories: () => Effect.succeed([]),
        get: () =>
          Effect.succeed([
            new Config.Loaded({
              source: { type: "memory" },
              info: decode({
                agents: {
                  reviewer: {
                    model: "anthropic/claude-sonnet",
                    system: "Review carefully.",
                    description: "Reviews changes",
                    mode: "subagent",
                    hidden: true,
                    color: "warning",
                    steps: 12,
                    options: {
                      headers: { first: "one", shared: "first" },
                      body: { enabled: true },
                      aisdk: { provider: { profile: "review" }, request: { effort: "medium" } },
                    },
                  },
                },
              }),
            }),
            new Config.Loaded({
              source: { type: "memory" },
              info: decode({
                agents: {
                  reviewer: {
                    options: {
                      headers: { shared: "last", second: "two" },
                      body: { retries: 2 },
                      aisdk: { request: { effort: "high" } },
                    },
                  },
                },
              }),
            }),
          ]),
      })

      yield* ConfigAgentPlugin.Plugin.effect.pipe(
        Effect.provideService(Config.Service, config),
        Effect.provideService(AgentV2.Service, agents),
      )

      const reviewer = yield* agents.get(AgentV2.ID.make("reviewer"))
      if (!reviewer) throw new Error("expected configured reviewer agent")
      expect(reviewer).toMatchObject({
        system: "Review carefully.",
        description: "Reviews changes",
        mode: "subagent",
        hidden: true,
        color: "warning",
        steps: 12,
        model: { providerID: "anthropic", id: "claude-sonnet", variant: undefined },
      })
      expect(reviewer.options).toEqual({
        headers: { first: "one", shared: "last", second: "two" },
        body: { enabled: true, retries: 2 },
        aisdk: { provider: { profile: "review" }, request: { effort: "high" } },
      })
    }),
  )

  it.effect("removes a built-in agent disabled by configuration", () =>
    Effect.gen(function* () {
      const agents = yield* AgentV2.Service
      const build = AgentV2.ID.make("build")
      const defaults = yield* agents.transform()
      yield* defaults((editor) => editor.update(build, () => {}))

      const config = Config.Service.of({
        directories: () => Effect.succeed([]),
        get: () =>
          Effect.succeed([
            new Config.Loaded({
              source: { type: "memory" },
              info: decode({ agents: { build: { disabled: true } } }),
            }),
          ]),
      })

      yield* ConfigAgentPlugin.Plugin.effect.pipe(
        Effect.provideService(Config.Service, config),
        Effect.provideService(AgentV2.Service, agents),
      )

      expect(yield* agents.get(build)).toBeUndefined()
    }),
  )

  it.live("loads markdown agents from config directories in priority order", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((tmp) => {
        const global = path.join(tmp.path, "global")
        const local = path.join(tmp.path, ".opencode")
        return Effect.gen(function* () {
          yield* Effect.promise(async () => {
            await fs.mkdir(path.join(global, "agent"), { recursive: true })
            await fs.mkdir(path.join(local, "agents", "team"), { recursive: true })
            await fs.writeFile(
              path.join(global, "agent", "reviewer.md"),
              `---
description: Global reviewer
mode: subagent
permissions:
  - action: edit
    resource: "*"
    effect: deny
---
Review globally.`,
            )
            await fs.writeFile(
              path.join(local, "agents", "reviewer.md"),
              `---
description: Local reviewer
model: anthropic/claude-sonnet
---
Review locally.`,
            )
            await fs.writeFile(
              path.join(local, "agents", "team", "research.md"),
              `---
mode: subagent
---
Research the issue.`,
            )
            await fs.writeFile(path.join(local, "agents", "build.md"), "---\ndisabled: true\n---\n")
          })

          const agents = yield* AgentV2.Service
          yield* agents.update((editor) => editor.update(AgentV2.ID.make("build"), () => {}))
          const config = Config.Service.of({
            directories: () => Effect.succeed([AbsolutePath.make(global), AbsolutePath.make(local)]),
            get: () => Effect.succeed([]),
          })

          yield* ConfigAgentPlugin.Plugin.effect.pipe(Effect.provideService(Config.Service, config))

          const reviewer = yield* agents.get(AgentV2.ID.make("reviewer"))
          expect(reviewer).toMatchObject({
            system: "Review locally.",
            description: "Local reviewer",
            mode: "subagent",
            model: { providerID: "anthropic", id: "claude-sonnet" },
          })
          expect(PermissionV2.evaluate("edit", "src/index.ts", reviewer?.permissions ?? []).effect).toBe("deny")
          expect(yield* agents.get(AgentV2.ID.make("team/research"))).toMatchObject({
            system: "Research the issue.",
            mode: "subagent",
          })
          expect(yield* agents.get(AgentV2.ID.make("build"))).toBeUndefined()
        })
      }),
    ),
  )
})
