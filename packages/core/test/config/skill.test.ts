import path from "path"
import { describe, expect } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import { Config } from "@canopystack/core/config"
import { ConfigSkillPlugin } from "@canopystack/core/config/plugin/skill"
import { Global } from "@canopystack/core/global"
import { Location } from "@canopystack/core/location"
import { AbsolutePath } from "@canopystack/core/schema"
import { SkillV2 } from "@canopystack/core/skill"
import { location } from "../fixture/location"
import { testEffect } from "../lib/effect"
import { host } from "../plugin/host"

const it = testEffect(Layer.empty)
const decode = Schema.decodeUnknownSync(Config.Info)

describe("ConfigSkillPlugin.Plugin", () => {
  it.effect("registers configured skill directories and URLs", () =>
    Effect.gen(function* () {
      const directory = AbsolutePath.make("/repo/packages/app")
      const sources: SkillV2.Source[] = []
      const transform = Effect.fnUntraced(function* (update: (draft: SkillV2.Draft) => void | Effect.Effect<void>) {
        const result = update({
          source: (source) => {
            sources.push(source)
          },
          list: () => sources,
        })
        if (Effect.isEffect(result)) yield* result
        const dispose = Effect.sync(() => {
          sources.length = 0
        })
        yield* Effect.addFinalizer(() => dispose)
        return { dispose }
      })

      yield* ConfigSkillPlugin.Plugin.effect(
        host({
          skill: { transform, reload: () => Effect.void },
        }),
      ).pipe(
        Effect.provideService(Global.Service, Global.Service.of({ ...Global.make(), home: "/home/test" })),
        Effect.provideService(Location.Service, Location.Service.of(location({ directory }))),
        Effect.provideService(
          Config.Service,
          Config.Service.of({
            entries: () =>
              Effect.succeed([
                new Config.Directory({ type: "directory", path: AbsolutePath.make("/repo/.opencode") }),
                new Config.Document({
                  type: "document",
                  info: decode({
                    skills: ["./skills", "~/shared-skills", "/opt/skills", "https://example.test/skills/"],
                  }),
                }),
              ]),
          }),
        ),
      )

      expect(sources).toEqual([
        new SkillV2.DirectorySource({
          type: "directory",
          path: AbsolutePath.make(path.join("/repo/.opencode", "skill")),
        }),
        new SkillV2.DirectorySource({
          type: "directory",
          path: AbsolutePath.make(path.join("/repo/.opencode", "skills")),
        }),
        new SkillV2.DirectorySource({ type: "directory", path: AbsolutePath.make(path.join(directory, "skills")) }),
        new SkillV2.DirectorySource({
          type: "directory",
          path: AbsolutePath.make(path.join("/home/test", "shared-skills")),
        }),
        new SkillV2.DirectorySource({ type: "directory", path: AbsolutePath.make("/opt/skills") }),
        new SkillV2.UrlSource({ type: "url", url: "https://example.test/skills/" }),
      ])
    }),
  )
})
