import { Effect, Semaphore } from "effect"

const lock = Semaphore.makeUnsafe(1)

export const githubBase = <A, E, R>(url: string, self: Effect.Effect<A, E, R>) =>
  lock.withPermit(
    Effect.acquireUseRelease(
      Effect.sync(() => {
        const previous = process.env.OPENCODE_REPO_CLONE_GITHUB_BASE_URL
        process.env.OPENCODE_REPO_CLONE_GITHUB_BASE_URL = url
        return previous
      }),
      () => self,
      (previous) =>
        Effect.sync(() => {
          if (previous === undefined) delete process.env.OPENCODE_REPO_CLONE_GITHUB_BASE_URL
          else process.env.OPENCODE_REPO_CLONE_GITHUB_BASE_URL = previous
        }),
    ),
  )
