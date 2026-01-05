import { useEffect, useCallback, RefObject, useRef } from 'react'
import { useDocumentStore } from '../../stores/documentStore'
import { useViewportStore, screenToWorld } from '../../stores/viewportStore'
import { useSelectionStore } from '../../stores/selectionStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { containsPoint, createCircle } from '../../geometry/shapes/Circle'
import { 
  isOnDirectionRing, 
  isOnDeleteIcon,
  isOnEdgeZone,
  isInBodyZone,
  getIndexDotAt,
  getTangentHandleAt, 
  computeTangentHandleInfo, 
  type TangentHandleType 
} from './renderers/ShapeRenderer'
import { snapPointToGrid, snapToGrid, distance, angle } from '../../geometry/math'
import { expandMirroredCircles, findPathSegmentAt, calculateNonOverlappingRadius } from '../../geometry/path'
import type { Point, CircleShape, DragMode, HoverTarget } from '../../types'
import {
  HANDLE_TOLERANCE,
  DRAG_THRESHOLD,
  RADIUS_SNAP_INCREMENT,
  OFFSET_SNAP_THRESHOLD,
  OFFSET_SNAP_INCREMENT,
  LENGTH_SNAP_INCREMENT,
  LENGTH_SNAP_THRESHOLD,
  DEFAULT_TANGENT_LENGTH,
  MIN_TANGENT_LENGTH,
  MAX_TANGENT_LENGTH,
  CURSOR_ANGLE_INCREMENT,
  TANGENT_DISTANCE_FACTOR
} from '../../constants'

/**
 * Generate a "reverse" cursor SVG for the direction toggle
 * Two curved arrows forming a circular swap/reverse icon
 */
function getReverseCursor(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <!-- Outer stroke for visibility -->
    <path d="M9 3 L5 7 L9 11 M5 7 C5 7 5 12 12 12 M15 21 L19 17 L15 13 M19 17 C19 17 19 12 12 12" 
          fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Inner stroke -->
    <path d="M9 3 L5 7 L9 11 M5 7 C5 7 5 12 12 12 M15 21 L19 17 L15 13 M19 17 C19 17 19 12 12 12" 
          fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
  
  return `url('data:image/svg+xml,${encodeURIComponent(svg)}') 12 12, pointer`
}

// Cache the reverse cursor
const reverseCursor = getReverseCursor()

/**
 * Generate a rotated scale cursor SVG data URL
 * The cursor arrows point along the circle edge (tangent direction)
 */
function generateScaleCursor(angleRad: number): string {
  // Convert to degrees for SVG rotation, add 90° to make arrows tangent to the circle
  const angleDeg = (angleRad * 180 / Math.PI) + 90
  
  // SVG scale cursor - double-headed arrow
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <g transform="rotate(${angleDeg}, 12, 12)">
      <!-- Outer stroke for visibility -->
      <path d="M12 2 L16 7 L13.5 7 L13.5 17 L16 17 L12 22 L8 17 L10.5 17 L10.5 7 L8 7 Z" 
            fill="none" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
      <!-- Inner fill -->
      <path d="M12 2 L16 7 L13.5 7 L13.5 17 L16 17 L12 22 L8 17 L10.5 17 L10.5 7 L8 7 Z" 
            fill="black" stroke="none"/>
    </g>
  </svg>`
  
  return `url('data:image/svg+xml,${encodeURIComponent(svg)}') 12 12, nwse-resize`
}

// Cache for generated cursors to avoid regenerating on every frame
const cursorCache = new Map<number, string>()

/**
 * Get a cached rotated scale cursor for the given angle
 * Quantizes to degree increments for caching efficiency
 */
function getScaleCursor(angleRad: number): string {
  // Quantize to degree increments (based on constant)
  const quantizedDeg = Math.round((angleRad * 180 / Math.PI) / CURSOR_ANGLE_INCREMENT) * CURSOR_ANGLE_INCREMENT
  const normalizedDeg = ((quantizedDeg % 360) + 360) % 360
  
  if (!cursorCache.has(normalizedDeg)) {
    cursorCache.set(normalizedDeg, generateScaleCursor(normalizedDeg * Math.PI / 180))
  }
  
  return cursorCache.get(normalizedDeg)!
}

export function useCanvasInteraction(
  canvasRef: RefObject<HTMLCanvasElement>,
  containerRef: RefObject<HTMLDivElement>
) {
  const shapes = useDocumentStore(state => state.shapes)
  const shapeOrder = useDocumentStore(state => state.shapeOrder)
  const globalStretch = useDocumentStore(state => state.globalStretch)
  const updateShape = useDocumentStore(state => state.updateShape)
  const removeShape = useDocumentStore(state => state.removeShape)
  const reorderShapes = useDocumentStore(state => state.reorderShapes)
  const insertShapeAt = useDocumentStore(state => state.insertShapeAt)
  const toggleWrapSide = useDocumentStore(state => state.toggleWrapSide)
  const setEntryOffset = useDocumentStore(state => state.setEntryOffset)
  const setExitOffset = useDocumentStore(state => state.setExitOffset)
  const setEntryTangentLength = useDocumentStore(state => state.setEntryTangentLength)
  const setExitTangentLength = useDocumentStore(state => state.setExitTangentLength)
  
  const pan = useViewportStore(state => state.pan)
  const zoom = useViewportStore(state => state.zoom)
  const setPan = useViewportStore(state => state.setPan)
  const zoomBy = useViewportStore(state => state.zoomBy)
  
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const select = useSelectionStore(state => state.select)
  const clearSelection = useSelectionStore(state => state.clearSelection)
  const setHovered = useSelectionStore(state => state.setHovered)
  const setHoverTarget = useSelectionStore(state => state.setHoverTarget)
  const setDragState = useSelectionStore(state => state.setDragState)
  const dragState = useSelectionStore(state => state.dragState)
  
  const snapToGridEnabled = useSettingsStore(state => state.snapToGrid)
  const gridSize = useSettingsStore(state => state.gridSize)
  
  // Track space key state for panning
  const spaceKeyHeld = useRef(false)
  // Track active panning state
  const isPanningActive = useRef(false)
  // Track if right-click drag occurred (to suppress context menu)
  const rightClickDragged = useRef(false)
  
  // Track modifier keys - check for middle mouse or space+left click
  const isPanning = useCallback((e: MouseEvent | WheelEvent): boolean => {
    return e.button === 1 || (e.button === 0 && spaceKeyHeld.current)
  }, [])
  
  // Get mouse position in world coordinates
  const getWorldPos = useCallback((e: MouseEvent): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    
    const rect = canvas.getBoundingClientRect()
    const screenPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
    
    return screenToWorld(screenPos, pan, zoom)
  }, [canvasRef, pan, zoom])
  
  // Find what's at a position and return detailed hover info
  const findTargetAt = useCallback((worldPos: Point): { 
    shape: CircleShape | null
    hoverTarget: HoverTarget
    tangentHandle: TangentHandleType
  } => {
    const circles = shapes.filter((s): s is CircleShape => s.type === 'circle')
    const handleTolerance = HANDLE_TOLERANCE / zoom
    
    // Get expanded shapes/order (including mirrored circles)
    const { expandedShapes, expandedOrder } = expandMirroredCircles(circles, shapeOrder)
    
    // First check tangent handles on selected shapes (highest priority)
    for (const shape of shapes) {
      if (shape.type === 'circle' && selectedIds.includes(shape.id)) {
        const tangentHandle = getTangentHandleAt(shape, expandedShapes, expandedOrder, worldPos, handleTolerance)
        if (tangentHandle) {
          const hoverTarget: HoverTarget = { 
            type: tangentHandle as 'entry-offset' | 'exit-offset' | 'entry-length' | 'exit-length' | 'entry-offset-slot' | 'exit-offset-slot' | 'entry-length-slot' | 'exit-length-slot', 
            shapeId: shape.id 
          }
          return { shape, hoverTarget, tangentHandle }
        }
      }
    }
    
    // Check index dots and delete icon on all circles
    for (const shape of shapes) {
      if (shape.type === 'circle') {
        // Check index dot grid (always visible)
        const dotIndex = getIndexDotAt(shape, worldPos, shapeOrder.length, zoom)
        if (dotIndex !== null) {
          return { 
            shape, 
            hoverTarget: { type: 'index-dot', shapeId: shape.id, dotIndex }, 
            tangentHandle: null 
          }
        }
        
        // Check delete icon (only on selected shapes)
        if (selectedIds.includes(shape.id) && isOnDeleteIcon(shape, worldPos, zoom, true)) {
          return { 
            shape, 
            hoverTarget: { type: 'delete-icon', shapeId: shape.id }, 
            tangentHandle: null 
          }
        }
      }
    }
    
    // Helper to check a single shape
    // All hit zones are proportional to radius for consistent behavior at any size/zoom
    // Hit zones from outside to inside:
    // 1. Edge zone (92-108% radius) - for scaling
    // 2. Direction ring (70-92% radius) - for toggling direction
    // 3. Body zone (< 70% radius) - for moving
    const checkShape = (shape: CircleShape): { 
      shape: CircleShape
      hoverTarget: HoverTarget
      tangentHandle: TangentHandleType
    } | null => {
      // Check edge first (outermost zone - for scaling)
      if (isOnEdgeZone(shape, worldPos)) {
        return { 
          shape, 
          hoverTarget: { type: 'shape-edge', shapeId: shape.id }, 
          tangentHandle: null 
        }
      }
      // Check direction ring (middle zone - for toggling direction)
      if (isOnDirectionRing(shape, worldPos)) {
        return { 
          shape, 
          hoverTarget: { type: 'direction-ring', shapeId: shape.id }, 
          tangentHandle: null 
        }
      }
      // Check body zone (inner zone - for moving)
      if (isInBodyZone(shape, worldPos)) {
        return { 
          shape, 
          hoverTarget: { type: 'shape-body', shapeId: shape.id }, 
          tangentHandle: null 
        }
      }
      return null
    }
    
    // Check selected shapes first (they're rendered on top)
    for (let i = shapes.length - 1; i >= 0; i--) {
      const shape = shapes[i]
      if (shape.type === 'circle' && selectedIds.includes(shape.id)) {
        const hit = checkShape(shape)
        if (hit) return hit
      }
    }
    
    // Then check non-selected shapes
    for (let i = shapes.length - 1; i >= 0; i--) {
      const shape = shapes[i]
      if (shape.type === 'circle' && !selectedIds.includes(shape.id)) {
        const hit = checkShape(shape)
        if (hit) return hit
      }
    }
    
    return { shape: null, hoverTarget: null, tangentHandle: null }
  }, [shapes, shapeOrder, zoom, selectedIds])
  
  // Store the scale cursor angle for dynamic rotation
  const scaleCursorAngle = useRef<number>(0)
  
  // Get cursor based on hover target
  const getCursor = useCallback((hoverTarget: HoverTarget, isDragging: boolean): string => {
    if (isDragging) {
      const mode = dragState?.mode
      if (mode === 'move') return 'move'
      if (mode === 'scale') return getScaleCursor(scaleCursorAngle.current)
      if (mode?.startsWith('tangent-')) return 'crosshair'
      return 'grabbing'
    }
    
    if (!hoverTarget) return ''
    
    switch (hoverTarget.type) {
      case 'shape-body':
        return 'move'
      case 'shape-edge':
        return getScaleCursor(scaleCursorAngle.current)
      case 'direction-ring':
        return reverseCursor
      case 'delete-icon':
        return 'pointer'
      case 'index-dot':
        return 'pointer'
      case 'entry-offset':
      case 'exit-offset':
      case 'entry-length':
      case 'exit-length':
        return 'grab'
      case 'entry-offset-slot':
      case 'exit-offset-slot':
      case 'entry-length-slot':
      case 'exit-length-slot':
        return 'pointer'
      default:
        return ''
    }
  }, [dragState])
  
  // Double-click handler - create circle on path
  const handleDoubleClick = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    // Only handle left double-click
    if (e.button !== 0) return
    
    const worldPos = getWorldPos(e)
    
    // Check if we clicked on an existing shape first
    const hit = findTargetAt(worldPos)
    if (hit.shape) {
      // Double-clicked on a shape, don't create new circle
      return
    }
    
    // Check if click is on a path segment
    const circles = shapes.filter((s): s is CircleShape => s.type === 'circle')
    const pathHit = findPathSegmentAt(circles, shapeOrder, worldPos, 15 / zoom, globalStretch)
    
    if (pathHit) {
      // Calculate non-overlapping radius
      const radius = calculateNonOverlappingRadius(pathHit.point, circles)
      
      // Create new circle
      const circleCount = shapes.filter(s => s.type === 'circle').length
      const newCircle = createCircle(
        pathHit.point,
        radius,
        undefined,
        `Circle ${circleCount + 1}`
      )
      
      // Insert at the correct position in the path order
      const insertIndex = pathHit.fromCircleIndex + 1
      insertShapeAt(newCircle, insertIndex)
      
      // Select the new circle
      select(newCircle.id, false)
    }
  }, [canvasRef, getWorldPos, findTargetAt, shapes, shapeOrder, globalStretch, zoom, insertShapeAt, select])

  // Mouse down handler
  const handleMouseDown = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const worldPos = getWorldPos(e)
    
    // Middle mouse or space+click: start panning
    if (isPanning(e)) {
      e.preventDefault()
      const startPan = { ...pan }
      const startPos = { x: e.clientX, y: e.clientY }
      
      const handlePanMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startPos.x
        const dy = moveEvent.clientY - startPos.y
        setPan({
          x: startPan.x + dx,
          y: startPan.y + dy
        })
      }
      
      const handlePanEnd = () => {
        isPanningActive.current = false
        window.removeEventListener('mousemove', handlePanMove)
        window.removeEventListener('mouseup', handlePanEnd)
        canvas.style.cursor = ''
      }
      
      isPanningActive.current = true
      canvas.style.cursor = 'grabbing'
      window.addEventListener('mousemove', handlePanMove)
      window.addEventListener('mouseup', handlePanEnd)
      return
    }
    
    // Right click: reset handle if clicking on one, otherwise pan if dragged
    if (e.button === 2) {
      // First check if we're right-clicking on a tangent handle
      const hit = findTargetAt(worldPos)
      if (hit.tangentHandle && hit.shape) {
        e.preventDefault()
        rightClickDragged.current = true // Suppress context menu
        
        // Reset the appropriate value based on handle type
        switch (hit.tangentHandle) {
          case 'entry-offset':
            setEntryOffset(hit.shape.id, 0)
            break
          case 'exit-offset':
            setExitOffset(hit.shape.id, 0)
            break
          case 'entry-length':
            setEntryTangentLength(hit.shape.id, 1.0)
            break
          case 'exit-length':
            setExitTangentLength(hit.shape.id, 1.0)
            break
        }
        
        setTimeout(() => {
          rightClickDragged.current = false
        }, 0)
        return
      }
      
      // No handle hit - proceed with pan behavior
      const startPan = { ...pan }
      const startPos = { x: e.clientX, y: e.clientY }
      const dragThreshold = DRAG_THRESHOLD
      let hasDragged = false
      
      const handleRightDragMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startPos.x
        const dy = moveEvent.clientY - startPos.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        
        if (!hasDragged && dist > dragThreshold) {
          hasDragged = true
          rightClickDragged.current = true
          isPanningActive.current = true
          canvas.style.cursor = 'grabbing'
        }
        
        if (hasDragged) {
          setPan({
            x: startPan.x + dx,
            y: startPan.y + dy
          })
        }
      }
      
      const handleRightDragEnd = () => {
        isPanningActive.current = false
        window.removeEventListener('mousemove', handleRightDragMove)
        window.removeEventListener('mouseup', handleRightDragEnd)
        canvas.style.cursor = ''
        
        setTimeout(() => {
          rightClickDragged.current = false
        }, 0)
      }
      
      window.addEventListener('mousemove', handleRightDragMove)
      window.addEventListener('mouseup', handleRightDragEnd)
      return
    }
    
    // Left click: select/drag shapes
    if (e.button === 0) {
      const hit = findTargetAt(worldPos)
      
      if (hit.shape) {
        const { shape, hoverTarget, tangentHandle } = hit
        
        // Click on delete icon: delete the shape
        if (hoverTarget?.type === 'delete-icon') {
          removeShape(shape.id)
          clearSelection()
          return
        }
        
        // Click on index dot: swap indices with target circle
        if (hoverTarget?.type === 'index-dot') {
          const currentIndex = shapeOrder.indexOf(shape.id)
          const targetIndex = hoverTarget.dotIndex
          
          // Only swap if clicking a different position
          if (currentIndex !== targetIndex && targetIndex >= 0 && targetIndex < shapeOrder.length) {
            const newOrder = [...shapeOrder]
            // Swap the two shapes
            ;[newOrder[currentIndex], newOrder[targetIndex]] = 
              [newOrder[targetIndex], newOrder[currentIndex]]
            reorderShapes(newOrder)
          }
          return
        }
        
        // Click on direction ring: toggle wrap side
        if (hoverTarget?.type === 'direction-ring') {
          toggleWrapSide(shape.id)
          return
        }
        
        // Click on tangent handle: start tangent dragging
        if (tangentHandle) {
          const circles = shapes.filter((s): s is CircleShape => s.type === 'circle')
          const { expandedShapes, expandedOrder } = expandMirroredCircles(circles, shapeOrder)
          const info = computeTangentHandleInfo(shape, expandedShapes, expandedOrder)
          
          let mode: DragMode = null
          let startAngle = 0
          let startOffset = 0
          let startTangentLength = DEFAULT_TANGENT_LENGTH
          
          if (tangentHandle === 'entry-offset') {
            mode = 'tangent-entry-offset'
            startAngle = info?.entryAngle ?? 0
            startOffset = shape.entryOffset ?? 0
          } else if (tangentHandle === 'exit-offset') {
            mode = 'tangent-exit-offset'
            startAngle = info?.exitAngle ?? 0
            startOffset = shape.exitOffset ?? 0
          } else if (tangentHandle === 'entry-length') {
            mode = 'tangent-entry-length'
            startTangentLength = shape.entryTangentLength ?? 1.0
          } else if (tangentHandle === 'exit-length') {
            mode = 'tangent-exit-length'
            startTangentLength = shape.exitTangentLength ?? 1.0
          } else if (tangentHandle === 'entry-offset-slot') {
            // Click on slot resets to default
            setEntryOffset(shape.id, undefined)
            return
          } else if (tangentHandle === 'exit-offset-slot') {
            setExitOffset(shape.id, undefined)
            return
          } else if (tangentHandle === 'entry-length-slot') {
            setEntryTangentLength(shape.id, undefined)
            return
          } else if (tangentHandle === 'exit-length-slot') {
            setExitTangentLength(shape.id, undefined)
            return
          }
          
          if (mode) {
            setDragState({
              mode,
              shapeId: shape.id,
              startPoint: worldPos,
              startCenter: { ...shape.center },
              startRadius: shape.radius,
              startAngle,
              startOffset,
              startTangentLength
            })
            canvas.style.cursor = 'grabbing'
          }
          return
        }
        
        // Select the shape
        select(shape.id, e.shiftKey)
        
        // Start dragging based on hit type
        const isEdge = hoverTarget?.type === 'shape-edge'
        const mode = isEdge ? 'scale' : 'move'
        
        // Update scale cursor angle for edge dragging
        if (isEdge) {
          scaleCursorAngle.current = angle(shape.center, worldPos)
        }
        
        setDragState({
          mode,
          shapeId: shape.id,
          startPoint: worldPos,
          startCenter: { ...shape.center },
          startRadius: shape.radius
        })
        
        canvas.style.cursor = mode === 'scale' ? getScaleCursor(scaleCursorAngle.current) : 'move'
      } else {
        // Clicked on empty space
        if (!e.shiftKey) {
          clearSelection()
        }
      }
    }
  }, [canvasRef, getWorldPos, isPanning, pan, setPan, findTargetAt, select, clearSelection, setDragState, toggleWrapSide, removeShape, shapes, shapeOrder])
  
  // Mouse move handler
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    // Skip if we're actively panning (handled by separate listeners)
    if (isPanningActive.current) return
    
    const worldPos = getWorldPos(e)
    
    // Handle dragging
    if (dragState) {
      const shape = shapes.find(s => s.id === dragState.shapeId)
      if (!shape || shape.type !== 'circle') return
      
      if (dragState.mode === 'move') {
        let newCenter = {
          x: dragState.startCenter.x + (worldPos.x - dragState.startPoint.x),
          y: dragState.startCenter.y + (worldPos.y - dragState.startPoint.y)
        }
        
        if (snapToGridEnabled || e.shiftKey) {
          newCenter = snapPointToGrid(newCenter, gridSize)
        }
        
        updateShape(dragState.shapeId, { center: newCenter })
      } else if (dragState.mode === 'scale') {
        const distFromCenter = distance(worldPos, dragState.startCenter)
        let newRadius = Math.max(5, distFromCenter)
        
        if (snapToGridEnabled || e.shiftKey) {
          newRadius = snapToGrid(newRadius, RADIUS_SNAP_INCREMENT)
          newRadius = Math.max(RADIUS_SNAP_INCREMENT, newRadius)
        }
        
        updateShape(dragState.shapeId, { radius: newRadius })
      } else if (dragState.mode === 'tangent-entry-offset' || dragState.mode === 'tangent-exit-offset') {
        const angleToMouse = angle(shape.center, worldPos)
        const clockwise = (shape.wrapSide ?? 'right') === 'right'
        const offsetDir = clockwise ? 1 : -1
        
        const baseAngle = dragState.startAngle ?? 0
        let newOffset = (angleToMouse - baseAngle) / offsetDir
        
        while (newOffset > Math.PI) newOffset -= Math.PI * 2
        while (newOffset < -Math.PI) newOffset += Math.PI * 2
        
        newOffset = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, newOffset))
        
        // Snap to angular increments when snapping is enabled or shift is held
        if (snapToGridEnabled || e.shiftKey) {
          newOffset = Math.round(newOffset / OFFSET_SNAP_INCREMENT) * OFFSET_SNAP_INCREMENT
        }
        
        // Snap to zero when very close
        if (Math.abs(newOffset) < OFFSET_SNAP_THRESHOLD) newOffset = 0
        
        if (dragState.mode === 'tangent-entry-offset') {
          setEntryOffset(shape.id, newOffset === 0 ? undefined : newOffset)
        } else {
          setExitOffset(shape.id, newOffset === 0 ? undefined : newOffset)
        }
      } else if (dragState.mode === 'tangent-entry-length' || dragState.mode === 'tangent-exit-length') {
        const circles = shapes.filter((s): s is CircleShape => s.type === 'circle')
        const { expandedShapes, expandedOrder } = expandMirroredCircles(circles, shapeOrder)
        const info = computeTangentHandleInfo(shape, expandedShapes, expandedOrder)
        
        if (info) {
          const isEntry = dragState.mode === 'tangent-entry-length'
          const tangentPoint = isEntry ? info.entryPoint : info.exitPoint
          const tangentDir = isEntry ? info.entryTangentDir : info.exitTangentDir
          
          const orderIndex = expandedOrder.indexOf(shape.id)
          const n = expandedOrder.length
          const prevIndex = (orderIndex - 1 + n) % n
          const nextIndex = (orderIndex + 1) % n
          const prevCircle = expandedShapes.find(c => c.id === expandedOrder[prevIndex])
          const nextCircle = expandedShapes.find(c => c.id === expandedOrder[nextIndex])
          
          const baseDist = isEntry 
            ? (prevCircle ? distance(prevCircle.center, shape.center) * TANGENT_DISTANCE_FACTOR : 50)
            : (nextCircle ? distance(shape.center, nextCircle.center) * TANGENT_DISTANCE_FACTOR : 50)
          
          const toMouse = {
            x: worldPos.x - tangentPoint.x,
            y: worldPos.y - tangentPoint.y
          }
          
          const projectedDist = isEntry
            ? -(toMouse.x * tangentDir.x + toMouse.y * tangentDir.y)
            : (toMouse.x * tangentDir.x + toMouse.y * tangentDir.y)
          
          let newLength = projectedDist / baseDist
          newLength = Math.max(MIN_TANGENT_LENGTH, Math.min(MAX_TANGENT_LENGTH, newLength))
          
          // Snap to percentage increments when snapping is enabled or shift is held
          if (snapToGridEnabled || e.shiftKey) {
            newLength = Math.round(newLength / LENGTH_SNAP_INCREMENT) * LENGTH_SNAP_INCREMENT
          }
          
          // Snap to default (1.0) when very close
          if (Math.abs(newLength - DEFAULT_TANGENT_LENGTH) < LENGTH_SNAP_THRESHOLD) newLength = DEFAULT_TANGENT_LENGTH
          
          if (isEntry) {
            setEntryTangentLength(shape.id, newLength === DEFAULT_TANGENT_LENGTH ? undefined : newLength)
          } else {
            setExitTangentLength(shape.id, newLength === DEFAULT_TANGENT_LENGTH ? undefined : newLength)
          }
        }
      }
      return
    }
    
    // Keep grab cursor if space is held for panning
    if (spaceKeyHeld.current) {
      canvas.style.cursor = 'grab'
      setHoverTarget(null)
      setHovered(null)
      return
    }
    
    // Update hover state and cursor
    const hit = findTargetAt(worldPos)
    
    // Calculate scale cursor angle if hovering over edge
    if (hit.hoverTarget?.type === 'shape-edge' && hit.shape) {
      scaleCursorAngle.current = angle(hit.shape.center, worldPos)
    }
    
    setHoverTarget(hit.hoverTarget)
    setHovered(hit.shape?.id ?? null)
    canvas.style.cursor = getCursor(hit.hoverTarget, false)
  }, [canvasRef, getWorldPos, dragState, shapes, shapeOrder, updateShape, snapToGridEnabled, gridSize, findTargetAt, getCursor, setHovered, setHoverTarget, setEntryOffset, setExitOffset, setEntryTangentLength, setExitTangentLength])
  
  // Mouse up handler
  const handleMouseUp = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    if (dragState) {
      setDragState(null)
      canvas.style.cursor = ''
    }
  }, [canvasRef, dragState, setDragState])
  
  // Wheel handler (zoom)
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const center = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
    
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    zoomBy(factor, center)
  }, [canvasRef, zoomBy])
  
  // Attach event listeners
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('dblclick', handleDoubleClick)
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    
    const handleContextMenu = (e: MouseEvent) => {
      if (rightClickDragged.current) {
        e.preventDefault()
      }
    }
    canvas.addEventListener('contextmenu', handleContextMenu)
    
    const handleGlobalMouseUp = () => {
      if (dragState) {
        setDragState(null)
      }
    }
    window.addEventListener('mouseup', handleGlobalMouseUp)
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }
      
      if (e.code === 'Space' && !e.repeat) {
        spaceKeyHeld.current = true
        if (canvas) {
          canvas.style.cursor = 'grab'
        }
        e.preventDefault()
      }
    }
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceKeyHeld.current = false
        if (canvas && !dragState) {
          canvas.style.cursor = ''
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('dblclick', handleDoubleClick)
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('contextmenu', handleContextMenu)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [canvasRef, handleMouseDown, handleMouseMove, handleMouseUp, handleDoubleClick, handleWheel, dragState, setDragState])
}
