---
type: executor-prompt
title: Fix usage tracking for all providers + add per-thread usage stats
slug: per-thread-usage-stats
created: 2026-06-25
status: ready
target: server persistence, provider adapters, WebSocket RPC, contracts, pricing, thread detail UI, settings usage page
related:
  - plan.html
---

# Executor Prompt: Fix Usage Tracking for All Providers + Add Per-Thread Usage Stats

## Critical Context

**Cost/usage tracking is broken for every provider except Claude.** Three independent gaps mean Codex, Grok, Cursor, and OpenCode turns always record $0.00 cost and 0 tokens. Fixing this pipeline is a prerequisite for per-thread usage stats — building UI on top of a broken pipe would show $0.00 for 4/5 providers.

Read these files first:
- `apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts:1590-1665` — the cost ingestion pipeline
- `packages/contracts/src/pricing.ts` — model pricing table
- `packages/contracts/src/model.ts:157-198` — model alias mappings
- `packages/shared/src/model.ts:235-253` — `normalizeModelSlug` helper
- `packages/contracts/src/providerRuntime.ts:308-325` — `ThreadTokenUsageSnapshot`
- `apps/server/src/provider/Layers/ClaudeAdapter.ts:1964-2055` — working example of turn.completed with usage
- `apps/web/src/components/settings/UsageSettingsPanel.tsx` — existing usage page (has code duplication with DashboardPanel)
- `apps/web/src/components/DashboardPanel.tsx` — duplicate usage display
- `apps/web/src/components/chat/ChatHeader.tsx` — where to add per-thread chip

# Phase 1 — Fix Pipeline for All Providers

## Fix 1 — Fallback reads wrong field names

**File:** `apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts:1616-1621`

The fallback only reads `lastInputTokens`, `lastOutputTokens`, etc. OpenCodeAdapter sets `inputTokens` not `lastInputTokens`, so all resolve to 0.

**Change:** Add non-prefixed fallback:

```typescript
inputTokens = cachedUsage.lastInputTokens ?? cachedUsage.inputTokens ?? 0;
outputTokens = cachedUsage.lastOutputTokens ?? cachedUsage.outputTokens ?? 0;
cachedInputTokens = cachedUsage.lastCachedInputTokens ?? cachedUsage.cachedInputTokens ?? 0;
reasoningTokens = cachedUsage.lastReasoningOutputTokens ?? cachedUsage.reasoningOutputTokens ?? 0;
```

## Fix 2 — Model name extraction from `modelUsage` is structurally wrong

**File:** `apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts:1625-1628`

Current code reads `event.payload.modelUsage?.model` — but `modelUsage` is `Record<string, ModelUsage>` where **keys are model names** (e.g. `{ "claude-sonnet-4-6": { ... } }`). There is no `.model` property.

**Change:** Extract from record keys:

```typescript
const modelUsageRecord = event.payload.modelUsage;
const rawModel =
  modelUsageRecord && typeof modelUsageRecord === "object"
    ? (Object.keys(modelUsageRecord).find((k) => typeof k === "string") ?? undefined)
    : undefined;
```

## Fix 3 — Add session model fallback

**File:** `apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts`

When `rawModel` is still undefined after Fix 2, fall back to the thread's session model.

Maintain a `Map<ThreadId, string>` alongside `latestTokenUsageByThread` that caches the model from `session.started` / `session.state-changed` events (which carry a `model` field on their payload).

When ingesting a `turn.completed`:

```typescript
const model = rawModel ?? modelByThread.get(thread.id);
```

## Fix 4 — Apply `normalizeModelSlug` before pricing lookup

**File:** `apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts` (around line 1634)

```typescript
import { normalizeModelSlug } from "@t3tools/shared/model";

const normalizedModel = model ? normalizeModelSlug(model, event.provider) : null;

let costUsd: number | undefined;
if (typeof event.payload.totalCostUsd === "number") {
  costUsd = event.payload.totalCostUsd;
} else if (normalizedModel) {
  costUsd = computeCost(normalizedModel, inputTokens, outputTokens, cachedInputTokens) ?? 0;
} else {
  costUsd = 0;
}
```

Also store `normalizedModel` in the `model` field of the `TurnCostRow` (not the raw/unresolved form).

## Fix 5 — Add alias entries for Grok and OpenCode

**File:** `packages/contracts/src/model.ts`, inside `MODEL_SLUG_ALIASES_BY_PROVIDER`:

```typescript
[GROK_DRIVER_KIND]: {
  "grok": "grok-3",
  "grok-2": "grok-2",
  "grok-3": "grok-3",
  "grok-build": "grok-build",
},
[OPENCODE_DRIVER_KIND]: {
  "openai/gpt-5": "openai/gpt-5",
  "gpt-5": "openai/gpt-5",
},
```

## Fix 6 — Populate `turn.completed.payload.usage` in all adapters

For each non-Claude adapter, extract token counts from the provider's turn-completion data:

- **CodexAdapter** (`CodexAdapter.ts:808`): Read from cached `thread/tokenUsage/updated` last event.
- **GrokAdapter** (`GrokAdapter.ts:868`): Check if completion data has usage.
- **CursorAdapter** (`CursorAdapter.ts:1043`): Extract from completion data.
- **OpenCodeAdapter** (`OpenCodeAdapter.ts:916, 945, 1259`): Map step-completion `input`/`output` token counts to `{ input_tokens, output_tokens }`.

The shape should match what the ingestion expects:
```typescript
payload: {
  ...existingFields,
  usage: { input_tokens: number; output_tokens: number; cached_input_tokens?: number },
}
```

## Fix 7 — Emit `thread.token-usage.updated` from GrokAdapter and CursorAdapter

- **GrokAdapter**: Add emission when context-window updates are available. Follow the pattern in CodexAdapter (`CodexAdapter.ts:768-774`) or OpenCodeAdapter (`OpenCodeAdapter.ts:1013-1025`).
- **CursorAdapter**: Same — add `thread.token-usage.updated` emission.

## Fix 8 — Fix OpenCodeAdapter field names

**File:** `OpenCodeAdapter.ts:1015-1016`

For consistency, also set `lastInputTokens` / `lastOutputTokens` alongside the existing `inputTokens` / `outputTokens`:

```typescript
usage: {
  usedTokens: used,
  totalProcessedTokens: total,
  inputTokens: input,
  outputTokens: output,
  lastInputTokens: input,
  lastOutputTokens: output,
}
```

(This is belt-and-suspenders with Fix 1, but makes the adapter idiomatic with CodexAdapter's pattern.)

---

# Phase 2 — Per-Thread Usage Stats & UI

## A. Server: per-thread aggregate queries

1. Add `aggregateByThreadId(threadId)` to `TurnCostRepositoryShape` in `TurnCosts.ts`
2. Add `aggregateTurnCostsByThreadId` SQL query in `Layers/TurnCosts.ts`
3. Add `aggregateByAllThreads` returning GROUP BY thread_id list
4. Wire into `getUsageSummary` handler in `ws.ts:1846-1897` — check `threadId` first, then `projectId`, then `aggregateAll`

## B. New RPC: `getUsageSummaryByThread`

- Add `WS_METHODS.serverGetUsageSummaryByThread` in `packages/contracts/src/rpc.ts`
- Schema: `{ threadId: ThreadId; totalTurns: number; totalCostUsd: number; totalInputTokens: number; totalOutputTokens: number }`
- Handler in `ws.ts` calling `aggregateByAllThreads`
- Map to `AuthOrchestrationReadScope`

## C. Client shared primitives

3. Create `hooks/useUsageAggregate.ts` — hook supporting `{ threadId?, projectId? }`, handles both Electron `readLocalApi()` and WebSocket `connection.client.server.*` paths
4. Create `components/settings/UsageDisplayComponents.tsx` — extract `StatCard`, `formatUsd`, `formatTokens`, `ModelBarChart`, `RecentToolsList` from the duplicated code in `DashboardPanel` and `UsageSettingsPanel`
5. Refactor `DashboardPanel.tsx` and `UsageSettingsPanel.tsx` to use shared imports

## D. Per-thread chip

6. Create `components/chat/ThreadUsageChip.tsx` — compact Badge showing `$0.12 · 4.2K tokens`, null when loading/zero/error
7. Mount in `ChatHeader.tsx` using the thread's ID

## E. Usage page enhancement

8. Add "Usage by Thread" section to `UsageSettingsPanel.tsx` using `getUsageSummaryByThread` RPC, look up thread titles from `useThreadShells()`, render sortable list, navigate-to-thread on click

---

# Verification

- `vp check` must pass
- `vp run typecheck` must pass
- After Phase 1: manually verify with OpenCode that turns record non-zero tokens and cost
- After Phase 1: verify Claude still works (it should — it never hits the fallback and uses `totalCostUsd`)
- After Phase 2: open a thread with completed turns, verify the chip shows real data
- After Phase 2: open `/settings/usage`, verify thread breakdown

# Constraints

- No `any`
- Follow Effect patterns (`Effect.gen`, pipe, `SqlSchema`)
- Reuse `@t3tools/contracts` types
- No new npm dependencies
- Preserve existing component interfaces
- Don't change ClaudeAdapter behavior
- Don't change TurnCostRow DB schema
