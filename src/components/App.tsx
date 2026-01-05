import { useEffect } from 'react'
import { Canvas } from './Canvas/Canvas'
import { HierarchyPanel } from './HierarchyPanel/HierarchyPanel'
import { MenuBar } from './MenuBar/MenuBar'
import { Toolbar } from './Toolbar/Toolbar'
import { Notifications } from './Notifications/Notifications'
import { ErrorBoundary } from './ErrorBoundary/ErrorBoundary'
import { ThemeProvider } from './ThemeProvider'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { initHistoryTracking } from '../stores/historyStore'
import styles from './App.module.css'

function AppContent() {
  // Enable global keyboard shortcuts
  useKeyboardShortcuts()
  
  // Initialize undo/redo history tracking
  useEffect(() => {
    const unsubscribe = initHistoryTracking()
    return () => unsubscribe()
  }, [])
  
  return (
    <div className={styles.app}>
      <MenuBar />
      <div className={styles.main}>
        <ErrorBoundary>
          <Canvas />
        </ErrorBoundary>
        <HierarchyPanel />
      </div>
      <Toolbar />
      <Notifications />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </ErrorBoundary>
  )
}
