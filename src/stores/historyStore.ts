import { create } from 'zustand'
import type { Shape } from '../types'
import { useDocumentStore } from './documentStore'
import { MAX_HISTORY, HISTORY_DEBOUNCE_MS } from '../constants'

// Snapshot of document state that can be undone/redone
interface DocumentSnapshot {
  shapes: Shape[]
  shapeOrder: string[]
  globalStretch: number
}

interface HistoryState {
  // State
  undoStack: DocumentSnapshot[]
  redoStack: DocumentSnapshot[]
  maxHistory: number
  isProgrammaticChange: boolean // Flag to prevent recording undo during undo/redo
  
  // Actions
  pushState: (snapshot: DocumentSnapshot) => void
  undo: () => void
  redo: () => void
  clear: () => void
  
  // Computed
  canUndo: () => boolean
  canRedo: () => boolean
}

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  undoStack: [],
  redoStack: [],
  maxHistory: MAX_HISTORY,
  isProgrammaticChange: false,
  
  pushState: (snapshot) => set((state) => {
    // Don't record during undo/redo operations
    if (state.isProgrammaticChange) return state
    
    const newUndoStack = [...state.undoStack, snapshot]
    
    // Trim stack if too long
    if (newUndoStack.length > state.maxHistory) {
      newUndoStack.shift()
    }
    
    return {
      undoStack: newUndoStack,
      redoStack: [] // Clear redo stack on new action
    }
  }),
  
  undo: () => {
    const state = get()
    if (state.undoStack.length === 0) return
    
    // Get current state before undo to push to redo stack
    const docStore = useDocumentStore.getState()
    const currentSnapshot: DocumentSnapshot = {
      shapes: docStore.shapes,
      shapeOrder: docStore.shapeOrder,
      globalStretch: docStore.globalStretch
    }
    
    // Get the state to restore
    const newUndoStack = [...state.undoStack]
    const snapshotToRestore = newUndoStack.pop()!
    
    // Mark as programmatic change to prevent recording
    set({ isProgrammaticChange: true })
    
    // Restore the document state
    useDocumentStore.setState({
      shapes: snapshotToRestore.shapes,
      shapeOrder: snapshotToRestore.shapeOrder,
      globalStretch: snapshotToRestore.globalStretch
    })
    
    // Update history stacks
    set({
      undoStack: newUndoStack,
      redoStack: [...state.redoStack, currentSnapshot],
      isProgrammaticChange: false
    })
  },
  
  redo: () => {
    const state = get()
    if (state.redoStack.length === 0) return
    
    // Get current state to push to undo stack
    const docStore = useDocumentStore.getState()
    const currentSnapshot: DocumentSnapshot = {
      shapes: docStore.shapes,
      shapeOrder: docStore.shapeOrder,
      globalStretch: docStore.globalStretch
    }
    
    // Get the state to restore
    const newRedoStack = [...state.redoStack]
    const snapshotToRestore = newRedoStack.pop()!
    
    // Mark as programmatic change to prevent recording
    set({ isProgrammaticChange: true })
    
    // Restore the document state
    useDocumentStore.setState({
      shapes: snapshotToRestore.shapes,
      shapeOrder: snapshotToRestore.shapeOrder,
      globalStretch: snapshotToRestore.globalStretch
    })
    
    // Update history stacks
    set({
      undoStack: [...state.undoStack, currentSnapshot],
      redoStack: newRedoStack,
      isProgrammaticChange: false
    })
  },
  
  clear: () => set({
    undoStack: [],
    redoStack: []
  }),
  
  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0
}))

// Helper to capture current state as a snapshot
function captureSnapshot(): DocumentSnapshot {
  const docStore = useDocumentStore.getState()
  return {
    shapes: JSON.parse(JSON.stringify(docStore.shapes)), // Deep clone
    shapeOrder: [...docStore.shapeOrder],
    globalStretch: docStore.globalStretch
  }
}

// Subscribe to document changes and auto-record history
// Uses debouncing to batch rapid changes (like dragging)
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let lastSnapshot: DocumentSnapshot | null = null
let lastStateString: string | null = null
let pendingSnapshot: DocumentSnapshot | null = null

// Initialize the subscription
export function initHistoryTracking() {
  // Capture initial state
  lastSnapshot = captureSnapshot()
  lastStateString = JSON.stringify({
    shapes: lastSnapshot.shapes,
    shapeOrder: lastSnapshot.shapeOrder,
    globalStretch: lastSnapshot.globalStretch
  })
  
  // Subscribe to document state changes (standard Zustand subscribe)
  const unsubscribe = useDocumentStore.subscribe((state) => {
    const historyState = useHistoryStore.getState()
    
    // Don't record during undo/redo
    if (historyState.isProgrammaticChange) return
    
    // Check if anything actually changed by comparing state strings
    const currentStateString = JSON.stringify({
      shapes: state.shapes,
      shapeOrder: state.shapeOrder,
      globalStretch: state.globalStretch
    })
    
    if (currentStateString === lastStateString) return
    
    // Capture the previous state immediately if we haven't yet for this change batch
    if (!pendingSnapshot && lastSnapshot) {
      pendingSnapshot = lastSnapshot
    }
    
    // Debounce rapid changes (for smooth dragging)
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    
    debounceTimer = setTimeout(() => {
      // Push the state from before the change batch started
      if (pendingSnapshot) {
        useHistoryStore.getState().pushState(pendingSnapshot)
        pendingSnapshot = null
      }
      // Update lastSnapshot to current state for the next change batch
      lastSnapshot = captureSnapshot()
      lastStateString = currentStateString
      debounceTimer = null
    }, HISTORY_DEBOUNCE_MS)
  })
  
  return unsubscribe
}

// Utility functions for external use
export function undo() {
  useHistoryStore.getState().undo()
}

export function redo() {
  useHistoryStore.getState().redo()
}

export function clearHistory() {
  useHistoryStore.getState().clear()
}

