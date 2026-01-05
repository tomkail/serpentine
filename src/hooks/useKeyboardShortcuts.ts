import { useEffect } from 'react'
import { useDocumentStore } from '../stores/documentStore'
import { useSelectionStore } from '../stores/selectionStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useNotificationStore } from '../stores/notificationStore'
import { useHistoryStore, undo, redo } from '../stores/historyStore'
import { createNewDocument, saveDocument, loadDocument, exportSvg } from '../utils/fileIO'
import { fitToView, resetView } from '../utils/viewportActions'

export function useKeyboardShortcuts() {
  const shapes = useDocumentStore(state => state.shapes)
  const shapeOrder = useDocumentStore(state => state.shapeOrder)
  const removeShape = useDocumentStore(state => state.removeShape)
  const duplicateShape = useDocumentStore(state => state.duplicateShape)
  
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const clearSelection = useSelectionStore(state => state.clearSelection)
  const selectAll = useSelectionStore(state => state.selectAll)
  
  const snapToGrid = useSettingsStore(state => state.snapToGrid)
  const toggleSnap = useSettingsStore(state => state.toggleSnap)
  const measurementMode = useSettingsStore(state => state.measurementMode)
  const cycleMeasurementMode = useSettingsStore(state => state.cycleMeasurementMode)
  const showGrid = useSettingsStore(state => state.showGrid)
  const toggleGrid = useSettingsStore(state => state.toggleGrid)
  const setIsolatePath = useSettingsStore(state => state.setIsolatePath)
  
  const canUndo = useHistoryStore(state => state.canUndo)
  const canRedo = useHistoryStore(state => state.canRedo)
  
  const info = useNotificationStore(state => state.info)
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }
      
      const isMod = e.metaKey || e.ctrlKey
      
      // File operations
      if (isMod && e.key === 'n') {
        e.preventDefault()
        createNewDocument()
        return
      }
      
      if (isMod && e.key === 's') {
        e.preventDefault()
        saveDocument()
        return
      }
      
      if (isMod && e.key === 'o') {
        e.preventDefault()
        loadDocument()
        return
      }
      
      if (isMod && e.key === 'e') {
        e.preventDefault()
        exportSvg()
        return
      }
      
      // Undo
      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canUndo()) {
          undo()
          info('Undo')
        }
        return
      }
      
      // Redo (Cmd+Shift+Z or Cmd+Y)
      if ((isMod && e.key === 'z' && e.shiftKey) || (isMod && e.key === 'y')) {
        e.preventDefault()
        if (canRedo()) {
          redo()
          info('Redo')
        }
        return
      }
      
      // Select all
      if (isMod && e.key === 'a') {
        e.preventDefault()
        selectAll(shapeOrder)
        return
      }
      
      // Duplicate
      if (isMod && e.key === 'd') {
        e.preventDefault()
        for (const id of selectedIds) {
          duplicateShape(id)
        }
        return
      }
      
      // Delete
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        for (const id of selectedIds) {
          removeShape(id)
        }
        clearSelection()
        return
      }
      
      // Escape - deselect
      if (e.key === 'Escape') {
        clearSelection()
        return
      }
      
      // Toggle snap
      if (e.key === 's' && !isMod) {
        toggleSnap()
        info(`Snap: ${!snapToGrid ? 'ON' : 'OFF'}`)
        return
      }
      
      // Cycle measurement mode
      if (e.key === 'm' && !isMod) {
        cycleMeasurementMode()
        const modes = ['clean', 'minimal', 'detailed']
        const currentIndex = modes.indexOf(measurementMode)
        const nextMode = modes[(currentIndex + 1) % modes.length]
        info(`Measurements: ${nextMode}`)
        return
      }
      
      // Toggle grid
      if (e.key === 'g' && !isMod) {
        toggleGrid()
        info(`Grid: ${!showGrid ? 'ON' : 'OFF'}`)
        return
      }
      
      // Fit to view
      if (e.key === 'f' && !isMod) {
        fitToView()
        return
      }
      
      // Reset view
      if (e.key === '0' && !isMod) {
        resetView()
        return
      }
      
      // Isolate path (hold to activate)
      if ((e.key === 'i' || e.key === 'I') && !isMod && !e.repeat) {
        setIsolatePath(true)
        return
      }
    }
    
    const handleKeyUp = (e: KeyboardEvent) => {
      // Release isolate path mode
      if (e.key === 'i' || e.key === 'I') {
        setIsolatePath(false)
        return
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [
    shapes,
    shapeOrder,
    selectedIds,
    removeShape,
    duplicateShape,
    clearSelection,
    selectAll,
    snapToGrid,
    toggleSnap,
    measurementMode,
    cycleMeasurementMode,
    showGrid,
    toggleGrid,
    setIsolatePath,
    canUndo,
    canRedo,
    info
  ])
}

