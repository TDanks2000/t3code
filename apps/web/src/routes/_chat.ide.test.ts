import { describe, it, expect } from "vite-plus/test";
import { parseIdeRouteSearch } from "./_chat.ide.search";

describe("parseIdeRouteSearch", () => {
  it("returns empty object when no environmentId is provided", () => {
    expect(parseIdeRouteSearch({})).toEqual({});
  });

  it("returns environmentId when a valid string is provided", () => {
    const result = parseIdeRouteSearch({ environmentId: "env-123" });
    expect(result).toEqual({ environmentId: "env-123" });
  });

  it("returns workspaceRoot when a valid string is provided", () => {
    const result = parseIdeRouteSearch({
      environmentId: "env-123",
      workspaceRoot: "/tmp/project",
    });
    expect(result).toEqual({ environmentId: "env-123", workspaceRoot: "/tmp/project" });
  });

  it("ignores non-string environmentId values", () => {
    expect(parseIdeRouteSearch({ environmentId: 123 })).toEqual({});
    expect(parseIdeRouteSearch({ environmentId: true })).toEqual({});
    expect(parseIdeRouteSearch({ environmentId: null })).toEqual({});
    expect(parseIdeRouteSearch({ environmentId: ["abc"] })).toEqual({});
  });

  it("ignores empty string environmentId", () => {
    expect(parseIdeRouteSearch({ environmentId: "" })).toEqual({});
  });

  it("ignores empty string workspaceRoot", () => {
    expect(parseIdeRouteSearch({ environmentId: "env-123", workspaceRoot: "" })).toEqual({
      environmentId: "env-123",
    });
  });

  it("preserves whitespace environmentId (trimming happens at the schema level)", () => {
    expect(parseIdeRouteSearch({ environmentId: "   " })).toEqual({ environmentId: "   " });
  });
});
