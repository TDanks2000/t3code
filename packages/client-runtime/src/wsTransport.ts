import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import { RpcClient } from "effect/unstable/rpc";

import { isTransportConnectionErrorMessage } from "./transportError.ts";
import {
  createWsRpcProtocolLayer,
  makeWsRpcProtocolClient,
  type WsProtocolLifecycleHandlers,
  type WsRpcProtocolClient,
  type WsRpcProtocolSocketUrlProvider,
} from "./wsRpcProtocol.ts";

export interface WsTransportOptions {
  /**
   * Merged into the transport `ManagedRuntime` alongside the RPC protocol layer
   * (for example a `Tracer` layer for OTLP).
   */
  readonly tracingLayer?: Layer.Layer<never, never, never>;
  /**
   * Override protocol construction (defaults to {@link createWsRpcProtocolLayer}).
   * The web app supplies its instrumented layer factory.
   */
  readonly createProtocolLayer?: (
    url: WsRpcProtocolSocketUrlProvider,
    lifecycleHandlers?: WsProtocolLifecycleHandlers,
  ) => Layer.Layer<RpcClient.Protocol, never, never>;
  readonly logWarning?: (message: string, metadata: { readonly error: string }) => void;
  /**
   * Invoked at the start of {@link WsTransport.reconnect} before the session is replaced.
   */
  readonly onBeforeReconnect?: () => void;
}

interface SubscribeOptions {
  readonly retryDelay?: Duration.Input;
  readonly onResubscribe?: () => void;
  readonly tag?: string;
}

const DEFAULT_SUBSCRIPTION_RETRY_DELAY = Duration.millis(250);
const NOOP: () => void = () => undefined;

interface TransportSession {
  readonly sessionId: number;
  readonly clientPromise: Promise<WsRpcProtocolClient>;
  readonly clientScope: Scope.Closeable;
  readonly runtime: ManagedRuntime.ManagedRuntime<RpcClient.Protocol, never>;
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return String(error);
}

export class WsTransport {
  private readonly url: WsRpcProtocolSocketUrlProvider;
  private readonly lifecycleHandlers: WsProtocolLifecycleHandlers | undefined;
  private readonly options: WsTransportOptions | undefined;
  private disposed = false;
  private readonly disposeSignal = new AbortController();
  private hasReportedTransportDisconnect = false;
  private intentionalCloseSessionIds = new Set<number>();
  private nextSessionId = 0;
  private activeSessionId = 0;
  private lastHeartbeatPongAt: number | null = null;
  private readonly streamRequestStartListeners = new Set<
    (info: { readonly tag: string }) => void
  >();
  private reconnectChain: Promise<void> = Promise.resolve();
  private session: TransportSession;

  private consecutiveSubscriptionFailures = 0;
  private lastSubscriptionFailureAt = 0;
  private readonly MAX_CONSECUTIVE_SUBSCRIPTION_FAILURES = 3;
  private readonly SUBSCRIPTION_FAILURE_WINDOW_MS = 30_000;
  private subscriptionFailureEscalating = false;

  constructor(
    url: WsRpcProtocolSocketUrlProvider,
    lifecycleHandlers?: WsProtocolLifecycleHandlers,
    options?: WsTransportOptions,
  ) {
    this.url = url;
    this.lifecycleHandlers = lifecycleHandlers;
    this.options = options;
    this.session = this.createSession();
  }

  async request<TSuccess>(
    execute: (client: WsRpcProtocolClient) => Effect.Effect<TSuccess, Error, never>,
  ): Promise<TSuccess> {
    if (this.disposed) {
      throw new Error("Transport disposed");
    }

    const session = this.session;
    const client = await session.clientPromise;
    return await session.runtime.runPromise(Effect.suspend(() => execute(client)));
  }

  async requestStream<TValue>(
    connect: (client: WsRpcProtocolClient) => Stream.Stream<TValue, Error, never>,
    listener: (value: TValue) => void,
  ): Promise<void> {
    if (this.disposed) {
      throw new Error("Transport disposed");
    }

    const session = this.session;
    const client = await session.clientPromise;
    await session.runtime.runPromise(
      Stream.runForEach(connect(client), (value) =>
        Effect.sync(() => {
          try {
            listener(value);
          } catch (error) {
            this.logWarning("Stream listener error", { error: String(error) });
          }
        }),
      ),
    );
  }

  subscribe<TValue>(
    connect: (client: WsRpcProtocolClient) => Stream.Stream<TValue, Error, never>,
    listener: (value: TValue) => void,
    options?: SubscribeOptions,
  ): () => void {
    if (this.disposed) {
      return NOOP;
    }

    let active = true;
    let hasReceivedValue = false;
    const retryDelayMs = Duration.toMillis(
      Duration.fromInputUnsafe(options?.retryDelay ?? DEFAULT_SUBSCRIPTION_RETRY_DELAY),
    );
    let cancelCurrentStream: () => void = NOOP;
    const retryAbortController = new AbortController();
    const onStreamRequestStart = (_info: { readonly tag: string }) => {
      // No-op. The retry loop is the single path that controls reconnection,
      // so onResubscribe is only called there.
    };
    this.streamRequestStartListeners.add(onStreamRequestStart);

    const abortAwareSleep = (ms: number): Promise<void> =>
      new Promise((resolve) => {
        if (retryAbortController.signal.aborted || this.disposeSignal.signal.aborted) {
          resolve();
          return;
        }
        const onAbort = () => {
          resolve();
        };
        retryAbortController.signal.addEventListener("abort", onAbort, { once: true });
        this.disposeSignal.signal.addEventListener("abort", onAbort, { once: true });
        Effect.runFork(
          Effect.sleep(Duration.millis(ms)).pipe(
            Effect.onExit(() =>
              Effect.sync(() => {
                retryAbortController.signal.removeEventListener("abort", onAbort);
                this.disposeSignal.signal.removeEventListener("abort", onAbort);
                resolve();
              }),
            ),
          ),
        );
      });

    void (async () => {
      for (;;) {
        if (!active || this.disposed) {
          return;
        }

        const session = this.session;
        try {
          if (hasReceivedValue) {
            try {
              options?.onResubscribe?.();
            } catch {
              // Ignore reconnect hook failures so the stream can recover.
            }
          }
          const runningStream = this.runStreamOnSession(
            session,
            connect,
            listener,
            () => active,
            () => {
              this.hasReportedTransportDisconnect = false;
              hasReceivedValue = true;
            },
          );
          cancelCurrentStream = runningStream.cancel;
          await runningStream.completed;
          cancelCurrentStream = NOOP;
        } catch (error) {
          cancelCurrentStream = NOOP;
          if (!active || this.disposed) {
            return;
          }

          // Skip retry if the session has already been replaced by a reconnect.
          if (session !== this.session) {
            continue;
          }

          const formattedError = formatErrorMessage(error);
          if (!isTransportConnectionErrorMessage(formattedError)) {
            this.logWarning("WebSocket RPC subscription failed", { error: formattedError });
            return;
          }

          if (!this.hasReportedTransportDisconnect) {
            this.logWarning("WebSocket RPC subscription disconnected", {
              error: formattedError,
            });
          }
          this.hasReportedTransportDisconnect = true;

          const now = performance.now();
          if (now - this.lastSubscriptionFailureAt > this.SUBSCRIPTION_FAILURE_WINDOW_MS) {
            this.consecutiveSubscriptionFailures = 0;
          }
          this.lastSubscriptionFailureAt = now;
          this.consecutiveSubscriptionFailures++;

          if (
            this.consecutiveSubscriptionFailures >= this.MAX_CONSECUTIVE_SUBSCRIPTION_FAILURES &&
            !this.subscriptionFailureEscalating
          ) {
            this.subscriptionFailureEscalating = true;
            this.logWarning(
              `Escalating to full reconnect after ${this.consecutiveSubscriptionFailures} consecutive subscription failures`,
              { error: formattedError },
            );
            try {
              await this.reconnect();
            } catch {
              // A failed reconnect surfaces through the next subscription
              // attempt's own retry/backoff path.
            }
            this.subscriptionFailureEscalating = false;
            this.consecutiveSubscriptionFailures = 0;
            continue;
          }

          await abortAwareSleep(retryDelayMs);
        }
      }
    })();

    return () => {
      active = false;
      retryAbortController.abort();
      this.streamRequestStartListeners.delete(onStreamRequestStart);
      cancelCurrentStream();
    };
  }

  async reconnect() {
    if (this.disposed) {
      throw new Error("Transport disposed");
    }

    const reconnectOperation = this.reconnectChain.then(async () => {
      if (this.disposed) {
        throw new Error("Transport disposed");
      }

      try {
        this.options?.onBeforeReconnect?.();
      } catch {
        // Ignore hook failures so reconnect can proceed.
      }

      this.lastHeartbeatPongAt = null;
      const previousSession = this.session;
      this.session = this.createSession();
      await this.closeSession(previousSession);
    });

    this.reconnectChain = reconnectOperation.catch(() => undefined);
    await reconnectOperation;
  }

  isHeartbeatFresh(maxAgeMs = 15_000): boolean {
    return (
      this.lastHeartbeatPongAt !== null && performance.now() - this.lastHeartbeatPongAt <= maxAgeMs
    );
  }

  async dispose() {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    if (this.disposeSignal) {
      this.disposeSignal.abort();
    }
    await this.closeSession(this.session);
  }

  private closeSession(session: TransportSession) {
    this.intentionalCloseSessionIds.add(session.sessionId);
    return session.runtime.runPromise(Scope.close(session.clientScope, Exit.void)).finally(() => {
      this.intentionalCloseSessionIds.delete(session.sessionId);
      session.runtime.dispose();
    });
  }

  private createSession(): TransportSession {
    const protocolFactory = this.options?.createProtocolLayer ?? createWsRpcProtocolLayer;
    const sessionId = this.nextSessionId + 1;
    this.nextSessionId = sessionId;
    this.activeSessionId = sessionId;
    const lifecycleHandlers = this.lifecycleHandlers;
    const protocolLayer = protocolFactory(this.url, {
      ...lifecycleHandlers,
      isActive: () =>
        !this.disposed &&
        this.activeSessionId === sessionId &&
        (lifecycleHandlers?.isActive?.() ?? true),
      isCloseIntentional: () =>
        this.disposed ||
        this.intentionalCloseSessionIds.has(sessionId) ||
        lifecycleHandlers?.isCloseIntentional?.() === true,
      onHeartbeatPong: () => {
        this.lastHeartbeatPongAt = performance.now();
        lifecycleHandlers?.onHeartbeatPong?.();
      },
      onRequestStart: (info) => {
        lifecycleHandlers?.onRequestStart?.(info);
        if (!info.stream) {
          return;
        }
        for (const listener of this.streamRequestStartListeners) {
          listener({ tag: info.tag });
        }
      },
    });
    const rootLayer = this.options?.tracingLayer
      ? Layer.mergeAll(protocolLayer, this.options.tracingLayer)
      : protocolLayer;
    const runtime = ManagedRuntime.make(rootLayer);
    const clientScope = runtime.runSync(Scope.make());
    return {
      sessionId,
      runtime,
      clientScope,
      clientPromise: runtime.runPromise(Scope.provide(clientScope)(makeWsRpcProtocolClient)),
    };
  }

  private logWarning(message: string, metadata: { readonly error: string }) {
    const logWarning = this.options?.logWarning;
    if (logWarning) {
      logWarning(message, metadata);
    } else {
      Effect.runSync(Effect.logWarning(message, metadata));
    }
  }

  private runStreamOnSession<TValue>(
    session: TransportSession,
    connect: (client: WsRpcProtocolClient) => Stream.Stream<TValue, Error, never>,
    listener: (value: TValue) => void,
    isActive: () => boolean,
    markValueReceived: () => void,
  ): {
    readonly cancel: () => void;
    readonly completed: Promise<void>;
  } {
    let resolveCompleted!: () => void;
    let rejectCompleted!: (error: unknown) => void;
    const completed = new Promise<void>((resolve, reject) => {
      resolveCompleted = resolve;
      rejectCompleted = reject;
    });
    const cancel = session.runtime.runCallback(
      Effect.promise(() => session.clientPromise).pipe(
        Effect.flatMap((client) =>
          Stream.runForEach(connect(client), (value) =>
            Effect.sync(() => {
              if (!isActive()) {
                return;
              }

              markValueReceived();
              try {
                listener(value);
              } catch (error) {
                this.logWarning("Stream listener error", { error: String(error) });
              }
            }),
          ),
        ),
      ),
      {
        onExit: (exit) => {
          if (Exit.isSuccess(exit)) {
            resolveCompleted();
            return;
          }

          rejectCompleted(Cause.squash(exit.cause));
        },
      },
    );

    return {
      cancel,
      completed,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return Effect.runPromise(Effect.sleep(Duration.millis(ms)));
}
