import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(e: Error) {
    return { error: e }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 40, color: '#fff', fontFamily: 'monospace',
          whiteSpace: 'pre-wrap', background: '#1a1a1a', height: '100vh',
          overflow: 'auto', fontSize: 13
        }}>
          <h2 style={{ color: '#f87171', marginBottom: 12 }}>⚠ Render Error</h2>
          <pre>{this.state.error.stack ?? this.state.error.message}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
