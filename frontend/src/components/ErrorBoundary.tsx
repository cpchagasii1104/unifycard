// src/components/ErrorBoundary.tsx
// Error Boundary para capturar erros de renderização

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturou um erro:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <h1 style={{ color: '#dc2626' }}>Erro ao carregar aplicação</h1>
          <p style={{ color: '#6b7280', margin: '1rem 0' }}>
            {this.state.error?.message || 'Ocorreu um erro inesperado'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Recarregar Página
          </button>
          <details style={{ marginTop: '2rem', textAlign: 'left', maxWidth: '600px', margin: '2rem auto 0' }}>
            <summary style={{ cursor: 'pointer', color: '#6b7280' }}>Detalhes do erro</summary>
            <pre style={{ 
              marginTop: '1rem', 
              padding: '1rem', 
              backgroundColor: '#f3f4f6', 
              borderRadius: '0.375rem',
              overflow: 'auto',
              fontSize: '0.875rem'
            }}>
              {this.state.error?.stack}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

