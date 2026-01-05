import type { SerpentineDocument, Shape, Point, CircleShape, PathSegment, ArcSegment, EllipseArcSegment, LineSegment, BezierSegment } from '../types'
import { useDocumentStore } from '../stores/documentStore'
import { useViewportStore } from '../stores/viewportStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useNotificationStore, reportError } from '../stores/notificationStore'
import { fitToView } from './viewportActions'
import { computeTangentHull } from '../geometry/path'
import { pointOnCircle } from '../geometry/math'

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
    
    // Fit to view after creating new document
    requestAnimationFrame(() => {
      fitToView(true)
    })
    
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
    
    const doc: SerpentineDocument = {
      version: 1,
      name: docState.fileName || 'Untitled',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      settings: {
        gridSize: settingsState.gridSize,
        globalStretch: docState.globalStretch,
        closedPath: docState.closedPath,
        useStartPoint: docState.useStartPoint,
        useEndPoint: docState.useEndPoint
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
    a.download = `${doc.name.replace(/[^a-z0-9]/gi, '_')}.serpentine`
    window.document.body.appendChild(a)
    a.click()
    window.document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    useNotificationStore.getState().success('Document saved', `${doc.name}.serpentine`)
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
    input.accept = '.serpentine,.stringpath,.json'
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      
      try {
        const text = await file.text()
        
        let data: SerpentineDocument
        try {
          data = JSON.parse(text) as SerpentineDocument
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
        
        if (data.settings) {
          useSettingsStore.setState({
            gridSize: data.settings.gridSize
          })
        }
        
        useDocumentStore.getState().setFileName(data.name)
        
        // Always fit to view when loading a document
        // Use requestAnimationFrame to ensure canvas dimensions are updated
        requestAnimationFrame(() => {
          fitToView(true)
        })
        
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
  
  const doc = data as Partial<SerpentineDocument>
  
  // Check required fields
  if (typeof doc.version !== 'number') {
    return 'Document is missing version information'
  }
  
  if (doc.version > 1) {
    return `Document version ${doc.version} is not supported. Please update Serpentine.`
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

/**
 * Convert path segments to an SVG path string
 */
function pathSegmentsToSvgPath(segments: PathSegment[], closed: boolean): string {
  if (segments.length === 0) return ''
  
  const commands: string[] = []
  let started = false
  
  for (const seg of segments) {
    if (seg.type === 'arc') {
      const arc = seg as ArcSegment
      const startPt = pointOnCircle(arc.center, arc.radius, arc.startAngle)
      const endPt = pointOnCircle(arc.center, arc.radius, arc.endAngle)
      
      if (!started) {
        commands.push(`M ${startPt.x.toFixed(3)} ${startPt.y.toFixed(3)}`)
        started = true
      }
      
      // Calculate arc sweep angle for large-arc-flag determination
      // CCW = negative angle direction, CW = positive angle direction
      let sweep = arc.endAngle - arc.startAngle
      if (arc.counterclockwise) {
        // CCW: normalize to negative sweep
        while (sweep > 0) sweep -= Math.PI * 2
        while (sweep < -Math.PI * 2) sweep += Math.PI * 2
      } else {
        // CW: normalize to positive sweep
        while (sweep < 0) sweep += Math.PI * 2
        while (sweep > Math.PI * 2) sweep -= Math.PI * 2
      }
      
      // SVG arc: A rx ry x-axis-rotation large-arc-flag sweep-flag x y
      // large-arc: 1 if arc spans more than 180 degrees
      // sweep-flag: 1 for clockwise, 0 for counter-clockwise
      const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0
      const sweepFlag = arc.counterclockwise ? 0 : 1
      
      commands.push(`A ${arc.radius.toFixed(3)} ${arc.radius.toFixed(3)} 0 ${largeArc} ${sweepFlag} ${endPt.x.toFixed(3)} ${endPt.y.toFixed(3)}`)
      
    } else if (seg.type === 'ellipse-arc') {
      const ellipse = seg as EllipseArcSegment
      
      // Calculate start and end points in world coordinates
      const cosR = Math.cos(ellipse.rotation)
      const sinR = Math.sin(ellipse.rotation)
      
      const startLocalX = ellipse.radiusX * Math.cos(ellipse.startAngle)
      const startLocalY = ellipse.radiusY * Math.sin(ellipse.startAngle)
      const startPt = {
        x: ellipse.center.x + startLocalX * cosR - startLocalY * sinR,
        y: ellipse.center.y + startLocalX * sinR + startLocalY * cosR
      }
      
      const endLocalX = ellipse.radiusX * Math.cos(ellipse.endAngle)
      const endLocalY = ellipse.radiusY * Math.sin(ellipse.endAngle)
      const endPt = {
        x: ellipse.center.x + endLocalX * cosR - endLocalY * sinR,
        y: ellipse.center.y + endLocalX * sinR + endLocalY * cosR
      }
      
      if (!started) {
        commands.push(`M ${startPt.x.toFixed(3)} ${startPt.y.toFixed(3)}`)
        started = true
      }
      
      // Calculate sweep angle
      let sweep = ellipse.endAngle - ellipse.startAngle
      if (!ellipse.counterclockwise) {
        while (sweep < 0) sweep += Math.PI * 2
        while (sweep > Math.PI * 2) sweep -= Math.PI * 2
      } else {
        while (sweep > 0) sweep -= Math.PI * 2
        while (sweep < -Math.PI * 2) sweep += Math.PI * 2
      }
      
      const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0
      // SVG sweep: 1 = clockwise, 0 = counter-clockwise
      // Canvas counterclockwise = true means CCW, so SVG sweep = 0
      const sweepFlag = ellipse.counterclockwise ? 0 : 1
      const rotationDeg = (ellipse.rotation * 180) / Math.PI
      
      commands.push(`A ${ellipse.radiusX.toFixed(3)} ${ellipse.radiusY.toFixed(3)} ${rotationDeg.toFixed(3)} ${largeArc} ${sweepFlag} ${endPt.x.toFixed(3)} ${endPt.y.toFixed(3)}`)
      
    } else if (seg.type === 'line') {
      const line = seg as LineSegment
      
      if (!started) {
        commands.push(`M ${line.start.x.toFixed(3)} ${line.start.y.toFixed(3)}`)
        started = true
      }
      
      commands.push(`L ${line.end.x.toFixed(3)} ${line.end.y.toFixed(3)}`)
      
    } else if (seg.type === 'bezier') {
      const bezier = seg as BezierSegment
      
      if (!started) {
        commands.push(`M ${bezier.start.x.toFixed(3)} ${bezier.start.y.toFixed(3)}`)
        started = true
      }
      
      commands.push(`C ${bezier.cp1.x.toFixed(3)} ${bezier.cp1.y.toFixed(3)} ${bezier.cp2.x.toFixed(3)} ${bezier.cp2.y.toFixed(3)} ${bezier.end.x.toFixed(3)} ${bezier.end.y.toFixed(3)}`)
    }
  }
  
  if (closed) {
    commands.push('Z')
  }
  
  return commands.join(' ')
}

/**
 * Calculate bounding box of path segments
 */
function calculatePathBounds(segments: PathSegment[]): { minX: number, minY: number, maxX: number, maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  
  const updateBounds = (x: number, y: number) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  
  for (const seg of segments) {
    if (seg.type === 'arc') {
      const arc = seg as ArcSegment
      // Include start, end, and potential extrema
      const startPt = pointOnCircle(arc.center, arc.radius, arc.startAngle)
      const endPt = pointOnCircle(arc.center, arc.radius, arc.endAngle)
      updateBounds(startPt.x, startPt.y)
      updateBounds(endPt.x, endPt.y)
      
      // Check cardinal directions (0, π/2, π, 3π/2) if within arc
      const cardinals = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]
      for (const angle of cardinals) {
        if (isAngleInArc(angle, arc.startAngle, arc.endAngle, arc.counterclockwise)) {
          const pt = pointOnCircle(arc.center, arc.radius, angle)
          updateBounds(pt.x, pt.y)
        }
      }
    } else if (seg.type === 'ellipse-arc') {
      const ellipse = seg as EllipseArcSegment
      // Approximate with start/end and center ± radii
      const cosR = Math.cos(ellipse.rotation)
      const sinR = Math.sin(ellipse.rotation)
      
      // Check multiple points along the arc for bounds
      for (let t = 0; t <= 1; t += 0.1) {
        const angle = ellipse.startAngle + t * (ellipse.endAngle - ellipse.startAngle)
        const localX = ellipse.radiusX * Math.cos(angle)
        const localY = ellipse.radiusY * Math.sin(angle)
        const x = ellipse.center.x + localX * cosR - localY * sinR
        const y = ellipse.center.y + localX * sinR + localY * cosR
        updateBounds(x, y)
      }
    } else if (seg.type === 'line') {
      const line = seg as LineSegment
      updateBounds(line.start.x, line.start.y)
      updateBounds(line.end.x, line.end.y)
    } else if (seg.type === 'bezier') {
      const bezier = seg as BezierSegment
      updateBounds(bezier.start.x, bezier.start.y)
      updateBounds(bezier.end.x, bezier.end.y)
      updateBounds(bezier.cp1.x, bezier.cp1.y)
      updateBounds(bezier.cp2.x, bezier.cp2.y)
    }
  }
  
  return { minX, minY, maxX, maxY }
}

/**
 * Check if an angle is within an arc (accounting for direction)
 */
function isAngleInArc(angle: number, start: number, end: number, counterclockwise: boolean): boolean {
  // Normalize all angles to [0, 2π)
  const normalize = (a: number) => {
    while (a < 0) a += Math.PI * 2
    while (a >= Math.PI * 2) a -= Math.PI * 2
    return a
  }
  
  const a = normalize(angle)
  const s = normalize(start)
  const e = normalize(end)
  
  if (counterclockwise) {
    // Counter-clockwise: from start to end going negative
    if (s >= e) {
      return a <= s && a >= e
    } else {
      return a <= s || a >= e
    }
  } else {
    // Clockwise: from start to end going positive
    if (s <= e) {
      return a >= s && a <= e
    } else {
      return a >= s || a <= e
    }
  }
}

/**
 * Export the current path as an SVG file
 */
export function exportSvg(): void {
  try {
    const docState = useDocumentStore.getState()
    
    const circles = docState.shapes.filter((s): s is CircleShape => s.type === 'circle')
    
    if (circles.length < 2) {
      useNotificationStore.getState().warning('Cannot export', 'Need at least 2 circles to export a path')
      return
    }
    
    const pathData = computeTangentHull(
      circles,
      docState.shapeOrder,
      docState.globalStretch,
      docState.closedPath,
      docState.useStartPoint,
      docState.useEndPoint
    )
    
    if (pathData.segments.length === 0) {
      useNotificationStore.getState().warning('Cannot export', 'No valid path to export')
      return
    }
    
    // Generate SVG path string
    const svgPathD = pathSegmentsToSvgPath(pathData.segments, docState.closedPath)
    
    // Calculate bounds for viewBox
    const bounds = calculatePathBounds(pathData.segments)
    const padding = 20
    const viewBoxX = bounds.minX - padding
    const viewBoxY = bounds.minY - padding
    const viewBoxWidth = bounds.maxX - bounds.minX + padding * 2
    const viewBoxHeight = bounds.maxY - bounds.minY + padding * 2
    
    // Create SVG document
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     viewBox="${viewBoxX.toFixed(3)} ${viewBoxY.toFixed(3)} ${viewBoxWidth.toFixed(3)} ${viewBoxHeight.toFixed(3)}"
     width="${viewBoxWidth.toFixed(0)}" 
     height="${viewBoxHeight.toFixed(0)}">
  <path d="${svgPathD}" 
        fill="none" 
        stroke="#000000" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round"/>
</svg>
`
    
    // Download the file
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    
    const a = window.document.createElement('a')
    a.href = url
    const fileName = docState.fileName || 'path'
    a.download = `${fileName.replace(/[^a-z0-9]/gi, '_')}.svg`
    window.document.body.appendChild(a)
    a.click()
    window.document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    useNotificationStore.getState().success('SVG exported', `${fileName}.svg`)
  } catch (error) {
    reportError(error, 'Failed to export SVG')
  }
}
