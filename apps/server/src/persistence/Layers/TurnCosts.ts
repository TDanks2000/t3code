import { NonNegativeInt } from "@t3tools/contracts";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { toPersistenceSqlError } from "../Errors.ts";
import {
  TurnCostRepository,
  TurnCostRow,
  type AccountLimitSnapshotRow,
  type TurnCostRepositoryShape,
} from "../Services/TurnCosts.ts";

const makeTurnCostRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const DEFAULT_LIST_LIMIT = 200;

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

  const deleteTurnCostByTurnId = SqlSchema.void({
    Request: Schema.Struct({ turnId: Schema.String }),
    execute: ({ turnId }) =>
      sql`
        DELETE FROM projection_turn_costs
        WHERE turn_id = ${turnId}
      `,
  });

  const listTurnCostsByThreadId = SqlSchema.findAll({
    Request: Schema.Struct({ threadId: Schema.String, limit: NonNegativeInt }),
    Result: TurnCostRow,
    execute: ({ threadId, limit }) =>
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
        LIMIT ${limit}
      `,
  });

  const listTurnCostsByProjectId = SqlSchema.findAll({
    Request: Schema.Struct({ projectId: Schema.String, limit: NonNegativeInt }),
    Result: TurnCostRow,
    execute: ({ projectId, limit }) =>
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
        LIMIT ${limit}
      `,
  });

  const aggregateTurnCostsByThreadId = SqlSchema.findOne({
    Request: Schema.Struct({ threadId: Schema.String }),
    Result: Schema.Struct({
      totalTurns: Schema.Int,
      totalCostUsd: Schema.Number,
      totalInputTokens: Schema.Int,
      totalOutputTokens: Schema.Int,
      totalCachedInputTokens: Schema.Int,
      totalReasoningTokens: Schema.Int,
    }),
    execute: ({ threadId }) =>
      sql`
        SELECT
          CAST(COUNT(*) AS INTEGER) AS "totalTurns",
          COALESCE(SUM(cost_usd), 0) AS "totalCostUsd",
          COALESCE(SUM(input_tokens), 0) AS "totalInputTokens",
          COALESCE(SUM(output_tokens), 0) AS "totalOutputTokens",
          COALESCE(SUM(cached_input_tokens), 0) AS "totalCachedInputTokens",
          COALESCE(SUM(reasoning_tokens), 0) AS "totalReasoningTokens"
        FROM projection_turn_costs
        WHERE thread_id = ${threadId}
      `,
  });

  const aggregateTurnCostsByAllThreads = SqlSchema.findAll({
    Request: Schema.Struct({}),
    Result: Schema.Struct({
      threadId: Schema.String,
      totalTurns: Schema.Int,
      totalCostUsd: Schema.Number,
      totalInputTokens: Schema.Int,
      totalOutputTokens: Schema.Int,
    }),
    execute: () =>
      sql`
        SELECT
          thread_id AS "threadId",
          CAST(COUNT(*) AS INTEGER) AS "totalTurns",
          COALESCE(SUM(cost_usd), 0) AS "totalCostUsd",
          COALESCE(SUM(input_tokens), 0) AS "totalInputTokens",
          COALESCE(SUM(output_tokens), 0) AS "totalOutputTokens"
        FROM projection_turn_costs
        GROUP BY thread_id
        ORDER BY "totalCostUsd" DESC
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
    sql
      .withTransaction(
        deleteTurnCostByTurnId({ turnId: row.turnId }).pipe(
          Effect.flatMap(() => insertTurnCostRow(row)),
        ),
      )
      .pipe(Effect.mapError(toPersistenceSqlError("TurnCostRepository.insert:query")));

  const listByThreadId: TurnCostRepositoryShape["listByThreadId"] = (threadId, options) =>
    listTurnCostsByThreadId({ threadId, limit: options?.limit ?? DEFAULT_LIST_LIMIT }).pipe(
      Effect.mapError(toPersistenceSqlError("TurnCostRepository.listByThreadId:query")),
    );

  const listByProjectId: TurnCostRepositoryShape["listByProjectId"] = (projectId, options) =>
    listTurnCostsByProjectId({ projectId, limit: options?.limit ?? DEFAULT_LIST_LIMIT }).pipe(
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

  const aggregateByThreadId: TurnCostRepositoryShape["aggregateByThreadId"] = (threadId) =>
    aggregateTurnCostsByThreadId({ threadId }).pipe(
      Effect.mapError(toPersistenceSqlError("TurnCostRepository.aggregateByThreadId:query")),
    );

  const aggregateByAllThreads: TurnCostRepositoryShape["aggregateByAllThreads"] =
    aggregateTurnCostsByAllThreads({}).pipe(
      Effect.mapError(toPersistenceSqlError("TurnCostRepository.aggregateByAllThreads:query")),
    );

  const listLatestAccountLimitSnapshotRows = SqlSchema.findAll({
    Request: Schema.Struct({}),
    Result: Schema.Struct({
      provider: Schema.String,
      threadId: Schema.String,
      createdAt: Schema.String,
      rateLimitsJson: Schema.String,
    }),
    execute: () =>
      sql`
        SELECT
          latest.provider,
          latest.thread_id AS "threadId",
          latest.created_at AS "createdAt",
          latest.payload_json AS "rateLimitsJson"
        FROM (
          SELECT
            events.provider,
            events.thread_id,
            events.created_at,
            events.payload_json,
            ROW_NUMBER() OVER (
              PARTITION BY events.provider
              ORDER BY events.created_at DESC, events.activity_id DESC
            ) AS row_num
          FROM (
            SELECT
              COALESCE(
                NULLIF(session.provider_instance_id, ''),
                NULLIF(session.provider_name, ''),
                NULLIF(json_extract(thread.model_selection_json, '$.instanceId'), ''),
                NULLIF(json_extract(thread.model_selection_json, '$.provider'), ''),
                'unknown'
              ) AS provider,
              activity.thread_id,
              activity.created_at,
              activity.activity_id,
              activity.payload_json
            FROM projection_thread_activities AS activity
            LEFT JOIN projection_thread_sessions AS session
              ON session.thread_id = activity.thread_id
            LEFT JOIN projection_threads AS thread
              ON thread.thread_id = activity.thread_id
            WHERE activity.kind = 'account.rate-limits.updated'
          ) AS events
          WHERE events.provider IS NOT NULL
        ) AS latest
        WHERE latest.row_num = 1
        ORDER BY latest.created_at DESC
      `,
  });

  const listLatestAccountLimitSnapshots: TurnCostRepositoryShape["listLatestAccountLimitSnapshots"] =
    listLatestAccountLimitSnapshotRows({}).pipe(
      Effect.map(
        (rows): ReadonlyArray<AccountLimitSnapshotRow> =>
          rows.map((row) => {
            let rateLimits: unknown = {};
            try {
              rateLimits = JSON.parse(row.rateLimitsJson);
            } catch {
              rateLimits = {};
            }
            return {
              provider: row.provider,
              threadId: row.threadId,
              createdAt: row.createdAt,
              rateLimits,
            };
          }),
      ),
      Effect.mapError(
        toPersistenceSqlError("TurnCostRepository.listLatestAccountLimitSnapshots:query"),
      ),
    );

  return {
    insert,
    listByThreadId,
    listByProjectId,
    aggregateByProject,
    aggregateByThreadId,
    aggregateAll,
    aggregateByProviderAll,
    aggregateByModelAll,
    aggregateByAllThreads,
    listLatestAccountLimitSnapshots,
  } satisfies TurnCostRepositoryShape;
});

export const TurnCostRepositoryLive = Layer.effect(TurnCostRepository, makeTurnCostRepository);
