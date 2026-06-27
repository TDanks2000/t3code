// @effect-diagnostics nodeBuiltinImport:off
import * as NodePath from "node:path";

export const ATTACHMENTS_ROUTE_PREFIX = "/attachments";

/**
 * Subdirectory of the attachments dir where browser screenshots from
 * preview_snapshot are persisted. A nested path is intentionally invisible to
 * the attachment reapers (they read the root non-recursively and skip nested
 * entries), so message-prune never deletes screenshots; cleanup is instead tied
 * to thread deletion.
 */
export const PREVIEW_SCREENSHOTS_SUBDIR = "screenshots";

export function normalizeAttachmentRelativePath(rawRelativePath: string): string | null {
  const normalized = NodePath.normalize(rawRelativePath).replace(/^[/\\]+/, "");
  if (normalized.length === 0 || normalized.startsWith("..") || normalized.includes("\0")) {
    return null;
  }
  return normalized.replace(/\\/g, "/");
}

export function resolveAttachmentRelativePath(input: {
  readonly attachmentsDir: string;
  readonly relativePath: string;
}): string | null {
  const normalizedRelativePath = normalizeAttachmentRelativePath(input.relativePath);
  if (!normalizedRelativePath) {
    return null;
  }

  const attachmentsRoot = NodePath.resolve(input.attachmentsDir);
  const filePath = NodePath.resolve(NodePath.join(attachmentsRoot, normalizedRelativePath));
  if (!filePath.startsWith(`${attachmentsRoot}${NodePath.sep}`)) {
    return null;
  }
  return filePath;
}
