import type { StringPathDocument, Shape, Point } from '../types'
import { useDocumentStore } from '../stores/documentStore'
import { useViewportStore } from '../stores/viewportStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useNotificationStore, reportError } from '../stores/notificationStore'

/**
 * Create a new document (reset to defaults)
 */
export function createNewDocument(skipConfirmation = false): boolean {
  try {
    if (!skipConfirmation) {
      const confirmed = window.confirm(
        'Create a new document? Any unsaved changes will be lost.'
      )
      if (!confirmed) return false
    }
    
    useDocumentStore.getState().reset()
    useViewportStore.getState().reset()
    useNotificationStore.getState().success('New document created')
    return true
  } catch (error) {
    reportError(error, 'Failed to create new document')
    return false
  }
}

/**
 * Save the current document to a file
 */
export function saveDocument(): void {
  try {
    const docState = useDocumentStore.getState()
    const viewportState = useViewportStore.getState()
    const settingsState = useSettingsStore.getState()
    
    const doc: StringPathDocument = {
      version: 1,
      name: docState.fileName || 'Untitled',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      settings: {
        gridSize: settingsState.gridSize,
        globalStretch: docState.globalStretch,
        closedPath: docState.closedPath
      },
      viewport: {
        pan: viewportState.pan,
        zoom: viewportState.zoom
      },
      shapes: docState.shapes,
      pathOrder: docState.shapeOrder
    }
    
    const json = JSON.stringify(doc, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = window.document.createElement('a')
    a.href = url
    a.download = `${doc.name.replace(/[^a-z0-9]/gi, '_')}.stringpath`
    window.document.body.appendChild(a)
    a.click()
    window.document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    useNotificationStore.getState().success('Document saved', `${doc.name}.stringpath`)
  } catch (error) {
    reportError(error, 'Failed to save document')
  }
}

/**
 * Load a document from a file
 */
export function loadDocument(): void {
  try {
    const input = window.document.createElement('input')
    input.type = 'file'
    input.accept = '.stringpath,.json'
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      
      try {
        const text = await file.text()
        
        let data: StringPathDocument
        try {
          data = JSON.parse(text) as StringPathDocument
        } catch (parseError) {
          throw new Error('Invalid JSON format. Please check the file is not corrupted.')
        }
        
        // Validate the document
        const validationError = validateDocument(data)
        if (validationError) {
          throw new Error(validationError)
        }
        
        // Load into stores
        useDocumentStore.getState().loadDocument(data)
        
        if (data.viewport) {
          useViewportStore.setState({
            pan: data.viewport.pan,
            zoom: data.viewport.zoom
          })
        }
        
        if (data.settings) {
          useSettingsStore.setState({
            gridSize: data.settings.gridSize
          })
        }
        
        useDocumentStore.getState().setFileName(data.name)
        useNotificationStore.getState().success('Document loaded', file.name)
        
      } catch (err) {
        reportError(err, 'Failed to load document')
      }
    }
    
    input.click()
  } catch (error) {
    reportError(error, 'Failed to open file picker')
  }
}

/**
 * Validate a loaded document and return error message if invalid
 */
function validateDocument(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return 'Document is empty or invalid'
  }
  
  const doc = data as Partial<StringPathDocument>
  
  // Check required fields
  if (typeof doc.version !== 'number') {
    return 'Document is missing version information'
  }
  
  if (doc.version > 1) {
    return `Document version ${doc.version} is not supported. Please update StringPath.`
  }
  
  if (!Array.isArray(doc.shapes)) {
    return 'Document is missing shapes data'
  }
  
  if (!Array.isArray(doc.pathOrder)) {
    return 'Document is missing path order data'
  }
  
  // Validate shapes
  for (let i = 0; i < doc.shapes.length; i++) {
    const shapeError = validateShape(doc.shapes[i], i)
    if (shapeError) return shapeError
  }
  
  return null
}

function validateShape(shape: unknown, index: number): string | null {
  if (!shape || typeof shape !== 'object') {
    return `Shape ${index + 1} is invalid`
  }
  
  const s = shape as Partial<Shape>
  
  if (typeof s.id !== 'string') {
    return `Shape ${index + 1} is missing an ID`
  }
  
  if (typeof s.type !== 'string') {
    return `Shape ${index + 1} is missing a type`
  }
  
  if (!isValidPoint(s.center)) {
    return `Shape ${index + 1} has invalid center coordinates`
  }
  
  if (s.type === 'circle') {
    if (typeof s.radius !== 'number' || s.radius <= 0) {
      return `Shape ${index + 1} has invalid radius`
    }
  }
  
  return null
}

function isValidPoint(point: unknown): point is Point {
  if (!point || typeof point !== 'object') return false
  const p = point as Partial<Point>
  return typeof p.x === 'number' && typeof p.y === 'number' && 
         isFinite(p.x) && isFinite(p.y)
}
