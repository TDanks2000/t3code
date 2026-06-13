import { IsoDateTime, NonNegativeInt, ProjectId, ThreadId, TurnId } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

export const TurnCostRow = Schema.Struct({
  turnId: TurnId,
  threadId: ThreadId,
  projectId: Schema.optional(ProjectId),
  provider: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
  inputTokens: NonNegativeInt,
  outputTokens: NonNegativeInt,
  cachedInputTokens: NonNegativeInt,
  reasoningTokens: NonNegativeInt,
  totalTokens: NonNegativeInt,
  durationMs: NonNegativeInt,
  costUsd: Schema.Number,
  currency: Schema.String,
  createdAt: IsoDateTime,
});
export type TurnCostRow = typeof TurnCostRow.Type;

export const ListTurnCostsInput = Schema.Struct({
  threadId: Schema.optional(ThreadId),
  projectId: Schema.optional(ProjectId),
  limit: Schema.optional(NonNegativeInt),
  offset: Schema.optional(NonNegativeInt),
});
export type ListTurnCostsInput = typeof ListTurnCostsInput.Type;

export interface TurnCostRepositoryShape {
  readonly insert: (row: TurnCostRow) => Effect.Effect<void, ProjectionRepositoryError>;

  readonly listByThreadId: (
    threadId: ThreadId,
  ) => Effect.Effect<ReadonlyArray<TurnCostRow>, ProjectionRepositoryError>;

  readonly listByProjectId: (
    projectId: ProjectId,
  ) => Effect.Effect<ReadonlyArray<TurnCostRow>, ProjectionRepositoryError>;

  readonly aggregateByProject: (projectId: ProjectId) => Effect.Effect<
    {
      totalTurns: number;
      totalCostUsd: number;
      totalInputTokens: number;
      totalOutputTokens: number;
    },
    ProjectionRepositoryError
  >;
}

export class TurnCostRepository extends Context.Service<
  TurnCostRepository,
  TurnCostRepositoryShape
>()("t3/persistence/Services/TurnCosts/TurnCostRepository") {}
