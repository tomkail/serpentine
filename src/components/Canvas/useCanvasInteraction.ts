import { useEffect, useCallback, RefObject, useRef, useMemo } from 'react'
import { useDocumentStore } from '../../stores/documentStore'
import { useViewportStore, screenToWorld } from '../../stores/viewportStore'
import { useSelectionStore } from '../../stores/selectionStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { undo, redo } from '../../stores/historyStore'
import { createCircle } from '../../geometry/shapes/Circle'
import { 
  isOnDirectionRing, 
  isOnDeleteIcon,
  isOnMirrorIcon,
  isOnEdgeZone,
  isInBodyZone,
  getIndexDotAt,
  getTangentHandleAt, 
  computeTangentHandleInfo, 
  type TangentHandleType 
} from './renderers/ShapeRenderer'
import { snapPointToGrid, snapToGrid, distance, angle, normalize, subtract } from '../../geometry/math'
import { expandMirroredCircles, findPathSegmentAt, findClosestPointOnPath, calculateNonOverlappingRadius } from '../../geometry/path'
import { calculateConstraintAxes, constrainToNearestAxis } from '../../geometry/axisConstraint'
import type { Point, CircleShape, DragMode, HoverTarget, MarqueeMode, Rect } from '../../types'
import {
  HANDLE_TOLERANCE,
  PATH_HIT_TOLERANCE,
  DRAG_THRESHOLD,
  POSITION_SNAP_INCREMENT,
  RADIUS_SNAP_INCREMENT,
  OFFSET_SNAP_THRESHOLD,
  OFFSET_SNAP_INCREMENT,
  LENGTH_SNAP_INCREMENT,
  LENGTH_SNAP_THRESHOLD,
  DEFAULT_TANGENT_LENGTH,
  MIN_TANGENT_LENGTH,
  MAX_TANGENT_LENGTH,
  TANGENT_DISTANCE_FACTOR,
  SMART_GUIDE_SNAP_THRESHOLD
} from '../../constants'
import { computeSmartGuides } from '../../geometry/smartGuides'
import { getScaleCursor, getCursorForTarget, getMarqueeCursor } from './cursorUtils'

/**
 * Touch state for gesture tracking
 */
interface TouchState {
  // Single touch tracking
  activeTouchId: number | null
  touchStartTime: number
  touchStartPos: { x: number; y: number } | null
  // Double-tap detection
  lastTapTime: number
  lastTapPos: { x: number; y: number } | null
  // Multi-touch tracking for pinch/pan
  touches: Map<number, { x: number; y: number }>
  initialPinchDistance: number | null
  initialPinchCenter: { x: number; y: number } | null
  initialZoom: number
  initialPan: { x: number; y: number }
  isPinching: boolean
  // Single-finger pan (when touching empty space)
  isPanningWithSingleFinger: boolean
  panStartPos: { x: number; y: number } | null
  panStartPan: { x: number; y: number } | null
  // Multi-finger tap detection (for undo/redo)
  multiTouchStartTime: number
  multiTouchStartPositions: Map<number, { x: number; y: number }>
  maxTouchCount: number // Track max fingers during gesture
}

const DOUBLE_TAP_THRESHOLD = 300 // ms
const DOUBLE_TAP_DISTANCE = 30 // pixels
const MULTI_TAP_THRESHOLD = 250 // ms - max duration for a multi-finger tap
const MULTI_TAP_MOVE_THRESHOLD = 20 // pixels - max movement allowed for tap

/**
 * Calculate distance between two touch points
 */
function getTouchDistance(t1: { x: number; y: number }, t2: { x: number; y: number }): number {
  const dx = t2.x - t1.x
  const dy = t2.y - t1.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate center point between two touch points
 */
function getTouchCenter(t1: { x: number; y: number }, t2: { x: number; y: number }): { x: number; y: number } {
  return {
    x: (t1.x + t2.x) / 2,
    y: (t1.y + t2.y) / 2
  }
}

/**
 * Check if a circle intersects with a rectangle
 * Uses circle-AABB intersection test
 */
function circleIntersectsRect(circle: CircleShape, rect: Rect): boolean {
  // Find closest point on rectangle to circle center
  const closestX = Math.max(rect.x, Math.min(circle.center.x, rect.x + rect.width))
  const closestY = Math.max(rect.y, Math.min(circle.center.y, rect.y + rect.height))
  
  // Calculate distance from closest point to circle center
  const dx = circle.center.x - closestX
  const dy = circle.center.y - closestY
  const distSquared = dx * dx + dy * dy
  
  // Circle intersects if closest point is within radius
  return distSquared <= circle.radius * circle.radius
}

/**
 * Get marquee mode based on modifier keys
 * - No modifiers: replace selection
 * - Shift: add to selection
 * - Alt/Option: subtract from selection
 */
function getMarqueeMode(e: MouseEvent | KeyboardEvent): MarqueeMode {
  if (e.altKey) return 'subtract'
  if (e.shiftKey) return 'add'
  return 'replace'
}

/**
 * Calculate the exact opposite point on the circle from the cursor
 */
function findExactOppositePoint(circle: CircleShape, cursor: Point): Point {
  const { center, radius } = circle
  const dir = normalize(subtract(cursor, center))
  // Return the point on the opposite side
  return {
    x: center.x - dir.x * radius,
    y: center.y - dir.y * radius
  }
}

/**
 * Find the closest circle to a given point
 */
function findClosestCircle(circles: CircleShape[], point: Point): CircleShape | null {
  if (circles.length === 0) return null
  
  let closestCircle: CircleShape | null = null
  let minDist = Infinity
  
  for (const circle of circles) {
    const dist = distance(point, circle.center)
    if (dist < minDist) {
      minDist = dist
      closestCircle = circle
    }
  }
  
  return closestCircle
}

export function useCanvasInteraction(
  canvasRef: RefObject<HTMLCanvasElement>,
  _containerRef: RefObject<HTMLDivElement>
) {
  const shapes = useDocumentStore(state => state.shapes)
  const shapeOrder = useDocumentStore(state => state.shapeOrder)
  const globalStretch = useDocumentStore(state => state.globalStretch)
  const closedPath = useDocumentStore(state => state.closedPath)
  const useStartPoint = useDocumentStore(state => state.useStartPoint)
  const useEndPoint = useDocumentStore(state => state.useEndPoint)
  const mirrorConfig = useDocumentStore(state => state.mirrorConfig)
  const updateShape = useDocumentStore(state => state.updateShape)
  const updateShapes = useDocumentStore(state => state.updateShapes)
  const removeShape = useDocumentStore(state => state.removeShape)
  const reorderShapes = useDocumentStore(state => state.reorderShapes)
  const insertShapeAt = useDocumentStore(state => state.insertShapeAt)
  const toggleDirection = useDocumentStore(state => state.toggleDirection)
  const toggleMirror = useDocumentStore(state => state.toggleMirror)
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
  const selectAll = useSelectionStore(state => state.selectAll)
  const clearSelection = useSelectionStore(state => state.clearSelection)
  const setHovered = useSelectionStore(state => state.setHovered)
  const setHoverTarget = useSelectionStore(state => state.setHoverTarget)
  const setDragState = useSelectionStore(state => state.setDragState)
  const dragState = useSelectionStore(state => state.dragState)
  const showClickPreview = useSelectionStore(state => state.showClickPreview)
  const clearClickPreview = useSelectionStore(state => state.clearClickPreview)
  const setActiveGuides = useSelectionStore(state => state.setActiveGuides)
  const clearActiveGuides = useSelectionStore(state => state.clearActiveGuides)
  const setMouseWorldPos = useSelectionStore(state => state.setMouseWorldPos)
  const modifierKeys = useSelectionStore(state => state.modifierKeys)
  const setModifierKeys = useSelectionStore(state => state.setModifierKeys)
  
  const snapToGridEnabled = useSettingsStore(state => state.snapToGrid)
  const smartGuidesEnabled = useSettingsStore(state => state.smartGuides)
  
  // Memoize circles array to avoid repeated filtering
  const circles = useMemo(
    () => shapes.filter((s): s is CircleShape => s.type === 'circle'),
    [shapes]
  )
  
  // Memoize constraint axes based on mirror configuration
  const constraintAxes = useMemo(
    () => calculateConstraintAxes(mirrorConfig),
    [mirrorConfig]
  )
  
  // Track space key state for panning
  const spaceKeyHeld = useRef(false)
  // Track active panning state
  const isPanningActive = useRef(false)
  // Track if right-click drag occurred (to suppress context menu)
  const rightClickDragged = useRef(false)
  // Track last two mousedown buttons for double-click validation
  const prevMouseDownButton = useRef<number | null>(null)
  const lastMouseDownButton = useRef<number | null>(null)
  
  // Touch state for gesture handling
  const touchState = useRef<TouchState>({
    activeTouchId: null,
    touchStartTime: 0,
    touchStartPos: null,
    lastTapTime: 0,
    lastTapPos: null,
    touches: new Map(),
    initialPinchDistance: null,
    initialPinchCenter: null,
    initialZoom: 1,
    initialPan: { x: 0, y: 0 },
    isPinching: false,
    isPanningWithSingleFinger: false,
    panStartPos: null,
    panStartPan: null,
    multiTouchStartTime: 0,
    multiTouchStartPositions: new Map(),
    maxTouchCount: 0
  })
  
  // Track modifier keys - check for middle mouse or space+left click
  const isPanning = useCallback((e: MouseEvent | WheelEvent): boolean => {
    return e.button === 1 || (e.button === 0 && spaceKeyHeld.current)
  }, [])
  
  // Get position in world coordinates from screen position
  const getWorldPosFromScreen = useCallback((screenX: number, screenY: number): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    
    const rect = canvas.getBoundingClientRect()
    const screenPos = {
      x: screenX - rect.left,
      y: screenY - rect.top
    }
    
    return screenToWorld(screenPos, pan, zoom)
  }, [canvasRef, pan, zoom])
  
  // Get mouse position in world coordinates
  const getWorldPos = useCallback((e: MouseEvent): Point => {
    return getWorldPosFromScreen(e.clientX, e.clientY)
  }, [getWorldPosFromScreen])
  
  // Find what's at a position and return detailed hover info
  const findTargetAt = useCallback((worldPos: Point): { 
    shape: CircleShape | null
    hoverTarget: HoverTarget
    tangentHandle: TangentHandleType
  } => {
    const handleTolerance = HANDLE_TOLERANCE / zoom
    
    // Get expanded shapes/order (including mirrored circles)
    const { expandedShapes, expandedOrder } = expandMirroredCircles(circles, shapeOrder, mirrorConfig)
    
    // First check tangent handles on selected shapes (highest priority)
    for (const shape of shapes) {
      if (shape.type === 'circle' && selectedIds.includes(shape.id)) {
        const tangentHandle = getTangentHandleAt(shape, expandedShapes, expandedOrder, worldPos, handleTolerance, closedPath, useStartPoint, useEndPoint)
        if (tangentHandle) {
          const hoverTarget: HoverTarget = { 
            type: tangentHandle as 'entry-offset' | 'exit-offset' | 'entry-length' | 'exit-length' | 'entry-offset-slot' | 'exit-offset-slot' | 'entry-length-slot' | 'exit-length-slot', 
            shapeId: shape.id 
          }
          return { shape, hoverTarget, tangentHandle }
        }
      }
    }
    
    // Check index dots and action row icons on all circles
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
        
        // Check action row icons (only on selected shapes)
        if (selectedIds.includes(shape.id)) {
          // Check mirror icon (always available)
          if (isOnMirrorIcon(shape, worldPos, zoom)) {
            return { 
              shape, 
              hoverTarget: { type: 'mirror-icon', shapeId: shape.id }, 
              tangentHandle: null 
            }
          }
          
          // Check delete icon (only if more than 2 circles exist)
          const circleCount = shapes.filter(s => s.type === 'circle').length
          if (circleCount > 2 && isOnDeleteIcon(shape, worldPos, zoom, true)) {
            return { 
              shape, 
              hoverTarget: { type: 'delete-icon', shapeId: shape.id }, 
              tangentHandle: null 
            }
          }
        }
      }
    }
    
    // Helper to check a single shape
    // All hit zones are proportional to radius for consistent behavior at any size/zoom
    // Hit zones from outside to inside:
    // 1. Edge zone (92-108% radius) - for scaling
    // 2. Direction ring (70-92% radius) - for toggling direction
    // 3. Body zone (< 70% radius, or up to 92% when direction ring is faded) - for moving
    const checkShape = (shape: CircleShape): { 
      shape: CircleShape
      hoverTarget: HoverTarget
      tangentHandle: TangentHandleType
    } | null => {
      // Check edge first (outermost zone - for scaling)
      // Edge zone is disabled when circle is too small on screen
      if (isOnEdgeZone(shape, worldPos, zoom)) {
        return { 
          shape, 
          hoverTarget: { type: 'shape-edge', shapeId: shape.id }, 
          tangentHandle: null 
        }
      }
      // Check direction ring (middle zone - for toggling direction)
      // Direction ring is not interactable when zoomed out too far
      if (isOnDirectionRing(shape, worldPos, zoom)) {
        return { 
          shape, 
          hoverTarget: { type: 'direction-ring', shapeId: shape.id }, 
          tangentHandle: null 
        }
      }
      // Check body zone (inner zone - for moving)
      // When direction ring is faded out, body zone expands to include direction ring area
      if (isInBodyZone(shape, worldPos, zoom)) {
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
  }, [shapes, circles, shapeOrder, zoom, selectedIds, closedPath, useStartPoint, useEndPoint])
  
  // Store the scale cursor angle for dynamic rotation
  const scaleCursorAngle = useRef<number>(0)
  
  // Get cursor based on hover target
  const getCursor = useCallback((hoverTarget: HoverTarget, isDragging: boolean): string => {
    return getCursorForTarget(hoverTarget, isDragging, dragState?.mode ?? null, scaleCursorAngle.current)
  }, [dragState])
  
  // Double-click handler - create circle on path
  const handleDoubleClick = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    // Only handle left double-click (both clicks must be left button)
    // Check that both the previous and current mousedown were left clicks
    if (e.button !== 0 || lastMouseDownButton.current !== 0 || prevMouseDownButton.current !== 0) return
    
    // Clear the preview since we're creating the actual circle
    clearClickPreview()
    
    const worldPos = getWorldPos(e)
    
    // Check if we clicked on an existing shape first
    const hit = findTargetAt(worldPos)
    if (hit.shape) {
      // Double-clicked on a shape, don't create new circle
      return
    }
    
    // Check if click is on a path segment (connector lines/beziers)
    const pathHit = findPathSegmentAt(circles, shapeOrder, worldPos, PATH_HIT_TOLERANCE / zoom, globalStretch, closedPath, useStartPoint, useEndPoint, mirrorConfig)
    
    if (pathHit) {
      // Calculate non-overlapping radius (reuse the existing circles array from scope)
      const radius = calculateNonOverlappingRadius(pathHit.point, circles)
      
      // Find closest circle to inherit mirror setting from
      const closestCircle = findClosestCircle(circles, pathHit.point)
      
      // Create new circle
      const circleCount = shapes.filter(s => s.type === 'circle').length
      const newCircle: CircleShape = {
        ...createCircle(
          pathHit.point,
          radius,
          undefined,
          `Circle ${circleCount + 1}`
        ),
        // New circles have mirroring enabled by default
        mirrored: closestCircle?.mirrored ?? true
      }
      
      // Insert at the correct position in the path order
      const insertIndex = pathHit.fromCircleIndex + 1
      insertShapeAt(newCircle, insertIndex)
      
      // Select the new circle
      select(newCircle.id, false)
      return
    }
    
    // Double-click on empty space - create circle at click position
    // Use findClosestPointOnPath to determine where to insert in the path order
    const closestPathHit = findClosestPointOnPath(circles, shapeOrder, worldPos, globalStretch, closedPath, useStartPoint, useEndPoint, mirrorConfig)
    
    // Calculate non-overlapping radius at the click position
    const radius = calculateNonOverlappingRadius(worldPos, circles)
    
    // Find closest circle to inherit mirror setting from
    const closestCircle = findClosestCircle(circles, worldPos)
    
    // Create new circle at the click position (not the nearest path point)
    const circleCount = shapes.filter(s => s.type === 'circle').length
    const newCircle: CircleShape = {
      ...createCircle(
        worldPos,
        radius,
        undefined,
        `Circle ${circleCount + 1}`
      ),
      // New circles have mirroring enabled by default
      mirrored: closestCircle?.mirrored ?? true
    }
    
    // Insert at the appropriate position in the path order
    const insertIndex = closestPathHit ? closestPathHit.fromCircleIndex + 1 : shapeOrder.length
    insertShapeAt(newCircle, insertIndex)
    
    // Select the new circle
    select(newCircle.id, false)
  }, [canvasRef, getWorldPos, findTargetAt, shapes, circles, shapeOrder, globalStretch, closedPath, useStartPoint, useEndPoint, zoom, insertShapeAt, select, clearClickPreview])

  // Mouse down handler
  const handleMouseDown = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    // Track button for double-click validation (keep history of last two clicks)
    prevMouseDownButton.current = lastMouseDownButton.current
    lastMouseDownButton.current = e.button
    
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
        // Shift or Alt key: reset both entry and exit together (same behavior for reset)
        const isOffset = hit.tangentHandle === 'entry-offset' || hit.tangentHandle === 'exit-offset'
        const isLength = hit.tangentHandle === 'entry-length' || hit.tangentHandle === 'exit-length'
        
        if (e.shiftKey || e.altKey) {
          // Reset both entry and exit
          if (isOffset) {
            setEntryOffset(hit.shape.id, 0)
            setExitOffset(hit.shape.id, 0)
          } else if (isLength) {
            setEntryTangentLength(hit.shape.id, 1.0)
            setExitTangentLength(hit.shape.id, 1.0)
          }
        } else {
          // Reset only the clicked handle
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
        
        // Click on delete icon: delete the shape (or all selected if Shift held)
        if (hoverTarget?.type === 'delete-icon') {
          if (e.shiftKey && selectedIds.length > 1) {
            // Delete all selected shapes
            for (const id of selectedIds) {
              removeShape(id)
            }
          } else {
            removeShape(shape.id)
          }
          clearSelection()
          return
        }
        
        // Click on mirror icon: toggle mirroring (or all selected if Shift held)
        if (hoverTarget?.type === 'mirror-icon') {
          if (e.shiftKey && selectedIds.length > 1) {
            // Toggle mirror on all selected shapes
            for (const id of selectedIds) {
              toggleMirror(id)
            }
          } else {
            toggleMirror(shape.id)
          }
          return
        }
        
        // Click on index dot: insert at target position (shifting others)
        if (hoverTarget?.type === 'index-dot') {
          const currentIndex = shapeOrder.indexOf(shape.id)
          const targetIndex = hoverTarget.dotIndex
          
          // Only move if clicking a different position
          if (currentIndex !== targetIndex && targetIndex >= 0 && targetIndex < shapeOrder.length) {
            const newOrder = [...shapeOrder]
            // Remove from current position and insert at target
            newOrder.splice(currentIndex, 1)
            newOrder.splice(targetIndex, 0, shape.id)
            reorderShapes(newOrder)
          }
          return
        }
        
        // Click on direction ring: toggle direction (or all selected if Shift held)
        if (hoverTarget?.type === 'direction-ring') {
          if (e.shiftKey && selectedIds.length > 1) {
            // Toggle direction on all selected shapes
            for (const id of selectedIds) {
              toggleDirection(id)
            }
          } else {
            toggleDirection(shape.id)
          }
          return
        }
        
        // Click on tangent handle: start tangent dragging
        if (tangentHandle) {
          const { expandedShapes, expandedOrder } = expandMirroredCircles(circles, shapeOrder, mirrorConfig)
          const info = computeTangentHandleInfo(shape, expandedShapes, expandedOrder, closedPath, useStartPoint, useEndPoint)
          
          let mode: DragMode = null
          let startAngle = 0
          let startOffset = 0
          let startOtherOffset = 0
          let startTangentLength = DEFAULT_TANGENT_LENGTH
          let startOtherTangentLength = DEFAULT_TANGENT_LENGTH
          
          if (tangentHandle === 'entry-offset') {
            mode = 'tangent-entry-offset'
            startAngle = info?.entryAngle ?? 0
            startOffset = shape.entryOffset ?? 0
            startOtherOffset = shape.exitOffset ?? 0
          } else if (tangentHandle === 'exit-offset') {
            mode = 'tangent-exit-offset'
            startAngle = info?.exitAngle ?? 0
            startOffset = shape.exitOffset ?? 0
            startOtherOffset = shape.entryOffset ?? 0
          } else if (tangentHandle === 'entry-length') {
            mode = 'tangent-entry-length'
            startTangentLength = shape.entryTangentLength ?? 1.0
            startOtherTangentLength = shape.exitTangentLength ?? 1.0
          } else if (tangentHandle === 'exit-length') {
            mode = 'tangent-exit-length'
            startTangentLength = shape.exitTangentLength ?? 1.0
            startOtherTangentLength = shape.entryTangentLength ?? 1.0
          } else if (tangentHandle === 'entry-offset-slot') {
            // Click on slot resets to default (shift or alt: reset both)
            setEntryOffset(shape.id, undefined)
            if (e.shiftKey || e.altKey) setExitOffset(shape.id, undefined)
            return
          } else if (tangentHandle === 'exit-offset-slot') {
            setExitOffset(shape.id, undefined)
            if (e.shiftKey || e.altKey) setEntryOffset(shape.id, undefined)
            return
          } else if (tangentHandle === 'entry-length-slot') {
            setEntryTangentLength(shape.id, undefined)
            if (e.shiftKey || e.altKey) setExitTangentLength(shape.id, undefined)
            return
          } else if (tangentHandle === 'exit-length-slot') {
            setExitTangentLength(shape.id, undefined)
            if (e.shiftKey || e.altKey) setEntryTangentLength(shape.id, undefined)
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
              startOtherOffset,
              startTangentLength,
              startOtherTangentLength
            })
            canvas.style.cursor = 'grabbing'
          }
          return
        }
        
        const isEdge = hoverTarget?.type === 'shape-edge'
        const mode = isEdge ? 'scale' : 'move'
        const isAlreadySelected = selectedIds.includes(shape.id)
        
        // Shift-click on body: toggle selection without starting drag
        // (But allow Shift+drag on edge for multi-select scaling)
        if (e.shiftKey && !isEdge) {
          select(shape.id, true) // additive/toggle mode
          return
        }
        
        // Update scale cursor angle for edge dragging
        if (isEdge) {
          scaleCursorAngle.current = angle(shape.center, worldPos)
        }
        
        // Determine scale anchor point for non-center scaling
        // Alt key enables alternative scaling mode:
        //   - With snapping on: anchor = cardinal snap point on opposite side (top/bottom/left/right)
        //   - With snapping off: anchor = exact opposite point from cursor
        // Without Alt: always center-based scaling (scaleAnchor = undefined)
        let scaleAnchor: Point | undefined
        if (isEdge && e.altKey) {
          // Alt: anchor = exact opposite point from cursor
          scaleAnchor = findExactOppositePoint(shape, worldPos)
          // Snap anchor to grid if snapping is enabled
          if (snapToGridEnabled) {
            scaleAnchor = snapPointToGrid(scaleAnchor, POSITION_SNAP_INCREMENT)
          }
        }
        
        // For move operations, capture starting positions of all shapes to move
        let shapeStarts: Map<string, Point> | undefined
        if (mode === 'move') {
          if (isAlreadySelected && selectedIds.length > 1) {
            // Clicking on a selected shape in a multi-selection: move all selected shapes
            shapeStarts = new Map()
            for (const id of selectedIds) {
              const s = shapes.find(sh => sh.id === id)
              if (s && s.type === 'circle') {
                shapeStarts.set(id, { ...s.center })
              }
            }
          }
          // Otherwise: single shape move (handled by default dragState.startCenter)
        }
        
        // For scale operations, capture starting radii and centers of all selected shapes
        // (used for Shift+drag multi-select scaling)
        let shapeRadii: Map<string, { radius: number; center: Point }> | undefined
        if (mode === 'scale' && isAlreadySelected && selectedIds.length > 1) {
          shapeRadii = new Map()
          for (const id of selectedIds) {
            const s = shapes.find(sh => sh.id === id)
            if (s && s.type === 'circle') {
              shapeRadii.set(id, { radius: s.radius, center: { ...s.center } })
            }
          }
        }
        
        // If clicking on unselected shape (without shift), replace selection
        if (!isAlreadySelected) {
          select(shape.id, false)
        }
        
        // For scale mode, clamp the start point to be exactly on the circle edge
        let startPoint = worldPos
        if (isEdge) {
          const dirToMouse = normalize(subtract(worldPos, shape.center))
          startPoint = {
            x: shape.center.x + dirToMouse.x * shape.radius,
            y: shape.center.y + dirToMouse.y * shape.radius
          }
          // Snap the clamped point to grid if snapping is enabled
          if (snapToGridEnabled) {
            startPoint = snapPointToGrid(startPoint, POSITION_SNAP_INCREMENT)
          }
        }
        
        setDragState({
          mode,
          shapeId: shape.id,
          startPoint,
          startCenter: { ...shape.center },
          startRadius: shape.radius,
          shapeStarts,
          shapeRadii,
          scaleAnchor
        })
        
        canvas.style.cursor = mode === 'scale' ? getScaleCursor(scaleCursorAngle.current) : 'move'
      } else {
        // Clicked on empty space - potential marquee selection or click preview
        // Use a threshold to distinguish between click and drag
        const startScreenPos = { x: e.clientX, y: e.clientY }
        const startWorldPos = worldPos
        let hasStartedMarquee = false
        
        // Store original selection for add/subtract modes
        const originalSelection = [...selectedIds]
        
        const handleEmptySpaceMove = (moveEvent: MouseEvent) => {
          const dx = moveEvent.clientX - startScreenPos.x
          const dy = moveEvent.clientY - startScreenPos.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          
          // Only start marquee after passing threshold
          if (!hasStartedMarquee && dist > DRAG_THRESHOLD) {
            hasStartedMarquee = true
            
            const marqueeMode = getMarqueeMode(moveEvent)
            
            // For replace mode, clear selection when starting marquee
            if (marqueeMode === 'replace') {
              clearSelection()
            }
            
            // Clear any click preview
            clearClickPreview()
            
            canvas.style.cursor = getMarqueeCursor(marqueeMode)
          }
          
          if (hasStartedMarquee) {
            const currentWorldPos = getWorldPos(moveEvent)
            const marqueeMode = getMarqueeMode(moveEvent)
            
            // Calculate marquee rectangle
            const minX = Math.min(startWorldPos.x, currentWorldPos.x)
            const maxX = Math.max(startWorldPos.x, currentWorldPos.x)
            const minY = Math.min(startWorldPos.y, currentWorldPos.y)
            const maxY = Math.max(startWorldPos.y, currentWorldPos.y)
            
            const rect: Rect = {
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY
            }
            
            // Find all circles that intersect with the marquee rectangle
            const intersectingIds = circles
              .filter(circle => circleIntersectsRect(circle, rect))
              .map(circle => circle.id)
            
            // Compute new selection based on mode
            let newSelection: string[]
            
            switch (marqueeMode) {
              case 'add':
                newSelection = [...new Set([...originalSelection, ...intersectingIds])]
                break
              case 'subtract':
                newSelection = originalSelection.filter(id => !intersectingIds.includes(id))
                break
              case 'replace':
              default:
                newSelection = intersectingIds
                break
            }
            
            selectAll(newSelection)
            
            // Update drag state for rendering
            setDragState({
              mode: 'marquee',
              shapeId: '',
              startPoint: startWorldPos,
              startCenter: startWorldPos,
              startRadius: 0,
              marqueeMode,
              marqueeStart: startWorldPos,
              marqueeCurrent: currentWorldPos,
              originalSelection
            })
            
            canvas.style.cursor = getMarqueeCursor(marqueeMode)
          }
        }
        
        const handleEmptySpaceUp = () => {
          window.removeEventListener('mousemove', handleEmptySpaceMove)
          window.removeEventListener('mouseup', handleEmptySpaceUp)
          
          if (hasStartedMarquee) {
            // End marquee selection
            setDragState(null)
            canvas.style.cursor = ''
          } else {
            // Was a click, not a drag
            const hadSelection = selectedIds.length > 0
            
            // Clear selection on click (unless shift/alt held for additive mode)
            if (!e.shiftKey && !e.altKey) {
              clearSelection()
            }
            
            // Show click preview for double-click circle creation
            // But only if this wasn't a deselect click (no prior selection)
            if (!e.shiftKey && !e.altKey && !hadSelection) {
              const pathHit = findPathSegmentAt(circles, shapeOrder, startWorldPos, PATH_HIT_TOLERANCE / zoom, globalStretch, closedPath, useStartPoint, useEndPoint, mirrorConfig)
              const previewRadius = calculateNonOverlappingRadius(pathHit ? pathHit.point : startWorldPos, circles)
              const previewPosition = pathHit ? pathHit.point : startWorldPos
              showClickPreview(previewPosition, previewRadius)
            }
          }
        }
        
        window.addEventListener('mousemove', handleEmptySpaceMove)
        window.addEventListener('mouseup', handleEmptySpaceUp)
      }
    }
  }, [canvasRef, getWorldPos, isPanning, pan, setPan, findTargetAt, select, selectAll, clearSelection, setDragState, toggleDirection, toggleMirror, removeShape, shapes, shapeOrder, selectedIds, circles, zoom, globalStretch, closedPath, useStartPoint, useEndPoint, showClickPreview, clearClickPreview])
  
  // Mouse move handler
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    // Skip if we're actively panning (handled by separate listeners)
    if (isPanningActive.current) return
    
    const worldPos = getWorldPos(e)
    
    // Handle dragging
    if (dragState) {
      // Marquee mode is handled by its own listeners, just skip here
      if (dragState.mode === 'marquee') {
        return
      }
      
      const shape = shapes.find(s => s.id === dragState.shapeId)
      if (!shape || shape.type !== 'circle') return
      
      if (dragState.mode === 'move') {
        let dx = worldPos.x - dragState.startPoint.x
        let dy = worldPos.y - dragState.startPoint.y
        
        // Apply axis constraint if Shift is held
        if (e.shiftKey) {
          const constrainedDelta = constrainToNearestAxis({ x: dx, y: dy }, constraintAxes)
          dx = constrainedDelta.x
          dy = constrainedDelta.y
        }
        
        // Multi-select move: update all shapes that were selected when drag started
        if (dragState.shapeStarts && dragState.shapeStarts.size > 0) {
          let snapOffset = { x: 0, y: 0 }
          
          // Compute smart guides if enabled (but not when axis-constrained)
          if (smartGuidesEnabled && !e.shiftKey) {
            // Build preview positions for smart guides
            const draggedCirclesPreviews: CircleShape[] = []
            const draggedIds = new Set(dragState.shapeStarts.keys())
            
            for (const [id, startCenter] of dragState.shapeStarts) {
              const originalShape = shapes.find(s => s.id === id) as CircleShape | undefined
              if (originalShape) {
                draggedCirclesPreviews.push({
                  ...originalShape,
                  center: {
                    x: startCenter.x + dx,
                    y: startCenter.y + dy
                  }
                })
              }
            }
            
            // Get other circles (not being dragged)
            const otherCircles = circles.filter(c => !draggedIds.has(c.id))
            
            // Compute smart guides (threshold in world coords)
            const smartGuideThreshold = SMART_GUIDE_SNAP_THRESHOLD / zoom
            const result = computeSmartGuides(draggedCirclesPreviews, otherCircles, smartGuideThreshold)
            setActiveGuides(result.guides)
            snapOffset = result.snapOffset
          } else {
            clearActiveGuides()
          }
          
          // Apply updates with smart guide snapping
          const updates = new Map<string, Partial<CircleShape>>()
          
          for (const [id, startCenter] of dragState.shapeStarts) {
            let newCenter = {
              x: startCenter.x + dx + snapOffset.x,
              y: startCenter.y + dy + snapOffset.y
            }
            
            if (snapToGridEnabled) {
              newCenter = snapPointToGrid(newCenter, POSITION_SNAP_INCREMENT)
            }
            
            updates.set(id, { center: newCenter })
          }
          
          updateShapes(updates)
        } else {
          // Single shape move
          let newCenter = {
            x: dragState.startCenter.x + dx,
            y: dragState.startCenter.y + dy
          }
          
          // Compute smart guides if enabled (but not when axis-constrained)
          if (smartGuidesEnabled && !e.shiftKey) {
            // Get the dragged circle with preview position
            const draggedCircle = circles.find(c => c.id === dragState.shapeId)
            if (draggedCircle) {
              const draggedCirclePreview: CircleShape = {
                ...draggedCircle,
                center: newCenter
              }
              
              // Get other circles (not being dragged)
              const otherCircles = circles.filter(c => c.id !== dragState.shapeId)
              
              // Compute smart guides (threshold in world coords)
              const smartGuideThreshold = SMART_GUIDE_SNAP_THRESHOLD / zoom
              const { guides, snapOffset } = computeSmartGuides([draggedCirclePreview], otherCircles, smartGuideThreshold)
              setActiveGuides(guides)
              
              // Apply smart guide snapping
              newCenter = {
                x: newCenter.x + snapOffset.x,
                y: newCenter.y + snapOffset.y
              }
            }
          } else {
            clearActiveGuides()
          }
          
          if (snapToGridEnabled) {
            newCenter = snapPointToGrid(newCenter, POSITION_SNAP_INCREMENT)
          }
          
          updateShape(dragState.shapeId, { center: newCenter })
        }
      } else if (dragState.mode === 'scale') {
        const anchor = dragState.scaleAnchor
        
        if (!anchor) {
          // Center-based scaling (default behavior)
          // The center stays fixed, radius is distance from cursor to center
          const distFromCenter = distance(worldPos, dragState.startCenter)
          let newRadius = Math.max(5, distFromCenter)
          
          if (snapToGridEnabled) {
            newRadius = snapToGrid(newRadius, RADIUS_SNAP_INCREMENT)
            newRadius = Math.max(RADIUS_SNAP_INCREMENT, newRadius)
          }
          
          // Shift: scale all selected shapes proportionally
          if (e.shiftKey && dragState.shapeRadii && dragState.shapeRadii.size > 1) {
            const scaleFactor = newRadius / dragState.startRadius
            dragState.shapeRadii.forEach((data, id) => {
              if (id !== dragState.shapeId) {
                let scaledRadius = Math.max(5, data.radius * scaleFactor)
                if (snapToGridEnabled) {
                  scaledRadius = snapToGrid(scaledRadius, RADIUS_SNAP_INCREMENT)
                  scaledRadius = Math.max(RADIUS_SNAP_INCREMENT, scaledRadius)
                }
                updateShape(id, { radius: scaledRadius })
              }
            })
          }
          
          updateShape(dragState.shapeId, { radius: newRadius })
        } else {
          // Anchor-based scaling (Alt key)
          // The anchor point stays fixed, scaling only along the line from anchor to start point
          // This prevents the circle from "orbiting" around the pivot
          
          // Direction from anchor to the original drag start point (fixed axis)
          const axisDir = normalize(subtract(dragState.startPoint, anchor))
          
          // Project cursor onto the line from anchor through startPoint
          // t = (cursor - anchor) · axisDir (signed distance along axis)
          const cursorVec = subtract(worldPos, anchor)
          const t = cursorVec.x * axisDir.x + cursorVec.y * axisDir.y
          
          // Projected point on the axis line
          let projectedPoint = {
            x: anchor.x + t * axisDir.x,
            y: anchor.y + t * axisDir.y
          }
          
          // Snap the projected point to grid if enabled
          if (snapToGridEnabled) {
            projectedPoint = snapPointToGrid(projectedPoint, POSITION_SNAP_INCREMENT)
          }
          
          // New diameter = distance from anchor to projected point
          // New radius = half that
          const distToProjected = distance(projectedPoint, anchor)
          let newRadius = Math.max(5, distToProjected / 2)
          
          // Center is midpoint between anchor and projected point
          let newCenter = {
            x: (anchor.x + projectedPoint.x) / 2,
            y: (anchor.y + projectedPoint.y) / 2
          }
          
          newRadius = Math.max(5, newRadius)
          
          // Shift: scale all selected shapes proportionally (anchor-based mode)
          if (e.shiftKey && dragState.shapeRadii && dragState.shapeRadii.size > 1) {
            const scaleFactor = newRadius / dragState.startRadius
            dragState.shapeRadii.forEach((data, id) => {
              if (id !== dragState.shapeId) {
                let scaledRadius = Math.max(5, data.radius * scaleFactor)
                if (snapToGridEnabled) {
                  scaledRadius = snapToGrid(scaledRadius, RADIUS_SNAP_INCREMENT)
                  scaledRadius = Math.max(RADIUS_SNAP_INCREMENT, scaledRadius)
                }
                updateShape(id, { radius: scaledRadius })
              }
            })
          }
          
          updateShape(dragState.shapeId, { center: newCenter, radius: newRadius })
        }
      } else if (dragState.mode === 'tangent-entry-offset' || dragState.mode === 'tangent-exit-offset') {
        const angleToMouse = angle(shape.center, worldPos)
        const clockwise = (shape.direction ?? 'cw') === 'cw'
        const offsetDir = clockwise ? 1 : -1
        
        const baseAngle = dragState.startAngle ?? 0
        let newOffset = (angleToMouse - baseAngle) / offsetDir
        
        while (newOffset > Math.PI) newOffset -= Math.PI * 2
        while (newOffset < -Math.PI) newOffset += Math.PI * 2
        
        newOffset = Math.max(-Math.PI, Math.min(Math.PI, newOffset))
        
        // Snap to angular increments when snapping is enabled
        if (snapToGridEnabled) {
          newOffset = Math.round(newOffset / OFFSET_SNAP_INCREMENT) * OFFSET_SNAP_INCREMENT
        }
        
        // Snap to zero when very close
        if (Math.abs(newOffset) < OFFSET_SNAP_THRESHOLD) newOffset = 0
        
        const offsetValue = newOffset === 0 ? undefined : newOffset
        
        // Modifier keys for linked control:
        // - Shift: apply the same delta to both handles (parallel movement)
        // - Alt: apply opposite delta to other handle (mirrored movement)
        const isEntry = dragState.mode === 'tangent-entry-offset'
        const startOffset = dragState.startOffset ?? 0
        const startOtherOffset = dragState.startOtherOffset ?? 0
        const delta = newOffset - startOffset
        
        if (e.altKey) {
          // Alt: mirrored - apply opposite delta to other handle
          let otherOffset = startOtherOffset - delta
          // Wrap around instead of clamping (same as main offset)
          while (otherOffset > Math.PI) otherOffset -= Math.PI * 2
          while (otherOffset < -Math.PI) otherOffset += Math.PI * 2
          if (Math.abs(otherOffset) < OFFSET_SNAP_THRESHOLD) otherOffset = 0
          const otherValue = otherOffset === 0 ? undefined : otherOffset
          
          if (isEntry) {
            setEntryOffset(shape.id, offsetValue)
            setExitOffset(shape.id, otherValue)
          } else {
            setExitOffset(shape.id, offsetValue)
            setEntryOffset(shape.id, otherValue)
          }
        } else if (e.shiftKey) {
          // Shift: symmetric - apply same delta to both handles
          let otherOffset = startOtherOffset + delta
          // Wrap around instead of clamping (same as main offset)
          while (otherOffset > Math.PI) otherOffset -= Math.PI * 2
          while (otherOffset < -Math.PI) otherOffset += Math.PI * 2
          if (Math.abs(otherOffset) < OFFSET_SNAP_THRESHOLD) otherOffset = 0
          const otherValue = otherOffset === 0 ? undefined : otherOffset
          
          if (isEntry) {
            setEntryOffset(shape.id, offsetValue)
            setExitOffset(shape.id, otherValue)
          } else {
            setExitOffset(shape.id, offsetValue)
            setEntryOffset(shape.id, otherValue)
          }
        } else if (isEntry) {
          setEntryOffset(shape.id, offsetValue)
        } else {
          setExitOffset(shape.id, offsetValue)
        }
      } else if (dragState.mode === 'tangent-entry-length' || dragState.mode === 'tangent-exit-length') {
        const { expandedShapes, expandedOrder } = expandMirroredCircles(circles, shapeOrder, mirrorConfig)
        const info = computeTangentHandleInfo(shape, expandedShapes, expandedOrder, closedPath, useStartPoint, useEndPoint)
        
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
          
          // Snap to percentage increments when snapping is enabled
          if (snapToGridEnabled) {
            newLength = Math.round(newLength / LENGTH_SNAP_INCREMENT) * LENGTH_SNAP_INCREMENT
          }
          
          // Snap to default (1.0) when very close
          if (Math.abs(newLength - DEFAULT_TANGENT_LENGTH) < LENGTH_SNAP_THRESHOLD) newLength = DEFAULT_TANGENT_LENGTH
          
          const lengthValue = newLength === DEFAULT_TANGENT_LENGTH ? undefined : newLength
          
          // Modifier keys for linked control:
          // - Shift: apply same delta to both handles (parallel movement)
          // - Alt: apply opposite delta to other handle (mirrored movement)
          const startLength = dragState.startTangentLength ?? DEFAULT_TANGENT_LENGTH
          const startOtherLength = dragState.startOtherTangentLength ?? DEFAULT_TANGENT_LENGTH
          const delta = newLength - startLength
          
          if (e.altKey) {
            // Alt: mirrored - apply opposite delta to other handle
            let otherLength = startOtherLength - delta
            otherLength = Math.max(MIN_TANGENT_LENGTH, Math.min(MAX_TANGENT_LENGTH, otherLength))
            if (Math.abs(otherLength - DEFAULT_TANGENT_LENGTH) < LENGTH_SNAP_THRESHOLD) otherLength = DEFAULT_TANGENT_LENGTH
            const otherValue = otherLength === DEFAULT_TANGENT_LENGTH ? undefined : otherLength
            
            if (isEntry) {
              setEntryTangentLength(shape.id, lengthValue)
              setExitTangentLength(shape.id, otherValue)
            } else {
              setExitTangentLength(shape.id, lengthValue)
              setEntryTangentLength(shape.id, otherValue)
            }
          } else if (e.shiftKey) {
            // Shift: symmetric - apply same delta to both handles
            let otherLength = startOtherLength + delta
            otherLength = Math.max(MIN_TANGENT_LENGTH, Math.min(MAX_TANGENT_LENGTH, otherLength))
            if (Math.abs(otherLength - DEFAULT_TANGENT_LENGTH) < LENGTH_SNAP_THRESHOLD) otherLength = DEFAULT_TANGENT_LENGTH
            const otherValue = otherLength === DEFAULT_TANGENT_LENGTH ? undefined : otherLength
            
            if (isEntry) {
              setEntryTangentLength(shape.id, lengthValue)
              setExitTangentLength(shape.id, otherValue)
            } else {
              setExitTangentLength(shape.id, lengthValue)
              setEntryTangentLength(shape.id, otherValue)
            }
          } else if (isEntry) {
            setEntryTangentLength(shape.id, lengthValue)
          } else {
            setExitTangentLength(shape.id, lengthValue)
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
    setMouseWorldPos(worldPos)
    canvas.style.cursor = getCursor(hit.hoverTarget, false)
  }, [canvasRef, getWorldPos, dragState, shapes, circles, shapeOrder, updateShape, updateShapes, snapToGridEnabled, findTargetAt, getCursor, setHovered, setHoverTarget, setMouseWorldPos, setEntryOffset, setExitOffset, setEntryTangentLength, setExitTangentLength, selectAll, setDragState, constraintAxes, smartGuidesEnabled, zoom, closedPath, useStartPoint, useEndPoint, mirrorConfig, setActiveGuides, clearActiveGuides])
  
  // Mouse up handler
  const handleMouseUp = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    if (dragState) {
      setDragState(null)
      clearActiveGuides()
      canvas.style.cursor = ''
    }
  }, [canvasRef, dragState, setDragState, clearActiveGuides])
  
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
  
  // ========== TOUCH EVENT HANDLERS ==========
  
  // Touch start handler
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const ts = touchState.current
    
    // Update touch tracking
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      ts.touches.set(touch.identifier, {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      })
    }
    
    const touchCount = ts.touches.size
    
    // Track multi-finger tap (for undo/redo gestures)
    if (touchCount >= 2) {
      // If this is a new multi-touch gesture, record start time and positions
      if (ts.maxTouchCount < 2) {
        ts.multiTouchStartTime = Date.now()
        ts.multiTouchStartPositions.clear()
      }
      // Always update max touch count and start positions
      ts.maxTouchCount = Math.max(ts.maxTouchCount, touchCount)
      for (const [id, pos] of ts.touches) {
        if (!ts.multiTouchStartPositions.has(id)) {
          ts.multiTouchStartPositions.set(id, { ...pos })
        }
      }
    }
    
    // Three-finger touch: just track for tap, don't do anything else
    if (touchCount >= 3) {
      e.preventDefault()
      // Cancel any other gestures
      ts.isPinching = false
      ts.isPanningWithSingleFinger = false
      if (dragState) {
        setDragState(null)
      }
      return
    }
    
    // Two-finger gesture: pinch-to-zoom or two-finger pan
    if (touchCount === 2) {
      e.preventDefault()
      const touchArray = Array.from(ts.touches.values())
      const [t1, t2] = touchArray
      
      ts.initialPinchDistance = getTouchDistance(t1, t2)
      ts.initialPinchCenter = getTouchCenter(t1, t2)
      ts.initialZoom = zoom
      ts.initialPan = { ...pan }
      ts.isPinching = true
      
      // Cancel any single-touch drag in progress
      ts.isPanningWithSingleFinger = false
      if (dragState) {
        setDragState(null)
      }
      return
    }
    
    // Single touch: simulate mouse behavior
    if (touchCount === 1) {
      const touch = e.changedTouches[0]
      ts.activeTouchId = touch.identifier
      ts.touchStartTime = Date.now()
      ts.touchStartPos = { x: touch.clientX, y: touch.clientY }
      
      // Check for double-tap
      const now = Date.now()
      const tapPos = { x: touch.clientX, y: touch.clientY }
      
      if (
        ts.lastTapTime && 
        ts.lastTapPos &&
        now - ts.lastTapTime < DOUBLE_TAP_THRESHOLD &&
        getTouchDistance(tapPos, ts.lastTapPos) < DOUBLE_TAP_DISTANCE
      ) {
        // Double tap detected - create circle
        e.preventDefault()
        ts.lastTapTime = 0
        ts.lastTapPos = null
        
        const worldPos = getWorldPosFromScreen(touch.clientX, touch.clientY)
        
        // Check if we tapped on an existing shape
        const hit = findTargetAt(worldPos)
        if (hit.shape) {
          // Double-tapped on a shape, don't create new circle
          return
        }
        
        // Check if tap is on a path segment
        const pathHit = findPathSegmentAt(circles, shapeOrder, worldPos, PATH_HIT_TOLERANCE / zoom, globalStretch, closedPath, useStartPoint, useEndPoint, mirrorConfig)
        
        if (pathHit) {
          const radius = calculateNonOverlappingRadius(pathHit.point, circles)
          const closestCircle = findClosestCircle(circles, pathHit.point)
          const circleCount = shapes.filter(s => s.type === 'circle').length
        const newCircle: CircleShape = {
          ...createCircle(pathHit.point, radius, undefined, `Circle ${circleCount + 1}`),
          mirrored: closestCircle?.mirrored ?? true
        }
          const insertIndex = pathHit.fromCircleIndex + 1
          insertShapeAt(newCircle, insertIndex)
          select(newCircle.id, false)
          return
        }
        
        // Double-tap on empty space - create circle
        const closestPathHit = findClosestPointOnPath(circles, shapeOrder, worldPos, globalStretch, closedPath, useStartPoint, useEndPoint, mirrorConfig)
        const radius = calculateNonOverlappingRadius(worldPos, circles)
        const closestCircle = findClosestCircle(circles, worldPos)
        const circleCount = shapes.filter(s => s.type === 'circle').length
        const newCircle: CircleShape = {
          ...createCircle(worldPos, radius, undefined, `Circle ${circleCount + 1}`),
          mirrored: closestCircle?.mirrored ?? true
        }
        const insertIndex = closestPathHit ? closestPathHit.fromCircleIndex + 1 : shapeOrder.length
        insertShapeAt(newCircle, insertIndex)
        select(newCircle.id, false)
        return
      }
      
      // Store tap info for potential double-tap
      ts.lastTapTime = now
      ts.lastTapPos = tapPos
      
      // Simulate mouse down for single touch
      const worldPos = getWorldPosFromScreen(touch.clientX, touch.clientY)
      const hit = findTargetAt(worldPos)
      
      if (hit.shape) {
        const { shape, hoverTarget, tangentHandle } = hit
        
        // Handle delete icon tap
        if (hoverTarget?.type === 'delete-icon') {
          e.preventDefault()
          removeShape(shape.id)
          clearSelection()
          return
        }
        
        // Handle mirror icon tap
        if (hoverTarget?.type === 'mirror-icon') {
          e.preventDefault()
          toggleMirror(shape.id)
          return
        }
        
        // Handle index dot tap
        if (hoverTarget?.type === 'index-dot') {
          e.preventDefault()
          const currentIndex = shapeOrder.indexOf(shape.id)
          const targetIndex = hoverTarget.dotIndex
          if (currentIndex !== targetIndex && targetIndex >= 0 && targetIndex < shapeOrder.length) {
            const newOrder = [...shapeOrder]
            newOrder.splice(currentIndex, 1)
            newOrder.splice(targetIndex, 0, shape.id)
            reorderShapes(newOrder)
          }
          return
        }
        
        // Handle direction ring tap
        if (hoverTarget?.type === 'direction-ring') {
          e.preventDefault()
          toggleDirection(shape.id)
          return
        }
        
        // Handle tangent handle drag
        if (tangentHandle && !tangentHandle.includes('slot')) {
          e.preventDefault()
          const { expandedShapes, expandedOrder } = expandMirroredCircles(circles, shapeOrder, mirrorConfig)
          const info = computeTangentHandleInfo(shape, expandedShapes, expandedOrder, closedPath, useStartPoint, useEndPoint)
          
          let mode: DragMode = null
          let startAngle = 0
          let startOffset = 0
          let startOtherOffset = 0
          let startTangentLength = DEFAULT_TANGENT_LENGTH
          let startOtherTangentLength = DEFAULT_TANGENT_LENGTH
          
          if (tangentHandle === 'entry-offset') {
            mode = 'tangent-entry-offset'
            startAngle = info?.entryAngle ?? 0
            startOffset = shape.entryOffset ?? 0
            startOtherOffset = shape.exitOffset ?? 0
          } else if (tangentHandle === 'exit-offset') {
            mode = 'tangent-exit-offset'
            startAngle = info?.exitAngle ?? 0
            startOffset = shape.exitOffset ?? 0
            startOtherOffset = shape.entryOffset ?? 0
          } else if (tangentHandle === 'entry-length') {
            mode = 'tangent-entry-length'
            startTangentLength = shape.entryTangentLength ?? 1.0
            startOtherTangentLength = shape.exitTangentLength ?? 1.0
          } else if (tangentHandle === 'exit-length') {
            mode = 'tangent-exit-length'
            startTangentLength = shape.exitTangentLength ?? 1.0
            startOtherTangentLength = shape.entryTangentLength ?? 1.0
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
              startOtherOffset,
              startTangentLength,
              startOtherTangentLength
            })
          }
          return
        }
        
        // Start dragging shape (move or scale)
        e.preventDefault()
        const isEdge = hoverTarget?.type === 'shape-edge'
        const mode = isEdge ? 'scale' : 'move'
        const isAlreadySelected = selectedIds.includes(shape.id)
        
        // Check modifier keys (from ModifierBar on touch devices)
        const shiftPressed = modifierKeys.shift
        const altPressed = modifierKeys.alt
        
        // Shift+tap on body: toggle selection without starting drag
        if (shiftPressed && !isEdge) {
          select(shape.id, true) // additive/toggle mode
          return
        }
        
        // Update scale cursor angle for edge dragging
        if (isEdge) {
          scaleCursorAngle.current = angle(shape.center, worldPos)
        }
        
        // Determine scale anchor point for non-center scaling (Alt key)
        let scaleAnchor: Point | undefined
        if (isEdge && altPressed) {
          scaleAnchor = findExactOppositePoint(shape, worldPos)
          if (snapToGridEnabled) {
            scaleAnchor = snapPointToGrid(scaleAnchor, POSITION_SNAP_INCREMENT)
          }
        }
        
        // For move operations, capture starting positions
        let shapeStarts: Map<string, Point> | undefined
        if (mode === 'move') {
          if (isAlreadySelected && selectedIds.length > 1) {
            shapeStarts = new Map()
            for (const id of selectedIds) {
              const s = shapes.find(sh => sh.id === id)
              if (s && s.type === 'circle') {
                shapeStarts.set(id, { ...s.center })
              }
            }
          }
        }
        
        // For scale operations, capture starting radii for proportional scaling
        let shapeRadii: Map<string, { radius: number; center: Point }> | undefined
        if (mode === 'scale' && isAlreadySelected && selectedIds.length > 1) {
          shapeRadii = new Map()
          for (const id of selectedIds) {
            const s = shapes.find(sh => sh.id === id)
            if (s && s.type === 'circle') {
              shapeRadii.set(id, { radius: s.radius, center: { ...s.center } })
            }
          }
        }
        
        if (!isAlreadySelected) {
          select(shape.id, false)
        }
        
        let startPoint = worldPos
        if (isEdge) {
          const dirToTouch = normalize(subtract(worldPos, shape.center))
          startPoint = {
            x: shape.center.x + dirToTouch.x * shape.radius,
            y: shape.center.y + dirToTouch.y * shape.radius
          }
          if (snapToGridEnabled) {
            startPoint = snapPointToGrid(startPoint, POSITION_SNAP_INCREMENT)
          }
        }
        
        setDragState({
          mode,
          shapeId: shape.id,
          startPoint,
          startCenter: { ...shape.center },
          startRadius: shape.radius,
          shapeStarts,
          shapeRadii,
          scaleAnchor
        })
      } else {
        // Tapped empty space - start single-finger pan mode
        e.preventDefault()
        ts.isPanningWithSingleFinger = true
        ts.panStartPos = { x: touch.clientX, y: touch.clientY }
        ts.panStartPan = { ...pan }
        
        // Clear selection on touch start (not move) to feel responsive
        clearSelection()
        clearClickPreview()
      }
    }
  }, [canvasRef, zoom, pan, findTargetAt, getWorldPosFromScreen, shapes, circles, shapeOrder, globalStretch, closedPath, useStartPoint, useEndPoint, mirrorConfig, selectedIds, select, clearSelection, setDragState, removeShape, toggleMirror, toggleDirection, reorderShapes, insertShapeAt, clearClickPreview, snapToGridEnabled, modifierKeys])
  
  // Touch move handler
  const handleTouchMove = useCallback((e: TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const ts = touchState.current
    
    // Update touch positions
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      ts.touches.set(touch.identifier, {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      })
    }
    
    // Handle pinch-to-zoom and two-finger pan
    if (ts.isPinching && ts.touches.size === 2) {
      e.preventDefault()
      const touchArray = Array.from(ts.touches.values())
      const [t1, t2] = touchArray
      
      const currentDistance = getTouchDistance(t1, t2)
      const currentCenter = getTouchCenter(t1, t2)
      
      if (ts.initialPinchDistance && ts.initialPinchCenter) {
        // Calculate zoom
        const zoomFactor = currentDistance / ts.initialPinchDistance
        const newZoom = Math.min(10, Math.max(0.1, ts.initialZoom * zoomFactor))
        
        // Calculate pan (two-finger drag)
        const panDeltaX = currentCenter.x - ts.initialPinchCenter.x
        const panDeltaY = currentCenter.y - ts.initialPinchCenter.y
        
        // Apply zoom centered on pinch center
        const zoomRatio = newZoom / ts.initialZoom
        const newPan = {
          x: ts.initialPinchCenter.x - (ts.initialPinchCenter.x - ts.initialPan.x) * zoomRatio + panDeltaX,
          y: ts.initialPinchCenter.y - (ts.initialPinchCenter.y - ts.initialPan.y) * zoomRatio + panDeltaY
        }
        
        setPan(newPan)
        zoomBy(newZoom / zoom, { x: canvas.width / 2, y: canvas.height / 2 })
      }
      return
    }
    
    // Single-finger pan (when started on empty canvas)
    if (ts.isPanningWithSingleFinger && ts.panStartPos && ts.panStartPan && ts.activeTouchId !== null) {
      e.preventDefault()
      const touch = Array.from(e.changedTouches).find(t => t.identifier === ts.activeTouchId)
      if (touch) {
        const dx = touch.clientX - ts.panStartPos.x
        const dy = touch.clientY - ts.panStartPos.y
        setPan({
          x: ts.panStartPan.x + dx,
          y: ts.panStartPan.y + dy
        })
      }
      return
    }
    
    // Single touch - handle drag
    if (ts.activeTouchId !== null && dragState) {
      e.preventDefault()
      
      const touch = Array.from(e.changedTouches).find(t => t.identifier === ts.activeTouchId)
      if (!touch) return
      
      const worldPos = getWorldPosFromScreen(touch.clientX, touch.clientY)
      const shape = shapes.find(s => s.id === dragState.shapeId)
      
      if (!shape || shape.type !== 'circle') return
      
      if (dragState.mode === 'move') {
        let dx = worldPos.x - dragState.startPoint.x
        let dy = worldPos.y - dragState.startPoint.y
        
        // Apply axis constraint if Shift is held (via ModifierBar on touch devices)
        const shiftPressed = modifierKeys.shift
        if (shiftPressed) {
          const constrainedDelta = constrainToNearestAxis({ x: dx, y: dy }, constraintAxes)
          dx = constrainedDelta.x
          dy = constrainedDelta.y
        }
        
        if (dragState.shapeStarts && dragState.shapeStarts.size > 0) {
          const updates = new Map<string, Partial<CircleShape>>()
          for (const [id, startCenter] of dragState.shapeStarts) {
            let newCenter = {
              x: startCenter.x + dx,
              y: startCenter.y + dy
            }
            if (snapToGridEnabled) {
              newCenter = snapPointToGrid(newCenter, POSITION_SNAP_INCREMENT)
            }
            updates.set(id, { center: newCenter })
          }
          updateShapes(updates)
        } else {
          let newCenter = {
            x: dragState.startCenter.x + dx,
            y: dragState.startCenter.y + dy
          }
          if (snapToGridEnabled) {
            newCenter = snapPointToGrid(newCenter, POSITION_SNAP_INCREMENT)
          }
          updateShape(dragState.shapeId, { center: newCenter })
        }
      } else if (dragState.mode === 'scale') {
        const anchor = dragState.scaleAnchor
        const shiftPressed = modifierKeys.shift
        
        if (!anchor) {
          // Center-based scaling (default)
          const distFromCenter = distance(worldPos, dragState.startCenter)
          let newRadius = Math.max(5, distFromCenter)
          if (snapToGridEnabled) {
            newRadius = snapToGrid(newRadius, RADIUS_SNAP_INCREMENT)
            newRadius = Math.max(RADIUS_SNAP_INCREMENT, newRadius)
          }
          
          // Shift: scale all selected shapes proportionally
          if (shiftPressed && dragState.shapeRadii && dragState.shapeRadii.size > 1) {
            const scaleFactor = newRadius / dragState.startRadius
            dragState.shapeRadii.forEach((data, id) => {
              if (id !== dragState.shapeId) {
                let scaledRadius = Math.max(5, data.radius * scaleFactor)
                if (snapToGridEnabled) {
                  scaledRadius = snapToGrid(scaledRadius, RADIUS_SNAP_INCREMENT)
                  scaledRadius = Math.max(RADIUS_SNAP_INCREMENT, scaledRadius)
                }
                updateShape(id, { radius: scaledRadius })
              }
            })
          }
          
          updateShape(dragState.shapeId, { radius: newRadius })
        } else {
          // Anchor-based scaling (Alt key)
          const axisDir = normalize(subtract(dragState.startPoint, anchor))
          const cursorVec = subtract(worldPos, anchor)
          const t = cursorVec.x * axisDir.x + cursorVec.y * axisDir.y
          
          let projectedPoint = {
            x: anchor.x + t * axisDir.x,
            y: anchor.y + t * axisDir.y
          }
          
          if (snapToGridEnabled) {
            projectedPoint = snapPointToGrid(projectedPoint, POSITION_SNAP_INCREMENT)
          }
          
          const distToProjected = distance(projectedPoint, anchor)
          let newRadius = Math.max(5, distToProjected / 2)
          
          let newCenter = {
            x: (anchor.x + projectedPoint.x) / 2,
            y: (anchor.y + projectedPoint.y) / 2
          }
          
          // Shift: scale all selected shapes proportionally
          if (shiftPressed && dragState.shapeRadii && dragState.shapeRadii.size > 1) {
            const scaleFactor = newRadius / dragState.startRadius
            dragState.shapeRadii.forEach((data, id) => {
              if (id !== dragState.shapeId) {
                let scaledRadius = Math.max(5, data.radius * scaleFactor)
                if (snapToGridEnabled) {
                  scaledRadius = snapToGrid(scaledRadius, RADIUS_SNAP_INCREMENT)
                  scaledRadius = Math.max(RADIUS_SNAP_INCREMENT, scaledRadius)
                }
                updateShape(id, { radius: scaledRadius })
              }
            })
          }
          
          updateShape(dragState.shapeId, { center: newCenter, radius: newRadius })
        }
      } else if (dragState.mode === 'tangent-entry-offset' || dragState.mode === 'tangent-exit-offset') {
        const angleToTouch = angle(shape.center, worldPos)
        const clockwise = (shape.direction ?? 'cw') === 'cw'
        const offsetDir = clockwise ? 1 : -1
        const baseAngle = dragState.startAngle ?? 0
        let newOffset = (angleToTouch - baseAngle) / offsetDir
        while (newOffset > Math.PI) newOffset -= Math.PI * 2
        while (newOffset < -Math.PI) newOffset += Math.PI * 2
        newOffset = Math.max(-Math.PI, Math.min(Math.PI, newOffset))
        if (snapToGridEnabled) {
          newOffset = Math.round(newOffset / OFFSET_SNAP_INCREMENT) * OFFSET_SNAP_INCREMENT
        }
        if (Math.abs(newOffset) < OFFSET_SNAP_THRESHOLD) newOffset = 0
        const offsetValue = newOffset === 0 ? undefined : newOffset
        
        if (dragState.mode === 'tangent-entry-offset') {
          setEntryOffset(shape.id, offsetValue)
        } else {
          setExitOffset(shape.id, offsetValue)
        }
      } else if (dragState.mode === 'tangent-entry-length' || dragState.mode === 'tangent-exit-length') {
        const { expandedShapes, expandedOrder } = expandMirroredCircles(circles, shapeOrder, mirrorConfig)
        const info = computeTangentHandleInfo(shape, expandedShapes, expandedOrder, closedPath, useStartPoint, useEndPoint)
        
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
          
          const toTouch = { x: worldPos.x - tangentPoint.x, y: worldPos.y - tangentPoint.y }
          const projectedDist = isEntry
            ? -(toTouch.x * tangentDir.x + toTouch.y * tangentDir.y)
            : (toTouch.x * tangentDir.x + toTouch.y * tangentDir.y)
          
          let newLength = projectedDist / baseDist
          newLength = Math.max(MIN_TANGENT_LENGTH, Math.min(MAX_TANGENT_LENGTH, newLength))
          if (snapToGridEnabled) {
            newLength = Math.round(newLength / LENGTH_SNAP_INCREMENT) * LENGTH_SNAP_INCREMENT
          }
          if (Math.abs(newLength - DEFAULT_TANGENT_LENGTH) < LENGTH_SNAP_THRESHOLD) newLength = DEFAULT_TANGENT_LENGTH
          const lengthValue = newLength === DEFAULT_TANGENT_LENGTH ? undefined : newLength
          
          if (isEntry) {
            setEntryTangentLength(shape.id, lengthValue)
          } else {
            setExitTangentLength(shape.id, lengthValue)
          }
        }
      }
    }
  }, [canvasRef, dragState, shapes, circles, shapeOrder, updateShape, updateShapes, snapToGridEnabled, getWorldPosFromScreen, zoom, pan, setPan, zoomBy, closedPath, useStartPoint, useEndPoint, mirrorConfig, setEntryOffset, setExitOffset, setEntryTangentLength, setExitTangentLength, modifierKeys, constraintAxes])
  
  // Touch end handler
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const ts = touchState.current
    const canvas = canvasRef.current
    const rect = canvas?.getBoundingClientRect()
    
    // Check for multi-finger tap (undo/redo) before removing touches
    if (ts.touches.size === 0 && ts.maxTouchCount >= 2 && rect) {
      const elapsed = Date.now() - ts.multiTouchStartTime
      
      // Check if it was a quick tap (not a drag/pinch)
      if (elapsed < MULTI_TAP_THRESHOLD) {
        // Check if fingers didn't move much (it's a tap, not a gesture)
        let isTap = true
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i]
          const startPos = ts.multiTouchStartPositions.get(touch.identifier)
          if (startPos) {
            const currentPos = {
              x: touch.clientX - rect.left,
              y: touch.clientY - rect.top
            }
            const moved = getTouchDistance(startPos, currentPos)
            if (moved > MULTI_TAP_MOVE_THRESHOLD) {
              isTap = false
              break
            }
          }
        }
        
        if (isTap) {
          // 2-finger tap = undo, 3-finger tap = redo
          if (ts.maxTouchCount === 2) {
            undo()
          } else if (ts.maxTouchCount >= 3) {
            redo()
          }
        }
      }
      
      // Reset multi-touch tracking
      ts.maxTouchCount = 0
      ts.multiTouchStartPositions.clear()
      ts.multiTouchStartTime = 0
    }
    
    // Remove ended touches from tracking
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      ts.touches.delete(touch.identifier)
      
      if (touch.identifier === ts.activeTouchId) {
        ts.activeTouchId = null
        ts.touchStartPos = null
      }
    }
    
    // Reset pinch state when all touches end
    if (ts.touches.size < 2) {
      ts.isPinching = false
      ts.initialPinchDistance = null
      ts.initialPinchCenter = null
    }
    
    // Reset single-finger pan state and multi-touch tracking when all fingers lift
    if (ts.touches.size === 0) {
      ts.isPanningWithSingleFinger = false
      ts.panStartPos = null
      ts.panStartPan = null
      ts.maxTouchCount = 0
      ts.multiTouchStartPositions.clear()
    }
    
    // End drag state
    if (dragState && ts.touches.size === 0) {
      setDragState(null)
      clearActiveGuides()
    }
  }, [canvasRef, dragState, setDragState, clearActiveGuides])
  
  // ========== END TOUCH EVENT HANDLERS ==========
  
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
      // Always prevent context menu on canvas - right click is used for panning
      e.preventDefault()
    }
    canvas.addEventListener('contextmenu', handleContextMenu)
    
    const handleGlobalMouseUp = () => {
      if (dragState) {
        setDragState(null)
      }
    }
    window.addEventListener('mouseup', handleGlobalMouseUp)
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Update modifier keys state
      setModifierKeys({
        alt: e.altKey,
        shift: e.shiftKey,
        ctrl: e.ctrlKey,
        meta: e.metaKey
      })
      
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
      // Update modifier keys state
      setModifierKeys({
        alt: e.altKey,
        shift: e.shiftKey,
        ctrl: e.ctrlKey,
        meta: e.metaKey
      })
      
      if (e.code === 'Space') {
        spaceKeyHeld.current = false
        if (canvas && !dragState) {
          canvas.style.cursor = ''
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    
    // Touch event listeners
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
    canvas.addEventListener('touchend', handleTouchEnd)
    canvas.addEventListener('touchcancel', handleTouchEnd)
    
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
      // Remove touch event listeners
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchmove', handleTouchMove)
      canvas.removeEventListener('touchend', handleTouchEnd)
      canvas.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [canvasRef, handleMouseDown, handleMouseMove, handleMouseUp, handleDoubleClick, handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd, dragState, setDragState])
}
