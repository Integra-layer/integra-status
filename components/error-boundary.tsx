"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-lg py-16 px-4 text-center" role="alert">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500 mb-4" />
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm text-text-muted mb-6">
            The dashboard encountered an error. Try refreshing the page.
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-border-strong/30 bg-surface-card px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
