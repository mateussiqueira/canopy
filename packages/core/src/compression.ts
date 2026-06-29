import { Effect, Stream, Chunk } from "effect"

export interface CompressOptions {
  readonly level: number
  readonly threshold: number
}

const defaultOptions: CompressOptions = {
  level: 6,
  threshold: 1024,
}

export const compressStream = (
  stream: Stream.Stream<Uint8Array, unknown>,
  options: Partial<CompressOptions> = {}
) => {
  const opts = { ...defaultOptions, ...options }

  return Stream.mapChunks(stream, (chunk) => {
    const data = Chunk.toArray(chunk)
    const combined = Buffer.concat(data)

    if (combined.length < opts.threshold) {
      return Chunk.of(combined)
    }

    const compressed = Bun.gzipSync(combined, { level: opts.level })
    return Chunk.of(compressed)
  })
}

export const createCompressTransform = (options: Partial<CompressOptions> = {}) => {
  const opts = { ...defaultOptions, ...options }

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      if (chunk.length < opts.threshold) {
        controller.enqueue(chunk)
        return
      }
      const compressed = Bun.gzipSync(chunk, { level: opts.level })
      controller.enqueue(compressed)
    },
  })
}
