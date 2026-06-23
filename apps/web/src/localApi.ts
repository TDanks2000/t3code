import type {
  ContextMenuItem,
  CostAggregate,
  LocalApi,
  ToolInvocationQueryFilter,
  ToolInvocationRecord,
} from "@t3tools/contracts";
import type { WsRpcClient } from "@t3tools/client-runtime";

import { resetRequestLatencyStateForTests } from "./rpc/requestLatencyState";
import { showContextMenuFallback } from "./contextMenuFallback";
import { readBrowserClientSettings, writeBrowserClientSettings } from "./clientPersistenceStorage";

let cachedApi: LocalApi | undefined;

function unavailableLocalBackendError(): Error {
  return new Error("Local backend API is unavailable before a backend is paired.");
}

function createBrowserLocalApi(): LocalApi {
  return {
    dialogs: {
      pickFolder: async (options) => {
        if (!window.desktopBridge) return null;
        return window.desktopBridge.pickFolder(options);
      },
      confirm: async (message) => {
        if (window.desktopBridge) {
          return window.desktopBridge.confirm(message);
        }
        return window.confirm(message);
      },
    },
    shell: {
      openInEditor: () => Promise.reject(unavailableLocalBackendError()),
      openExternal: async (url) => {
        if (window.desktopBridge) {
          const opened = await window.desktopBridge.openExternal(url);
          if (!opened) {
            throw new Error("Unable to open link.");
          }
          return;
        }

        window.open(url, "_blank", "noopener,noreferrer");
      },
    },
    contextMenu: {
      show: async <T extends string>(
        items: readonly ContextMenuItem<T>[],
        position?: { x: number; y: number },
      ): Promise<T | null> => {
        if (window.desktopBridge) {
          return window.desktopBridge.showContextMenu(items, position) as Promise<T | null>;
        }
        return showContextMenuFallback(items, position);
      },
    },
    persistence: {
      getClientSettings: async () => {
        if (window.desktopBridge) {
          return window.desktopBridge.getClientSettings();
        }
        return readBrowserClientSettings();
      },
      setClientSettings: async (settings) => {
        if (window.desktopBridge) {
          return window.desktopBridge.setClientSettings(settings);
        }
        writeBrowserClientSettings(settings);
      },
    },
    server: {
      getConfig: () =>
        rpcClient ? rpcClient.server.getConfig() : Promise.reject(unavailableLocalBackendError()),
      refreshProviders: () =>
        rpcClient
          ? rpcClient.server.refreshProviders()
          : Promise.reject(unavailableLocalBackendError()),
      updateProvider: (input) =>
        rpcClient
          ? rpcClient.server.updateProvider(input)
          : Promise.reject(unavailableLocalBackendError()),
      upsertKeybinding: (input) =>
        rpcClient
          ? rpcClient.server.upsertKeybinding(input)
          : Promise.reject(unavailableLocalBackendError()),
      removeKeybinding: (input) =>
        rpcClient
          ? rpcClient.server.removeKeybinding(input)
          : Promise.reject(unavailableLocalBackendError()),
      getSettings: () =>
        rpcClient ? rpcClient.server.getSettings() : Promise.reject(unavailableLocalBackendError()),
      updateSettings: (patch) =>
        rpcClient
          ? rpcClient.server.updateSettings(patch)
          : Promise.reject(unavailableLocalBackendError()),
      discoverSourceControl: () =>
        rpcClient
          ? rpcClient.server.discoverSourceControl()
          : Promise.reject(unavailableLocalBackendError()),
      getTraceDiagnostics: () =>
        rpcClient
          ? rpcClient.server.getTraceDiagnostics()
          : Promise.reject(unavailableLocalBackendError()),
      getProcessDiagnostics: () =>
        rpcClient
          ? rpcClient.server.getProcessDiagnostics()
          : Promise.reject(unavailableLocalBackendError()),
      getProcessResourceHistory: (input) =>
        rpcClient
          ? rpcClient.server.getProcessResourceHistory(input)
          : Promise.reject(unavailableLocalBackendError()),
      signalProcess: (input) =>
        rpcClient
          ? rpcClient.server.signalProcess(input)
          : Promise.reject(unavailableLocalBackendError()),
      getUsageSummary: (input) =>
        rpcClient
          ? rpcClient.server.getUsageSummary(input)
          : Promise.reject(unavailableLocalBackendError()),
      listToolInvocations: async (input) => {
        if (!rpcClient) throw unavailableLocalBackendError();
        const result = await rpcClient.server.listToolInvocations(input);
        return [...result];
      },
    },
  };
}

export function createLocalApi(): LocalApi {
  return createBrowserLocalApi();
}

export function readLocalApi(): LocalApi | undefined {
  if (typeof window === "undefined") return undefined;
  if (cachedApi) return cachedApi;

  if (window.nativeApi) {
    cachedApi = window.nativeApi;
    return cachedApi;
  }

  cachedApi = createBrowserLocalApi();
  return cachedApi;
}

export function ensureLocalApi(): LocalApi {
  const api = readLocalApi();
  if (!api) {
    throw new Error("Local API not found");
  }
  return api;
}

export async function __resetLocalApiForTests() {
  cachedApi = undefined;
  const { __resetClientSettingsPersistenceForTests } = await import("./hooks/useSettings");
  __resetClientSettingsPersistenceForTests();
  resetRequestLatencyStateForTests();
}
