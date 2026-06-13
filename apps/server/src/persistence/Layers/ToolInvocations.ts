import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { toPersistenceSqlError } from "../Errors.ts";
import {
  ListAllToolInvocationsInput,
  ToolInvocationRepository,
  ToolInvocationRow,
  type ToolInvocationRepositoryShape,
} from "../Services/ToolInvocations.ts";

const makeToolInvocationRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const insertToolInvocationRow = SqlSchema.void({
    Request: ToolInvocationRow,
    execute: (row) =>
      sql`
        INSERT INTO projection_tool_invocations (
          invocation_id,
          turn_id,
          thread_id,
          provider,
          tool_type,
          tool_name,
          item_type,
          status,
          title,
          input_preview,
          output_preview,
          file_paths_json,
          command,
          exit_code,
          elapsed_ms,
          started_at,
          completed_at,
          created_at
        )
        VALUES (
          ${row.invocationId},
          ${row.turnId},
          ${row.threadId},
          ${row.provider ?? null},
          ${row.toolType},
          ${row.toolName ?? null},
          ${row.itemType ?? null},
          ${row.status ?? null},
          ${row.title ?? null},
          ${row.inputPreview ?? null},
          ${row.outputPreview ?? null},
          ${row.filePathsJson ?? null},
          ${row.command ?? null},
          ${row.exitCode ?? null},
          ${row.elapsedMs ?? null},
          ${row.startedAt ?? null},
          ${row.completedAt ?? null},
          ${row.createdAt}
        )
      `,
  });

  const listInvocationsByThreadId = SqlSchema.findAll({
    Request: Schema.Struct({ threadId: Schema.String }),
    Result: ToolInvocationRow,
    execute: ({ threadId }) =>
      sql`
        SELECT
          invocation_id AS "invocationId",
          turn_id AS "turnId",
          thread_id AS "threadId",
          provider,
          tool_type AS "toolType",
          tool_name AS "toolName",
          item_type AS "itemType",
          status,
          title,
          input_preview AS "inputPreview",
          output_preview AS "outputPreview",
          file_paths_json AS "filePathsJson",
          command,
          exit_code AS "exitCode",
          elapsed_ms AS "elapsedMs",
          started_at AS "startedAt",
          completed_at AS "completedAt",
          created_at AS "createdAt"
        FROM projection_tool_invocations
        WHERE thread_id = ${threadId}
        ORDER BY created_at ASC
      `,
  });

  const listInvocationsByTurnId = SqlSchema.findAll({
    Request: Schema.Struct({ turnId: Schema.String }),
    Result: ToolInvocationRow,
    execute: ({ turnId }) =>
      sql`
        SELECT
          invocation_id AS "invocationId",
          turn_id AS "turnId",
          thread_id AS "threadId",
          provider,
          tool_type AS "toolType",
          tool_name AS "toolName",
          item_type AS "itemType",
          status,
          title,
          input_preview AS "inputPreview",
          output_preview AS "outputPreview",
          file_paths_json AS "filePathsJson",
          command,
          exit_code AS "exitCode",
          elapsed_ms AS "elapsedMs",
          started_at AS "startedAt",
          completed_at AS "completedAt",
          created_at AS "createdAt"
        FROM projection_tool_invocations
        WHERE turn_id = ${turnId}
        ORDER BY created_at ASC
      `,
  });

  const listAllInvocations = SqlSchema.findAll({
    Request: ListAllToolInvocationsInput,
    Result: ToolInvocationRow,
    execute: (input) =>
      sql`
        SELECT
          invocation_id AS "invocationId",
          turn_id AS "turnId",
          thread_id AS "threadId",
          provider,
          tool_type AS "toolType",
          tool_name AS "toolName",
          item_type AS "itemType",
          status,
          title,
          input_preview AS "inputPreview",
          output_preview AS "outputPreview",
          file_paths_json AS "filePathsJson",
          command,
          exit_code AS "exitCode",
          elapsed_ms AS "elapsedMs",
          started_at AS "startedAt",
          completed_at AS "completedAt",
          created_at AS "createdAt"
        FROM projection_tool_invocations
        ORDER BY created_at DESC
        LIMIT ${input.limit ?? -1}
      `,
  });

  const insert: ToolInvocationRepositoryShape["insert"] = (row) =>
    insertToolInvocationRow(row).pipe(
      Effect.mapError(toPersistenceSqlError("ToolInvocationRepository.insert:query")),
    );

  const listByThreadId: ToolInvocationRepositoryShape["listByThreadId"] = (threadId) =>
    listInvocationsByThreadId({ threadId }).pipe(
      Effect.mapError(toPersistenceSqlError("ToolInvocationRepository.listByThreadId:query")),
    );

  const listByTurnId: ToolInvocationRepositoryShape["listByTurnId"] = (turnId) =>
    listInvocationsByTurnId({ turnId }).pipe(
      Effect.mapError(toPersistenceSqlError("ToolInvocationRepository.listByTurnId:query")),
    );

  const listAll: ToolInvocationRepositoryShape["listAll"] = (input) =>
    listAllInvocations(input).pipe(
      Effect.mapError(toPersistenceSqlError("ToolInvocationRepository.listAll:query")),
    );

  return {
    insert,
    listByThreadId,
    listByTurnId,
    listAll,
  } satisfies ToolInvocationRepositoryShape;
});

export const ToolInvocationRepositoryLive = Layer.effect(
  ToolInvocationRepository,
  makeToolInvocationRepository,
);
