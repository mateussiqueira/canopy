import { Credential } from "@canopystack/core/credential"
import { EventV2 } from "@canopystack/core/event"
import { FileSystem } from "@canopystack/core/filesystem"
import { FSUtil } from "@canopystack/core/fs-util"
import { Global } from "@canopystack/core/global"
import { Npm } from "@canopystack/core/npm"
import { PluginV2 } from "@canopystack/core/plugin"
import { RepositoryCache } from "@canopystack/core/repository-cache"
import { Ripgrep } from "@canopystack/core/ripgrep"
import { SkillDiscovery } from "@canopystack/core/skill/discovery"
import { Effect, Layer } from "effect"
import { tempLocationLayer } from "../fixture/location"

export const PluginTestLayer = Layer.mergeAll(FileSystem.locationLayer, PluginV2.locationLayer).pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      Credential.defaultLayer,
      EventV2.defaultLayer,
      FSUtil.defaultLayer,
      Global.defaultLayer,
      Layer.succeed(
        Npm.Service,
        Npm.Service.of({
          add: () => Effect.succeed({ directory: "", entrypoint: undefined }),
          install: () => Effect.void,
          which: () => Effect.succeed(undefined),
        }),
      ),
      RepositoryCache.defaultLayer,
      SkillDiscovery.defaultLayer,
      Ripgrep.defaultLayer,
      tempLocationLayer,
    ),
  ),
)
