import type { EnvironmentId, ThreadId, ProjectId } from "@t3tools/contracts";
import type { MissionReviewStatus } from "./reviewStateStore";

export type MissionBoardColumnId =
  | "backlog"
  | "running"
  | "needs_human"
  | "needs_review"
  | "failed"
  | "done";

export type MissionBoardAction =
  | "open"
  | "continue"
  | "retry"
  | "archive"
  | "copy_diagnostics"
  | "respond"
  | "mark_reviewed"
  | "mark_unreviewed"
  | "dismiss";

export interface MissionBoardCard {
  id: string;
  threadId: ThreadId;
  environmentId: EnvironmentId;
  projectId: ProjectId;
  title: string;
  columnId: MissionBoardColumnId;
  statusLabel: string;
  providerName?: string;
  providerInstanceId?: string;
  projectName?: string;
  lastActivityAt: string;
  preview?: string;
  errorMessage?: string;
  isActive: boolean;
  needsReview: boolean;
  needsHumanReason?: string;
  needsReviewReason?: string;
  missionReviewStatus?: MissionReviewStatus;
  reviewedAt?: string;
  hasNewActivityAfterReview?: boolean;
  draftId?: string;
  availableActions: MissionBoardAction[];
}

export interface MissionBoardColumn {
  id: MissionBoardColumnId;
  label: string;
  description: string;
  cards: MissionBoardCard[];
}

export type MissionManualColumnId = "backlog" | "done";

export interface MissionBoardManualState {
  threadId: ThreadId;
  manualColumnId?: MissionManualColumnId;
  sortOrder?: number;
  updatedAt: string;
}

export type MissionMoveResult =
  | { allowed: true; reason?: string }
  | { allowed: false; reason: string };

export interface MissionBoardSummary {
  total: number;
  running: number;
  needsHuman: number;
  needsReview: number;
  failed: number;
  done: number;
  backlog: number;
}
