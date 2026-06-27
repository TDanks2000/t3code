import { describe, expect, it } from "vite-plus/test";

import { computeCost, getModelPricing } from "./pricing.ts";

describe("pricing lookup", () => {
  it("prices Codex aliases emitted by runtime selections", () => {
    expect(getModelPricing("gpt-5-codex")).toEqual({
      inputPer1K: 0.01,
      outputPer1K: 0.04,
    });
    expect(computeCost("gpt-5-codex", 1_000, 1_000)).toBe(0.05);
  });

  it("prices provider-prefixed OpenCode model ids", () => {
    expect(getModelPricing("openai/gpt-5.4")).toEqual({
      inputPer1K: 0.01,
      outputPer1K: 0.04,
    });
    expect(computeCost("openai/gpt-5.4", 1_000, 1_000)).toBe(0.05);
  });

  it("prices Cursor model ids with config suffixes", () => {
    expect(getModelPricing("composer-2[fast=true]")).toEqual({
      inputPer1K: 0.003,
      outputPer1K: 0.015,
    });
    expect(computeCost("composer-2[fast=true]", 1_000, 1_000)).toBe(0.018);
  });

  it("prices built-in Claude model aliases used by providers", () => {
    expect(getModelPricing("claude-fable-5")).toEqual({
      inputPer1K: 0.003,
      outputPer1K: 0.015,
    });
    expect(getModelPricing("opus-4.5-thinking")).toEqual({
      inputPer1K: 0.015,
      outputPer1K: 0.075,
    });
  });
});
