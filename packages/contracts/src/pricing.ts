interface ModelPricing {
  inputPer1K: number;
  outputPer1K: number;
  cachedInputPer1K?: number;
}

const PRICING_BY_MODEL: Record<string, ModelPricing> = {
  "gpt-5.4": { inputPer1K: 0.01, outputPer1K: 0.04 },
  "gpt-5.4-codex": { inputPer1K: 0.01, outputPer1K: 0.04 },
  "gpt-5.3-codex": { inputPer1K: 0.005, outputPer1K: 0.02 },
  "gpt-5.3-codex-spark": { inputPer1K: 0.0025, outputPer1K: 0.01 },
  "gpt-5.4-mini": { inputPer1K: 0.0025, outputPer1K: 0.01 },
  "gpt-5-mini-codex": { inputPer1K: 0.0015, outputPer1K: 0.006 },
  "gpt-4.1-codex": { inputPer1K: 0.02, outputPer1K: 0.08 },
  "gpt-4.1-mini-codex": { inputPer1K: 0.004, outputPer1K: 0.016 },
  "gpt-4.1-nano-codex": { inputPer1K: 0.001, outputPer1K: 0.004 },
  "o3-codex": { inputPer1K: 0.01, outputPer1K: 0.04 },
  "o4-mini-codex": { inputPer1K: 0.0011, outputPer1K: 0.0044 },
  "claude-sonnet-4-6": { inputPer1K: 0.003, outputPer1K: 0.015 },
  "claude-sonnet-4-5": { inputPer1K: 0.003, outputPer1K: 0.015 },
  "claude-haiku-4-5": { inputPer1K: 0.0008, outputPer1K: 0.004 },
  "claude-opus-4-8": { inputPer1K: 0.015, outputPer1K: 0.075 },
  "claude-opus-4-7": { inputPer1K: 0.015, outputPer1K: 0.075 },
  "claude-opus-4-6": { inputPer1K: 0.015, outputPer1K: 0.075 },
  "grok-build": { inputPer1K: 0.003, outputPer1K: 0.015 },
  "grok-3": { inputPer1K: 0.003, outputPer1K: 0.015 },
  "grok-2": { inputPer1K: 0.002, outputPer1K: 0.01 },
  "openai/gpt-5": { inputPer1K: 0.01, outputPer1K: 0.04 },
  auto: { inputPer1K: 0.003, outputPer1K: 0.015 },
  "composer-2": { inputPer1K: 0.003, outputPer1K: 0.015 },
  "composer-1.5": { inputPer1K: 0.003, outputPer1K: 0.015 },
};

export function getModelPricing(
  model: string,
): { inputPer1K: number; outputPer1K: number } | undefined {
  return PRICING_BY_MODEL[model];
}

export function computeCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens?: number,
): number | undefined {
  const pricing = PRICING_BY_MODEL[model];
  if (!pricing) return undefined;

  const effectiveInput = Math.max(0, inputTokens - (cachedInputTokens ?? 0));
  const cachedInput = cachedInputTokens ?? 0;
  const cachedRate = pricing.cachedInputPer1K ?? pricing.inputPer1K * 0.5;

  const inputCost = (effectiveInput / 1000) * pricing.inputPer1K;
  const cachedCost = (cachedInput / 1000) * cachedRate;
  const outputCost = (outputTokens / 1000) * pricing.outputPer1K;

  return Math.round((inputCost + cachedCost + outputCost) * 10000) / 10000;
}

export function computeCostFromTokens(
  model: string,
  tokens: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number },
): number | undefined {
  return computeCost(
    model,
    tokens.inputTokens ?? 0,
    tokens.outputTokens ?? 0,
    tokens.cachedInputTokens,
  );
}
