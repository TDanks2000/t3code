import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS projection_turn_costs (
      row_id INTEGER PRIMARY KEY AUTOINCREMENT,
      turn_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      project_id TEXT,
      provider TEXT,
      model TEXT,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cached_input_tokens INTEGER DEFAULT 0,
      reasoning_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      cost_usd REAL DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      created_at TEXT NOT NULL
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_projection_turn_costs_turn_id
    ON projection_turn_costs(turn_id)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_projection_turn_costs_thread_project
    ON projection_turn_costs(thread_id, project_id, created_at)
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS projection_tool_invocations (
      row_id INTEGER PRIMARY KEY AUTOINCREMENT,
      invocation_id TEXT NOT NULL UNIQUE,
      turn_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      project_id TEXT,
      provider TEXT,
      tool_type TEXT NOT NULL,
      tool_name TEXT,
      item_type TEXT,
      status TEXT,
      title TEXT,
      input_preview TEXT,
      output_preview TEXT,
      file_paths_json TEXT,
      command TEXT,
      exit_code INTEGER,
      elapsed_ms INTEGER,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_projection_tool_invocations_turn_id
    ON projection_tool_invocations(turn_id)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_projection_tool_invocations_thread
    ON projection_tool_invocations(thread_id, created_at)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_projection_tool_invocations_type_status
    ON projection_tool_invocations(tool_type, status)
  `;
});
