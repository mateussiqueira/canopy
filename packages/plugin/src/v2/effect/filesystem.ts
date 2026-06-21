import type { FileSystemEntry } from "@opencode-ai/sdk/v2/types"
import type { Effect } from "effect"
import type { PlatformError } from "effect/PlatformError"

export type FileSystemError =
  | PlatformError
  | {
      readonly _tag: "FileSystemError"
      readonly method: string
      readonly cause?: unknown
    }
  | {
      readonly _tag: "FileSystem.PathError"
      readonly path: string
      readonly reason: "lexical_escape" | "symlink_escape" | "not_file" | "not_directory"
    }

export interface FileSystem {
  read(input: {
    readonly path: string
  }): Effect.Effect<{ readonly content: Uint8Array; readonly mime: string }, FileSystemError>
  list(input?: { readonly path?: string }): Effect.Effect<FileSystemEntry[], FileSystemError>
  find(input: {
    readonly query: string
    readonly type?: "file" | "directory"
    readonly limit?: number
  }): Effect.Effect<FileSystemEntry[]>
  glob(input: {
    readonly pattern: string
    readonly path?: string
    readonly limit?: number
  }): Effect.Effect<readonly FileSystemEntry[]>
}
