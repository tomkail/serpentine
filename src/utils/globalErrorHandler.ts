import { reportError } from '../stores/notificationStore'

/**
 * Set up global error handlers for uncaught errors and unhandled promise rejections
 */
export function setupGlobalErrorHandlers(): void {
  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    // Ignore ResizeObserver errors (common and usually harmless)
    if (event.message?.includes('ResizeObserver')) {
      return
    }
    
    reportError(event.error || event.message, 'Uncaught error')
    event.preventDefault()
  })
  
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, 'Unhandled promise rejection')
    event.preventDefault()
  })
}

