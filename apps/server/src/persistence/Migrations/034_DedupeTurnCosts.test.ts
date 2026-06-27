import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "../NodeSqliteClient.ts";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

layer("034_DedupeTurnCosts", (it) => {
  it.effect("keeps the best cost row per turn and enforces unique turn ids", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations({ toMigrationInclusive: 33 });

      yield* sql`
        INSERT INTO projection_turn_costs (
          turn_id,
          thread_id,
          project_id,
          provider,
          model,
          input_tokens,
          output_tokens,
          cost_usd,
          created_at
        )
        VALUES
          (
            'turn-1',
            'thread-1',
            'project-1',
            'codex',
            'gpt-5.4',
            0,
            0,
            0,
            '2026-06-26T00:00:00.000Z'
          ),
          (
            'turn-1',
            'thread-1',
            'project-1',
            'codex',
            'gpt-5.4',
            100,
            50,
            0.003,
            '2026-06-26T00:00:01.000Z'
          ),
          (
            'turn-2',
            'thread-1',
            'project-1',
            'codex',
            'gpt-5.4',
            10,
            5,
            0.001,
            '2026-06-26T00:00:02.000Z'
          )
      `;

      yield* runMigrations({ toMigrationInclusive: 34 });

      const rows = yield* sql<{
        readonly turnId: string;
        readonly inputTokens: number;
        readonly outputTokens: number;
        readonly costUsd: number;
      }>`
        SELECT
          turn_id AS "turnId",
          input_tokens AS "inputTokens",
          output_tokens AS "outputTokens",
          cost_usd AS "costUsd"
        FROM projection_turn_costs
        ORDER BY turn_id
      `;
      assert.deepStrictEqual(rows, [
        { turnId: "turn-1", inputTokens: 100, outputTokens: 50, costUsd: 0.003 },
        { turnId: "turn-2", inputTokens: 10, outputTokens: 5, costUsd: 0.001 },
      ]);

      const indexes = yield* sql<{ readonly name: string; readonly unique: number }>`
        PRAGMA index_list(projection_turn_costs)
      `;
      assert.ok(
        indexes.some(
          (index) =>
            index.name === "idx_projection_turn_costs_turn_id_unique" && index.unique === 1,
        ),
      );

      const duplicateInsertError = yield* Effect.flip(sql`
        INSERT INTO projection_turn_costs (turn_id, thread_id, created_at)
        VALUES ('turn-1', 'thread-1', '2026-06-26T00:00:03.000Z')
      `);
      assert.equal(duplicateInsertError._tag, "SqlError");
    }),
  );
});
