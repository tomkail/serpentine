import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useDocumentStore } from '../../stores/documentStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { computeTangentHull } from '../../geometry/path'
import { pathSegmentsToSvgPath, calculatePathBounds } from '../../utils/fileIO'
import type { CircleShape } from '../../types'
import styles from './FloatingPreview.module.css'

interface Position {
  x: number
  y: number
}

interface Size {
  width: number
  height: number
}

const MIN_WIDTH = 180
const MIN_HEIGHT = 140
const DEFAULT_WIDTH = 240
const DEFAULT_HEIGHT = 200

export function FloatingPreview() {
  const shapes = useDocumentStore(state => state.shapes)
  const shapeOrder = useDocumentStore(state => state.shapeOrder)
  const globalStretch = useDocumentStore(state => state.globalStretch)
  const closedPath = useDocumentStore(state => state.closedPath)
  const useStartPoint = useDocumentStore(state => state.useStartPoint)
  const useEndPoint = useDocumentStore(state => state.useEndPoint)
  const mirrorAxis = useDocumentStore(state => state.mirrorAxis)
  
  const isVisible = useSettingsStore(state => state.showSvgPreview)
  const setIsVisible = useSettingsStore(state => state.setShowSvgPreview)
  
  const [position, setPosition] = useState<Position>({ x: 20, y: 80 })
  const [size, setSize] = useState<Size>({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState<string | null>(null)
  const [strokeWidth, setStrokeWidth] = useState(2)
  
  const windowRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number }>({ x: 0, y: 0, posX: 0, posY: 0 })
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number; posX: number; posY: number }>({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 })

  const svgData = useMemo(() => {
    const circles = shapes.filter((s): s is CircleShape => s.type === 'circle')
    if (circles.length < 2) return null
    
    const pathData = computeTangentHull(
      circles,
      shapeOrder,
      globalStretch,
      closedPath,
      useStartPoint,
      useEndPoint,
      mirrorAxis
    )
    
    if (pathData.segments.length === 0) return null
    
    const svgPathD = pathSegmentsToSvgPath(pathData.segments, closedPath)
    const bounds = calculatePathBounds(pathData.segments)
    
    const baseWidth = bounds.maxX - bounds.minX
    const baseHeight = bounds.maxY - bounds.minY
    const baseDimension = Math.max(baseWidth, baseHeight, 1)
    
    // Calculate stroke width in SVG units as a percentage of shape size
    // strokeWidth slider (0.5-12) maps to roughly 0.1%-2.4% of shape size
    const scaledStrokeWidth = (strokeWidth / 100) * baseDimension
    
    // Add padding based on stroke width to prevent clipping
    // Stroke extends half its width on each side
    const strokePadding = scaledStrokeWidth / 2
    const padding = baseDimension * 0.05 + strokePadding * 1.5
    
    const viewBoxX = bounds.minX - padding
    const viewBoxY = bounds.minY - padding
    const viewBoxWidth = bounds.maxX - bounds.minX + padding * 2
    const viewBoxHeight = bounds.maxY - bounds.minY + padding * 2
    
    return {
      pathD: svgPathD,
      viewBox: `${viewBoxX.toFixed(3)} ${viewBoxY.toFixed(3)} ${viewBoxWidth.toFixed(3)} ${viewBoxHeight.toFixed(3)}`,
      scaledStrokeWidth
    }
  }, [shapes, shapeOrder, globalStretch, closedPath, useStartPoint, useEndPoint, mirrorAxis, strokeWidth])

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y
    }
  }, [position])

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    
    setPosition({
      x: dragStartRef.current.posX + dx,
      y: dragStartRef.current.posY + dy
    })
  }, [isDragging])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: string) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(direction)
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y
    }
  }, [size, position])

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    
    const dx = e.clientX - resizeStartRef.current.x
    const dy = e.clientY - resizeStartRef.current.y
    const start = resizeStartRef.current
    
    let newWidth = start.width
    let newHeight = start.height
    let newX = start.posX
    let newY = start.posY
    
    // Handle horizontal resizing
    if (isResizing.includes('E')) {
      newWidth = Math.max(MIN_WIDTH, start.width + dx)
    }
    if (isResizing.includes('W')) {
      const potentialWidth = start.width - dx
      if (potentialWidth >= MIN_WIDTH) {
        newWidth = potentialWidth
        newX = start.posX + dx
      }
    }
    
    // Handle vertical resizing
    if (isResizing.includes('S')) {
      newHeight = Math.max(MIN_HEIGHT, start.height + dy)
    }
    if (isResizing.includes('N')) {
      const potentialHeight = start.height - dy
      if (potentialHeight >= MIN_HEIGHT) {
        newHeight = potentialHeight
        newY = start.posY + dy
      }
    }
    
    setSize({ width: newWidth, height: newHeight })
    setPosition({ x: newX, y: newY })
  }, [isResizing])

  const handleResizeEnd = useCallback(() => {
    setIsResizing(null)
  }, [])

  // Set up global mouse listeners for drag and resize
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove)
      window.addEventListener('mouseup', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleDragMove)
        window.removeEventListener('mouseup', handleDragEnd)
      }
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove)
      window.addEventListener('mouseup', handleResizeEnd)
      return () => {
        window.removeEventListener('mousemove', handleResizeMove)
        window.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [isResizing, handleResizeMove, handleResizeEnd])

  if (!isVisible) return null

  return (
    <div
      ref={windowRef}
      className={styles.floatingWindow}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height
      }}
    >
      {/* Header for dragging */}
      <div className={styles.header} onMouseDown={handleDragStart}>
        <span className={styles.title}>SVG PREVIEW</span>
        <button className={styles.closeButton} onClick={() => setIsVisible(false)} title="Close preview">
          ×
        </button>
      </div>
      
      {/* Content */}
      <div className={styles.content}>
        {svgData ? (
          <div className={styles.svgContainer}>
            <svg 
              viewBox={svgData.viewBox}
              className={styles.svgPreview}
              preserveAspectRatio="xMidYMid meet"
            >
              <path 
                d={svgData.pathD}
                fill="none"
                stroke="currentColor"
                strokeWidth={svgData.scaledStrokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        ) : (
          <div className={styles.svgContainer}>
            <div className={styles.svgEmpty}>
              Add at least 2 circles to preview SVG
            </div>
          </div>
        )}
        
        {/* Stroke width slider */}
        <div className={styles.sliderRow}>
          <label className={styles.sliderLabel}>Width</label>
          <input
            type="range"
            min="0.5"
            max="12"
            step="0.5"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(parseFloat(e.target.value))}
            className={styles.slider}
          />
          <span className={styles.sliderValue}>{strokeWidth}</span>
        </div>
      </div>
      
      {/* Resize handles */}
      <div className={`${styles.resizeHandle} ${styles.resizeN}`} onMouseDown={(e) => handleResizeStart(e, 'N')} />
      <div className={`${styles.resizeHandle} ${styles.resizeS}`} onMouseDown={(e) => handleResizeStart(e, 'S')} />
      <div className={`${styles.resizeHandle} ${styles.resizeE}`} onMouseDown={(e) => handleResizeStart(e, 'E')} />
      <div className={`${styles.resizeHandle} ${styles.resizeW}`} onMouseDown={(e) => handleResizeStart(e, 'W')} />
      <div className={`${styles.resizeHandle} ${styles.resizeNE}`} onMouseDown={(e) => handleResizeStart(e, 'NE')} />
      <div className={`${styles.resizeHandle} ${styles.resizeNW}`} onMouseDown={(e) => handleResizeStart(e, 'NW')} />
      <div className={`${styles.resizeHandle} ${styles.resizeSE}`} onMouseDown={(e) => handleResizeStart(e, 'SE')} />
      <div className={`${styles.resizeHandle} ${styles.resizeSW}`} onMouseDown={(e) => handleResizeStart(e, 'SW')} />
      
      {/* Visual resize indicator in corner */}
      <div className={styles.resizeCorner} />
    </div>
  )
}

