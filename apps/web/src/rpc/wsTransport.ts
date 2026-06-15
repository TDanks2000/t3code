import {
  WsTransport as BaseWsTransport,
  type WsProtocolLifecycleHandlers,
  type WsRpcProtocolSocketUrlProvider,
  type WsTransportOptions,
} from "@t3tools/client-runtime";
import { createWsRpcProtocolLayer as createSharedWsRpcProtocolLayer } from "@t3tools/client-runtime";

import { ClientTracingLive } from "../observability/clientTracing";
import {
  acknowledgeRpcRequest,
  clearAllTrackedRpcRequests,
  trackRpcRequestSent,
} from "./requestLatencyState";
import {
  recordWsConnectionAttempt,
  recordWsConnectionClosed,
  recordWsConnectionErrored,
  recordWsConnectionOpened,
} from "./wsConnectionState";

function createWsRpcProtocolLayer(
  url: WsRpcProtocolSocketUrlProvider,
  handlers?: WsProtocolLifecycleHandlers,
) {
  return createSharedWsRpcProtocolLayer(url, handlers, {
    telemetryLifecycle: {
      onAttempt: recordWsConnectionAttempt,
      onOpen: recordWsConnectionOpened,
      onError: (message) => {
        clearAllTrackedRpcRequests();
        recordWsConnectionErrored(message);
      },
      onClose: (details, context) => {
        clearAllTrackedRpcRequests();
        if (context.intentional) {
          return;
        }
        recordWsConnectionClosed(details);
      },
    },
    requestTelemetry: {
      onRequestSent: trackRpcRequestSent,
      onRequestAcknowledged: acknowledgeRpcRequest,
      onClearTrackedRequests: clearAllTrackedRpcRequests,
    },
  });
}

const webWsTransportOptions = {
  tracingLayer: ClientTracingLive,
  createProtocolLayer: createWsRpcProtocolLayer,
  onBeforeReconnect: () => {
    // Clear in-flight request tracking for the session being replaced, but do
    // NOT wipe the store here. The fresh shell snapshot delivered over the new
    // session (see syncEnvironmentShellSnapshot) is an authoritative full
    // replacement — it rebuilds projects/threads and drops anything no longer
    // present. Clearing the store up front only produced an empty window where
    // projects vanished and reappeared (or, if the snapshot was delayed/lost on
    // an overlapping reconnect, never came back). Keeping the last-known state
    // visible while the snapshot reconciles is both correct and far less jarring.
    clearAllTrackedRpcRequests();
  },
} satisfies WsTransportOptions;

export class WsTransport extends BaseWsTransport {
  constructor(
    url: WsRpcProtocolSocketUrlProvider,
    lifecycleHandlers?: WsProtocolLifecycleHandlers,
  ) {
    super(url, lifecycleHandlers, webWsTransportOptions);
  }
}
