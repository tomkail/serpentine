import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './components/App'
import { setupGlobalErrorHandlers } from './utils/globalErrorHandler'
import './theme.css'

// Set up global error handling
setupGlobalErrorHandlers()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

