import * as Schema from "effect/Schema";

export const WorkspaceRootInput = Schema.Struct({
  cwd: Schema.optional(Schema.String),
});
export type WorkspaceRootInput = typeof WorkspaceRootInput.Type;

export const WorkspaceFileTreeEntry = Schema.Struct({
  path: Schema.String,
  name: Schema.String,
  kind: Schema.Literals(["file", "directory"]),
  parentPath: Schema.optional(Schema.String),
});
export type WorkspaceFileTreeEntry = typeof WorkspaceFileTreeEntry.Type;

export const WorkspaceGetFileTreeResult = Schema.Struct({
  entries: Schema.Array(WorkspaceFileTreeEntry),
  truncated: Schema.Boolean,
});
export type WorkspaceGetFileTreeResult = typeof WorkspaceGetFileTreeResult.Type;

export const WorkspaceReadTextFileInput = Schema.Struct({
  cwd: Schema.optional(Schema.String),
  relativePath: Schema.String,
});
export type WorkspaceReadTextFileInput = typeof WorkspaceReadTextFileInput.Type;

export const WorkspaceReadTextFileResult = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("ok"),
    path: Schema.String,
    language: Schema.String,
    content: Schema.String,
    hash: Schema.String,
  }),
  Schema.Struct({
    status: Schema.Literal("too_large"),
    path: Schema.String,
    sizeBytes: Schema.Int,
    maxSizeBytes: Schema.Int,
  }),
  Schema.Struct({ status: Schema.Literal("binary"), path: Schema.String }),
  Schema.Struct({ status: Schema.Literal("not_found"), path: Schema.String }),
  Schema.Struct({
    status: Schema.Literal("unsupported"),
    path: Schema.String,
    reason: Schema.String,
  }),
  Schema.Struct({ status: Schema.Literal("error"), path: Schema.String, detail: Schema.String }),
]);
export type WorkspaceReadTextFileResult = typeof WorkspaceReadTextFileResult.Type;

export const WorkspaceWriteTextFileInput = Schema.Struct({
  cwd: Schema.optional(Schema.String),
  relativePath: Schema.String,
  content: Schema.String,
  expectedHash: Schema.optional(Schema.String),
});
export type WorkspaceWriteTextFileInput = typeof WorkspaceWriteTextFileInput.Type;

export const WorkspaceWriteTextFileResult = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("ok"),
    path: Schema.String,
    sizeBytes: Schema.Int,
    hash: Schema.String,
    writtenAt: Schema.String,
  }),
  Schema.Struct({
    status: Schema.Literal("conflict"),
    path: Schema.String,
    reason: Schema.String,
    currentHash: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    status: Schema.Literal("too_large"),
    path: Schema.String,
    sizeBytes: Schema.Int,
    maxSizeBytes: Schema.Int,
  }),
  Schema.Struct({
    status: Schema.Literal("unsupported"),
    path: Schema.String,
    reason: Schema.String,
  }),
  Schema.Struct({ status: Schema.Literal("not_found"), path: Schema.String }),
  Schema.Struct({ status: Schema.Literal("error"), path: Schema.String, detail: Schema.String }),
]);
export type WorkspaceWriteTextFileResult = typeof WorkspaceWriteTextFileResult.Type;
