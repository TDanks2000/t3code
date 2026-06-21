import { describe, expect, it } from "vite-plus/test";
import * as Schema from "effect/Schema";

import {
  GitReviewStatusResult,
  GitReviewFileDiffResult,
  GitReviewRevertFileResult,
  GitChangedFile,
  GitFileStatus,
} from "./gitReview.ts";

const decodeStatus = Schema.decodeUnknownSync(GitReviewStatusResult);
const decodeDiff = Schema.decodeUnknownSync(GitReviewFileDiffResult);
const decodeRevert = Schema.decodeUnknownSync(GitReviewRevertFileResult);
const decodeChangedFile = Schema.decodeUnknownSync(GitChangedFile);

describe("GitFileStatus", () => {
  it("accepts valid status values", () => {
    const decode = Schema.decodeUnknownSync(GitFileStatus);
    expect(decode("modified")).toBe("modified");
    expect(decode("added")).toBe("added");
    expect(decode("deleted")).toBe("deleted");
    expect(decode("renamed")).toBe("renamed");
    expect(decode("copied")).toBe("copied");
    expect(decode("untracked")).toBe("untracked");
    expect(decode("conflicted")).toBe("conflicted");
    expect(decode("unknown")).toBe("unknown");
  });
});

describe("GitChangedFile", () => {
  it("accepts a minimal changed file", () => {
    const parsed = decodeChangedFile({
      path: "src/index.ts",
      status: "modified",
    });
    expect(parsed.path).toBe("src/index.ts");
    expect(parsed.status).toBe("modified");
  });

  it("accepts a renamed file with oldPath", () => {
    const parsed = decodeChangedFile({
      path: "src/index.ts",
      status: "renamed",
      oldPath: "src/old.ts",
    });
    expect(parsed.oldPath).toBe("src/old.ts");
  });

  it("accepts additions and deletions", () => {
    const parsed = decodeChangedFile({
      path: "src/index.ts",
      status: "modified",
      additions: 5,
      deletions: 3,
    });
    expect(parsed.additions).toBe(5);
    expect(parsed.deletions).toBe(3);
  });
});

describe("GitReviewStatusResult", () => {
  it("accepts ok status with clean state", () => {
    const parsed = decodeStatus({
      status: "ok",
      changedFiles: [],
      isClean: true,
    });
    expect(parsed.status).toBe("ok");
    if (parsed.status === "ok") {
      expect(parsed.isClean).toBe(true);
      expect(parsed.changedFiles).toEqual([]);
    }
  });

  it("accepts ok status with files", () => {
    const parsed = decodeStatus({
      status: "ok",
      changedFiles: [{ path: "src/index.ts", status: "modified" }],
      isClean: false,
    });
    expect(parsed.status).toBe("ok");
    if (parsed.status === "ok") {
      expect(parsed.changedFiles).toHaveLength(1);
    }
  });

  it("accepts ok status with optional branch", () => {
    const parsed = decodeStatus({
      status: "ok",
      branch: "main",
      changedFiles: [],
      isClean: true,
    });
    expect(parsed.status).toBe("ok");
    if (parsed.status === "ok") {
      expect(parsed.branch).toBe("main");
    }
  });

  it("accepts not_repo status", () => {
    const parsed = decodeStatus({
      status: "not_repo",
      message: "Not a Git repository.",
    });
    expect(parsed.status).toBe("not_repo");
  });

  it("accepts error status", () => {
    const parsed = decodeStatus({
      status: "error",
      detail: "Something went wrong.",
    });
    expect(parsed.status).toBe("error");
  });
});

describe("GitReviewFileDiffResult", () => {
  it("accepts ok with diff", () => {
    const parsed = decodeDiff({
      status: "ok",
      path: "src/index.ts",
      diff: "--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1 +1 @@\n-old\n+new",
    });
    expect(parsed.status).toBe("ok");
    if (parsed.status === "ok") {
      expect(parsed.diff.length).toBeGreaterThan(0);
    }
  });

  it("accepts not_found", () => {
    const parsed = decodeDiff({ status: "not_found", path: "missing.ts" });
    expect(parsed.status).toBe("not_found");
  });

  it("accepts too_large", () => {
    const parsed = decodeDiff({
      status: "too_large",
      path: "big.ts",
      sizeBytes: 600_000,
      maxSizeBytes: 512_000,
    });
    expect(parsed.status).toBe("too_large");
  });

  it("accepts binary", () => {
    const parsed = decodeDiff({ status: "binary", path: "image.png" });
    expect(parsed.status).toBe("binary");
  });

  it("accepts not_repo", () => {
    const parsed = decodeDiff({
      status: "not_repo",
      message: "Not a Git repository.",
    });
    expect(parsed.status).toBe("not_repo");
  });

  it("accepts error", () => {
    const parsed = decodeDiff({
      status: "error",
      path: "index.ts",
      detail: "Git diff failed.",
    });
    expect(parsed.status).toBe("error");
  });
});

describe("GitReviewRevertFileResult", () => {
  it("accepts ok", () => {
    const parsed = decodeRevert({
      status: "ok",
      path: "src/index.ts",
      revertedAt: "2025-01-01T00:00:00.000Z",
    });
    expect(parsed.status).toBe("ok");
    if (parsed.status === "ok") {
      expect(parsed.revertedAt).toBeTruthy();
    }
  });

  it("accepts not_found", () => {
    const parsed = decodeRevert({ status: "not_found", path: "missing.ts" });
    expect(parsed.status).toBe("not_found");
  });

  it("accepts conflict", () => {
    const parsed = decodeRevert({
      status: "conflict",
      path: "index.ts",
      reason: "Untracked file revert is not supported yet.",
    });
    expect(parsed.status).toBe("conflict");
  });

  it("accepts not_repo", () => {
    const parsed = decodeRevert({
      status: "not_repo",
      message: "Not a Git repository.",
    });
    expect(parsed.status).toBe("not_repo");
  });

  it("accepts error", () => {
    const parsed = decodeRevert({
      status: "error",
      path: "index.ts",
      detail: "Git checkout failed.",
    });
    expect(parsed.status).toBe("error");
  });
});
