import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  fallback?: ReactNode;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', err, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="p-4 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 text-sm">
            <strong>Something went wrong rendering this component.</strong>
            {this.state.message && (
              <pre className="mt-2 text-xs opacity-70 whitespace-pre-wrap break-all">
                {this.state.message}
              </pre>
            )}
          </div>
        )
      );
    }
    return this.props.children;
  }
}
