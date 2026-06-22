/**
 * Rank artifact candidates from turn diff files and an explicit target path.
 * Returns the most recent matching HTML file path, or the target path if no
 * diff-based match is found.
 */
export function rankCandidateArtifact(
  diffFiles: ReadonlyArray<{ path: string }>,
  targetPath: string,
): string | null {
  const htmlFiles = diffFiles.filter((f) => f.path.endsWith(".html"));

  if (htmlFiles.length > 0) {
    return htmlFiles[htmlFiles.length - 1]!.path;
  }

  if (targetPath.endsWith(".html")) {
    return targetPath;
  }

  return null;
}

/**
 * Validate a target artifact path. Must be a relative path with an `.html`
 * extension, no path traversal components, and reasonable length.
 */
export interface PathValidationResult {
  valid: boolean;
  normalizedPath: string;
  error: string | null;
}

export function validateTargetPath(path: string): PathValidationResult {
  if (!path || path.trim().length === 0) {
    return { valid: false, normalizedPath: "", error: "Path must not be empty" };
  }

  if (path.length > 512) {
    return {
      valid: false,
      normalizedPath: "",
      error: "Path exceeds maximum length of 512 characters",
    };
  }

  const containsTraversal = path.includes("..") || path.startsWith("/");
  if (containsTraversal) {
    return { valid: false, normalizedPath: "", error: "Path traversal is not allowed" };
  }

  if (!path.endsWith(".html")) {
    return { valid: false, normalizedPath: "", error: "Artifact must be an .html file" };
  }

  return { valid: true, normalizedPath: path.trim(), error: null };
}

/**
 * Derive a default target path from the user prompt.
 * Lowercases, replaces spaces with hyphens, and strips non-alphanumeric chars.
 */
export function deriveTargetPath(prompt: string): string {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return `design-artifacts/${slug || "untitled"}.html`;
}
