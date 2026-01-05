import type { Shape, CircleShape, Point, CanvasTheme, HoverTarget } from '../../../types'
import { getMirroredCircles, createMirroredCircle, expandMirroredCircles } from '../../../geometry/path'
import { drawMirrorIconCanvas, drawDeleteIconCanvas } from '../../icons/Icons'
import {
  DIRECTION_RING_RADIUS,
  DOT_SIZE,
  CHEVRON_TARGET_SPACING,
  CHEVRON_MIN_SCREEN_SIZE,
  CHEVRON_MAX_SCREEN_SIZE,
  CHEVRON_PROPORTIONAL_SIZE,
  ACTION_ROW_OFFSET,
  ACTION_ICON_SIZE,
  ACTION_ICON_SPACING,
  MIRRORED_OPACITY
} from '../../../constants'

// Re-export hit testing functions for backwards compatibility
export {
  isOnEdgeZone,
  isInBodyZone,
  isOnDirectionRing,
  isOnDirectionArrow,
  isOnDeleteIcon,
  isOnMirrorIcon,
  getDotPosition,
  getIndexDotAt,
  computeTangentHandleInfo,
  getTangentHandleAt,
  type TangentHandleInfo,
  type TangentHandleType
} from './hitTesting'

import { getDotPosition, computeTangentHandleInfo } from './hitTesting'

/**
 * Render all shapes on the canvas
 * Selected shapes are drawn last so they appear on top and can be dragged
 * even when overlapping with other shapes
 */
export function renderShapes(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  selectedIds: string[],
  hoveredId: string | null,
  hoverTarget: HoverTarget,
  theme: CanvasTheme,
  zoom: number = 1,
  shapeOrder: string[] = []
) {
  // Separate shapes into non-selected and selected
  // Selected shapes are drawn last so they appear on top
  const nonSelectedShapes = shapes.filter(s => !selectedIds.includes(s.id))
  const selectedShapes = shapes.filter(s => selectedIds.includes(s.id))
  
  // Only count shapes in shapeOrder (excludes mirror shapes)
  const totalShapes = shapeOrder.length
  
  // Can only delete if more than 2 circles exist (must keep at least 2)
  const circleCount = shapes.filter(s => s.type === 'circle').length
  const canDelete = circleCount > 2
  
  // Draw non-selected shapes first (underneath)
  for (const shape of nonSelectedShapes) {
    if (shape.type === 'circle') {
      const shapeIndex = shapeOrder.indexOf(shape.id)
      const isInOrder = shapeIndex >= 0
      renderCircle(ctx, shape, {
        theme,
        isSelected: false,
        isHovered: shape.id === hoveredId,
        hoverTarget,
        zoom,
        // Only show index dots for shapes in the order (not mirrors)
        shapeIndex: isInOrder ? shapeIndex : undefined,
        totalShapes: isInOrder ? totalShapes : undefined,
        canDelete,
        isMirrored: shape.mirrored ?? false
      })
    }
  }
  
  // Draw selected shapes (on top of non-selected)
  for (const shape of selectedShapes) {
    if (shape.type === 'circle') {
      const shapeIndex = shapeOrder.indexOf(shape.id)
      const isInOrder = shapeIndex >= 0
      renderCircle(ctx, shape, {
        theme,
        isSelected: true,
        isHovered: shape.id === hoveredId,
        hoverTarget,
        zoom,
        // Only show index dots for shapes in the order (not mirrors)
        shapeIndex: isInOrder ? shapeIndex : undefined,
        totalShapes: isInOrder ? totalShapes : undefined,
        canDelete,
        isMirrored: shape.mirrored ?? false
      })
    }
  }
  
  // Get mirrored ghost circles for circles with mirrored=true
  // Draw these on top of all regular circles so they're always visible
  const circles = shapes.filter((s): s is CircleShape => s.type === 'circle')
  const mirroredCircles = getMirroredCircles(circles)
  
  for (const mirrorCircle of mirroredCircles) {
    // Find the original circle to get its hover/selection state
    // The mirrored circle's ID is `${originalId}_mirror`
    const originalId = mirrorCircle.id.replace('_mirror', '')
    const isOriginalSelected = selectedIds.includes(originalId)
    const isOriginalHovered = originalId === hoveredId
    
    renderMirroredCircle(ctx, mirrorCircle, originalId, theme, zoom, isOriginalSelected, isOriginalHovered, hoverTarget)
  }
}

/**
 * Render a mirrored ghost circle
 * Uses the same styles as the original but with reduced opacity
 * Mirrors the hover/selection state of its counterpart
 */
function renderMirroredCircle(
  ctx: CanvasRenderingContext2D,
  circle: CircleShape,
  originalId: string,
  theme: CanvasTheme,
  zoom: number,
  isOriginalSelected: boolean = false,
  isOriginalHovered: boolean = false,
  hoverTarget: HoverTarget = null
) {
  const { center, radius } = circle
  const uiScale = 1 / zoom
  
  // Check hover states on the original (mirrored circle mirrors its counterpart's state)
  const isEdgeHovered = hoverTarget?.type === 'shape-edge' && hoverTarget.shapeId === originalId
  const isRingHovered = hoverTarget?.type === 'direction-ring' && hoverTarget.shapeId === originalId
  
  ctx.save()
  
  // Apply transparency to entire mirrored circle
  ctx.globalAlpha = MIRRORED_OPACITY
  
  // Draw filled circle
  ctx.beginPath()
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
  ctx.fillStyle = theme.fill
  ctx.fill()
  
  // Draw stroke - mirror selection/hover state (solid line, same as original)
  let stroke = theme.stroke
  if (isOriginalSelected) stroke = theme.accent
  else if (isEdgeHovered) stroke = theme.accent
  else if (isOriginalHovered) stroke = theme.strokeHover
  ctx.strokeStyle = stroke
  ctx.lineWidth = (isOriginalSelected || isEdgeHovered ? theme.weights.heavy : theme.weights.medium) * uiScale
  ctx.stroke()
  
  // Draw direction ring - mirror selection/hover state
  drawDirectionRing(ctx, circle, theme, zoom, isRingHovered, false, isOriginalSelected)
  
  ctx.restore()
}

/**
 * Render tangent handles for all selected circles
 * This should be called AFTER the path is rendered so handles appear on top
 */
export function renderSelectedTangentHandles(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  selectedIds: string[],
  hoverTarget: HoverTarget,
  shapeOrder: string[],
  theme: CanvasTheme,
  zoom: number,
  closedPath: boolean = true,
  useStartPoint: boolean = true,
  useEndPoint: boolean = true
) {
  const circles = shapes.filter((s): s is CircleShape => s.type === 'circle')
  const selectedCircles = circles.filter(c => selectedIds.includes(c.id))
  
  // Get expanded shapes and order (including mirrored circles)
  const { expandedShapes, expandedOrder } = expandMirroredCircles(circles, shapeOrder)
  
  // First render ghost handles for mirrored versions of selected circles
  for (const circle of selectedCircles) {
    if (circle.mirrored) {
      const mirroredCircle = createMirroredCircle(circle)
      renderGhostTangentHandles(ctx, mirroredCircle, expandedShapes, expandedOrder, theme, zoom, closedPath, useStartPoint, useEndPoint)
    }
  }
  
  // Then render normal handles for selected circles (on top)
  for (const circle of selectedCircles) {
    renderTangentHandles(ctx, circle, expandedShapes, expandedOrder, hoverTarget, theme, zoom, closedPath, useStartPoint, useEndPoint)
  }
}

interface CircleRenderOptions {
  theme: CanvasTheme
  isSelected: boolean
  isHovered: boolean
  hoverTarget: HoverTarget
  zoom: number
  shapeIndex?: number  // Index in shape order (0-based)
  totalShapes?: number // Total number of shapes
  canDelete?: boolean  // Whether deletion is allowed (false if only 2 circles)
  isMirrored?: boolean // Whether this circle has mirroring enabled
}

function renderCircle(
  ctx: CanvasRenderingContext2D,
  circle: CircleShape,
  options: CircleRenderOptions
) {
  const { center, radius } = circle
  const { theme, isSelected, isHovered, hoverTarget, zoom, shapeIndex, totalShapes, canDelete = true, isMirrored = false } = options
  
  const uiScale = 1 / zoom
  
  // Check if specific elements are hovered
  const isEdgeHovered = hoverTarget?.type === 'shape-edge' && hoverTarget.shapeId === circle.id
  const isRingHovered = hoverTarget?.type === 'direction-ring' && hoverTarget.shapeId === circle.id
  const isDeleteHovered = hoverTarget?.type === 'delete-icon' && hoverTarget.shapeId === circle.id
  const isMirrorHovered = hoverTarget?.type === 'mirror-icon' && hoverTarget.shapeId === circle.id
  
  // Determine stroke color based on state
  let stroke = theme.stroke
  if (isSelected) stroke = theme.accent
  else if (isEdgeHovered) stroke = theme.accent
  else if (isHovered) stroke = theme.strokeHover
  
  // Draw filled circle
  ctx.beginPath()
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
  ctx.fillStyle = theme.fill
  ctx.fill()
  
  // Draw stroke - heavier when edge is hovered (scale action)
  ctx.strokeStyle = stroke
  ctx.lineWidth = (isSelected || isEdgeHovered ? theme.weights.heavy : theme.weights.medium) * uiScale
  ctx.stroke()
  
  // Draw direction ring (accent color only when selected or hovered)
  drawDirectionRing(ctx, circle, theme, zoom, isRingHovered, false, isSelected)
  
  // Draw index dot grid (always visible, shows position in sequence)
  if (shapeIndex !== undefined && totalShapes !== undefined && totalShapes > 0) {
    const hoveredDotIndex = hoverTarget?.type === 'index-dot' && hoverTarget.shapeId === circle.id 
      ? hoverTarget.dotIndex 
      : null
    drawIndexDotGrid(ctx, center, shapeIndex, totalShapes, theme, zoom, isSelected, hoveredDotIndex)
  }
  
  // Draw action row (mirror + delete icons) when selected, positioned below the circle
  if (isSelected) {
    const rowY = center.y + radius + ACTION_ROW_OFFSET * uiScale
    drawActionRow(ctx, { x: center.x, y: rowY }, theme, zoom, canDelete, isMirrored, isMirrorHovered, isDeleteHovered)
  }
}

/**
 * Draw a direction flow indicator around the circle
 * Shows path direction with many chevron marks around the full perimeter
 * Clickable to reverse direction
 * Positioned close to the edge (at 85% of radius)
 * 
 * Color scheme:
 * - Selected circles: accent color
 * - Hovered: accent color (brighter)
 * - Non-selected: monochrome (chrome color)
 * - Ghost (mirrored): monochrome, more transparent
 */
function drawDirectionRing(
  ctx: CanvasRenderingContext2D,
  circle: CircleShape,
  theme: CanvasTheme,
  zoom: number,
  isHovered: boolean,
  isGhost: boolean = false,
  isSelected: boolean = false
) {
  const { center, radius, direction } = circle
  const pathGoesClockwise = (direction ?? 'cw') === 'cw'
  
  const uiScale = 1 / zoom
  const ringRadius = radius * DIRECTION_RING_RADIUS
  
  ctx.save()
  
  // Determine colors based on state
  // Accent color only for selected or hovered, otherwise monochrome
  let chevronColor: string
  if (isGhost) {
    chevronColor = theme.chrome  // Monochrome ghost
  } else if (isHovered) {
    chevronColor = theme.accent
  } else if (isSelected) {
    chevronColor = theme.accentDim
  } else {
    chevronColor = theme.chrome  // Monochrome for non-selected
  }
  
  ctx.strokeStyle = chevronColor
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  
  // Calculate chevron count based on circumference
  // Target: chevrons every ~10-12 pixels of screen space for denser coverage
  const circumference = 2 * Math.PI * ringRadius * zoom
  const numChevrons = Math.max(12, Math.min(72, Math.floor(circumference / CHEVRON_TARGET_SPACING)))
  
  // Chevron size matches the selectable ring width
  const proportionalSize = radius * CHEVRON_PROPORTIONAL_SIZE
  const minScreenSize = CHEVRON_MIN_SCREEN_SIZE * uiScale
  const maxScreenSize = CHEVRON_MAX_SCREEN_SIZE * uiScale
  const chevronSize = Math.max(minScreenSize, Math.min(maxScreenSize, proportionalSize))
  
  const weight = (isHovered ? theme.weights.medium : theme.weights.light) * uiScale
  
  ctx.lineWidth = weight
  
  // Draw all chevrons in a single batched path for performance
  ctx.beginPath()
  for (let i = 0; i < numChevrons; i++) {
    const t = i / numChevrons
    const angle = t * Math.PI * 2  // Full circle
    
    const cx = center.x + ringRadius * Math.cos(angle)
    const cy = center.y + ringRadius * Math.sin(angle)
    
    // Chevron points in direction of flow (tangent to circle)
    const tangentAngle = pathGoesClockwise 
      ? angle + Math.PI / 2 
      : angle - Math.PI / 2
    
    // Chevron arms angle - slightly more open for better visibility
    const armAngle = Math.PI * 0.7
    const chevronAngle1 = tangentAngle + armAngle
    const chevronAngle2 = tangentAngle - armAngle
  
    ctx.moveTo(
      cx + chevronSize * Math.cos(chevronAngle1),
      cy + chevronSize * Math.sin(chevronAngle1)
    )
    ctx.lineTo(cx, cy)
    ctx.lineTo(
      cx + chevronSize * Math.cos(chevronAngle2),
      cy + chevronSize * Math.sin(chevronAngle2)
    )
  }
  ctx.stroke()
  
  ctx.restore()
}

// ============================================================================
// ACTION ROW (Mirror + Delete icons)
// ============================================================================

/**
 * Draw the action row with mirror and delete icons
 * Positioned below the selected circle
 */
function drawActionRow(
  ctx: CanvasRenderingContext2D,
  center: Point,  // Center point of the row (below circle)
  theme: CanvasTheme,
  zoom: number,
  canDelete: boolean,
  isMirrored: boolean,
  isMirrorHovered: boolean,
  isDeleteHovered: boolean
) {
  const uiScale = 1 / zoom
  const halfSpacing = (ACTION_ICON_SPACING / 2) * uiScale
  const iconSize = ACTION_ICON_SIZE * 2 * uiScale  // Size for the icon drawing
  
  // Calculate positions - mirror on left, delete on right
  const mirrorX = center.x - halfSpacing
  const deleteX = center.x + halfSpacing
  
  // Determine colors
  const mirrorColor = (isMirrored || isMirrorHovered) ? theme.accent : theme.accentDim
  const deleteColor = isDeleteHovered ? theme.danger : theme.accentDim
  
  // Draw mirror icon using shared function
  drawMirrorIconCanvas({
    ctx,
    x: mirrorX,
    y: center.y,
    size: iconSize,
    color: mirrorColor,
    haloColor: theme.handle.outerStroke,
    lineWidth: theme.weights.medium * uiScale
  })
  
  // Draw delete icon (only if deletion is allowed)
  if (canDelete) {
    drawDeleteIconCanvas({
      ctx,
      x: deleteX,
      y: center.y,
      size: iconSize,
      color: deleteColor,
      haloColor: theme.handle.outerStroke,
      lineWidth: theme.weights.medium * uiScale
    })
  }
}

/**
 * Draw the index dot grid
 * Shows a grid of dots where highlighted dot = this circle's position
 */
function drawIndexDotGrid(
  ctx: CanvasRenderingContext2D,
  center: Point,
  index: number,
  total: number,
  theme: CanvasTheme,
  zoom: number,
  isSelected: boolean,
  hoveredDotIndex: number | null
) {
  if (total <= 0) return
  
  const uiScale = 1 / zoom
  const dotRadius = (DOT_SIZE / 2) * uiScale
  
  ctx.save()
  
  for (let i = 0; i < total; i++) {
    const pos = getDotPosition(center, i, total, zoom)
    const isCurrentIndex = i === index
    const isHovered = hoveredDotIndex === i && !isCurrentIndex
    
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, dotRadius, 0, Math.PI * 2)
    
    if (isCurrentIndex) {
      // This circle's position - filled with accent color
      ctx.fillStyle = isSelected ? theme.accent : theme.accentDim
      ctx.fill()
    } else if (isHovered) {
      // Hovered dot (can click to move here) - accent outline
      ctx.strokeStyle = theme.accent
      ctx.lineWidth = 1.5 * uiScale
      ctx.stroke()
    } else {
      // Other positions - subtle monochrome
      ctx.fillStyle = theme.chrome
      ctx.fill()
    }
  }
  
  ctx.restore()
}

// ============================================================================
// DOUBLE-STROKE HANDLES
// ============================================================================

type HandleShape = 'diamond' | 'circle'
type HandleStyle = 'filled' | 'hollow'

/**
 * Draw a handle with double-stroke for universal visibility
 * Inner dark stroke + outer light stroke = visible on any background
 */
function drawHandle(
  ctx: CanvasRenderingContext2D,
  point: Point,
  shape: HandleShape,
  style: HandleStyle,
  theme: CanvasTheme,
  uiScale: number,
  isHovered: boolean = false
) {
  const size = theme.handle.size * uiScale
  const color = isHovered ? theme.accent : theme.accentDim
  
  ctx.save()
  
  // Build the path
  ctx.beginPath()
  if (shape === 'diamond') {
    ctx.moveTo(point.x, point.y - size)
    ctx.lineTo(point.x + size, point.y)
    ctx.lineTo(point.x, point.y + size)
    ctx.lineTo(point.x - size, point.y)
    ctx.closePath()
  } else {
    ctx.arc(point.x, point.y, size * 0.8, 0, Math.PI * 2)
  }
  
  // Layer 1: Outer stroke (light halo)
  ctx.strokeStyle = theme.handle.outerStroke
  ctx.lineWidth = (theme.handle.innerWidth + theme.handle.outerWidth * 2) * uiScale
  ctx.stroke()
  
  // Layer 2: Inner stroke (dark outline)
  ctx.strokeStyle = theme.handle.innerStroke
  ctx.lineWidth = theme.handle.innerWidth * uiScale
  ctx.stroke()
  
  // Layer 3: Fill or accent stroke based on style
  if (style === 'filled') {
    ctx.fillStyle = color
    ctx.fill()
  } else {
    ctx.strokeStyle = color
    ctx.lineWidth = theme.weights.medium * uiScale
    ctx.stroke()
  }
  
  ctx.restore()
}

/**
 * Draw a slot marker showing the default/raw position of a handle
 * Uses same stroke order as handles: light outer, dark inner
 */
function drawSlot(
  ctx: CanvasRenderingContext2D,
  point: Point,
  shape: HandleShape,
  theme: CanvasTheme,
  uiScale: number,
  isHovered: boolean = false
) {
  // Make slot smaller than handles - it's just a reference point
  const size = (theme.handle.size - 2) * uiScale
  
  ctx.save()
  
  // Build the shape path
  const buildPath = () => {
    ctx.beginPath()
    if (shape === 'diamond') {
      ctx.moveTo(point.x, point.y - size)
      ctx.lineTo(point.x + size, point.y)
      ctx.lineTo(point.x, point.y + size)
      ctx.lineTo(point.x - size, point.y)
      ctx.closePath()
    } else {
      ctx.arc(point.x, point.y, size * 0.7, 0, Math.PI * 2)
    }
  }
  
  // Layer 1: Light outer stroke (white halo for visibility)
  buildPath()
  ctx.strokeStyle = theme.handle.outerStroke
  ctx.lineWidth = (theme.handle.innerWidth + theme.handle.outerWidth * 2) * uiScale
  ctx.stroke()
  
  // Layer 2: Dark inner stroke
  buildPath()
  ctx.strokeStyle = theme.handle.innerStroke
  ctx.lineWidth = theme.handle.innerWidth * uiScale
  ctx.stroke()
  
  // Layer 3: Fill (accent when hovered, chrome otherwise)
  buildPath()
  ctx.fillStyle = isHovered ? theme.accent : theme.chrome
  ctx.fill()
  
  ctx.restore()
}

// ============================================================================
// TANGENT HANDLE RENDERING
// ============================================================================

/**
 * Render tangent handles for a selected circle
 */
function renderTangentHandles(
  ctx: CanvasRenderingContext2D,
  circle: CircleShape,
  circles: CircleShape[],
  shapeOrder: string[],
  hoverTarget: HoverTarget,
  theme: CanvasTheme,
  zoom: number,
  closedPath: boolean = true,
  useStartPoint: boolean = true,
  useEndPoint: boolean = true
) {
  const info = computeTangentHandleInfo(circle, circles, shapeOrder, closedPath, useStartPoint, useEndPoint)
  if (!info) return
  
  // Determine if this is the first or last circle in the path
  const orderIndex = shapeOrder.indexOf(circle.id)
  const isFirst = orderIndex === 0
  const isLast = orderIndex === shapeOrder.length - 1
  
  // Determine which handles to show based on path settings
  // For closed paths: always show all handles
  // For open paths:
  //   - First circle: has entry handles only if useStartPoint is true (wraps around circle)
  //   - First circle: always has exit handles (path starts here)
  //   - Last circle: always has entry handles (path arrives here)
  //   - Last circle: has exit handles only if useEndPoint is true (wraps around circle)
  // Length handles are hidden when:
  //   - It's a start/end extension point (no bezier connection)
  //   - The angle offset is 0 (no bezier curve, length has no effect)
  let showEntry = true
  let showExit = true
  let showEntryLength = info.hasEntryOffset  // Only show if offset is non-zero
  let showExitLength = info.hasExitOffset    // Only show if offset is non-zero
  
  if (!closedPath) {
    if (isFirst) {
      // First circle: entry only if useStartPoint (arc wraps around)
      showEntry = useStartPoint
      // Don't show entry length handle for start point (no bezier connection)
      showEntryLength = false
    }
    if (isLast) {
      // Last circle: exit only if useEndPoint (arc wraps around)
      showExit = useEndPoint
      // Don't show exit length handle for end point (no bezier connection)
      showExitLength = false
    }
  }
  
  // If nothing to show, return early
  if (!showEntry && !showExit) return
  
  const uiScale = 1 / zoom
  
  // Check hover states
  const isEntryOffsetHovered = hoverTarget?.type === 'entry-offset' && hoverTarget.shapeId === circle.id
  const isExitOffsetHovered = hoverTarget?.type === 'exit-offset' && hoverTarget.shapeId === circle.id
  const isEntryLengthHovered = hoverTarget?.type === 'entry-length' && hoverTarget.shapeId === circle.id
  const isExitLengthHovered = hoverTarget?.type === 'exit-length' && hoverTarget.shapeId === circle.id
  
  // Check slot hover states
  const isEntryOffsetSlotHovered = hoverTarget?.type === 'entry-offset-slot' && hoverTarget.shapeId === circle.id
  const isExitOffsetSlotHovered = hoverTarget?.type === 'exit-offset-slot' && hoverTarget.shapeId === circle.id
  const isEntryLengthSlotHovered = hoverTarget?.type === 'entry-length-slot' && hoverTarget.shapeId === circle.id
  const isExitLengthSlotHovered = hoverTarget?.type === 'exit-length-slot' && hoverTarget.shapeId === circle.id
  
  // Draw slots for offset handles (diamond shape - same as handle, no connecting line)
  if (showEntry && info.hasEntryOffset) {
    drawSlot(ctx, info.rawEntryPoint, 'diamond', theme, uiScale, isEntryOffsetSlotHovered)
  }
  if (showExit && info.hasExitOffset) {
    drawSlot(ctx, info.rawExitPoint, 'diamond', theme, uiScale, isExitOffsetSlotHovered)
  }
  
  // Draw slots for length handles (circle shape - same as handle, no connecting line)
  if (showEntryLength && info.hasEntryLengthOffset) {
    drawSlot(ctx, info.rawEntryLengthHandle, 'circle', theme, uiScale, isEntryLengthSlotHovered)
  }
  if (showExitLength && info.hasExitLengthOffset) {
    drawSlot(ctx, info.rawExitLengthHandle, 'circle', theme, uiScale, isExitLengthSlotHovered)
  }
  
  // Draw tangent lines to length handles (batched for performance)
  // Layer 1: White outer stroke (halo for visibility)
  ctx.strokeStyle = theme.handle.outerStroke
  ctx.lineWidth = (theme.handle.innerWidth + theme.handle.outerWidth * 2) * uiScale
  ctx.beginPath()
  
  if (showEntryLength) {
    ctx.moveTo(info.entryLengthHandle.x, info.entryLengthHandle.y)
    ctx.lineTo(info.entryPoint.x, info.entryPoint.y)
  }
  
  if (showExitLength) {
    ctx.moveTo(info.exitPoint.x, info.exitPoint.y)
    ctx.lineTo(info.exitLengthHandle.x, info.exitLengthHandle.y)
  }
  
  ctx.stroke()
  
  // Layer 2: Dark inner stroke (solid)
  ctx.strokeStyle = theme.handle.innerStroke
  ctx.lineWidth = theme.handle.innerWidth * uiScale
  ctx.beginPath()
  
  if (showEntryLength) {
    ctx.moveTo(info.entryLengthHandle.x, info.entryLengthHandle.y)
    ctx.lineTo(info.entryPoint.x, info.entryPoint.y)
  }
  
  if (showExitLength) {
    ctx.moveTo(info.exitPoint.x, info.exitPoint.y)
    ctx.lineTo(info.exitLengthHandle.x, info.exitLengthHandle.y)
  }
  
  ctx.stroke()
  
  // Draw entry point handle (filled diamond)
  if (showEntry) {
    drawHandle(ctx, info.entryPoint, 'diamond', 'filled', theme, uiScale, isEntryOffsetHovered)
  }
  
  // Draw exit point handle (filled diamond)
  if (showExit) {
    drawHandle(ctx, info.exitPoint, 'diamond', 'filled', theme, uiScale, isExitOffsetHovered)
  }
  
  // Draw entry length handle (filled circle) - not shown for start point
  if (showEntryLength) {
    drawHandle(ctx, info.entryLengthHandle, 'circle', 'filled', theme, uiScale, isEntryLengthHovered)
  }
  
  // Draw exit length handle (filled circle) - not shown for end point
  if (showExitLength) {
    drawHandle(ctx, info.exitLengthHandle, 'circle', 'filled', theme, uiScale, isExitLengthHovered)
  }
}

/**
 * Render ghost tangent handles for a mirrored circle
 * Uses the same styles as normal handles but with reduced opacity
 */
function renderGhostTangentHandles(
  ctx: CanvasRenderingContext2D,
  circle: CircleShape,
  circles: CircleShape[],
  shapeOrder: string[],
  theme: CanvasTheme,
  zoom: number,
  closedPath: boolean = true,
  useStartPoint: boolean = true,
  useEndPoint: boolean = true
) {
  const info = computeTangentHandleInfo(circle, circles, shapeOrder, closedPath, useStartPoint, useEndPoint)
  if (!info) return
  
  // Determine if this is the first or last circle in the path
  const orderIndex = shapeOrder.indexOf(circle.id)
  const isFirst = orderIndex === 0
  const isLast = orderIndex === shapeOrder.length - 1
  
  // Determine which handles to show based on path settings (same logic as renderTangentHandles)
  // Length handles are hidden when offset is 0 (no bezier curve)
  let showEntry = true
  let showExit = true
  let showEntryLength = info.hasEntryOffset  // Only show if offset is non-zero
  let showExitLength = info.hasExitOffset    // Only show if offset is non-zero
  
  if (!closedPath) {
    if (isFirst) {
      // First circle: entry only if useStartPoint (arc wraps around)
      showEntry = useStartPoint
      // Don't show entry length handle for start point (no bezier connection)
      showEntryLength = false
    }
    if (isLast) {
      // Last circle: exit only if useEndPoint (arc wraps around)
      showExit = useEndPoint
      // Don't show exit length handle for end point (no bezier connection)
      showExitLength = false
    }
  }
  
  // If nothing to show, return early
  if (!showEntry && !showExit) return
  
  const uiScale = 1 / zoom
  
  ctx.save()
  
  // Apply transparency to entire ghost handles (same as mirrored circles)
  ctx.globalAlpha = MIRRORED_OPACITY
  
  // Draw tangent lines (batched for performance)
  ctx.strokeStyle = theme.accent
  ctx.lineWidth = theme.weights.light * uiScale
  ctx.beginPath()
  
  if (showEntryLength) {
    ctx.moveTo(info.entryLengthHandle.x, info.entryLengthHandle.y)
    ctx.lineTo(info.entryPoint.x, info.entryPoint.y)
  }
  
  if (showExitLength) {
    ctx.moveTo(info.exitPoint.x, info.exitPoint.y)
    ctx.lineTo(info.exitLengthHandle.x, info.exitLengthHandle.y)
  }
  
  ctx.stroke()
  
  // Draw handles using the same drawHandle function (same style as normal)
  // Entry offset handle (diamond, filled)
  if (showEntry) {
    drawHandle(ctx, info.entryPoint, 'diamond', 'filled', theme, uiScale, false)
  }
  
  // Exit offset handle (diamond, filled)
  if (showExit) {
    drawHandle(ctx, info.exitPoint, 'diamond', 'filled', theme, uiScale, false)
  }
  
  // Entry length handle (circle, filled) - not shown for start point
  if (showEntryLength) {
    drawHandle(ctx, info.entryLengthHandle, 'circle', 'filled', theme, uiScale, false)
  }
  
  // Exit length handle (circle, filled) - not shown for end point
  if (showExitLength) {
    drawHandle(ctx, info.exitLengthHandle, 'circle', 'filled', theme, uiScale, false)
  }
  
  ctx.restore()
}

