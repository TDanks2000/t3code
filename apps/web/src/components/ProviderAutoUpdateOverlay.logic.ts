import type { ProviderDriverKind, ProviderInstanceId, ServerProvider } from "@t3tools/contracts";

export type ProviderAutoUpdatePhase = "checking" | "updating" | "done" | "failed" | "skipped";

export interface ProviderAutoUpdateStatus {
  readonly instanceId: ProviderInstanceId;
  readonly driver: ProviderDriverKind;
  readonly displayName: string;
  readonly currentVersion: string | null;
  readonly latestVersion: string | null;
  readonly changelogUrl: string | null;
  readonly updateStatus: "pending" | "queued" | "running" | "succeeded" | "failed" | "unchanged";
  readonly message: string | null;
}

export interface ProviderAutoUpdateSessionState {
  readonly phase: ProviderAutoUpdatePhase;
  readonly providers: ReadonlyArray<ProviderAutoUpdateStatus>;
}

export function isProviderAutoUpdateCandidate(provider: ServerProvider): boolean {
  return (
    provider.enabled &&
    provider.versionAdvisory?.status === "behind_latest" &&
    provider.versionAdvisory.latestVersion !== null &&
    provider.versionAdvisory.canUpdate === true
  );
}

export function buildAutoUpdateStatus(provider: ServerProvider): ProviderAutoUpdateStatus {
  const updateStatus =
    provider.updateState?.status === "running" || provider.updateState?.status === "queued"
      ? provider.updateState.status
      : "pending";
  return {
    instanceId: provider.instanceId,
    driver: provider.driver,
    displayName: provider.driver,
    currentVersion: provider.version ?? null,
    latestVersion: provider.versionAdvisory?.latestVersion ?? null,
    changelogUrl: provider.versionAdvisory?.changelogUrl ?? null,
    updateStatus:
      provider.updateState?.status === "succeeded"
        ? "succeeded"
        : provider.updateState?.status === "failed"
          ? "failed"
          : provider.updateState?.status === "unchanged"
            ? "unchanged"
            : updateStatus === "queued"
              ? "queued"
              : updateStatus === "running"
                ? "running"
                : "pending",
    message: provider.updateState?.message ?? null,
  };
}

export function collectAutoUpdateSessionState(providers: ReadonlyArray<ServerProvider>): {
  readonly candidates: ReadonlyArray<ServerProvider>;
  readonly statuses: ReadonlyArray<ProviderAutoUpdateStatus>;
} {
  const candidates = providers.filter(isProviderAutoUpdateCandidate);
  const statuses = candidates.map(buildAutoUpdateStatus);
  return { candidates, statuses };
}

export function allUpdatesTerminal(statuses: ReadonlyArray<ProviderAutoUpdateStatus>): boolean {
  return (
    statuses.length > 0 &&
    statuses.every(
      (s) =>
        s.updateStatus === "succeeded" ||
        s.updateStatus === "failed" ||
        s.updateStatus === "unchanged",
    )
  );
}

export function anyUpdatesFailed(statuses: ReadonlyArray<ProviderAutoUpdateStatus>): boolean {
  return statuses.some((s) => s.updateStatus === "failed");
}
