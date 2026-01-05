import type { Shape, CircleShape, Point, CanvasTheme, HoverTarget } from '../../../types'
import { getTangentForWrapSides } from '../../../geometry/tangent'
import { pointOnCircle, distance } from '../../../geometry/math'
import { getMirroredCircles, createMirroredCircle, expandMirroredCircles } from '../../../geometry/path'
import {
  EDGE_OUTER,
  EDGE_INNER,
  DIRECTION_RING_OUTER,
  DIRECTION_RING_INNER,
  DIRECTION_RING_RADIUS,
  DOT_SIZE,
  DOT_SPACING,
  DOT_GRID_Y_OFFSET,
  MAX_DOT_COLS,
  CHEVRON_TARGET_SPACING,
  CHEVRON_MIN_SCREEN_SIZE,
  CHEVRON_MAX_SCREEN_SIZE,
  CHEVRON_PROPORTIONAL_SIZE,
  DELETE_ICON_SIZE,
  DELETE_ICON_Y_OFFSET,
  HANDLE_TOLERANCE,
  SLOT_TOLERANCE_FACTOR,
  MIRRORED_OPACITY,
  TANGENT_DISTANCE_FACTOR
} from '../../../constants'

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
        totalShapes: isInOrder ? totalShapes : undefined
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
        totalShapes: isInOrder ? totalShapes : undefined
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
  zoom: number
) {
  const circles = shapes.filter((s): s is CircleShape => s.type === 'circle')
  const selectedCircles = circles.filter(c => selectedIds.includes(c.id))
  
  // Get expanded shapes and order (including mirrored circles)
  const { expandedShapes, expandedOrder } = expandMirroredCircles(circles, shapeOrder)
  
  // First render ghost handles for mirrored versions of selected circles
  for (const circle of selectedCircles) {
    if (circle.mirrored) {
      const mirroredCircle = createMirroredCircle(circle)
      renderGhostTangentHandles(ctx, mirroredCircle, expandedShapes, expandedOrder, theme, zoom)
    }
  }
  
  // Then render normal handles for selected circles (on top)
  for (const circle of selectedCircles) {
    renderTangentHandles(ctx, circle, expandedShapes, expandedOrder, hoverTarget, theme, zoom)
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
}

function renderCircle(
  ctx: CanvasRenderingContext2D,
  circle: CircleShape,
  options: CircleRenderOptions
) {
  const { center, radius } = circle
  const { theme, isSelected, isHovered, hoverTarget, zoom, shapeIndex, totalShapes } = options
  
  const uiScale = 1 / zoom
  
  // Check if specific elements are hovered
  const isEdgeHovered = hoverTarget?.type === 'shape-edge' && hoverTarget.shapeId === circle.id
  const isRingHovered = hoverTarget?.type === 'direction-ring' && hoverTarget.shapeId === circle.id
  const isDeleteHovered = hoverTarget?.type === 'delete-icon' && hoverTarget.shapeId === circle.id
  
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
  
  // Draw delete icon when selected (below the dot grid)
  if (isSelected) {
    drawDeleteIcon(ctx, { x: center.x, y: center.y + DELETE_ICON_Y_OFFSET * uiScale }, theme, zoom, isDeleteHovered)
  }
}

/**
 * Check if a point is in the edge/scale zone (proportional to radius)
 * Zone is between EDGE_INNER and EDGE_OUTER of radius
 */
export function isOnEdgeZone(
  circle: CircleShape,
  point: Point
): boolean {
  const { center, radius } = circle
  const dx = point.x - center.x
  const dy = point.y - center.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  
  const innerRadius = radius * EDGE_INNER
  const outerRadius = radius * EDGE_OUTER
  
  return dist >= innerRadius && dist <= outerRadius
}

/**
 * Check if a point is in the body/move zone (inside direction ring)
 */
export function isInBodyZone(
  circle: CircleShape,
  point: Point
): boolean {
  const { center, radius } = circle
  const dx = point.x - center.x
  const dy = point.y - center.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  
  return dist < radius * DIRECTION_RING_INNER
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
  const { center, radius, wrapSide } = circle
  const pathGoesClockwise = (wrapSide ?? 'right') !== 'right'
  
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
  
  // Draw chevrons around the FULL circle (360 degrees)
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
  
  ctx.beginPath()
    ctx.moveTo(
      cx + chevronSize * Math.cos(chevronAngle1),
      cy + chevronSize * Math.sin(chevronAngle1)
    )
    ctx.lineTo(cx, cy)
  ctx.lineTo(
      cx + chevronSize * Math.cos(chevronAngle2),
      cy + chevronSize * Math.sin(chevronAngle2)
  )
  ctx.stroke()
  }
  
  ctx.restore()
}

/**
 * Check if a point is in the direction ring zone
 * Zone is between DIRECTION_RING_INNER and DIRECTION_RING_OUTER of radius
 */
export function isOnDirectionRing(
  circle: CircleShape,
  point: Point
): boolean {
  const { center, radius } = circle
  const dx = point.x - center.x
  const dy = point.y - center.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  
  const innerRadius = radius * DIRECTION_RING_INNER
  const outerRadius = radius * DIRECTION_RING_OUTER
  
  return dist >= innerRadius && dist <= outerRadius
}

// Keep old function name for backwards compatibility
export const isOnDirectionArrow = isOnDirectionRing

// ============================================================================
// DELETE ICON
// ============================================================================

/**
 * Draw a delete icon (X) in the center of a selected circle
 * Uses double-stroke for visibility on any background
 */
function drawDeleteIcon(
  ctx: CanvasRenderingContext2D,
  center: Point,
  theme: CanvasTheme,
  zoom: number,
  isHovered: boolean
) {
  const uiScale = 1 / zoom
  const size = DELETE_ICON_SIZE * uiScale
  
  ctx.save()
  
  // Determine color based on hover state
  const color = isHovered ? theme.danger : theme.accentDim
  
  // Double-stroke for visibility
  // Outer stroke (halo)
  ctx.strokeStyle = theme.handle.outerStroke
  ctx.lineWidth = (theme.weights.medium + 2) * uiScale
  ctx.lineCap = 'round'
  
  ctx.beginPath()
  ctx.moveTo(center.x - size, center.y - size)
  ctx.lineTo(center.x + size, center.y + size)
  ctx.moveTo(center.x + size, center.y - size)
  ctx.lineTo(center.x - size, center.y + size)
  ctx.stroke()
  
  // Inner stroke (color)
  ctx.strokeStyle = color
  ctx.lineWidth = theme.weights.medium * uiScale
  
  ctx.beginPath()
  ctx.moveTo(center.x - size, center.y - size)
  ctx.lineTo(center.x + size, center.y + size)
  ctx.moveTo(center.x + size, center.y - size)
  ctx.lineTo(center.x - size, center.y + size)
  ctx.stroke()
  
  ctx.restore()
}

/**
 * Check if a point is on the delete icon
 * Note: Delete icon is offset down when order controls are shown
 */
export function isOnDeleteIcon(
  circle: CircleShape,
  point: Point,
  zoom: number,
  hasOrderControls: boolean = true
): boolean {
  const tolerance = HANDLE_TOLERANCE / zoom
  const uiScale = 1 / zoom
  const deleteY = hasOrderControls ? circle.center.y + (DELETE_ICON_Y_OFFSET + 2) * uiScale : circle.center.y
  const dx = point.x - circle.center.x
  const dy = point.y - deleteY
  const dist = Math.sqrt(dx * dx + dy * dy)
  return dist <= tolerance
}

/**
 * Calculate the grid layout for N items
 * Max columns based on constant, then wrap to new rows
 */
function calculateGridLayout(total: number): { cols: number; rows: number } {
  if (total <= 0) return { cols: 0, rows: 0 }
  if (total <= MAX_DOT_COLS) return { cols: total, rows: 1 }
  
  // More than MAX_DOT_COLS: use MAX_DOT_COLS columns and wrap
  const cols = MAX_DOT_COLS
  const rows = Math.ceil(total / cols)
  return { cols, rows }
}

/**
 * Get the position of a dot at a given index in the grid
 * Each row is centered independently
 */
export function getDotPosition(
  center: Point,
  index: number,
  total: number,
  zoom: number
): Point {
  const uiScale = 1 / zoom
  const spacing = DOT_SPACING * uiScale
  const yOffset = DOT_GRID_Y_OFFSET * uiScale
  
  const { cols, rows } = calculateGridLayout(total)
  
  // Calculate row and column for this index
  const row = Math.floor(index / cols)
  const col = index % cols
  
  // Calculate how many items are in this specific row
  const itemsInThisRow = row < rows - 1 
    ? cols  // Full row
    : total - (rows - 1) * cols  // Last row may be partial
  
  // Calculate grid height (for vertical centering)
  const gridHeight = (rows - 1) * spacing
  
  // Calculate this row's width (for horizontal centering of this row)
  const rowWidth = (itemsInThisRow - 1) * spacing
  
  // Calculate position (each row centered independently)
  const x = center.x - rowWidth / 2 + col * spacing
  const y = center.y + yOffset - gridHeight / 2 + row * spacing
  
  return { x, y }
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
      // Hovered dot (can click to swap) - accent outline
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

/**
 * Check if a point is on an index dot
 * Returns the dot index if hit, or null
 */
export function getIndexDotAt(
  circle: CircleShape,
  point: Point,
  totalShapes: number,
  zoom: number
): number | null {
  const uiScale = 1 / zoom
  const hitRadius = (DOT_SIZE / 2 + 2) * uiScale // Slightly larger hit area
  
  for (let i = 0; i < totalShapes; i++) {
    const dotPos = getDotPosition(circle.center, i, totalShapes, zoom)
    const dx = point.x - dotPos.x
    const dy = point.y - dotPos.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    
    if (dist <= hitRadius) {
      return i
    }
  }
  
  return null
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
// TANGENT HANDLE INFO
// ============================================================================

/**
 * Information about a circle's tangent points in the path
 */
export interface TangentHandleInfo {
  entryPoint: Point
  entryAngle: number
  entryTangentDir: Point
  entryLengthHandle: Point
  rawEntryPoint: Point          // Default position when offset = 0
  rawEntryLengthHandle: Point   // Default position when length = 1.0
  
  exitPoint: Point
  exitAngle: number
  exitTangentDir: Point
  exitLengthHandle: Point
  rawExitPoint: Point           // Default position when offset = 0
  rawExitLengthHandle: Point    // Default position when length = 1.0
  
  hasEntryOffset: boolean
  hasExitOffset: boolean
  hasEntryLengthOffset: boolean
  hasExitLengthOffset: boolean
}

/**
 * Compute tangent handle information for a circle in the path
 */
export function computeTangentHandleInfo(
  circle: CircleShape,
  circles: CircleShape[],
  shapeOrder: string[]
): TangentHandleInfo | null {
  const orderIndex = shapeOrder.indexOf(circle.id)
  if (orderIndex === -1) return null
  
  const n = shapeOrder.length
  if (n < 2) return null
  
  const prevIndex = (orderIndex - 1 + n) % n
  const nextIndex = (orderIndex + 1) % n
  
  const prevCircle = circles.find(c => c.id === shapeOrder[prevIndex])
  const nextCircle = circles.find(c => c.id === shapeOrder[nextIndex])
  
  if (!prevCircle || !nextCircle) return null
  
  const clockwise = (circle.wrapSide ?? 'right') === 'right'
  
  const entryTangent = getTangentForWrapSides(
    prevCircle.center, prevCircle.radius, prevCircle.wrapSide ?? 'right',
    circle.center, circle.radius, circle.wrapSide ?? 'right'
  )
  
  const exitTangent = getTangentForWrapSides(
    circle.center, circle.radius, circle.wrapSide ?? 'right',
    nextCircle.center, nextCircle.radius, nextCircle.wrapSide ?? 'right'
  )
  
  if (!entryTangent || !exitTangent) return null
  
  const baseEntryAngle = entryTangent.angle2
  const baseExitAngle = exitTangent.angle1
  
  const entryOffsetAmount = circle.entryOffset ?? 0
  const exitOffsetAmount = circle.exitOffset ?? 0
  const offsetDir = clockwise ? 1 : -1
  
  const entryAngle = baseEntryAngle + entryOffsetAmount * offsetDir
  const exitAngle = baseExitAngle + exitOffsetAmount * offsetDir
  
  const entryPoint = pointOnCircle(circle.center, circle.radius, entryAngle)
  const exitPoint = pointOnCircle(circle.center, circle.radius, exitAngle)
  
  const rawEntryPoint = pointOnCircle(circle.center, circle.radius, baseEntryAngle)
  const rawExitPoint = pointOnCircle(circle.center, circle.radius, baseExitAngle)
  
  const hasEntryOffset = Math.abs(entryOffsetAmount) > 0.001
  const hasExitOffset = Math.abs(exitOffsetAmount) > 0.001
  
  const entryTangentOffset = clockwise ? -Math.PI / 2 : Math.PI / 2
  const exitTangentOffset = clockwise ? -Math.PI / 2 : Math.PI / 2
  
  const entryTangentAngle = entryAngle + entryTangentOffset
  const exitTangentAngle = exitAngle + exitTangentOffset
  
  const entryTangentDir: Point = {
    x: Math.cos(entryTangentAngle),
    y: Math.sin(entryTangentAngle)
  }
  
  const exitTangentDir: Point = {
    x: Math.cos(exitTangentAngle),
    y: Math.sin(exitTangentAngle)
  }
  
  const entryTangentLength = circle.entryTangentLength ?? 1.0
  const exitTangentLength = circle.exitTangentLength ?? 1.0
  
  const entryDist = distance(prevCircle.center, circle.center) * TANGENT_DISTANCE_FACTOR
  const exitDist = distance(circle.center, nextCircle.center) * TANGENT_DISTANCE_FACTOR
  
  // Current length handle positions (with user's length multiplier)
  const entryLengthHandle: Point = {
    x: entryPoint.x - entryTangentDir.x * entryDist * entryTangentLength,
    y: entryPoint.y - entryTangentDir.y * entryDist * entryTangentLength
  }
  
  const exitLengthHandle: Point = {
    x: exitPoint.x + exitTangentDir.x * exitDist * exitTangentLength,
    y: exitPoint.y + exitTangentDir.y * exitDist * exitTangentLength
  }
  
  // Raw (default) length handle positions (when length = 1.0)
  const rawEntryLengthHandle: Point = {
    x: entryPoint.x - entryTangentDir.x * entryDist,
    y: entryPoint.y - entryTangentDir.y * entryDist
  }
  
  const rawExitLengthHandle: Point = {
    x: exitPoint.x + exitTangentDir.x * exitDist,
    y: exitPoint.y + exitTangentDir.y * exitDist
  }
  
  // Check if length has been modified from default
  const hasEntryLengthOffset = Math.abs(entryTangentLength - 1.0) > 0.01
  const hasExitLengthOffset = Math.abs(exitTangentLength - 1.0) > 0.01
  
  return {
    entryPoint,
    entryAngle: baseEntryAngle,
    entryTangentDir,
    entryLengthHandle,
    rawEntryPoint,
    rawEntryLengthHandle,
    exitPoint,
    exitAngle: baseExitAngle,
    exitTangentDir,
    exitLengthHandle,
    rawExitPoint,
    rawExitLengthHandle,
    hasEntryOffset,
    hasExitOffset,
    hasEntryLengthOffset,
    hasExitLengthOffset
  }
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
  zoom: number
) {
  const info = computeTangentHandleInfo(circle, circles, shapeOrder)
  if (!info) return
  
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
  if (info.hasEntryOffset) {
    drawSlot(ctx, info.rawEntryPoint, 'diamond', theme, uiScale, isEntryOffsetSlotHovered)
  }
  if (info.hasExitOffset) {
    drawSlot(ctx, info.rawExitPoint, 'diamond', theme, uiScale, isExitOffsetSlotHovered)
  }
  
  // Draw slots for length handles (circle shape - same as handle, no connecting line)
  if (info.hasEntryLengthOffset) {
    drawSlot(ctx, info.rawEntryLengthHandle, 'circle', theme, uiScale, isEntryLengthSlotHovered)
  }
  if (info.hasExitLengthOffset) {
    drawSlot(ctx, info.rawExitLengthHandle, 'circle', theme, uiScale, isExitLengthSlotHovered)
  }
  
  // Draw tangent lines to length handles
  // Layer 1: White outer stroke (halo for visibility)
  ctx.strokeStyle = theme.handle.outerStroke
  ctx.lineWidth = (theme.handle.innerWidth + theme.handle.outerWidth * 2) * uiScale
  
  ctx.beginPath()
  ctx.moveTo(info.entryLengthHandle.x, info.entryLengthHandle.y)
  ctx.lineTo(info.entryPoint.x, info.entryPoint.y)
  ctx.stroke()
  
  ctx.beginPath()
  ctx.moveTo(info.exitPoint.x, info.exitPoint.y)
  ctx.lineTo(info.exitLengthHandle.x, info.exitLengthHandle.y)
  ctx.stroke()
  
  // Layer 2: Dark inner stroke (solid)
  ctx.strokeStyle = theme.handle.innerStroke
  ctx.lineWidth = theme.handle.innerWidth * uiScale
  
  ctx.beginPath()
  ctx.moveTo(info.entryLengthHandle.x, info.entryLengthHandle.y)
  ctx.lineTo(info.entryPoint.x, info.entryPoint.y)
  ctx.stroke()
  
  ctx.beginPath()
  ctx.moveTo(info.exitPoint.x, info.exitPoint.y)
  ctx.lineTo(info.exitLengthHandle.x, info.exitLengthHandle.y)
  ctx.stroke()
  
  // Draw entry point handle (filled diamond)
  drawHandle(ctx, info.entryPoint, 'diamond', 'filled', theme, uiScale, isEntryOffsetHovered)
  
  // Draw exit point handle (filled diamond)
  drawHandle(ctx, info.exitPoint, 'diamond', 'filled', theme, uiScale, isExitOffsetHovered)
  
  // Draw entry length handle (filled circle)
  drawHandle(ctx, info.entryLengthHandle, 'circle', 'filled', theme, uiScale, isEntryLengthHovered)
  
  // Draw exit length handle (filled circle)
  drawHandle(ctx, info.exitLengthHandle, 'circle', 'filled', theme, uiScale, isExitLengthHovered)
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
  zoom: number
) {
  const info = computeTangentHandleInfo(circle, circles, shapeOrder)
  if (!info) return
  
  const uiScale = 1 / zoom
  
  ctx.save()
  
  // Apply transparency to entire ghost handles (same as mirrored circles)
  ctx.globalAlpha = MIRRORED_OPACITY
  
  // Draw tangent lines (same style as normal)
  ctx.strokeStyle = theme.accent
  ctx.lineWidth = theme.weights.light * uiScale
  
  ctx.beginPath()
  ctx.moveTo(info.entryLengthHandle.x, info.entryLengthHandle.y)
  ctx.lineTo(info.entryPoint.x, info.entryPoint.y)
  ctx.stroke()
  
  ctx.beginPath()
  ctx.moveTo(info.exitPoint.x, info.exitPoint.y)
  ctx.lineTo(info.exitLengthHandle.x, info.exitLengthHandle.y)
  ctx.stroke()
  
  // Draw handles using the same drawHandle function (same style as normal)
  // Entry offset handle (diamond, filled)
  drawHandle(ctx, info.entryPoint, 'diamond', 'filled', theme, uiScale, false)
  
  // Exit offset handle (diamond, filled)
  drawHandle(ctx, info.exitPoint, 'diamond', 'filled', theme, uiScale, false)
  
  // Entry length handle (circle, filled)
  drawHandle(ctx, info.entryLengthHandle, 'circle', 'filled', theme, uiScale, false)
  
  // Exit length handle (circle, filled)
  drawHandle(ctx, info.exitLengthHandle, 'circle', 'filled', theme, uiScale, false)
  
  ctx.restore()
}

// ============================================================================
// HIT TESTING
// ============================================================================

export type TangentHandleType = 
  | 'entry-offset' 
  | 'exit-offset' 
  | 'entry-length' 
  | 'exit-length' 
  | 'entry-offset-slot'
  | 'exit-offset-slot'
  | 'entry-length-slot'
  | 'exit-length-slot'
  | null

export function getTangentHandleAt(
  circle: CircleShape,
  circles: CircleShape[],
  shapeOrder: string[],
  point: Point,
  tolerance: number
): TangentHandleType {
  const info = computeTangentHandleInfo(circle, circles, shapeOrder)
  if (!info) return null
  
  // Check handles first (they're on top)
  if (distance(point, info.entryPoint) <= tolerance) {
    return 'entry-offset'
  }
  
  if (distance(point, info.exitPoint) <= tolerance) {
    return 'exit-offset'
  }
  
  if (distance(point, info.entryLengthHandle) <= tolerance) {
    return 'entry-length'
  }
  
  if (distance(point, info.exitLengthHandle) <= tolerance) {
    return 'exit-length'
  }
  
  // Check slots (only exist when there's an offset from default)
  // Slots are smaller, so use smaller tolerance
  const slotTolerance = tolerance * SLOT_TOLERANCE_FACTOR
  
  if (info.hasEntryOffset && distance(point, info.rawEntryPoint) <= slotTolerance) {
    return 'entry-offset-slot'
  }
  
  if (info.hasExitOffset && distance(point, info.rawExitPoint) <= slotTolerance) {
    return 'exit-offset-slot'
  }
  
  if (info.hasEntryLengthOffset && distance(point, info.rawEntryLengthHandle) <= slotTolerance) {
    return 'entry-length-slot'
  }
  
  if (info.hasExitLengthOffset && distance(point, info.rawExitLengthHandle) <= slotTolerance) {
    return 'exit-length-slot'
  }
  
  return null
}
