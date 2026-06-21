import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

import type {
  GitChangedFile,
  GitFileStatus,
  GitReviewFileDiffResult,
  GitReviewRevertFileResult,
  GitReviewStatusResult,
} from "@t3tools/contracts";
import { ProcessRunner } from "../processRunner.ts";

const GIT_TIMEOUT_MS = 30_000;
const MAX_DIFF_OUTPUT_BYTES = 512 * 1024;

export class GitPathOutsideRootError extends Data.TaggedError("GitPathOutsideRootError")<{
  readonly detail: string;
}> {}

export interface GitReviewServiceShape {
  readonly getStatus: (cwd: string) => Effect.Effect<GitReviewStatusResult>;
  readonly getFileDiff: (cwd: string, path: string) => Effect.Effect<GitReviewFileDiffResult>;
  readonly revertFile: (cwd: string, path: string) => Effect.Effect<GitReviewRevertFileResult>;
}

export class GitReviewService extends Context.Service<GitReviewService, GitReviewServiceShape>()(
  "t3/git/GitReviewService",
) {}

function validateRelativePath(
  workspaceRoot: string,
  relativePath: string,
  pathUtil: Path.Path,
): Effect.Effect<string, GitPathOutsideRootError> {
  const trimmed = relativePath.trim();
  if (trimmed.length === 0) {
    return Effect.fail(new GitPathOutsideRootError({ detail: "Path must not be empty." }));
  }
  if (trimmed.includes("\0")) {
    return Effect.fail(
      new GitPathOutsideRootError({ detail: "Path must not contain null bytes." }),
    );
  }
  if (pathUtil.isAbsolute(trimmed)) {
    return Effect.fail(
      new GitPathOutsideRootError({ detail: "Path must be relative, not absolute." }),
    );
  }
  if (
    trimmed.startsWith("file://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("git@") ||
    trimmed.startsWith("ssh://")
  ) {
    return Effect.fail(new GitPathOutsideRootError({ detail: "Path must not be a URL." }));
  }
  const absolutePath = pathUtil.resolve(workspaceRoot, trimmed);
  const relativeToRoot = pathUtil.relative(workspaceRoot, absolutePath);
  if (
    relativeToRoot.length === 0 ||
    relativeToRoot === "." ||
    relativeToRoot.startsWith("..") ||
    pathUtil.isAbsolute(relativeToRoot)
  ) {
    return Effect.fail(
      new GitPathOutsideRootError({
        detail: "Path must stay within the workspace root.",
      }),
    );
  }
  return Effect.succeed(relativeToRoot);
}

function parsePorcelainV1Status(stdout: string): ReadonlyArray<{
  readonly xy: string;
  readonly path: string;
  readonly oldPath?: string;
}> {
  if (stdout.length === 0) return [];
  const lines = stdout.split("\0");
  const entries: Array<{
    xy: string;
    path: string;
    oldPath?: string;
  }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.length < 2) continue;
    const xy = line.slice(0, 2);
    const rest = line.slice(2).trim();
    if (rest.length === 0) continue;
    if (xy[0] === "R" || xy[0] === "C") {
      const parts = rest.split("\0");
      const srcPath = parts[0]?.trim();
      const dstPath = parts[1]?.trim();
      if (srcPath && dstPath) {
        entries.push({ xy, path: dstPath, oldPath: srcPath });
      }
    } else {
      entries.push({ xy, path: rest });
    }
  }
  return entries;
}

function xyToFileStatus(xy: string): GitFileStatus {
  const indexChar = xy[0];
  const workTreeChar = xy[1];
  if (indexChar === "?" && workTreeChar === "?") return "untracked";
  if (indexChar === "!" && workTreeChar === "!") return "unknown";
  if (indexChar === "U" || workTreeChar === "U") return "conflicted";
  const effectiveStatus = workTreeChar !== " " ? workTreeChar : indexChar;
  switch (effectiveStatus) {
    case "M":
      return "modified";
    case "A":
      return "added";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    default:
      return "unknown";
  }
}

function handleProcessError(
  error: unknown,
  operation: string,
  path: string,
): GitReviewFileDiffResult {
  return {
    status: "error",
    path,
    detail: `${operation} failed: ${String(error)}`,
  };
}

function handleRevertProcessError(
  error: unknown,
  operation: string,
  path: string,
): GitReviewRevertFileResult {
  return {
    status: "error",
    path,
    detail: `${operation} failed: ${String(error)}`,
  };
}

export const makeGitReviewService: Effect.Effect<
  GitReviewServiceShape,
  never,
  ProcessRunner | FileSystem.FileSystem | Path.Path
> = Effect.gen(function* () {
  const processRunner = yield* ProcessRunner;
  const fileSystem = yield* FileSystem.FileSystem;
  const pathUtil = yield* Path.Path;

  const runGit = (cwd: string, args: ReadonlyArray<string>) =>
    processRunner.run({
      command: "git",
      args,
      cwd,
      timeout: Duration.millis(GIT_TIMEOUT_MS),
      maxOutputBytes: MAX_DIFF_OUTPUT_BYTES,
      outputMode: "truncate",
    });

  const isGitRepo = (cwd: string): Effect.Effect<boolean> =>
    fileSystem.stat(pathUtil.join(cwd, ".git")).pipe(
      Effect.as(true),
      Effect.catch(() => Effect.succeed(false)),
    );

  const nowIso = Effect.map(DateTime.now, DateTime.formatIso);

  const getStatus: GitReviewServiceShape["getStatus"] = (cwd) =>
    isGitRepo(cwd).pipe(
      Effect.flatMap((repoCheck): Effect.Effect<GitReviewStatusResult> => {
        if (!repoCheck) {
          return Effect.succeed({
            status: "not_repo" as const,
            message: "Not a Git repository.",
          });
        }
        return Effect.all({
          statusResult: runGit(cwd, ["status", "--porcelain=v1", "-z"]).pipe(
            Effect.map((r) => r.stdout),
            Effect.catch(() => Effect.succeed("")),
          ),
          branchResult: runGit(cwd, ["branch", "--show-current"]).pipe(
            Effect.map((r) => r.stdout.trim()),
            Effect.catch(() => Effect.succeed("")),
          ),
        }).pipe(
          Effect.map(({ statusResult, branchResult }) => {
            const entries = parsePorcelainV1Status(statusResult);
            const changedFiles: Array<GitChangedFile> = entries.map((entry) => ({
              path: entry.path,
              status: xyToFileStatus(entry.xy),
              ...(entry.oldPath !== undefined ? { oldPath: entry.oldPath } : {}),
            }));
            return {
              status: "ok" as const,
              branch: branchResult.length > 0 ? branchResult : undefined,
              changedFiles,
              isClean: changedFiles.length === 0,
            };
          }),
        );
      }),
    );

  const getFileDiff: GitReviewServiceShape["getFileDiff"] = (cwd, rawPath) =>
    validateRelativePath(cwd, rawPath, pathUtil).pipe(
      Effect.catch((error) =>
        Effect.succeed({
          status: "error" as const,
          path: rawPath,
          detail: error.detail,
        }),
      ),
      Effect.flatMap((validation): Effect.Effect<GitReviewFileDiffResult> => {
        if (typeof validation !== "string") return Effect.succeed(validation);
        const relativePath = validation;
        return isGitRepo(cwd).pipe(
          Effect.flatMap((repoCheck): Effect.Effect<GitReviewFileDiffResult> => {
            if (!repoCheck) {
              return Effect.succeed({
                status: "not_repo" as const,
                message: "Not a Git repository.",
              });
            }
            return runGit(cwd, ["diff", "--", relativePath]).pipe(
              Effect.catch((error) =>
                Effect.succeed(handleProcessError(error, "Git diff", rawPath)),
              ),
              Effect.flatMap((diffResult): Effect.Effect<GitReviewFileDiffResult> => {
                if ("status" in diffResult) return Effect.succeed(diffResult);
                if (diffResult.stdoutTruncated) {
                  return Effect.succeed({
                    status: "too_large" as const,
                    path: rawPath,
                    sizeBytes: MAX_DIFF_OUTPUT_BYTES,
                    maxSizeBytes: MAX_DIFF_OUTPUT_BYTES,
                  });
                }
                const diff = diffResult.stdout;
                if (diff.length === 0) {
                  return fileSystem.stat(pathUtil.join(cwd, relativePath)).pipe(
                    Effect.andThen(() =>
                      Effect.succeed({
                        status: "ok" as const,
                        path: rawPath,
                        diff: "(untracked file - no diff available)",
                      }),
                    ),
                    Effect.catch(() =>
                      Effect.succeed({ status: "not_found" as const, path: rawPath }),
                    ),
                  );
                }
                return Effect.succeed({
                  status: "ok" as const,
                  path: rawPath,
                  diff,
                });
              }),
            );
          }),
        );
      }),
    );

  const revertFile: GitReviewServiceShape["revertFile"] = (cwd, rawPath) =>
    validateRelativePath(cwd, rawPath, pathUtil).pipe(
      Effect.catch((error) =>
        Effect.succeed({
          status: "error" as const,
          path: rawPath,
          detail: error.detail,
        }),
      ),
      Effect.flatMap((validation): Effect.Effect<GitReviewRevertFileResult> => {
        if (typeof validation !== "string") return Effect.succeed(validation);
        const relativePath = validation;
        return isGitRepo(cwd).pipe(
          Effect.flatMap((repoCheck): Effect.Effect<GitReviewRevertFileResult> => {
            if (!repoCheck) {
              return Effect.succeed({
                status: "not_repo" as const,
                message: "Not a Git repository.",
              });
            }
            return getStatus(cwd).pipe(
              Effect.flatMap((statusResult): Effect.Effect<GitReviewRevertFileResult> => {
                if (statusResult.status !== "ok") {
                  return Effect.succeed({
                    status: "error" as const,
                    path: rawPath,
                    detail: "Cannot determine file status.",
                  });
                }
                const changedFile = statusResult.changedFiles.find((f) => f.path === relativePath);
                if (!changedFile) {
                  return Effect.succeed({
                    status: "not_found" as const,
                    path: rawPath,
                  });
                }
                if (changedFile.status === "untracked") {
                  return Effect.succeed({
                    status: "conflict" as const,
                    path: rawPath,
                    reason: "Untracked file revert is not supported yet.",
                  });
                }
                return processRunner
                  .run({
                    command: "git",
                    args: ["checkout", "--", relativePath],
                    cwd,
                    timeout: Duration.millis(GIT_TIMEOUT_MS),
                    maxOutputBytes: 1024,
                  })
                  .pipe(
                    Effect.catch((error) =>
                      Effect.succeed(handleRevertProcessError(error, "Git checkout", rawPath)),
                    ),
                    Effect.flatMap((revertResult) => {
                      if ("status" in revertResult) return Effect.succeed(revertResult);
                      if (revertResult.code !== null && revertResult.code !== 0) {
                        return Effect.succeed({
                          status: "conflict" as const,
                          path: rawPath,
                          reason: revertResult.stderr.trim() || "Git checkout failed.",
                        });
                      }
                      return nowIso.pipe(
                        Effect.map((revertedAt) => ({
                          status: "ok" as const,
                          path: rawPath,
                          revertedAt,
                        })),
                      );
                    }),
                  );
              }),
            );
          }),
        );
      }),
    );

  return {
    getStatus,
    getFileDiff,
    revertFile,
  } satisfies GitReviewServiceShape;
});

export const GitReviewServiceLive = Layer.effect(GitReviewService, makeGitReviewService);
