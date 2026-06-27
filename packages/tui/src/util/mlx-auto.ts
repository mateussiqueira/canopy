const CODE_KEYWORDS = [
  "refactor", "implement", "class", "function", "api", "docker",
  "bug", "fix", "test", "debug", "compile", "deploy", "migration",
  "schema", "query", "endpoint", "route", "middleware", "controller",
  "service", "repository", "interface", "type", "component",
  "algoritmo", "classe", "função", "implemente", "refatore",
  "codigo", "código", "programa", "app", "aplicação",
]

const MATH_KEYWORDS = [
  "math", "calculate", "equation", "formula", "statistics",
  "probability", "calculus", "algebra", "logic", "proof",
  "matemática", "calcular", "equação", "fórmula", "estatística",
  "probabilidade", "álgebra", "lógica",
]

function hasCodeIntent(text: string): boolean {
  const lower = text.toLowerCase()
  return CODE_KEYWORDS.some((kw) => lower.includes(kw))
}

function hasMathIntent(text: string): boolean {
  const lower = text.toLowerCase()
  return MATH_KEYWORDS.some((kw) => lower.includes(kw))
}

function hasImageInput(parts: { type?: string }[]): boolean {
  return parts.some((p) => p.type === "image" || p.type === "file")
}

export interface MLXModelRoute {
  providerID: string
  modelID: string
}

export function resolveMLXAuto(
  text: string,
  parts: { type?: string }[],
): MLXModelRoute {
  if (hasImageInput(parts)) {
    return { providerID: "mlx-local", modelID: "Qwen2.5-VL-7B-Instruct-4bit" }
  }
  if (hasCodeIntent(text)) {
    return { providerID: "mlx-local", modelID: "Qwen2.5-Coder-14B-Instruct-4bit" }
  }
  if (hasMathIntent(text)) {
    return { providerID: "mlx-local", modelID: "DeepSeek-R1-Distill-Qwen-7B-4bit" }
  }
  return { providerID: "mlx-local", modelID: "Mistral-7B-Instruct-v0.3-4bit" }
}
