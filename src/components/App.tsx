import { useEffect, useLayoutEffect } from 'react'
import { Canvas } from './Canvas/Canvas'
import { FloatingPreview } from './FloatingPreview/FloatingPreview'
import { Toolbar } from './Toolbar/Toolbar'
import { ModifierBar } from './ModifierBar/ModifierBar'
import { Notifications } from './Notifications/Notifications'
import { ErrorBoundary } from './ErrorBoundary/ErrorBoundary'
import { ThemeProvider } from './ThemeProvider'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { initHistoryTracking } from '../stores/historyStore'
import styles from './App.module.css'

// Startup timing
const APP_LOAD_TIME = performance.now()
console.log(`%c[App] Module loaded at ${APP_LOAD_TIME.toFixed(1)}ms`, 'color: #ff6b6b; font-weight: bold;')

function AppContent() {
  console.log(`%c[App] AppContent render at ${(performance.now() - APP_LOAD_TIME).toFixed(1)}ms`, 'color: #ff6b6b;')
  
  // Enable global keyboard shortcuts
  useKeyboardShortcuts()
  
  // Initialize undo/redo history tracking
  useEffect(() => {
    const start = performance.now()
    const unsubscribe = initHistoryTracking()
    console.log(`%c[App] History tracking initialized in ${(performance.now() - start).toFixed(1)}ms`, 'color: #00ff88;')
    return () => unsubscribe()
  }, [])
  
  // Mark when component mounts
  useLayoutEffect(() => {
    console.log(`%c[App] AppContent mounted (layout) at ${(performance.now() - APP_LOAD_TIME).toFixed(1)}ms`, 'color: #00ff88;')
  }, [])
  
  useEffect(() => {
    console.log(`%c[App] AppContent mounted (effect) at ${(performance.now() - APP_LOAD_TIME).toFixed(1)}ms`, 'color: #00ff88;')
  }, [])
  
  return (
    <div className={styles.app}>
      <div className={styles.main}>
        <ErrorBoundary>
          <Canvas />
        </ErrorBoundary>
        <FloatingPreview />
      </div>
      <Toolbar />
      <ModifierBar />
      <Notifications />
    </div>
  )
}

export default function App() {
  console.log(`%c[App] App render at ${(performance.now() - APP_LOAD_TIME).toFixed(1)}ms`, 'color: #ff6b6b;')
  
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </ErrorBoundary>
  )
}
