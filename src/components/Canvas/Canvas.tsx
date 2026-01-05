import { useRef, useEffect, useCallback } from 'react'
import { useDocumentStore } from '../../stores/documentStore'
import { useViewportStore } from '../../stores/viewportStore'
import { useSelectionStore } from '../../stores/selectionStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useCanvasStore } from '../../stores/canvasStore'
import { useDebugStore } from '../../stores/debugStore'
import { useThemeStore } from '../../stores/themeStore'
import { useCanvasInteraction } from './useCanvasInteraction'
import { renderGrid, renderMirrorAxis } from './renderers/GridRenderer'
import { renderShapes, renderSelectedTangentHandles } from './renderers/ShapeRenderer'
import { renderPath } from './renderers/PathRenderer'
import { renderMeasurements } from './renderers/MeasurementRenderer'
import { renderHandleValues } from './renderers/HandleValueRenderer'
import { reportError } from '../../stores/notificationStore'
import { fitToView } from '../../utils/viewportActions'
import styles from './Canvas.module.css'

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Store subscriptions
  const shapes = useDocumentStore(state => state.shapes)
  const shapeOrder = useDocumentStore(state => state.shapeOrder)
  const globalStretch = useDocumentStore(state => state.globalStretch)
  const closedPath = useDocumentStore(state => state.closedPath)
  const useStartPoint = useDocumentStore(state => state.useStartPoint)
  const useEndPoint = useDocumentStore(state => state.useEndPoint)
  const pan = useViewportStore(state => state.pan)
  const zoom = useViewportStore(state => state.zoom)
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const hoveredId = useSelectionStore(state => state.hoveredId)
  const hoverTarget = useSelectionStore(state => state.hoverTarget)
  const dragState = useSelectionStore(state => state.dragState)
  const gridSize = useSettingsStore(state => state.gridSize)
  const showGrid = useSettingsStore(state => state.showGrid)
  const measurementMode = useSettingsStore(state => state.measurementMode)
  const theme = useThemeStore(state => state.theme)
  
  // Debug state - subscribe to trigger re-render when debug settings change
  const debugSettings = useDebugStore(state => ({
    showTangentPoints: state.showTangentPoints,
    showTangentLabels: state.showTangentLabels,
    showArcAngles: state.showArcAngles,
    showPathOrder: state.showPathOrder,
    showCircleCenters: state.showCircleCenters,
  }))
  
  // Canvas interaction hook
  useCanvasInteraction(canvasRef, containerRef)
  
  // Track if we've already reported a render error (to avoid spamming)
  const lastRenderErrorRef = useRef<string | null>(null)
  
  // Track if initial fit-to-view has been done
  const initialFitDoneRef = useRef(false)
  
  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    
    try {
      // Clear canvas with theme background
      ctx.fillStyle = theme.background
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Save context and apply viewport transform
      ctx.save()
      ctx.translate(pan.x, pan.y)
      ctx.scale(zoom, zoom)
      
      // Render layers (back to front)
      if (showGrid) {
        renderGrid(ctx, canvas.width, canvas.height, pan, zoom, gridSize)
      }
      
      // Draw mirror axis if any circle has mirroring enabled
      const hasMirroredCircles = shapes.some(s => s.type === 'circle' && s.mirrored)
      if (hasMirroredCircles) {
        renderMirrorAxis(ctx, canvas.width, canvas.height, pan, zoom)
      }
      
      // Shapes first (below path)
      renderShapes(ctx, shapes, selectedIds, hoveredId, hoverTarget, theme, zoom, shapeOrder)
      
      // Path on top of shapes
      renderPath(ctx, shapes, shapeOrder, zoom, globalStretch, closedPath, useStartPoint, useEndPoint)
      
      // Tangent handles on top of path (for selected circles)
      renderSelectedTangentHandles(ctx, shapes, selectedIds, hoverTarget, shapeOrder, theme, zoom, closedPath, useStartPoint, useEndPoint)
      
      // Handle value labels (for hovered/dragged handles)
      renderHandleValues(
        ctx,
        shapes,
        shapeOrder,
        selectedIds,
        hoveredId,
        hoverTarget,
        dragState?.mode ?? null,
        dragState?.shapeId ?? null,
        theme,
        zoom
      )
      
      // Measurements on top of everything
      if (measurementMode !== 'clean') {
        renderMeasurements(ctx, shapes, shapeOrder, measurementMode, zoom, closedPath, useStartPoint, useEndPoint)
      }
      
      ctx.restore()
      
      // Clear error state on successful render
      lastRenderErrorRef.current = null
    } catch (error) {
      ctx.restore()
      
      // Only report if this is a new error
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (lastRenderErrorRef.current !== errorMessage) {
        lastRenderErrorRef.current = errorMessage
        reportError(error, 'Canvas render error')
      }
    }
  }, [shapes, shapeOrder, globalStretch, closedPath, useStartPoint, useEndPoint, pan, zoom, selectedIds, hoveredId, hoverTarget, dragState, gridSize, showGrid, measurementMode, debugSettings, theme])
  
  // Store canvas dimensions
  const setCanvasDimensions = useCanvasStore(state => state.setDimensions)
  
  // Handle resize
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const dpr = window.devicePixelRatio || 1
        
        canvas.width = width * dpr
        canvas.height = height * dpr
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        
        // Store dimensions for fit-to-view calculations
        setCanvasDimensions(width, height)
        
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.scale(dpr, dpr)
        }
        
        // Fit to view on initial load (only once)
        if (!initialFitDoneRef.current) {
          initialFitDoneRef.current = true
          // Use requestAnimationFrame to ensure dimensions are committed
          requestAnimationFrame(() => {
            fitToView(true)
          })
        }
        
        render()
      }
    })
    
    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [render, setCanvasDimensions])
  
  // Re-render on state changes
  useEffect(() => {
    render()
  }, [render])
  
  return (
    <div ref={containerRef} className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
