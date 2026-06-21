import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { toPersistenceSqlError } from "../Errors.ts";
import {
  TurnCostRepository,
  TurnCostRow,
  type TurnCostRepositoryShape,
} from "../Services/TurnCosts.ts";

const makeTurnCostRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const insertTurnCostRow = SqlSchema.void({
    Request: TurnCostRow,
    execute: (row) =>
      sql`
        INSERT INTO projection_turn_costs (
          turn_id,
          thread_id,
          project_id,
          provider,
          model,
          input_tokens,
          output_tokens,
          cached_input_tokens,
          reasoning_tokens,
          total_tokens,
          duration_ms,
          cost_usd,
          currency,
          created_at
        )
        VALUES (
          ${row.turnId},
          ${row.threadId},
          ${row.projectId ?? null},
          ${row.provider ?? null},
          ${row.model ?? null},
          ${row.inputTokens},
          ${row.outputTokens},
          ${row.cachedInputTokens},
          ${row.reasoningTokens},
          ${row.totalTokens},
          ${row.durationMs},
          ${row.costUsd},
          ${row.currency},
          ${row.createdAt}
        )
      `,
  });

  const listTurnCostsByThreadId = SqlSchema.findAll({
    Request: Schema.Struct({ threadId: Schema.String }),
    Result: TurnCostRow,
    execute: ({ threadId }) =>
      sql`
        SELECT
          turn_id AS "turnId",
          thread_id AS "threadId",
          project_id AS "projectId",
          provider,
          model,
          input_tokens AS "inputTokens",
          output_tokens AS "outputTokens",
          cached_input_tokens AS "cachedInputTokens",
          reasoning_tokens AS "reasoningTokens",
          total_tokens AS "totalTokens",
          duration_ms AS "durationMs",
          cost_usd AS "costUsd",
          currency,
          created_at AS "createdAt"
        FROM projection_turn_costs
        WHERE thread_id = ${threadId}
        ORDER BY created_at ASC
      `,
  });

  const listTurnCostsByProjectId = SqlSchema.findAll({
    Request: Schema.Struct({ projectId: Schema.String }),
    Result: TurnCostRow,
    execute: ({ projectId }) =>
      sql`
        SELECT
          turn_id AS "turnId",
          thread_id AS "threadId",
          project_id AS "projectId",
          provider,
          model,
          input_tokens AS "inputTokens",
          output_tokens AS "outputTokens",
          cached_input_tokens AS "cachedInputTokens",
          reasoning_tokens AS "reasoningTokens",
          total_tokens AS "totalTokens",
          duration_ms AS "durationMs",
          cost_usd AS "costUsd",
          currency,
          created_at AS "createdAt"
        FROM projection_turn_costs
        WHERE project_id = ${projectId}
        ORDER BY created_at ASC
      `,
  });

  const aggregateTurnCostsByProject = SqlSchema.findOne({
    Request: Schema.Struct({ projectId: Schema.String }),
    Result: Schema.Struct({
      totalTurns: Schema.Int,
      totalCostUsd: Schema.Number,
      totalInputTokens: Schema.Int,
      totalOutputTokens: Schema.Int,
      totalCachedInputTokens: Schema.Int,
      totalReasoningTokens: Schema.Int,
    }),
    execute: ({ projectId }) =>
      sql`
        SELECT
          CAST(COUNT(*) AS INTEGER) AS "totalTurns",
          COALESCE(SUM(cost_usd), 0) AS "totalCostUsd",
          COALESCE(SUM(input_tokens), 0) AS "totalInputTokens",
          COALESCE(SUM(output_tokens), 0) AS "totalOutputTokens",
          COALESCE(SUM(cached_input_tokens), 0) AS "totalCachedInputTokens",
          COALESCE(SUM(reasoning_tokens), 0) AS "totalReasoningTokens"
        FROM projection_turn_costs
        WHERE project_id = ${projectId}
      `,
  });

  const aggregateTurnCostsByProviderAll = SqlSchema.findAll({
    Request: Schema.Struct({}),
    Result: Schema.Struct({
      provider: Schema.String,
      totalTurns: Schema.Int,
      totalCostUsd: Schema.Number,
      totalInputTokens: Schema.Int,
      totalOutputTokens: Schema.Int,
    }),
    execute: () =>
      sql`
        SELECT
          provider,
          CAST(COUNT(*) AS INTEGER) AS "totalTurns",
          COALESCE(SUM(cost_usd), 0) AS "totalCostUsd",
          COALESCE(SUM(input_tokens), 0) AS "totalInputTokens",
          COALESCE(SUM(output_tokens), 0) AS "totalOutputTokens"
        FROM projection_turn_costs
        WHERE provider IS NOT NULL
        GROUP BY provider
        ORDER BY "totalCostUsd" DESC
      `,
  });

  const aggregateTurnCostsByModelAll = SqlSchema.findAll({
    Request: Schema.Struct({}),
    Result: Schema.Struct({
      model: Schema.String,
      totalTurns: Schema.Int,
      totalCostUsd: Schema.Number,
      totalInputTokens: Schema.Int,
      totalOutputTokens: Schema.Int,
    }),
    execute: () =>
      sql`
        SELECT
          model,
          CAST(COUNT(*) AS INTEGER) AS "totalTurns",
          COALESCE(SUM(cost_usd), 0) AS "totalCostUsd",
          COALESCE(SUM(input_tokens), 0) AS "totalInputTokens",
          COALESCE(SUM(output_tokens), 0) AS "totalOutputTokens"
        FROM projection_turn_costs
        WHERE model IS NOT NULL
        GROUP BY model
        ORDER BY "totalCostUsd" DESC
      `,
  });

  const insert: TurnCostRepositoryShape["insert"] = (row) =>
    insertTurnCostRow(row).pipe(
      Effect.mapError(toPersistenceSqlError("TurnCostRepository.insert:query")),
    );

  const listByThreadId: TurnCostRepositoryShape["listByThreadId"] = (threadId) =>
    listTurnCostsByThreadId({ threadId }).pipe(
      Effect.mapError(toPersistenceSqlError("TurnCostRepository.listByThreadId:query")),
    );

  const listByProjectId: TurnCostRepositoryShape["listByProjectId"] = (projectId) =>
    listTurnCostsByProjectId({ projectId }).pipe(
      Effect.mapError(toPersistenceSqlError("TurnCostRepository.listByProjectId:query")),
    );

  const aggregateTurnCostsAll = SqlSchema.findOne({
    Request: Schema.Struct({}),
    Result: Schema.Struct({
      totalTurns: Schema.Int,
      totalCostUsd: Schema.Number,
      totalInputTokens: Schema.Int,
      totalOutputTokens: Schema.Int,
      totalCachedInputTokens: Schema.Int,
      totalReasoningTokens: Schema.Int,
    }),
    execute: () =>
      sql`
        SELECT
          CAST(COUNT(*) AS INTEGER) AS "totalTurns",
          COALESCE(SUM(cost_usd), 0) AS "totalCostUsd",
          COALESCE(SUM(input_tokens), 0) AS "totalInputTokens",
          COALESCE(SUM(output_tokens), 0) AS "totalOutputTokens",
          COALESCE(SUM(cached_input_tokens), 0) AS "totalCachedInputTokens",
          COALESCE(SUM(reasoning_tokens), 0) AS "totalReasoningTokens"
        FROM projection_turn_costs
      `,
  });

  const aggregateByProject: TurnCostRepositoryShape["aggregateByProject"] = (projectId) =>
    aggregateTurnCostsByProject({ projectId }).pipe(
      Effect.mapError(toPersistenceSqlError("TurnCostRepository.aggregateByProject:query")),
    );

  const aggregateAll: TurnCostRepositoryShape["aggregateAll"] = aggregateTurnCostsAll({}).pipe(
    Effect.mapError(toPersistenceSqlError("TurnCostRepository.aggregateAll:query")),
  );

  const aggregateByProviderAll: TurnCostRepositoryShape["aggregateByProviderAll"] =
    aggregateTurnCostsByProviderAll({}).pipe(
      Effect.mapError(toPersistenceSqlError("TurnCostRepository.aggregateByProviderAll:query")),
    );

  const aggregateByModelAll: TurnCostRepositoryShape["aggregateByModelAll"] =
    aggregateTurnCostsByModelAll({}).pipe(
      Effect.mapError(toPersistenceSqlError("TurnCostRepository.aggregateByModelAll:query")),
    );

  return {
    insert,
    listByThreadId,
    listByProjectId,
    aggregateByProject,
    aggregateAll,
    aggregateByProviderAll,
    aggregateByModelAll,
  } satisfies TurnCostRepositoryShape;
});

export const TurnCostRepositoryLive = Layer.effect(TurnCostRepository, makeTurnCostRepository);
