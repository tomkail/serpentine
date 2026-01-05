import { Component, type ReactNode, type ErrorInfo } from 'react'
import styles from './ErrorBoundary.module.css'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }
  
  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })
    console.error('[StringPath] Uncaught error:', error, errorInfo)
  }
  
  handleReset = (): void => {
    // Clear localStorage to reset app state
    localStorage.removeItem('stringpath-document')
    localStorage.removeItem('stringpath-viewport')
    localStorage.removeItem('stringpath-settings')
    
    // Reload the page
    window.location.reload()
  }
  
  handleDismiss = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }
  
  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      
      return (
        <div className={styles.errorScreen}>
          <div className={styles.errorContent}>
            <div className={styles.errorIcon}>⚠</div>
            <h1 className={styles.errorTitle}>Something went wrong</h1>
            <p className={styles.errorMessage}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            
            <div className={styles.errorActions}>
              <button 
                className={styles.primaryButton}
                onClick={this.handleDismiss}
              >
                Try to Continue
              </button>
              <button 
                className={styles.secondaryButton}
                onClick={this.handleReset}
              >
                Reset App State
              </button>
            </div>
            
            {this.state.error && (
              <details className={styles.errorDetails}>
                <summary>Technical Details</summary>
                <pre>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }
    
    return this.props.children
  }
}

