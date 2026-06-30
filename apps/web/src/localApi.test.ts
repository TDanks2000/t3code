import {
  DEFAULT_CLIENT_SETTINGS,
  type ContextMenuItem,
  type DesktopBridge,
  EnvironmentId,
  type TerminalAttachStreamEvent,
  type TerminalMetadataStreamEvent,
  type OrchestrationShellStreamItem,
  type VcsStatusResult,
} from "@t3tools/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const showContextMenuFallbackMock =
  vi.fn<
    <T extends string>(
      items: readonly ContextMenuItem<T>[],
      position?: { x: number; y: number },
    ) => Promise<T | null>
  >();

function registerListener<T>(listeners: Set<(event: T) => void>, listener: (event: T) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const terminalAttachListeners = new Set<(event: TerminalAttachStreamEvent) => void>();
const terminalMetadataListeners = new Set<(event: TerminalMetadataStreamEvent) => void>();
const shellStreamListeners = new Set<(event: OrchestrationShellStreamItem) => void>();
const gitStatusListeners = new Set<(event: VcsStatusResult) => void>();

const rpcClientMock = {
  dispose: vi.fn(),
  terminal: {
    open: vi.fn(),
    attach: vi.fn((_input: unknown, listener: (event: TerminalAttachStreamEvent) => void) =>
      registerListener(terminalAttachListeners, listener),
    ),
    write: vi.fn(),
    resize: vi.fn(),
    clear: vi.fn(),
    restart: vi.fn(),
    close: vi.fn(),
    onMetadata: vi.fn((listener: (event: TerminalMetadataStreamEvent) => void) =>
      registerListener(terminalMetadataListeners, listener),
    ),
  },
  projects: {
    searchEntries: vi.fn(),
    writeFile: vi.fn(),
  },
  filesystem: {
    browse: vi.fn(),
  },
  diagnostics: {
    run: vi.fn(),
  },
  workspace: {
    getFileTree: vi.fn(),
    readTextFile: vi.fn(),
    writeTextFile: vi.fn(),
  },
  sourceControl: {
    lookupRepository: vi.fn(),
    cloneRepository: vi.fn(),
    publishRepository: vi.fn(),
  },
  shell: {
    openInEditor: vi.fn(),
  },
  vcs: {
    pull: vi.fn(),
    refreshStatus: vi.fn(),
    onStatus: vi.fn((input: { cwd: string }, listener: (event: VcsStatusResult) => void) =>
      registerListener(gitStatusListeners, listener),
    ),
    listRefs: vi.fn(),
    createWorktree: vi.fn(),
    removeWorktree: vi.fn(),
    createRef: vi.fn(),
    switchRef: vi.fn(),
    init: vi.fn(),
  },
  git: {
    runStackedAction: vi.fn(),
    resolvePullRequest: vi.fn(),
    preparePullRequestThread: vi.fn(),
  },
  gitReview: {
    getStatus: vi.fn(),
    getFileDiff: vi.fn(),
    revertFile: vi.fn(),
  },
  review: {
    getDiffPreview: vi.fn(),
  },
  server: {
    getConfig: vi.fn(),
    refreshProviders: vi.fn(),
    updateProvider: vi.fn(),
    upsertKeybinding: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    subscribeConfig: vi.fn(),
    subscribeLifecycle: vi.fn(),
    subscribeAuthAccess: vi.fn(),
  },
  orchestration: {
    dispatchCommand: vi.fn(),
    getTurnDiff: vi.fn(),
    getFullThreadDiff: vi.fn(),
    subscribeShell: vi.fn((listener: (event: OrchestrationShellStreamItem) => void) =>
      registerListener(shellStreamListeners, listener),
    ),
    subscribeThread: vi.fn(() => () => undefined),
  },
};

vi.mock("./environments/runtime", () => ({
  getPrimaryEnvironmentConnection: () => ({
    kind: "primary" as const,
    knownEnvironment: {
      id: "environment-local",
      label: "Primary",
      source: "manual" as const,
      target: {
        httpBaseUrl: "http://localhost:3000",
        wsBaseUrl: "ws://localhost:3000",
      },
      environmentId: EnvironmentId.make("environment-local"),
    },
    client: rpcClientMock,
    environmentId: EnvironmentId.make("environment-local"),
    ensureBootstrapped: async () => undefined,
    reconnect: async () => undefined,
    dispose: async () => undefined,
  }),
  resetEnvironmentServiceForTests: vi.fn(),
  resetSavedEnvironmentRegistryStoreForTests: vi.fn(),
  resetSavedEnvironmentRuntimeStoreForTests: vi.fn(),
  subscribeEnvironmentConnections: vi.fn(() => () => undefined),
}));

vi.mock("./contextMenuFallback", () => ({
  showContextMenuFallback: showContextMenuFallbackMock,
}));

function createLocalStorageStub(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  };
}

function testWindow(): Window & typeof globalThis {
  return globalThis.window ?? (globalThis as unknown as Window & typeof globalThis);
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  if (globalThis.window === undefined) {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: globalThis,
    });
  }
  Reflect.deleteProperty(testWindow(), "desktopBridge");
  Reflect.deleteProperty(testWindow(), "nativeApi");
  Object.defineProperty(testWindow(), "localStorage", {
    configurable: true,
    value: createLocalStorageStub(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LocalApi", () => {
  it("keeps backend operations unavailable in the browser facade", async () => {
    const { createLocalApi } = await import("./localApi");
    const api = createLocalApi();

    await expect(api.server.getConfig()).rejects.toThrow(
      "Local backend API is unavailable before a backend is paired.",
    );
    await expect(api.shell.openInEditor("/tmp", "cursor")).rejects.toThrow(
      "Local backend API is unavailable before a backend is paired.",
    );
  });

  it("uses the browser context-menu fallback without a desktop bridge", async () => {
    showContextMenuFallbackMock.mockResolvedValue("rename");
    const { createLocalApi } = await import("./localApi");
    const items = [{ id: "rename", label: "Rename" }] as const;

    await expect(createLocalApi().contextMenu.show(items, { x: 4, y: 5 })).resolves.toBe("rename");
    expect(showContextMenuFallbackMock).toHaveBeenCalledWith(items, { x: 4, y: 5 });
  });

  it("delegates host capabilities and persistence to the desktop bridge", async () => {
    const showContextMenu = vi.fn().mockResolvedValue("delete");
    const pickFolder = vi.fn().mockResolvedValue("/tmp/project");
    const getClientSettings = vi.fn().mockResolvedValue(DEFAULT_CLIENT_SETTINGS);
    const setClientSettings = vi.fn().mockResolvedValue(undefined);
    testWindow().desktopBridge = {
      showContextMenu,
      pickFolder,
      getClientSettings,
      setClientSettings,
    } as unknown as DesktopBridge;

    const { createLocalApi } = await import("./localApi");
    const api = createLocalApi();
    const items = [{ id: "delete", label: "Delete" }] as const;

    await expect(api.contextMenu.show(items)).resolves.toBe("delete");
    await expect(api.dialogs.pickFolder({ initialPath: "/tmp" })).resolves.toBe("/tmp/project");
    await expect(api.persistence.getClientSettings()).resolves.toEqual(DEFAULT_CLIENT_SETTINGS);
    await api.persistence.setClientSettings(DEFAULT_CLIENT_SETTINGS);

    expect(showContextMenu).toHaveBeenCalledWith(items, undefined);
    expect(pickFolder).toHaveBeenCalledWith({ initialPath: "/tmp" });
    expect(getClientSettings).toHaveBeenCalledTimes(1);
    expect(setClientSettings).toHaveBeenCalledWith(DEFAULT_CLIENT_SETTINGS);
  });

  it("persists client settings in browser storage", async () => {
    const { createLocalApi } = await import("./localApi");
    const api = createLocalApi();
    const settings = {
      ...DEFAULT_CLIENT_SETTINGS,
      timestampFormat: "12-hour" as const,
    };

    await api.persistence.setClientSettings(settings);
    await expect(api.persistence.getClientSettings()).resolves.toEqual(settings);
  });

  it("prefers the native LocalApi when one is injected", async () => {
    const nativeApi = { dialogs: {} };
    testWindow().nativeApi = nativeApi as never;
    const { readLocalApi } = await import("./localApi");

    expect(readLocalApi()).toBe(nativeApi);
  });
});
