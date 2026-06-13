import { EventId, IsoDateTime, NonNegativeInt, ThreadId, TurnId } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

export const ToolInvocationRow = Schema.Struct({
  invocationId: EventId,
  turnId: TurnId,
  threadId: ThreadId,
  provider: Schema.optional(Schema.String),
  toolType: Schema.String,
  toolName: Schema.optional(Schema.String),
  itemType: Schema.optional(Schema.String),
  status: Schema.optional(Schema.String),
  title: Schema.optional(Schema.String),
  inputPreview: Schema.optional(Schema.String),
  outputPreview: Schema.optional(Schema.String),
  filePathsJson: Schema.optional(Schema.String),
  command: Schema.optional(Schema.String),
  exitCode: Schema.optional(Schema.Int),
  elapsedMs: Schema.optional(NonNegativeInt),
  startedAt: Schema.optional(IsoDateTime),
  completedAt: Schema.optional(IsoDateTime),
  createdAt: IsoDateTime,
});
export type ToolInvocationRow = typeof ToolInvocationRow.Type;

export const ListToolInvocationsInput = Schema.Struct({
  threadId: Schema.optional(ThreadId),
  turnId: Schema.optional(TurnId),
  limit: Schema.optional(NonNegativeInt),
  offset: Schema.optional(NonNegativeInt),
});
export type ListToolInvocationsInput = typeof ListToolInvocationsInput.Type;

export interface ToolInvocationRepositoryShape {
  readonly insert: (row: ToolInvocationRow) => Effect.Effect<void, ProjectionRepositoryError>;

  readonly listByThreadId: (
    threadId: ThreadId,
  ) => Effect.Effect<ReadonlyArray<ToolInvocationRow>, ProjectionRepositoryError>;

  readonly listByTurnId: (
    turnId: TurnId,
  ) => Effect.Effect<ReadonlyArray<ToolInvocationRow>, ProjectionRepositoryError>;
}

export class ToolInvocationRepository extends Context.Service<
  ToolInvocationRepository,
  ToolInvocationRepositoryShape
>()("t3/persistence/Services/ToolInvocations/ToolInvocationRepository") {}
