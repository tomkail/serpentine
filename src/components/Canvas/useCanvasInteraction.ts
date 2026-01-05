import { useEffect, useCallback, RefObject, useRef, useMemo } from 'react'
import { useDocumentStore } from '../../stores/documentStore'
import { useViewportStore, screenToWorld } from '../../stores/viewportStore'
import { useSelectionStore } from '../../stores/selectionStore'
import { useSettingsStore } from '../../stores/settingsStore'
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
import { snapPointToGrid, snapToGrid, distance, angle } from '../../geometry/math'
import { expandMirroredCircles, findPathSegmentAt, findClosestPointOnPath, calculateNonOverlappingRadius } from '../../geometry/path'
import type { Point, CircleShape, DragMode, HoverTarget } from '../../types'
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
  TANGENT_DISTANCE_FACTOR
} from '../../constants'
import { getScaleCursor, getCursorForTarget } from './cursorUtils'

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
  const updateShape = useDocumentStore(state => state.updateShape)
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
  const clearSelection = useSelectionStore(state => state.clearSelection)
  const setHovered = useSelectionStore(state => state.setHovered)
  const setHoverTarget = useSelectionStore(state => state.setHoverTarget)
  const setDragState = useSelectionStore(state => state.setDragState)
  const dragState = useSelectionStore(state => state.dragState)
  
  const snapToGridEnabled = useSettingsStore(state => state.snapToGrid)
  
  // Memoize circles array to avoid repeated filtering
  const circles = useMemo(
    () => shapes.filter((s): s is CircleShape => s.type === 'circle'),
    [shapes]
  )
  
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
    const handleTolerance = HANDLE_TOLERANCE / zoom
    
    // Get expanded shapes/order (including mirrored circles)
    const { expandedShapes, expandedOrder } = expandMirroredCircles(circles, shapeOrder)
    
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
      // Direction ring is not interactable when zoomed out too far
      if (isOnDirectionRing(shape, worldPos, zoom)) {
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
    
    // Only handle left double-click
    if (e.button !== 0) return
    
    const worldPos = getWorldPos(e)
    
    // Check if we clicked on an existing shape first
    const hit = findTargetAt(worldPos)
    if (hit.shape) {
      // Double-clicked on a shape, don't create new circle
      return
    }
    
    // Check if click is on a path segment (connector lines/beziers)
    const pathHit = findPathSegmentAt(circles, shapeOrder, worldPos, PATH_HIT_TOLERANCE / zoom, globalStretch, closedPath, useStartPoint, useEndPoint)
    
    if (pathHit) {
      // Calculate non-overlapping radius (reuse the existing circles array from scope)
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
      return
    }
    
    // Double-click on empty space - find closest point on entire path
    const closestPathHit = findClosestPointOnPath(circles, shapeOrder, worldPos, globalStretch, closedPath, useStartPoint, useEndPoint)
    
    if (closestPathHit) {
      // Calculate non-overlapping radius at the closest path point
      const radius = calculateNonOverlappingRadius(closestPathHit.point, circles)
      
      // Create new circle at the closest point on the path
      const circleCount = shapes.filter(s => s.type === 'circle').length
      const newCircle = createCircle(
        closestPathHit.point,
        radius,
        undefined,
        `Circle ${circleCount + 1}`
      )
      
      // Insert at the correct position in the path order
      const insertIndex = closestPathHit.fromCircleIndex + 1
      insertShapeAt(newCircle, insertIndex)
      
      // Select the new circle
      select(newCircle.id, false)
    }
  }, [canvasRef, getWorldPos, findTargetAt, shapes, circles, shapeOrder, globalStretch, closedPath, useStartPoint, useEndPoint, zoom, insertShapeAt, select])

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
        // Shift key: reset both entry and exit together
        const isOffset = hit.tangentHandle === 'entry-offset' || hit.tangentHandle === 'exit-offset'
        const isLength = hit.tangentHandle === 'entry-length' || hit.tangentHandle === 'exit-length'
        
        if (e.shiftKey) {
          // Reset both entry and exit symmetrically
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
        
        // Click on delete icon: delete the shape
        if (hoverTarget?.type === 'delete-icon') {
          removeShape(shape.id)
          clearSelection()
          return
        }
        
        // Click on mirror icon: toggle mirroring
        if (hoverTarget?.type === 'mirror-icon') {
          toggleMirror(shape.id)
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
        
        // Click on direction ring: toggle direction
        if (hoverTarget?.type === 'direction-ring') {
          toggleDirection(shape.id)
          return
        }
        
        // Click on tangent handle: start tangent dragging
        if (tangentHandle) {
          const { expandedShapes, expandedOrder } = expandMirroredCircles(circles, shapeOrder)
          const info = computeTangentHandleInfo(shape, expandedShapes, expandedOrder, closedPath, useStartPoint, useEndPoint)
          
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
            // Click on slot resets to default (shift: reset both)
            setEntryOffset(shape.id, undefined)
            if (e.shiftKey) setExitOffset(shape.id, undefined)
            return
          } else if (tangentHandle === 'exit-offset-slot') {
            setExitOffset(shape.id, undefined)
            if (e.shiftKey) setEntryOffset(shape.id, undefined)
            return
          } else if (tangentHandle === 'entry-length-slot') {
            setEntryTangentLength(shape.id, undefined)
            if (e.shiftKey) setExitTangentLength(shape.id, undefined)
            return
          } else if (tangentHandle === 'exit-length-slot') {
            setExitTangentLength(shape.id, undefined)
            if (e.shiftKey) setEntryTangentLength(shape.id, undefined)
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
  }, [canvasRef, getWorldPos, isPanning, pan, setPan, findTargetAt, select, clearSelection, setDragState, toggleDirection, toggleMirror, removeShape, shapes, shapeOrder])
  
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
          newCenter = snapPointToGrid(newCenter, POSITION_SNAP_INCREMENT)
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
        
        // Shift key: affect both entry and exit offsets symmetrically
        if (e.shiftKey) {
          setEntryOffset(shape.id, offsetValue)
          setExitOffset(shape.id, offsetValue)
        } else if (dragState.mode === 'tangent-entry-offset') {
          setEntryOffset(shape.id, offsetValue)
        } else {
          setExitOffset(shape.id, offsetValue)
        }
      } else if (dragState.mode === 'tangent-entry-length' || dragState.mode === 'tangent-exit-length') {
        const { expandedShapes, expandedOrder } = expandMirroredCircles(circles, shapeOrder)
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
          
          // Shift key: affect both entry and exit tangent lengths symmetrically
          if (e.shiftKey) {
            setEntryTangentLength(shape.id, lengthValue)
            setExitTangentLength(shape.id, lengthValue)
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
    canvas.style.cursor = getCursor(hit.hoverTarget, false)
  }, [canvasRef, getWorldPos, dragState, shapes, shapeOrder, updateShape, snapToGridEnabled, findTargetAt, getCursor, setHovered, setHoverTarget, setEntryOffset, setExitOffset, setEntryTangentLength, setExitTangentLength])
  
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
