import type { LanguageModelV3, LanguageModelV3CallOptions, LanguageModelV3FinishReason } from "@ai-sdk/provider"
import { Effect, Layer } from "effect"
import { Provider } from "@/provider/provider"
import { ModelID, ProviderID } from "@/provider/schema"
import { Simulation, type LLMScript } from "./service"

const providerID = ProviderID.make("simulation")
const modelID = ModelID.make("mock")

const model: Provider.Model = {
  id: modelID,
  providerID,
  api: { id: modelID, url: "simulation://mock", npm: "simulation" },
  name: "Simulation Mock",
  capabilities: {
    temperature: true,
    reasoning: true,
    attachment: false,
    toolcall: false,
    input: { text: true, audio: false, image: false, video: false, pdf: false },
    output: { text: true, audio: false, image: false, video: false, pdf: false },
    interleaved: false,
  },
  cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
  limit: { context: 128_000, output: 32_000 },
  status: "active",
  options: {},
  headers: {},
  release_date: "2026-01-01",
  variants: {},
}

const provider: Provider.Info = {
  id: providerID,
  name: "Simulation",
  source: "custom",
  env: [],
  options: {},
  models: { [modelID]: model },
}

function text(script: LLMScript) {
  return script.steps[0]?.flatMap((item) => (item.type === "text" || item.type === "thinking" ? [item.content] : []))
    .join("") ?? ""
}

function error(script: LLMScript) {
  return script.steps[0]?.find((item) => item.type === "error")
}

function stream(script: LLMScript) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: "stream-start", warnings: [] })
      let index = 0
      for (const item of script.steps[0] ?? []) {
        index++
        if (item.type === "error") {
          controller.enqueue({ type: "error", error: new Error(item.message) })
          controller.close()
          return
        }
        const id = `simulation-${item.type}-${index}`
        if (item.type === "thinking") {
          controller.enqueue({ type: "reasoning-start", id })
          controller.enqueue({ type: "reasoning-delta", id, delta: item.content })
          controller.enqueue({ type: "reasoning-end", id })
          continue
        }
        controller.enqueue({ type: "text-start", id })
        controller.enqueue({ type: "text-delta", id, delta: item.content })
        controller.enqueue({ type: "text-end", id })
      }
      controller.enqueue({ type: "finish", finishReason: finishReason(script), usage: usage(script) })
      controller.close()
    },
  })
}

function usage(script: LLMScript) {
  return {
    inputTokens: {
      total: script.usage?.inputTokens ?? 0,
      noCache: script.usage?.inputTokens ?? 0,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: script.usage?.outputTokens ?? text(script).length,
      text: script.usage?.outputTokens ?? text(script).length,
      reasoning: undefined,
    },
    raw: script.usage,
  }
}

function finishReason(script: LLMScript): LanguageModelV3FinishReason {
  return { unified: script.finish === "unknown" ? "other" : (script.finish ?? "stop"), raw: script.finish }
}

function language(simulation: Simulation.Interface): LanguageModelV3 {
  return {
    specificationVersion: "v3",
    provider: "simulation",
    modelId: modelID,
    supportedUrls: {},
    async doGenerate(_options: LanguageModelV3CallOptions) {
      const script = await Effect.runPromise(simulation.nextLLM())
      const err = error(script)
      if (err?.type === "error") throw new Error(err.message)
      return {
        content: [{ type: "text", text: text(script) }],
        finishReason: finishReason(script),
        usage: usage(script),
        warnings: [],
      }
    },
    async doStream(_options: LanguageModelV3CallOptions) {
      const script = await Effect.runPromise(simulation.nextLLM())
      return { stream: stream(script) }
    },
  }
}

export const layer = Layer.effect(
  Provider.Service,
  Effect.gen(function* () {
    const simulation = yield* Simulation.Service
    const lang = language(simulation)
    return Provider.Service.of({
      list: () => Effect.succeed({ [providerID]: provider }),
      getProvider: () => Effect.succeed(provider),
      getModel: () => Effect.succeed(model),
      getLanguage: () => Effect.succeed(lang),
      closest: () => Effect.succeed({ providerID, modelID }),
      getSmallModel: () => Effect.succeed(model),
      defaultModel: () => Effect.succeed({ providerID, modelID }),
    })
  }),
)

export * as SimulationProvider from "./provider"
