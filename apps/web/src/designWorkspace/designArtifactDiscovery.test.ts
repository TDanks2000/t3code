import { describe, it, expect } from "vite-plus/test";
import {
  rankCandidateArtifact,
  validateTargetPath,
  deriveTargetPath,
} from "./designArtifactDiscovery";

describe("rankCandidateArtifact", () => {
  it("returns the last HTML file from diff files", () => {
    const files = [
      { path: "src/index.ts" },
      { path: "design/v1.html" },
      { path: "design/v2.html" },
    ];
    expect(rankCandidateArtifact(files, "design/fallback.html")).toBe("design/v2.html");
  });

  it("returns target path when no HTML files in diff", () => {
    const files = [{ path: "src/index.ts" }];
    expect(rankCandidateArtifact(files, "design/fallback.html")).toBe("design/fallback.html");
  });

  it("returns null when no HTML files and target is not HTML", () => {
    const files: Array<{ path: string }> = [];
    expect(rankCandidateArtifact(files, "readme.md")).toBeNull();
  });
});

describe("validateTargetPath", () => {
  it("accepts valid relative HTML paths", () => {
    const result = validateTargetPath("design-artifacts/landing.html");
    expect(result.valid).toBe(true);
    expect(result.normalizedPath).toBe("design-artifacts/landing.html");
    expect(result.error).toBeNull();
  });

  it("rejects empty paths", () => {
    const result = validateTargetPath("");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Path must not be empty");
  });

  it("rejects path traversal", () => {
    const result = validateTargetPath("../etc/passwd.html");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Path traversal is not allowed");
  });

  it("rejects absolute paths", () => {
    const result = validateTargetPath("/etc/passwd.html");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Path traversal is not allowed");
  });

  it("rejects non-HTML files", () => {
    const result = validateTargetPath("design/landing.tsx");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Artifact must be an .html file");
  });

  it("rejects overly long paths", () => {
    const longPath = "a".repeat(600) + ".html";
    const result = validateTargetPath(longPath);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Path exceeds maximum length of 512 characters");
  });
});

describe("deriveTargetPath", () => {
  it("generates a slug from the prompt", () => {
    expect(deriveTargetPath("Create Landing Page")).toBe(
      "design-artifacts/create-landing-page.html",
    );
  });

  it("handles multiple spaces and special characters", () => {
    expect(deriveTargetPath("Build a  Form! @#$%")).toBe("design-artifacts/build-a-form.html");
  });

  it("truncates long prompts", () => {
    const longPrompt = "a".repeat(100);
    const path = deriveTargetPath(longPrompt);
    expect(path.length).toBeLessThan(100);
    expect(path).toMatch(/^design-artifacts\//);
  });

  it("uses untitled fallback for empty-like prompts", () => {
    expect(deriveTargetPath("   ")).toBe("design-artifacts/untitled.html");
  });
});
