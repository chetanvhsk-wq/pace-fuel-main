import * as React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    (this as any).state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    const { hasError, error } = (this as any).state;
    const { children } = (this as any).props;

    if (hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
          <h1 className="text-2xl font-bold text-error mb-4">Something went wrong</h1>
          <p className="text-on-surface-variant mb-6">We've encountered an unexpected error. Please try refreshing the page.</p>
          <pre className="text-xs bg-surface-container p-4 rounded-lg overflow-auto max-w-full text-left">
            {error?.message}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="mt-8 px-6 py-2 bg-primary text-on-primary rounded-full font-bold"
          >
            Refresh App
          </button>
        </div>
      );
    }

    return children;
  }
}
