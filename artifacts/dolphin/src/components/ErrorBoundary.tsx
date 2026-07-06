import React from 'react';
import { getDiagnostics } from '../diagnostics';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  errorStack: string;
}

/**
 * Diagnostic error boundary.
 *
 * Catches React render/lifecycle errors and logs a structured diagnostic
 * snapshot (no precise coordinates). Also installs a window-level listener
 * to catch non-React errors from MapLibre event handlers and web workers.
 *
 * Does NOT suppress or hide the Vite HMR runtime error overlay in development.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  private static _globalListenerInstalled = false;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '', errorStack: '' };
  }

  // Install a global listener once for errors that escape the React tree
  // (e.g. MapLibre event handlers, web worker messages, unhandled rejections)
  static install(): void {
    if (ErrorBoundary._globalListenerInstalled) return;
    ErrorBoundary._globalListenerInstalled = true;

    window.addEventListener('error', (e) => {
      ErrorBoundary._logDiagnostic(
        e.error ?? new Error(e.message),
        'window.onerror'
      );
      // Do NOT call e.preventDefault() — preserve Vite HMR overlay behaviour
    });

    window.addEventListener('unhandledrejection', (e) => {
      const err = e.reason instanceof Error
        ? e.reason
        : new Error(String(e.reason));
      ErrorBoundary._logDiagnostic(err, 'unhandledrejection');
    });
  }

  private static _logDiagnostic(error: Error, source: string): void {
    const snap = getDiagnostics();
    console.error('[Dolphin] Runtime crash diagnostic', {
      source,
      message: error.message,
      stack: error.stack,
      diagnostics: snap,
    });
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message,
      errorStack: error.stack ?? '',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    ErrorBoundary._logDiagnostic(error, 'React.componentDidCatch');
    console.error('[Dolphin] React component stack:', info.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // Minimal fallback — preserves the dark nautical background
      return (
        <div className="w-screen h-[100dvh] bg-[#071820] flex flex-col items-center justify-center gap-4 p-8">
          <div className="text-[#44e4c2] text-5xl opacity-60">◎</div>
          <p className="text-white/70 text-sm text-center max-w-xs leading-relaxed font-medium">
            Er is een onverwachte fout opgetreden.
          </p>
          <p className="text-white/40 text-xs text-center max-w-xs leading-relaxed font-mono">
            {this.state.errorMessage}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2.5 rounded-[14px] bg-primary/10 border border-primary/30 text-primary text-sm font-semibold active:scale-95 transition-transform"
          >
            Opnieuw laden
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
