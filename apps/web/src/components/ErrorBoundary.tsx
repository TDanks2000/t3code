import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./ui/button";

interface ErrorBoundaryFatalProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryFatalState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundaryFatal extends Component<
  ErrorBoundaryFatalProps,
  ErrorBoundaryFatalState
> {
  constructor(props: ErrorBoundaryFatalProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Unhandled React error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground sm:px-6">
          <div className="pointer-events-none absolute inset-0 opacity-80">
            <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(44rem_16rem_at_top,color-mix(in_srgb,var(--color-red-500)_16%,transparent),transparent)]" />
            <div className="absolute inset-0 bg-[linear-gradient(145deg,color-mix(in_srgb,var(--background)_90%,var(--color-black))_0%,var(--background)_55%)]" />
          </div>

          <section className="relative w-full max-w-xl rounded-2xl border border-border/80 bg-card/90 p-6 shadow-2xl shadow-black/20 backdrop-blur-md sm:p-8">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              T3
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              An unexpected error occurred
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The application encountered an error it could not recover from.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button size="sm" onClick={this.handleReset}>
                Try again
              </Button>
              <Button size="sm" variant="outline" onClick={this.handleReload}>
                Reload app
              </Button>
            </div>

            {this.state.error && (
              <details className="group mt-5 overflow-hidden rounded-lg border border-border/70 bg-background/55">
                <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-muted-foreground">
                  <span className="group-open:hidden">Show error details</span>
                  <span className="hidden group-open:inline">Hide error details</span>
                </summary>
                <pre className="max-h-56 overflow-auto border-t border-border/70 bg-background/80 px-3 py-2 text-xs text-foreground/85">
                  {this.state.error.stack ?? this.state.error.message}
                </pre>
              </details>
            )}
          </section>
        </div>
      );
    }

    return this.props.children;
  }
}
