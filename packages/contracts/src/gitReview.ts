import * as Schema from "effect/Schema";

const MAX_DIFF_SIZE_BYTES = 512 * 1024;

export const GitFileStatus = Schema.Literals([
  "modified",
  "added",
  "deleted",
  "renamed",
  "copied",
  "untracked",
  "conflicted",
  "unknown",
]);
export type GitFileStatus = typeof GitFileStatus.Type;

export const GitChangedFile = Schema.Struct({
  path: Schema.String,
  status: GitFileStatus,
  oldPath: Schema.optional(Schema.String),
  additions: Schema.optional(Schema.Int),
  deletions: Schema.optional(Schema.Int),
});
export type GitChangedFile = typeof GitChangedFile.Type;

export const GitReviewStatusResult = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("ok"),
    branch: Schema.optional(Schema.String),
    changedFiles: Schema.Array(GitChangedFile),
    isClean: Schema.Boolean,
  }),
  Schema.Struct({
    status: Schema.Literal("not_repo"),
    message: Schema.String,
  }),
  Schema.Struct({
    status: Schema.Literal("error"),
    detail: Schema.String,
  }),
]);
export type GitReviewStatusResult = typeof GitReviewStatusResult.Type;

export const GitReviewFileDiffResult = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("ok"),
    path: Schema.String,
    oldPath: Schema.optional(Schema.String),
    diff: Schema.String,
    additions: Schema.optional(Schema.Int),
    deletions: Schema.optional(Schema.Int),
  }),
  Schema.Struct({
    status: Schema.Literal("not_found"),
    path: Schema.String,
  }),
  Schema.Struct({
    status: Schema.Literal("too_large"),
    path: Schema.String,
    sizeBytes: Schema.Int,
    maxSizeBytes: Schema.Int,
  }),
  Schema.Struct({
    status: Schema.Literal("binary"),
    path: Schema.String,
  }),
  Schema.Struct({
    status: Schema.Literal("not_repo"),
    message: Schema.String,
  }),
  Schema.Struct({
    status: Schema.Literal("error"),
    path: Schema.optional(Schema.String),
    detail: Schema.String,
  }),
]);
export type GitReviewFileDiffResult = typeof GitReviewFileDiffResult.Type;

export const GitReviewRevertFileResult = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("ok"),
    path: Schema.String,
    revertedAt: Schema.String,
  }),
  Schema.Struct({
    status: Schema.Literal("not_found"),
    path: Schema.String,
  }),
  Schema.Struct({
    status: Schema.Literal("conflict"),
    path: Schema.String,
    reason: Schema.String,
  }),
  Schema.Struct({
    status: Schema.Literal("not_repo"),
    message: Schema.String,
  }),
  Schema.Struct({
    status: Schema.Literal("error"),
    path: Schema.String,
    detail: Schema.String,
  }),
]);
export type GitReviewRevertFileResult = typeof GitReviewRevertFileResult.Type;

export const GitReviewGetStatusInput = Schema.Struct({
  cwd: Schema.String,
});
export type GitReviewGetStatusInput = typeof GitReviewGetStatusInput.Type;

export const GitReviewGetFileDiffInput = Schema.Struct({
  cwd: Schema.String,
  path: Schema.String,
});
export type GitReviewGetFileDiffInput = typeof GitReviewGetFileDiffInput.Type;

export const GitReviewRevertFileInput = Schema.Struct({
  cwd: Schema.String,
  path: Schema.String,
});
export type GitReviewRevertFileInput = typeof GitReviewRevertFileInput.Type;

export { MAX_DIFF_SIZE_BYTES };
