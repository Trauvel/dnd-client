import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            padding: 24,
            maxWidth: 600,
            margin: '40px auto',
            background: '#fff',
            border: '1px solid #dc3545',
            borderRadius: 8,
            color: '#333',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h2 style={{ color: '#dc3545', marginTop: 0 }}>Произошла ошибка</h2>
          <pre
            style={{
              background: '#f8f9fa',
              padding: 12,
              borderRadius: 4,
              overflow: 'auto',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error.message}
          </pre>
          {this.state.errorInfo?.componentStack && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Стек компонентов</summary>
              <pre
                style={{
                  background: '#f8f9fa',
                  padding: 12,
                  borderRadius: 4,
                  overflow: 'auto',
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                  marginTop: 8,
                }}
              >
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button
            type="button"
            onClick={() => window.location.href = '/'}
            style={{
              marginTop: 16,
              padding: '10px 20px',
              background: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            На главную
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
