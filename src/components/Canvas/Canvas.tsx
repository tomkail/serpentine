import { useRef, useEffect, useCallback, useLayoutEffect } from 'react'
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
import { renderTooltips, renderScalePivotMarker } from './renderers/TooltipRenderer'
import { renderSmartGuides } from './renderers/SmartGuidesRenderer'
import { hasActiveAnimations } from './renderers/opacityAnimation'
import { drawPlusIconCanvas } from '../icons/Icons'
import { reportError } from '../../stores/notificationStore'
import { fitToView } from '../../utils/viewportActions'
import { startMeasure, endMeasure, markFrame, getFPS, getAvgFrameTime, isProfilerEnabled, trackMemory, getMemoryUsageMB } from '../../utils/profiler'
import styles from './Canvas.module.css'

// Startup timing
const CANVAS_LOAD_TIME = performance.now()
console.log(`%c[Canvas] Module loaded at ${CANVAS_LOAD_TIME.toFixed(1)}ms`, 'color: #6bcb77; font-weight: bold;')

// Pre-warm the Canvas 2D API by doing a small draw
// This triggers GPU resource allocation and JIT compilation early
// so the first real render doesn't freeze for 3+ seconds
const warmupCanvas = () => {
  const startTime = performance.now()
  console.log('%c[Canvas] Starting GPU/JIT warmup...', 'color: #ffd93d;')
  
  const canvas = document.createElement('canvas')
  canvas.width = 100
  canvas.height = 100
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  // Do a variety of draw operations to trigger JIT compilation
  // These are the same operations used in the real render
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 100, 100)
  
  // Arc drawing (used by grid dots)
  ctx.beginPath()
  for (let i = 0; i < 100; i++) {
    ctx.moveTo(i + 2, i)
    ctx.arc(i, i, 2, 0, Math.PI * 2)
  }
  ctx.fill()
  
  // Line drawing (used by paths)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(100, 100)
  ctx.bezierCurveTo(25, 25, 75, 75, 100, 0)
  ctx.stroke()
  
  // Text rendering (used by labels)
  ctx.font = '12px system-ui'
  ctx.fillText('warmup', 10, 10)
  
  console.log(`%c[Canvas] GPU/JIT warmup completed in ${(performance.now() - startTime).toFixed(1)}ms`, 'color: #00ff88;')
}

// Run warmup immediately on module load
warmupCanvas()

export function Canvas() {
  console.log(`%c[Canvas] Canvas render at ${(performance.now() - CANVAS_LOAD_TIME).toFixed(1)}ms`, 'color: #6bcb77;')
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Store subscriptions
  const shapes = useDocumentStore(state => state.shapes)
  const shapeOrder = useDocumentStore(state => state.shapeOrder)
  const globalStretch = useDocumentStore(state => state.globalStretch)
  const closedPath = useDocumentStore(state => state.closedPath)
  const useStartPoint = useDocumentStore(state => state.useStartPoint)
  const useEndPoint = useDocumentStore(state => state.useEndPoint)
  const mirrorConfig = useDocumentStore(state => state.mirrorConfig)
  const pan = useViewportStore(state => state.pan)
  const zoom = useViewportStore(state => state.zoom)
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const hoveredId = useSelectionStore(state => state.hoveredId)
  const hoverTarget = useSelectionStore(state => state.hoverTarget)
  const dragState = useSelectionStore(state => state.dragState)
  const clickPreview = useSelectionStore(state => state.clickPreview)
  const activeGuides = useSelectionStore(state => state.activeGuides)
  const mouseWorldPos = useSelectionStore(state => state.mouseWorldPos)
  const modifierKeys = useSelectionStore(state => state.modifierKeys)
  const gridSize = useSettingsStore(state => state.gridSize)
  const showGrid = useSettingsStore(state => state.showGrid)
  const measurementMode = useSettingsStore(state => state.measurementMode)
  const isolatePath = useSettingsStore(state => state.isolatePath)
  const snapToGrid = useSettingsStore(state => state.snapToGrid)
  const smartGuides = useSettingsStore(state => state.smartGuides)
  const theme = useThemeStore(state => state.theme)
  
  // Debug state - subscribe to trigger re-render when debug settings change
  const debugSettings = useDebugStore(state => ({
    showTangentPoints: state.showTangentPoints,
    showTangentLabels: state.showTangentLabels,
    showArcAngles: state.showArcAngles,
    showPathOrder: state.showPathOrder,
    showCircleCenters: state.showCircleCenters,
    showMirrorPlaneNumbers: state.showMirrorPlaneNumbers,
  }))
  
  // Profiling state
  const showPerformanceOverlay = useDebugStore(state => state.showPerformanceOverlay)
  
  // Canvas interaction hook
  useCanvasInteraction(canvasRef, containerRef)
  
  // Track if we've already reported a render error (to avoid spamming)
  const lastRenderErrorRef = useRef<string | null>(null)
  
  // Track if initial fit-to-view has been done
  const initialFitDoneRef = useRef(false)
  
  // Track if first render has been done (for startup profiling)
  const firstRenderDoneRef = useRef(false)
  
  // Render function
  const render = useCallback(() => {
    const renderStart = performance.now()
    console.log(`%c[Canvas] render() called at ${(renderStart - CANVAS_LOAD_TIME).toFixed(1)}ms`, 'color: #6bcb77;')
    
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      console.log(`%c[Canvas] render() EARLY RETURN - canvas: ${!!canvas}, ctx: ${!!ctx}`, 'color: #ff0000; font-weight: bold;')
      return
    }
    // Canvas has no size yet (before layout, or mid hot reload) - nothing to draw,
    // and zero-size canvases make pattern creation throw
    if (canvas.width === 0 || canvas.height === 0) return
    console.log(`%c[Canvas] render() starting work, canvas: ${canvas.width}x${canvas.height}`, 'color: #888;')
    
    // Track timing for first render (always on for debugging startup)
    const isFirstRender = !firstRenderDoneRef.current
    const timings: Record<string, number> = {}
    const mark = (name: string) => { timings[name] = performance.now() - renderStart }
    
    // Mark frame for FPS tracking and detect GC
    markFrame()
    if (isProfilerEnabled()) {
      trackMemory() // Track memory to detect GC pauses
    }
    startMeasure('Canvas.render', { shapes: shapes.length })
    
    try {
      // Clear canvas with background
      startMeasure('clear')
      // In isolate mode, use a clean neutral background instead of theme background
      ctx.fillStyle = isolatePath ? '#000000' : theme.background
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      endMeasure('clear')
      if (isFirstRender) mark('clear')
      
      // Save context and apply viewport transform
      ctx.save()
      ctx.translate(pan.x, pan.y)
      ctx.scale(zoom, zoom)
      
      // In isolate mode, only render the path - skip everything else
      if (isolatePath) {
        startMeasure('path (isolated)')
        renderPath(ctx, shapes, shapeOrder, zoom, globalStretch, closedPath, useStartPoint, useEndPoint, theme.pathStroke, mirrorConfig)
        endMeasure('path (isolated)')
        ctx.restore()
        lastRenderErrorRef.current = null
        endMeasure('Canvas.render')
        return
      }
      
      // Render layers (back to front)
      // Skip grid on first render to avoid 3+ second freeze (grid is the heaviest operation)
      // Grid will appear on subsequent renders
      if (showGrid && !isFirstRender) {
        startMeasure('grid')
        renderGrid(ctx, canvas.width, canvas.height, pan, zoom, gridSize, theme.gridColor)
        endMeasure('grid')
      }
      if (isFirstRender) mark('grid-skipped')
      
      // Draw mirror axis if any circle has mirroring enabled
      const hasMirroredCircles = shapes.some(s => s.type === 'circle' && s.mirrored)
      if (hasMirroredCircles) {
        startMeasure('mirrorAxis')
        renderMirrorAxis(ctx, canvas.width, canvas.height, pan, zoom, theme.gridColor, mirrorConfig, debugSettings.showMirrorPlaneNumbers)
        endMeasure('mirrorAxis')
        if (isFirstRender) mark('mirrorAxis')
      }
      
      // Shapes first (below path)
      // Returns set of circle IDs with visible UI (for hiding overlapping measurements)
      startMeasure('shapes')
      const circlesWithVisibleUI = renderShapes(ctx, shapes, selectedIds, hoveredId, hoverTarget, theme, zoom, shapeOrder, mirrorConfig, measurementMode, mouseWorldPos)
      endMeasure('shapes')
      if (isFirstRender) mark('shapes')
      
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
      startMeasure('path')
      renderPath(ctx, shapes, shapeOrder, zoom, globalStretch, closedPath, useStartPoint, useEndPoint, theme.pathStroke, mirrorConfig)
      endMeasure('path')
      if (isFirstRender) mark('path')
      
      // Smart guides during drag operations
      if (dragState?.mode === 'move' && activeGuides.length > 0) {
        renderSmartGuides(ctx, activeGuides, canvas.width, canvas.height, pan, zoom, theme.smartGuide)
      }
      
      // Tangent handles on top of path (for selected circles)
      startMeasure('handles')
      renderSelectedTangentHandles(ctx, shapes, selectedIds, hoverTarget, shapeOrder, theme, zoom, closedPath, useStartPoint, useEndPoint, mirrorConfig)
      endMeasure('handles')
      if (isFirstRender) mark('handles')
      
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
        mirrorConfig
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
          mirrorConfig,
          modifierKeys,
          mouseWorldPos,
          snapToGrid,
          smartGuides,
          selectedIds.length
        )
      }
      
      // Scale pivot marker (shown during scale drag with Alt modifier)
      if (dragState?.mode === 'scale' && dragState.scaleAnchor) {
        renderScalePivotMarker(ctx, dragState.scaleAnchor, theme, zoom)
      }
      
      // Measurements on top of everything
      if (measurementMode !== 'clean') {
        startMeasure('measurements')
        renderMeasurements(ctx, shapes, shapeOrder, measurementMode, zoom, closedPath, useStartPoint, useEndPoint, mirrorConfig, circlesWithVisibleUI)
        endMeasure('measurements')
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
      
      // Draw performance overlay if enabled
      if (showPerformanceOverlay && isProfilerEnabled()) {
        drawPerformanceOverlay(ctx, canvas.width, canvas.height)
      }
      
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
    
    endMeasure('Canvas.render')
    
    // Log first render timing breakdown
    if (isFirstRender) {
      firstRenderDoneRef.current = true
      console.log(
        `%c[Canvas] FIRST RENDER BREAKDOWN:`,
        'color: #ff6b6b; font-weight: bold; background: #fff0f0; padding: 4px 8px;'
      )
      let lastTime = 0
      for (const [name, time] of Object.entries(timings)) {
        const delta = time - lastTime
        const color = delta > 100 ? '#ff0000' : delta > 10 ? '#ffa500' : '#00aa00'
        console.log(`  %c${name}: ${time.toFixed(1)}ms (Δ${delta.toFixed(1)}ms)`, `color: ${color};`)
        lastTime = time
      }
      
      // Schedule a second render to show the grid (which was skipped on first render)
      requestAnimationFrame(() => {
        console.log('%c[Canvas] Rendering grid (deferred)...', 'color: #ffd93d;')
        render()
      })
    }
    
    console.log(`%c[Canvas] render() completed in ${(performance.now() - renderStart).toFixed(1)}ms`, 'color: #00ff88;')
  }, [shapes, shapeOrder, globalStretch, closedPath, useStartPoint, useEndPoint, mirrorConfig, pan, zoom, selectedIds, hoveredId, hoverTarget, dragState, clickPreview, activeGuides, mouseWorldPos, gridSize, showGrid, measurementMode, isolatePath, debugSettings, theme, showPerformanceOverlay])
  
  // Helper to draw performance overlay
  function drawPerformanceOverlay(ctx: CanvasRenderingContext2D, width: number, _height: number) {
    const dpr = window.devicePixelRatio || 1
    const padding = 12 * dpr
    const lineHeight = 16 * dpr
    const fontSize = 12 * dpr
    
    const fps = getFPS()
    const frameTime = getAvgFrameTime()
    const memoryMB = getMemoryUsageMB()
    
    // Background
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0) // Reset transform to screen space
    
    const boxWidth = 150 * dpr
    const boxHeight = memoryMB >= 0 ? 76 * dpr : 60 * dpr // Taller if memory available
    const x = width - boxWidth - padding
    const y = padding
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
    ctx.fillRect(x, y, boxWidth, boxHeight)
    
    ctx.font = `${fontSize}px monospace`
    ctx.fillStyle = fps > 55 ? '#6bcb77' : fps > 30 ? '#ffd93d' : '#ff6b6b'
    ctx.fillText(`FPS: ${fps.toFixed(1)}`, x + 8 * dpr, y + lineHeight)
    
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`Frame: ${frameTime.toFixed(2)}ms`, x + 8 * dpr, y + lineHeight * 2)
    ctx.fillText(`Shapes: ${shapes.length}`, x + 8 * dpr, y + lineHeight * 3)
    
    // Show memory if available (Chrome only)
    if (memoryMB >= 0) {
      ctx.fillStyle = memoryMB > 100 ? '#ffd93d' : '#888888'
      ctx.fillText(`Memory: ${memoryMB.toFixed(1)}MB`, x + 8 * dpr, y + lineHeight * 4)
    }
    
    ctx.restore()
  }
  
  // Store canvas dimensions
  const setCanvasDimensions = useCanvasStore(state => state.setDimensions)
  
  // Handle resize
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    
    console.log(`%c[Canvas] ResizeObserver setup at ${(performance.now() - CANVAS_LOAD_TIME).toFixed(1)}ms`, 'color: #ff6b6b;')
    
    const resizeObserver = new ResizeObserver((entries) => {
      const resizeStart = performance.now()
      console.log(`%c[Canvas] ResizeObserver callback fired at ${(resizeStart - CANVAS_LOAD_TIME).toFixed(1)}ms`, 'color: #ff6b6b; font-weight: bold;')
      
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const dpr = window.devicePixelRatio || 1
        
        console.log(`%c[Canvas] Canvas size: ${width}x${height} (dpr: ${dpr})`, 'color: #888;')
        
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
          console.log(`%c[Canvas] Scheduling fitToView...`, 'color: #ffd93d;')
          // Use requestAnimationFrame to ensure dimensions are committed
          requestAnimationFrame(() => {
            const fitStart = performance.now()
            console.log(`%c[Canvas] fitToView started at ${(fitStart - CANVAS_LOAD_TIME).toFixed(1)}ms`, 'color: #ffd93d;')
            fitToView(true)
            console.log(`%c[Canvas] fitToView completed in ${(performance.now() - fitStart).toFixed(1)}ms`, 'color: #00ff88;')
          })
        }
        
        console.log(`%c[Canvas] Calling render() from resize handler...`, 'color: #6bcb77;')
        render()
        console.log(`%c[Canvas] Resize handler completed in ${(performance.now() - resizeStart).toFixed(1)}ms`, 'color: #00ff88;')
      }
    })
    
    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [render, setCanvasDimensions])
  
  // Mark Canvas mount timing
  useLayoutEffect(() => {
    console.log(`%c[Canvas] Canvas mounted (layout) at ${(performance.now() - CANVAS_LOAD_TIME).toFixed(1)}ms`, 'color: #00ff88;')
  }, [])
  
  useEffect(() => {
    console.log(`%c[Canvas] Canvas mounted (effect) at ${(performance.now() - CANVAS_LOAD_TIME).toFixed(1)}ms`, 'color: #00ff88;')
  }, [])
  
  // Re-render on state changes
  useEffect(() => {
    console.log(`%c[Canvas] useEffect[render] triggered at ${(performance.now() - CANVAS_LOAD_TIME).toFixed(1)}ms`, 'color: #ff6b6b;')
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
  
  // Animate opacity transitions (index dots and direction ring fade in/out)
  // Re-render while animations are in progress after zoom changes
  useEffect(() => {
    let animationId: number
    let isRunning = true
    
    const animate = () => {
      if (!isRunning) return
      
      render()
      // Continue animation while there are active opacity transitions
      if (hasActiveAnimations()) {
        animationId = requestAnimationFrame(animate)
      }
    }
    
    // Start animation loop after zoom changes
    animationId = requestAnimationFrame(animate)
    
    return () => {
      isRunning = false
      cancelAnimationFrame(animationId)
    }
  }, [zoom, render])
  
  return (
    <div ref={containerRef} className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
