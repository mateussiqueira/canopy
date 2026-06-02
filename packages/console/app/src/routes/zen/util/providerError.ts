export function parseProviderErrorBody(body: string, statusText: string) {
  const text = body.trim()
  const sseData = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== "[DONE]")

  const parsed = (() => {
    for (const data of sseData) {
      try {
        const json = JSON.parse(data)
        if (json && typeof json === "object") return json as Record<string, any>
      } catch {}
    }
  })()
  if (parsed) return parsed as Record<string, any>

  return {
    error: {
      message: sseData[0] || text || statusText,
    },
  }
}
