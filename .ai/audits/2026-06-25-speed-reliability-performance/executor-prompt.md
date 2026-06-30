---
type: executor-prompt
title: Speed, Reliability & Performance — Task 1 (Low-Risk Fixes)
slug: speed-reliability-performance
created: 2026-06-25
status: ready
target: apps/server (SQLite WAL, list-query LIMIT), apps/web (storeSelectors stub, Zustand memoization)
related:
  - audit.html
---

You are implementing **Task 1** of the Speed, Reliability & Performance audit for the T3 Code monorepo. This task covers four low-to-medium risk fixes. Do not touch provider adapters, checkpoint reactor, auth, or the read-model array structure — those are out of scope.

## Context

- Stack: Effect-TS 4.0 beta on Node/Bun, SQLite via `@effect/sql-sqlite-bun`, React + Zustand on the web
- Repo root: monorepo with `apps/server`, `apps/web`, `packages/client-runtime`, `packages/contracts`

---

## Fix 1 — Enable SQLite WAL mode (High priority)

**Why**: SQLite defaults to DELETE journal mode, which blocks all concurrent reads during any write. WAL mode enables concurrent reads, dramatically reducing read latency during high-frequency event ingestion.

**Steps**:

1. Open `apps/server/src/persistence/NodeSqliteClient.ts` and read the full file.
2. Find where the SQLite connection is opened (look for `Database`, `SqlClient`, or connection factory).
3. Immediately after opening, execute:
   ```sql
   PRAGMA journal_mode=WAL;
   PRAGMA synchronous=NORMAL;
   ```
   In Effect-sql, this looks like:
   ```ts
   yield * sql`PRAGMA journal_mode=WAL`;
   yield * sql`PRAGMA synchronous=NORMAL`;
   ```
4. If there is already a WAL pragma, confirm it and skip this fix.
5. If a migration would be cleaner (e.g., the connection setup doesn't easily allow pragmas), add it as `apps/server/src/persistence/Migrations/034_WalMode.ts` following the pattern of sibling migrations.

**Constraint**: WAL is a connection-level pragma — it does NOT require a migration to be run per database row. One pragma call is sufficient. Do not add a migration unless the connection setup forces it.

---

## Fix 2 — Add LIMIT to TurnCost list queries (Medium priority)

**Why**: `listByThreadId` and `listByProjectId` return all rows with no bound. Threads with hundreds of turns will materialize hundreds of rows on every call.

**Steps**:

1. Read `apps/server/src/persistence/Services/TurnCosts.ts` — find `TurnCostRepositoryShape`.
2. Add an optional `limit?: number` parameter to `listByThreadId` and `listByProjectId` signatures:
   ```ts
   readonly listByThreadId: (
     threadId: ThreadId,
     options?: { readonly limit?: number },
   ) => Effect.Effect<ReadonlyArray<TurnCostRow>, ProjectionRepositoryError>;
   ```
3. Read `apps/server/src/persistence/Layers/TurnCosts.ts:56–107`.
4. Update `listTurnCostsByThreadId` and `listTurnCostsByProjectId` SQL:
   - Add `LIMIT ${limit ?? 200}` at the end of each query.
   - The `SqlSchema.findAll` request struct must include the limit parameter — add it.
5. Update the wrapper functions `listByThreadId` and `listByProjectId` to forward the options.
6. Search for all callers of `listByThreadId` and `listByProjectId` in `apps/server/src/`:
   ```bash
   grep -rn "listByThreadId\|listByProjectId" apps/server/src/
   ```
   For each caller, verify it does not depend on receiving the full unbounded result. If a caller needs totals, redirect it to the aggregate queries instead.

---

## Fix 3 — Implement storeSelectors stub (Low priority)

**Why**: `createThreadSelectorAcrossEnvironments` always returns `null`, making it useless and a silent failure surface.

**Steps**:

1. Read `apps/web/src/storeSelectors.ts` in full.
2. Read `apps/web/src/store.ts` — understand `AppState`, `EnvironmentState`, and `threadShellById`.
3. Read `apps/web/src/types.ts` (or wherever `SidebarThreadSummary` / `EnvironmentThreadShell` is defined) to understand the thread shape.
4. Implement `createThreadSelectorAcrossEnvironments`:
   ```ts
   export function createThreadSelectorAcrossEnvironments(
     threadId: ThreadId | null,
   ): (state: AppState) => EnvironmentThread | null {
     if (threadId === null) return () => null;
     return (state) => {
       for (const env of Object.values(state.environments)) {
         const thread = env.threadShellById[threadId as ThreadId];
         if (thread) return thread as unknown as EnvironmentThread;
       }
       return null;
     };
   }
   ```
   Adjust the return type and lookup to match the actual types in the project. Do not use `any`.
5. Verify the return type matches what `EnvironmentThread` from `@t3tools/client-runtime/state/models` defines.

---

## Fix 4 — Memoize Zustand selector work in workspaceOverviewSelectors (Medium priority)

**Why**: `selectSidebarThreadsAcrossEnvironments` is called independently in `selectOverviewStats`, `selectAttentionItems`, `selectActiveWorkThreads`, `selectRecentThreads`, and `selectHasThreads`. During streaming turns, state updates are frequent and each update triggers all five calls.

**Steps**:

1. Read `apps/web/src/workspaceOverviewSelectors.ts` in full.
2. Read `apps/web/src/store.ts` — understand how `selectSidebarThreadsAcrossEnvironments` is defined.
3. **Option A (recommended if these selectors are only used inside React components)**: Refactor the five exported functions to accept a pre-computed `threads: EnvironmentThreadShell[]` parameter, removing the internal call to `selectSidebarThreadsAcrossEnvironments`. Callers use `useMemo` to compute threads once:
   ```ts
   const threads = useMemo(
     () => selectSidebarThreadsAcrossEnvironments(state),
     [state.environments],
   );
   const stats = selectOverviewStats(threads);
   const items = selectAttentionItems(threads);
   ```
4. **Option B (if the selectors are used outside React)**: Create a memoized selector wrapper using a simple last-result cache:
   ```ts
   let lastEnvRef: typeof state.environments | undefined;
   let lastThreads: EnvironmentThreadShell[] | undefined;
   function cachedThreads(state: AppState) {
     if (state.environments !== lastEnvRef) {
       lastEnvRef = state.environments;
       lastThreads = selectSidebarThreadsAcrossEnvironments(state);
     }
     return lastThreads!;
   }
   ```
   Then have all five selectors call `cachedThreads(state)` instead of `selectSidebarThreadsAcrossEnvironments(state)`.
5. Also fix `selectRecentThreads`: it currently does `[...threads].sort(...)` on every call. Move the sort into the cached computation or memoize it separately.
6. Check all call sites of these selectors in `apps/web/src/components/` to understand which option is correct:
   ```bash
   grep -rn "selectOverviewStats\|selectAttentionItems\|selectActiveWorkThreads\|selectRecentThreads\|selectHasThreads" apps/web/src/
   ```

---

## Code Quality Rules

- Do not use `any`.
- Do not introduce new dependencies.
- Do not refactor beyond what is described.
- Match existing Effect-TS patterns in `apps/server/src/persistence/`.
- Match existing Zustand patterns in `apps/web/src/`.
- No comments unless the reasoning is non-obvious.

---

## Validation

After making changes:

```bash
# Type-check the whole repo
pnpm typecheck

# Run server tests
pnpm --filter t3 test

# Run web tests
pnpm --filter @t3tools/web test
```

All three commands must pass with no new errors.

---

## Acceptance Criteria

1. `PRAGMA journal_mode` returns `wal` when queried against the running server SQLite database.
2. `listByThreadId` and `listByProjectId` have a `limit` option and default to at most 200 rows.
3. `createThreadSelectorAcrossEnvironments("some-thread-id")` returns the matching thread shell when one exists in state; returns `null` when not found.
4. The five overview selectors in `workspaceOverviewSelectors.ts` compute `selectSidebarThreadsAcrossEnvironments` at most once per state reference, not five times independently.
5. `pnpm typecheck` passes.
6. Existing test suites pass without modification.
