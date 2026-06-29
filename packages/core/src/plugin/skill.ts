/// <reference path="../markdown.d.ts" />

export * as SkillPlugin from "./skill"

import { define } from "./internal"
import { Effect } from "effect"
import { AbsolutePath } from "../schema"
import { SkillV2 } from "../skill"
import customizeCanopyContent from "./skill/customize-canopy.md" with { type: "text" }
import jobSearchContent from "./skill/job-search.md" with { type: "text" }

export const CustomizeCanopyContent = customizeCanopyContent
export const JobSearchContent = jobSearchContent

export const Plugin = define({
  id: "skill",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.skill.transform((draft) => {
      draft.source(
        new SkillV2.EmbeddedSource({
          type: "embedded",
          skill: new SkillV2.Info({
            name: "customize-canopy",
            description:
              "Use ONLY when the user is editing or creating Canopy's own configuration: opencode.json, opencode.jsonc, files under .opencode/, or files under ~/.config/opencode/. Also use when creating or fixing Canopy agents, subagents, commands, skills, plugins, MCP servers, or permission rules. Do not use for the user's own application code, or for any project that is not configuring Canopy itself.",
            location: AbsolutePath.make("/builtin/customize-canopy.md"),
            content: CustomizeCanopyContent,
          }),
        }),
      )
      draft.source(
        new SkillV2.EmbeddedSource({
          type: "embedded",
          skill: new SkillV2.Info({
            name: "job-search",
            description:
              "Use when the user asks for help with job search, career transition, resume/CV optimization, LinkedIn profile, cover letters, interview preparation, application tracking, or follow-up management. Also use when the user references CV Aprovado or Resume Doctor projects.",
            location: AbsolutePath.make("/builtin/job-search.md"),
            content: JobSearchContent,
          }),
        }),
      )
    })
  }),
})
