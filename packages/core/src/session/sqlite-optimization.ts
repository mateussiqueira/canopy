import { Effect } from "effect"
import { Database } from "./database/database"

const PRAGMA_STATEMENTS = [
  "PRAGMA journal_mode=WAL",
  "PRAGMA synchronous=NORMAL",
  "PRAGMA cache_size=-64000",
  "PRAGMA temp_store=MEMORY",
  "PRAGMA mmap_size=268435456",
  "PRAGMA page_size=4096",
  "PRAGMA busy_timeout=5000",
]

const INDEX_STATEMENTS = [
  `CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_tool_calls_message ON tool_calls(message_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tool_calls_status ON tool_calls(status)`,
]

export const optimizeDatabase = Effect.fn("SessionStore.optimize")(function* () {
  const db = yield* Database.Service

  for (const pragma of PRAGMA_STATEMENTS) {
    yield* db.run(pragma)
  }

  for (const index of INDEX_STATEMENTS) {
    yield* db.run(index)
  }
})

export const analyzeDatabase = Effect.fn("SessionStore.analyze")(function* () {
  const db = yield* Database.Service
  yield* db.run("ANALYZE")
})

export const vacuumDatabase = Effect.fn("SessionStore.vacuum")(function* () {
  const db = yield* Database.Service
  yield* db.run("VACUUM")
})
