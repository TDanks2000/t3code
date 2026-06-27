import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    DELETE FROM projection_turn_costs
    WHERE row_id IN (
      SELECT row_id
      FROM (
        SELECT
          row_id,
          ROW_NUMBER() OVER (
            PARTITION BY turn_id
            ORDER BY
              CASE
                WHEN (
                  COALESCE(input_tokens, 0) +
                  COALESCE(output_tokens, 0) +
                  COALESCE(cached_input_tokens, 0) +
                  COALESCE(reasoning_tokens, 0) +
                  COALESCE(cost_usd, 0)
                ) > 0 THEN 0
                ELSE 1
              END,
              created_at DESC,
              row_id DESC
          ) AS row_num
        FROM projection_turn_costs
      )
      WHERE row_num > 1
    )
  `;

  yield* sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_projection_turn_costs_turn_id_unique
    ON projection_turn_costs(turn_id)
  `;
});
