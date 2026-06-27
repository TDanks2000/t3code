import { useCallback, useEffect, useMemo, useState } from "react";
import { workspaceTerminalThreadRef } from "@t3tools/client-runtime/workspaceTerminal";
import type { EnvironmentId } from "@t3tools/contracts";
import { nextTerminalId, resolveTerminalSessionLabel } from "@t3tools/shared/terminalLabels";
import { projectScriptRuntimeEnv } from "@t3tools/shared/projectScripts";

import { useAtomValue } from "@effect/atom-react";

import { readEnvironmentApi } from "../../environmentApi";
import { primaryServerKeybindingsAtom } from "../../state/server";
import { useKnownTerminalSessions } from "../../state/terminalSessions";
import { selectThreadTerminalUiState, useTerminalUiStateStore } from "../../terminalUiStateStore";
import { DEFAULT_THREAD_TERMINAL_ID, DEFAULT_THREAD_TERMINAL_HEIGHT } from "../../types";
import ThreadTerminalDrawer from "../ThreadTerminalDrawer";

interface IdeTerminalPanelProps {
  readonly environmentId: EnvironmentId | null;
  readonly workspaceRoot: string | null;
}

function terminalIdListsEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function serverTerminalIdsStrictSubsetOfClient(
  serverIds: readonly string[],
  clientIds: readonly string[],
): boolean {
  if (serverIds.length >= clientIds.length || clientIds.length === 0) {
    return false;
  }
  const clientSet = new Set(clientIds);
  return serverIds.every((id) => clientSet.has(id));
}

export function IdeTerminalPanel({ environmentId, workspaceRoot }: IdeTerminalPanelProps) {
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const [focusRequestId, setFocusRequestId] = useState(0);
  const terminalThreadRef = useMemo(
    () =>
      environmentId && workspaceRoot
        ? workspaceTerminalThreadRef({ environmentId, workspaceRoot })
        : null,
    [environmentId, workspaceRoot],
  );
  const terminalThreadId = terminalThreadRef?.threadId ?? null;
  const terminalUiState = useTerminalUiStateStore((state) =>
    selectThreadTerminalUiState(state.terminalUiStateByThreadKey, terminalThreadRef),
  );
  const knownTerminalSessions = useKnownTerminalSessions({
    environmentId,
    threadId: terminalThreadId,
  });
  const serverOrderedTerminalIds = useMemo(
    () => knownTerminalSessions.map((session) => session.target.terminalId),
    [knownTerminalSessions],
  );
  const knownTerminalIds = useMemo(
    () => [...new Set([...serverOrderedTerminalIds, ...terminalUiState.terminalIds])],
    [serverOrderedTerminalIds, terminalUiState.terminalIds],
  );
  const terminalLabelsById = useMemo(() => {
    const next = new Map<string, string>();
    for (const session of knownTerminalSessions) {
      next.set(
        session.target.terminalId,
        resolveTerminalSessionLabel(session.target.terminalId, session.state.summary),
      );
    }
    return next;
  }, [knownTerminalSessions]);
  const runtimeEnv = useMemo(
    () => (workspaceRoot ? projectScriptRuntimeEnv({ project: { cwd: workspaceRoot } }) : {}),
    [workspaceRoot],
  );
  const setTerminalOpen = useTerminalUiStateStore((state) => state.setTerminalOpen);
  const setTerminalHeight = useTerminalUiStateStore((state) => state.setTerminalHeight);
  const splitTerminalInStore = useTerminalUiStateStore((state) => state.splitTerminal);
  const splitTerminalVerticalInStore = useTerminalUiStateStore((state) => state.splitTerminalVertical);
  const newTerminalInStore = useTerminalUiStateStore((state) => state.newTerminal);
  const setActiveTerminal = useTerminalUiStateStore((state) => state.setActiveTerminal);
  const closeTerminalInStore = useTerminalUiStateStore((state) => state.closeTerminal);
  const reconcileTerminalIds = useTerminalUiStateStore((state) => state.reconcileTerminalIds);

  useEffect(() => {
    if (!terminalThreadRef) return;
    setTerminalOpen(terminalThreadRef, true);
  }, [setTerminalOpen, terminalThreadRef]);

  useEffect(() => {
    if (!terminalThreadRef) return;
    if (terminalIdListsEqual(serverOrderedTerminalIds, terminalUiState.terminalIds)) {
      return;
    }
    if (
      serverTerminalIdsStrictSubsetOfClient(serverOrderedTerminalIds, terminalUiState.terminalIds)
    ) {
      return;
    }
    reconcileTerminalIds(terminalThreadRef, serverOrderedTerminalIds);
  }, [
    reconcileTerminalIds,
    serverOrderedTerminalIds,
    terminalThreadRef,
    terminalUiState.terminalIds,
  ]);

  const openTerminal = useCallback(
    (terminalId: string) => {
      if (!environmentId || !terminalThreadId || !workspaceRoot) return;
      const api = readEnvironmentApi(environmentId);
      if (!api) return;
      setFocusRequestId((value) => value + 1);
      void api.terminal
        .open({
          threadId: terminalThreadId,
          terminalId,
          cwd: workspaceRoot,
          env: runtimeEnv,
        })
        .catch(() => undefined);
    },
    [environmentId, runtimeEnv, terminalThreadId, workspaceRoot],
  );

  const splitTerminal = useCallback(() => {
    if (!terminalThreadRef) return;
    const terminalId = nextTerminalId(knownTerminalIds);
    splitTerminalInStore(terminalThreadRef, terminalId);
    openTerminal(terminalId);
  }, [knownTerminalIds, openTerminal, splitTerminalInStore, terminalThreadRef]);

  const splitTerminalVertical = useCallback(() => {
    if (!terminalThreadRef) return;
    const terminalId = nextTerminalId(knownTerminalIds);
    splitTerminalVerticalInStore(terminalThreadRef, terminalId);
    openTerminal(terminalId);
  }, [knownTerminalIds, openTerminal, splitTerminalVerticalInStore, terminalThreadRef]);

  const createNewTerminal = useCallback(() => {
    if (!terminalThreadRef) return;
    const terminalId = nextTerminalId(knownTerminalIds);
    newTerminalInStore(terminalThreadRef, terminalId);
    openTerminal(terminalId);
  }, [knownTerminalIds, newTerminalInStore, openTerminal, terminalThreadRef]);

  const activateTerminal = useCallback(
    (terminalId: string) => {
      if (!terminalThreadRef) return;
      setActiveTerminal(terminalThreadRef, terminalId);
      setFocusRequestId((value) => value + 1);
    },
    [setActiveTerminal, terminalThreadRef],
  );

  const closeTerminal = useCallback(
    (terminalId: string) => {
      if (!environmentId || !terminalThreadId || !terminalThreadRef) return;
      const api = readEnvironmentApi(environmentId);
      if (!api) return;
      const isFinalTerminal = knownTerminalIds.length <= 1;
      void (async () => {
        if (isFinalTerminal) {
          await api.terminal
            .clear({ threadId: terminalThreadId, terminalId })
            .catch(() => undefined);
        }
        await api.terminal.close({
          threadId: terminalThreadId,
          terminalId,
          deleteHistory: true,
        });
      })().catch(() =>
        api.terminal.write({ threadId: terminalThreadId, terminalId, data: "exit\n" }),
      );
      closeTerminalInStore(terminalThreadRef, terminalId);
      setFocusRequestId((value) => value + 1);
    },
    [
      closeTerminalInStore,
      environmentId,
      knownTerminalIds.length,
      terminalThreadId,
      terminalThreadRef,
    ],
  );

  if (!terminalThreadRef || !terminalThreadId || !workspaceRoot) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <p className="text-[11px] text-muted-foreground/40">
          Open a workspace to use the terminal.
        </p>
      </div>
    );
  }

  const terminalIds =
    terminalUiState.terminalIds.length > 0
      ? terminalUiState.terminalIds
      : [DEFAULT_THREAD_TERMINAL_ID];

  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <ThreadTerminalDrawer
        threadRef={terminalThreadRef}
        threadId={terminalThreadId}
        cwd={workspaceRoot}
        runtimeEnv={runtimeEnv}
        visible
        height={terminalUiState.terminalHeight || DEFAULT_THREAD_TERMINAL_HEIGHT}
        terminalIds={terminalIds}
        activeTerminalId={terminalUiState.activeTerminalId || terminalIds[0] || ""}
        terminalGroups={terminalUiState.terminalGroups}
        activeTerminalGroupId={terminalUiState.activeTerminalGroupId}
        focusRequestId={focusRequestId}
        onSplitTerminal={splitTerminal}
        onSplitTerminalVertical={splitTerminalVertical}
        onNewTerminal={createNewTerminal}
        onActiveTerminalChange={activateTerminal}
        onCloseTerminal={closeTerminal}
        onHeightChange={(height) => setTerminalHeight(terminalThreadRef, height)}
        onAddTerminalContext={() => undefined}
        keybindings={keybindings}
        terminalLabelsById={terminalLabelsById}
      />
    </div>
  );
}
