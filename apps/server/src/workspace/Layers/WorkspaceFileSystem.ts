// @effect-diagnostics nodeBuiltinImport:off
import * as nodeCrypto from "node:crypto";
import * as nodeFs from "node:fs/promises";
import * as nodePath from "node:path";

import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import type { WorkspaceReadTextFileResult, WorkspaceWriteTextFileResult } from "@t3tools/contracts";

import {
  WorkspaceFileSystem,
  WorkspaceFileSystemError,
  type WorkspaceFileSystemShape,
} from "../Services/WorkspaceFileSystem.ts";
import { WorkspaceEntries } from "../Services/WorkspaceEntries.ts";
import { WorkspacePaths } from "../Services/WorkspacePaths.ts";

const TEXT_READ_MAX_BYTES = 256 * 1024;
const TEXT_WRITE_MAX_BYTES = 256 * 1024;

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".jsonc",
  ".html",
  ".css",
  ".scss",
  ".less",
  ".yaml",
  ".yml",
  ".toml",
  ".env",
  ".txt",
  ".md",
  ".mdx",
  ".py",
  ".rs",
  ".go",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".rb",
  ".php",
  ".swift",
  ".kt",
  ".cs",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".sql",
  ".graphql",
  ".gql",
  ".proto",
  ".xml",
  ".svg",
  ".gitignore",
  ".prettierrc",
  ".eslintrc",
  ".editorconfig",
]);

const LANGUAGE_MAP: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".json": "json",
  ".jsonc": "json",
  ".md": "markdown",
  ".mdx": "markdown",
  ".css": "css",
  ".scss": "scss",
  ".less": "less",
  ".html": "html",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "plaintext",
  ".env": "plaintext",
  ".txt": "plaintext",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".cs": "csharp",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".fish": "shell",
  ".sql": "sql",
  ".graphql": "graphql",
  ".gql": "graphql",
  ".proto": "plaintext",
  ".xml": "xml",
  ".svg": "xml",
  ".gitignore": "ignore",
  ".prettierrc": "json",
  ".eslintrc": "json",
  ".editorconfig": "ini",
};

function detectLanguage(relativePath: string): string {
  const basename = nodePath.basename(relativePath);
  const ext = nodePath.extname(basename).toLowerCase();
  if (LANGUAGE_MAP[ext]) return LANGUAGE_MAP[ext];
  if (LANGUAGE_MAP[basename]) return LANGUAGE_MAP[basename];
  return "plaintext";
}

function hasBinaryBytes(buffer: Buffer): boolean {
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

function isInsideWorkspace(workspaceRealPath: string, targetRealPath: string): boolean {
  if (targetRealPath === workspaceRealPath) return false;
  const relative = nodePath.relative(workspaceRealPath, targetRealPath);
  return relative !== "" && !relative.startsWith("..") && !nodePath.isAbsolute(relative);
}

async function readTextFileAsync(
  cwd: string,
  absolutePath: string,
  relativePath: string,
): Promise<WorkspaceReadTextFileResult> {
  // Concurrent realpath check to prevent symlink escapes (TOCTOU-safe)
  let realpaths: [string, string];
  try {
    realpaths = await Promise.all([nodeFs.realpath(absolutePath), nodeFs.realpath(cwd)]);
  } catch {
    return { status: "not_found", path: relativePath };
  }

  const [targetRealPath, workspaceRealPath] = realpaths;

  if (!isInsideWorkspace(workspaceRealPath, targetRealPath)) {
    return { status: "not_found", path: relativePath };
  }

  // Stat to verify it's a regular file (not a directory or symlink to one)
  let stat: Awaited<ReturnType<typeof nodeFs.stat>>;
  try {
    stat = await nodeFs.stat(targetRealPath);
  } catch {
    return { status: "not_found", path: relativePath };
  }

  if (!stat.isFile()) {
    return { status: "not_found", path: relativePath };
  }

  // Extension whitelist
  const ext = nodePath.extname(targetRealPath).toLowerCase();
  const basename = nodePath.basename(targetRealPath);
  if (ext.length > 0 && !TEXT_EXTENSIONS.has(ext)) {
    if (!TEXT_EXTENSIONS.has(basename)) {
      return {
        status: "unsupported",
        path: relativePath,
        reason: `File extension "${ext}" is not supported for text preview.`,
      };
    }
  }

  // Size cap
  if (stat.size > TEXT_READ_MAX_BYTES) {
    return {
      status: "too_large",
      path: relativePath,
      sizeBytes: stat.size,
      maxSizeBytes: TEXT_READ_MAX_BYTES,
    };
  }

  // Read file and check for binary content
  let buffer: Buffer;
  try {
    buffer = await nodeFs.readFile(targetRealPath);
  } catch (cause) {
    return {
      status: "error",
      path: relativePath,
      detail: cause instanceof Error ? cause.message : "Failed to read file",
    };
  }

  if (hasBinaryBytes(buffer)) {
    return { status: "binary", path: relativePath };
  }

  const content = buffer.toString("utf-8");
  const hash = nodeCrypto.createHash("sha256").update(content, "utf-8").digest("hex");
  return {
    status: "ok",
    path: relativePath,
    language: detectLanguage(relativePath),
    content,
    hash,
  };
}

function computeHash(content: string): string {
  return nodeCrypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

async function writeTextFileAsync(
  cwd: string,
  absolutePath: string,
  relativePath: string,
  content: string,
  expectedHash: string | undefined,
): Promise<WorkspaceWriteTextFileResult> {
  // Concurrent realpath check to prevent symlink escapes (TOCTOU-safe)
  let realpaths: [string, string];
  try {
    realpaths = await Promise.all([nodeFs.realpath(absolutePath), nodeFs.realpath(cwd)]);
  } catch {
    return { status: "not_found", path: relativePath };
  }

  const [targetRealPath, workspaceRealPath] = realpaths;

  if (!isInsideWorkspace(workspaceRealPath, targetRealPath)) {
    return { status: "not_found", path: relativePath };
  }

  // Stat to verify it's a regular file (not a directory or symlink to one)
  let stat: Awaited<ReturnType<typeof nodeFs.stat>>;
  try {
    stat = await nodeFs.stat(targetRealPath);
  } catch {
    return { status: "not_found", path: relativePath };
  }

  if (!stat.isFile()) {
    return { status: "not_found", path: relativePath };
  }

  // Extension whitelist
  const ext = nodePath.extname(targetRealPath).toLowerCase();
  const basename = nodePath.basename(targetRealPath);
  if (ext.length > 0 && !TEXT_EXTENSIONS.has(ext)) {
    if (!TEXT_EXTENSIONS.has(basename)) {
      return {
        status: "unsupported",
        path: relativePath,
        reason: `File extension "${ext}" is not supported for text writing.`,
      };
    }
  }

  // Size cap
  const byteLength = Buffer.byteLength(content, "utf-8");
  if (byteLength > TEXT_WRITE_MAX_BYTES) {
    return {
      status: "too_large",
      path: relativePath,
      sizeBytes: byteLength,
      maxSizeBytes: TEXT_WRITE_MAX_BYTES,
    };
  }

  // Conflict detection
  if (expectedHash !== undefined) {
    try {
      const currentBuffer = await nodeFs.readFile(targetRealPath);
      const currentHash = computeHash(currentBuffer.toString("utf-8"));
      if (currentHash !== expectedHash) {
        return {
          status: "conflict",
          path: relativePath,
          reason: "File changed on disk since it was last read.",
          currentHash,
        };
      }
    } catch {
      return {
        status: "error",
        path: relativePath,
        detail: "Failed to read current file content for conflict check.",
      };
    }
  }

  // Write file
  try {
    await nodeFs.writeFile(targetRealPath, content, "utf-8");
  } catch (cause) {
    return {
      status: "error",
      path: relativePath,
      detail: cause instanceof Error ? cause.message : "Failed to write file",
    };
  }

  const newHash = computeHash(content);
  return {
    status: "ok",
    path: relativePath,
    sizeBytes: byteLength,
    hash: newHash,
    writtenAt: DateTime.formatIso(DateTime.nowUnsafe()),
  };
}

export const makeWorkspaceFileSystem = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workspacePaths = yield* WorkspacePaths;
  const workspaceEntries = yield* WorkspaceEntries;

  const writeFile: WorkspaceFileSystemShape["writeFile"] = Effect.fn(
    "WorkspaceFileSystem.writeFile",
  )(function* (input) {
    if (
      input.relativePath.includes("\0") ||
      input.relativePath.startsWith("http://") ||
      input.relativePath.startsWith("https://")
    ) {
      return yield* new WorkspaceFileSystemError({
        cwd: input.cwd,
        relativePath: input.relativePath,
        operation: "workspaceFileSystem.writeFile",
        detail: "Invalid file path.",
      });
    }

    const target = yield* workspacePaths.resolveRelativePathWithinRoot({
      workspaceRoot: input.cwd,
      relativePath: input.relativePath,
    });

    // Resolve symlinks to prevent path traversal after string-based check.
    // If either path can't be resolved, the file doesn't exist yet — that's
    // fine for a write. Only validate when both exist.
    const targetRealPath = yield* fileSystem
      .realPath(target.absolutePath)
      .pipe(Effect.orElseSucceed(() => null as string | null));
    if (targetRealPath !== null) {
      const workspaceRealPath = yield* fileSystem
        .realPath(input.cwd)
        .pipe(Effect.orElseSucceed(() => null as string | null));
      if (workspaceRealPath !== null && !isInsideWorkspace(workspaceRealPath, targetRealPath)) {
        return yield* new WorkspaceFileSystemError({
          cwd: input.cwd,
          relativePath: input.relativePath,
          operation: "workspaceFileSystem.writeFile",
          detail: "File path escapes workspace root via symlink.",
        });
      }
    }

    yield* fileSystem.makeDirectory(path.dirname(target.absolutePath), { recursive: true }).pipe(
      Effect.mapError(
        (cause) =>
          new WorkspaceFileSystemError({
            cwd: input.cwd,
            relativePath: input.relativePath,
            operation: "workspaceFileSystem.makeDirectory",
            detail: cause.message,
            cause,
          }),
      ),
    );
    yield* fileSystem.writeFileString(target.absolutePath, input.contents).pipe(
      Effect.mapError(
        (cause) =>
          new WorkspaceFileSystemError({
            cwd: input.cwd,
            relativePath: input.relativePath,
            operation: "workspaceFileSystem.writeFile",
            detail: cause.message,
            cause,
          }),
      ),
    );
    yield* workspaceEntries.invalidate(input.cwd);
    return { relativePath: target.relativePath };
  });

  const readTextFile: WorkspaceFileSystemShape["readTextFile"] = (cwd, relativePath) => {
    if (
      relativePath.includes("\0") ||
      relativePath.startsWith("http://") ||
      relativePath.startsWith("https://")
    ) {
      return Effect.succeed({ status: "not_found", path: relativePath });
    }

    return workspacePaths.resolveRelativePathWithinRoot({ workspaceRoot: cwd, relativePath }).pipe(
      Effect.catchTag("WorkspacePathOutsideRootError", () =>
        Effect.succeed(null as { absolutePath: string; relativePath: string } | null),
      ),
      Effect.flatMap((resolved) => {
        if (resolved === null) {
          return Effect.succeed({
            status: "not_found",
            path: relativePath,
          } satisfies WorkspaceReadTextFileResult);
        }
        return Effect.promise(() => readTextFileAsync(cwd, resolved.absolutePath, relativePath));
      }),
    );
  };

  const writeTextFile: WorkspaceFileSystemShape["writeTextFile"] = (cwd, input) => {
    if (
      input.relativePath.includes("\0") ||
      input.relativePath.startsWith("http://") ||
      input.relativePath.startsWith("https://")
    ) {
      return Effect.succeed({ status: "not_found", path: input.relativePath });
    }

    return workspacePaths
      .resolveRelativePathWithinRoot({ workspaceRoot: cwd, relativePath: input.relativePath })
      .pipe(
        Effect.catchTag("WorkspacePathOutsideRootError", () =>
          Effect.succeed(null as { absolutePath: string; relativePath: string } | null),
        ),
        Effect.flatMap((resolved) => {
          if (resolved === null) {
            return Effect.succeed({
              status: "not_found",
              path: input.relativePath,
            } satisfies WorkspaceWriteTextFileResult);
          }
          return Effect.promise(() =>
            writeTextFileAsync(
              cwd,
              resolved.absolutePath,
              input.relativePath,
              input.content,
              input.expectedHash,
            ),
          );
        }),
      );
  };

  return { writeFile, readTextFile, writeTextFile } satisfies WorkspaceFileSystemShape;
});

export const WorkspaceFileSystemLive = Layer.effect(WorkspaceFileSystem, makeWorkspaceFileSystem);
