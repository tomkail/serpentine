import { useRef, useEffect, useCallback } from 'react'
import { useDocumentStore } from '../../stores/documentStore'
import { useViewportStore } from '../../stores/viewportStore'
import { useSelectionStore, getClickPreviewOpacity, getMarqueeRect } from '../../stores/selectionStore'
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
import { renderTooltips } from './renderers/TooltipRenderer'
import { renderSmartGuides } from './renderers/SmartGuidesRenderer'
import { drawPlusIconCanvas } from '../icons/Icons'
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
  const mirrorAxis = useDocumentStore(state => state.mirrorAxis)
  const pan = useViewportStore(state => state.pan)
  const zoom = useViewportStore(state => state.zoom)
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const hoveredId = useSelectionStore(state => state.hoveredId)
  const hoverTarget = useSelectionStore(state => state.hoverTarget)
  const dragState = useSelectionStore(state => state.dragState)
  const clickPreview = useSelectionStore(state => state.clickPreview)
  const activeGuides = useSelectionStore(state => state.activeGuides)
  const gridSize = useSettingsStore(state => state.gridSize)
  const showGrid = useSettingsStore(state => state.showGrid)
  const measurementMode = useSettingsStore(state => state.measurementMode)
  const isolatePath = useSettingsStore(state => state.isolatePath)
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
      // Clear canvas with background
      // In isolate mode, use a clean neutral background instead of theme background
      ctx.fillStyle = isolatePath ? '#000000' : theme.background
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Save context and apply viewport transform
      ctx.save()
      ctx.translate(pan.x, pan.y)
      ctx.scale(zoom, zoom)
      
      // In isolate mode, only render the path - skip everything else
      if (isolatePath) {
        // Path only
        renderPath(ctx, shapes, shapeOrder, zoom, globalStretch, closedPath, useStartPoint, useEndPoint, theme.pathStroke, mirrorAxis)
        ctx.restore()
        lastRenderErrorRef.current = null
        return
      }
      
      // Render layers (back to front)
      if (showGrid) {
        renderGrid(ctx, canvas.width, canvas.height, pan, zoom, gridSize, theme.gridColor)
      }
      
      // Draw mirror axis if any circle has mirroring enabled
      const hasMirroredCircles = shapes.some(s => s.type === 'circle' && s.mirrored)
      if (hasMirroredCircles) {
        renderMirrorAxis(ctx, canvas.width, canvas.height, pan, zoom, theme.gridColor, mirrorAxis)
      }
      
      // Shapes first (below path)
      renderShapes(ctx, shapes, selectedIds, hoveredId, hoverTarget, theme, zoom, shapeOrder, mirrorAxis)
      
      // Click preview circle (semi-transparent hint for double-click)
      // Animated: fades in over first 10%, fades out over last 50%
      const previewOpacity = getClickPreviewOpacity(clickPreview)
      if (clickPreview && previewOpacity > 0) {
        const { position, radius } = clickPreview
        const uiScale = 1 / zoom
        
        // Draw circle
        ctx.beginPath()
        ctx.arc(position.x, position.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = theme.fill
        ctx.globalAlpha = 0.4 * previewOpacity
        ctx.fill()
        ctx.strokeStyle = theme.accent
        ctx.globalAlpha = 0.5 * previewOpacity
        ctx.lineWidth = (theme.weights?.medium ?? 2) * uiScale
        ctx.stroke()
        
        // Draw plus icon in center
        const plusSize = Math.min(radius * 0.8, 28 * uiScale)
        const plusLineWidth = Math.max(2 * uiScale, plusSize * 0.15)
        
        ctx.globalAlpha = 0.7 * previewOpacity
        drawPlusIconCanvas({
          ctx,
          x: position.x,
          y: position.y,
          size: plusSize,
          color: theme.accent,
          lineWidth: plusLineWidth
        })
        
        ctx.globalAlpha = 1
      }
      
      // Path on top of shapes
      renderPath(ctx, shapes, shapeOrder, zoom, globalStretch, closedPath, useStartPoint, useEndPoint, theme.pathStroke, mirrorAxis)
      
      // Smart guides during drag operations
      if (dragState?.mode === 'move' && activeGuides.length > 0) {
        renderSmartGuides(ctx, activeGuides, canvas.width, canvas.height, pan, zoom)
      }
      
      // Tangent handles on top of path (for selected circles)
      renderSelectedTangentHandles(ctx, shapes, selectedIds, hoverTarget, shapeOrder, theme, zoom, closedPath, useStartPoint, useEndPoint, mirrorAxis)
      
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
        zoom,
        closedPath,
        useStartPoint,
        useEndPoint,
        mirrorAxis
      )
      
      // Tooltips for interactive elements (only when not dragging)
      if (!dragState) {
        renderTooltips(
          ctx,
          shapes,
          shapeOrder,
          hoveredId,
          hoverTarget,
          theme,
          zoom,
          closedPath,
          useStartPoint,
          useEndPoint,
          mirrorAxis
        )
      }
      
      // Measurements on top of everything
      if (measurementMode !== 'clean') {
        renderMeasurements(ctx, shapes, shapeOrder, measurementMode, zoom, closedPath, useStartPoint, useEndPoint, mirrorAxis)
      }
      
      // Marquee selection rectangle (rendered last, on top of everything)
      const marqueeRect = getMarqueeRect(dragState)
      if (marqueeRect && marqueeRect.width > 0 && marqueeRect.height > 0) {
        const marqueeMode = dragState?.marqueeMode ?? 'replace'
        
        // Semi-transparent fill
        ctx.fillStyle = marqueeMode === 'subtract' 
          ? 'rgba(255, 100, 100, 0.1)'  // Red tint for subtract
          : 'rgba(100, 150, 255, 0.15)' // Blue tint for replace/add
        ctx.fillRect(marqueeRect.x, marqueeRect.y, marqueeRect.width, marqueeRect.height)
        
        // Dashed border
        ctx.strokeStyle = marqueeMode === 'subtract'
          ? 'rgba(255, 100, 100, 0.8)'  // Red for subtract
          : theme.accent                 // Theme accent for replace/add
        ctx.lineWidth = 1 / zoom
        ctx.setLineDash([4 / zoom, 4 / zoom])
        ctx.strokeRect(marqueeRect.x, marqueeRect.y, marqueeRect.width, marqueeRect.height)
        ctx.setLineDash([])
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
  }, [shapes, shapeOrder, globalStretch, closedPath, useStartPoint, useEndPoint, mirrorAxis, pan, zoom, selectedIds, hoveredId, hoverTarget, dragState, clickPreview, activeGuides, gridSize, showGrid, measurementMode, isolatePath, debugSettings, theme])
  
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
  
  // Animate click preview (continuous re-render while preview is visible)
  useEffect(() => {
    if (!clickPreview) return
    
    let animationId: number
    
    const animate = () => {
      render()
      // Continue animation while preview might still be visible
      if (getClickPreviewOpacity(clickPreview) > 0) {
        animationId = requestAnimationFrame(animate)
      }
    }
    
    animationId = requestAnimationFrame(animate)
    
    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [clickPreview, render])
  
  return (
    <div ref={containerRef} className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
