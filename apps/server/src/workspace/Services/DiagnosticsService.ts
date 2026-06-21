import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { DiagnosticsRunInput, DiagnosticsRunResult } from "@t3tools/contracts";
import { DiagnosticsRunError } from "@t3tools/contracts";

export interface DiagnosticsServiceShape {
  readonly run: (
    input: DiagnosticsRunInput,
    cwd: string,
  ) => Effect.Effect<DiagnosticsRunResult, DiagnosticsRunError>;
}

export class DiagnosticsService extends Context.Service<
  DiagnosticsService,
  DiagnosticsServiceShape
>()("t3/workspace/Services/DiagnosticsService") {}
