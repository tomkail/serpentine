/**
 * Hit testing functions for canvas interactions
 * Extracted from ShapeRenderer.ts for better code organization
 */

import type { CircleShape, Point } from '../../../types'
import { distance, pointOnCircle } from '../../../geometry/math'
import { getTangentForDirections } from '../../../geometry/tangent'
import {
  EDGE_OUTER,
  EDGE_INNER,
  DIRECTION_RING_OUTER,
  DIRECTION_RING_INNER,
  DOT_SIZE,
  DOT_SPACING,
  DOT_GRID_Y_OFFSET,
  MAX_DOT_COLS,
  ACTION_ROW_OFFSET,
  ACTION_ICON_SPACING,
  HANDLE_TOLERANCE,
  SLOT_TOLERANCE_FACTOR,
  TANGENT_DISTANCE_FACTOR,
  CHEVRON_MAX_SCREEN_SIZE,
  UI_FADE_START_RATIO,
  UI_FADE_END_RATIO,
  DIRECTION_RING_SIZE_MULTIPLIER
} from '../../../constants'

// ============================================================================
// UI ELEMENT VISIBILITY (fade based on zoom)
// ============================================================================

/**
 * Compute a compact, symmetrical row layout for N dots.
 * Returns an array of row sizes, e.g.:
 *   3 → [2, 1]
 *   4 → [2, 2]
 *   5 → [3, 2]
 *   6 → [3, 3]
 *   7 → [2, 3, 2]
 *   8 → [3, 2, 3]
 *   etc.
 */
export function computeRowLayout(total: number): number[] {
  if (total <= 0) return []
  if (total === 1) return [1]
  if (total === 2) return [2]
  
  // For 3-6: use 2 rows, bigger row on top
  if (total <= 6) {
    return [Math.ceil(total / 2), Math.floor(total / 2)]
  }
  
  // For 7-15: use 3 rows, diamond pattern
  // Middle row gets extra if remainder is 1, outer rows get extras if remainder is 2
  if (total <= 15) {
    const base = Math.floor(total / 3)
    const rem = total % 3
    if (rem === 0) return [base, base, base]
    if (rem === 1) return [base, base + 1, base]
    return [base + 1, base, base + 1]
  }
  
  // For 16-24: use 4 rows, diamond pattern (inner rows larger)
  if (total <= 24) {
    const base = Math.floor(total / 4)
    const rem = total % 4
    const rows = [base, base, base, base]
    // Distribute remainder: inner rows first (indices 1, 2), then outer (0, 3)
    const order = [1, 2, 0, 3]
    for (let i = 0; i < rem; i++) {
      rows[order[i]]++
    }
    return rows
  }
  
  // For 25+: use 5 rows, diamond pattern (center row first)
  const base = Math.floor(total / 5)
  const rem = total % 5
  const rows = [base, base, base, base, base]
  // Distribute remainder: center first, then spreading out
  const order = [2, 1, 3, 0, 4]
  for (let i = 0; i < rem; i++) {
    rows[order[i]]++
  }
  return rows
}

/**
 * Calculate the width of the dot grid based on number of items
 * Uses the maximum row width from the computed row layout
 */
function calculateDotGridWidth(total: number): number {
  if (total <= 0) return 0
  const rowLayout = computeRowLayout(total)
  const maxRowSize = Math.max(...rowLayout)
  return (maxRowSize - 1) * DOT_SPACING + DOT_SIZE
}

/**
 * Calculate the opacity for index dots based on zoom level and circle radius
 * Dots fade out when the dot grid becomes larger than 50% of the circle's visual size
 * Returns a value from 0 (invisible) to 1 (fully visible)
 */
export function getIndexDotOpacity(radius: number, zoom: number, totalShapes: number = MAX_DOT_COLS): number {
  // Dot grid width in screen pixels (constant, doesn't change with zoom)
  const gridWidthScreen = calculateDotGridWidth(totalShapes)
  // Circle diameter in screen pixels: 2 * radius * zoom
  const circleDiameterScreen = 2 * radius * zoom
  // Ratio of grid size to circle size
  const ratio = gridWidthScreen / circleDiameterScreen
  
  // Fade from fully visible to invisible as ratio goes from START to END
  if (ratio <= UI_FADE_START_RATIO) return 1
  if (ratio >= UI_FADE_END_RATIO) return 0
  
  // Linear interpolation between thresholds
  return 1 - (ratio - UI_FADE_START_RATIO) / (UI_FADE_END_RATIO - UI_FADE_START_RATIO)
}

/**
 * Calculate the opacity for direction ring (chevrons) based on zoom level and circle radius
 * Direction arrows fade out when they become too prominent relative to the circle
 * The multiplier accounts for the visual density of many chevrons around the ring
 * Returns a value from 0 (invisible) to 1 (fully visible)
 */
export function getDirectionRingOpacity(radius: number, zoom: number): number {
  // Effective size accounts for the visual density of the chevron ring
  // The ring has many chevrons so it appears larger than individual chevron size
  const effectiveSize = CHEVRON_MAX_SCREEN_SIZE * DIRECTION_RING_SIZE_MULTIPLIER
  // Circle diameter in screen pixels: 2 * radius * zoom
  const circleDiameterScreen = 2 * radius * zoom
  const ratio = effectiveSize / circleDiameterScreen
  
  // Fade from fully visible to invisible as ratio goes from START to END
  if (ratio <= UI_FADE_START_RATIO) return 1
  if (ratio >= UI_FADE_END_RATIO) return 0
  
  // Linear interpolation between thresholds
  return 1 - (ratio - UI_FADE_START_RATIO) / (UI_FADE_END_RATIO - UI_FADE_START_RATIO)
}

/**
 * Check if index dots are interactable at current zoom/radius
 */
export function areIndexDotsInteractable(radius: number, zoom: number, totalShapes: number = MAX_DOT_COLS): boolean {
  return getIndexDotOpacity(radius, zoom, totalShapes) > 0
}

/**
 * Check if direction ring is interactable at current zoom/radius
 */
export function isDirectionRingInteractable(radius: number, zoom: number): boolean {
  return getDirectionRingOpacity(radius, zoom) > 0
}

// ============================================================================
// SHAPE ZONE HIT TESTING
// ============================================================================

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
 * When the direction ring is faded out, the body zone expands to include
 * the direction ring area, allowing users to move the circle by clicking
 * anywhere inside the edge zone.
 */
export function isInBodyZone(
  circle: CircleShape,
  point: Point,
  zoom: number = 1
): boolean {
  const { center, radius } = circle
  const dx = point.x - center.x
  const dy = point.y - center.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  
  // When direction ring is not interactable (faded out), expand body zone
  // to include the direction ring area (up to DIRECTION_RING_OUTER)
  const outerBoundary = isDirectionRingInteractable(radius, zoom)
    ? DIRECTION_RING_INNER
    : DIRECTION_RING_OUTER
  
  return dist < radius * outerBoundary
}

/**
 * Check if a point is in the direction ring zone
 * Zone is between DIRECTION_RING_INNER and DIRECTION_RING_OUTER of radius
 * Returns false if the direction ring has faded out due to zoom level
 */
export function isOnDirectionRing(
  circle: CircleShape,
  point: Point,
  zoom: number = 1
): boolean {
  const { center, radius } = circle
  
  // Check if direction ring is interactable at this zoom level
  if (!isDirectionRingInteractable(radius, zoom)) {
    return false
  }
  
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
// ACTION ROW HIT TESTING (Mirror + Delete icons)
// ============================================================================

/**
 * Get the Y position of the action row for a circle
 */
function getActionRowY(circle: CircleShape, zoom: number): number {
  const uiScale = 1 / zoom
  return circle.center.y + circle.radius + ACTION_ROW_OFFSET * uiScale
}

/**
 * Check if a point is on the delete icon
 * Action row is positioned below the circle
 */
export function isOnDeleteIcon(
  circle: CircleShape,
  point: Point,
  zoom: number,
  _hasOrderControls: boolean = true  // Legacy param, kept for API compatibility
): boolean {
  const tolerance = HANDLE_TOLERANCE / zoom
  const uiScale = 1 / zoom
  const rowY = getActionRowY(circle, zoom)
  const deleteX = circle.center.x + (ACTION_ICON_SPACING / 2) * uiScale
  
  const dx = point.x - deleteX
  const dy = point.y - rowY
  const dist = Math.sqrt(dx * dx + dy * dy)
  return dist <= tolerance
}

/**
 * Check if a point is on the mirror icon
 * Action row is positioned below the circle
 */
export function isOnMirrorIcon(
  circle: CircleShape,
  point: Point,
  zoom: number
): boolean {
  const tolerance = HANDLE_TOLERANCE / zoom
  const uiScale = 1 / zoom
  const rowY = getActionRowY(circle, zoom)
  const mirrorX = circle.center.x - (ACTION_ICON_SPACING / 2) * uiScale
  
  const dx = point.x - mirrorX
  const dy = point.y - rowY
  const dist = Math.sqrt(dx * dx + dy * dy)
  return dist <= tolerance
}

// ============================================================================
// INDEX DOT GRID HIT TESTING
// ============================================================================

/**
 * Get the position of a dot at a given index in the grid
 * Uses the compact symmetrical row layout
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
  
  const rowLayout = computeRowLayout(total)
  const numRows = rowLayout.length
  
  // Find which row this index belongs to and the column within that row
  let row = 0
  let col = index
  let itemsBeforeThisRow = 0
  
  for (let r = 0; r < rowLayout.length; r++) {
    if (col < rowLayout[r]) {
      row = r
      break
    }
    col -= rowLayout[r]
    itemsBeforeThisRow += rowLayout[r]
  }
  
  const itemsInThisRow = rowLayout[row]
  
  // Calculate grid height (for vertical centering)
  const gridHeight = (numRows - 1) * spacing
  
  // Calculate this row's width (for horizontal centering of this row)
  const rowWidth = (itemsInThisRow - 1) * spacing
  
  // Calculate position (each row centered independently)
  const x = center.x - rowWidth / 2 + col * spacing
  const y = center.y + yOffset - gridHeight / 2 + row * spacing
  
  return { x, y }
}

/**
 * Check if a point is on an index dot
 * Returns the dot index if hit, or null
 * Returns null if index dots have faded out due to zoom level
 * 
 * Uses a "closest dot within grid bounds" approach to ensure no gaps
 * between clickable areas - any click within the grid area selects
 * the nearest dot.
 */
export function getIndexDotAt(
  circle: CircleShape,
  point: Point,
  totalShapes: number,
  zoom: number
): number | null {
  // Check if index dots are interactable at this zoom level
  if (!areIndexDotsInteractable(circle.radius, zoom, totalShapes)) {
    return null
  }
  
  if (totalShapes <= 0) return null
  
  const uiScale = 1 / zoom
  const spacing = DOT_SPACING * uiScale
  const yOffset = DOT_GRID_Y_OFFSET * uiScale
  const dotRadius = (DOT_SIZE / 2) * uiScale
  
  const rowLayout = computeRowLayout(totalShapes)
  const numRows = rowLayout.length
  const maxRowSize = Math.max(...rowLayout)
  
  // Calculate grid bounds
  const gridHeight = (numRows - 1) * spacing
  const maxRowWidth = (maxRowSize - 1) * spacing
  const gridCenterY = circle.center.y + yOffset
  
  // Expand bounds by half spacing + dot radius to cover full clickable area
  const margin = spacing / 2 + dotRadius
  const gridTop = gridCenterY - gridHeight / 2 - margin
  const gridBottom = gridCenterY + gridHeight / 2 + margin
  const gridLeft = circle.center.x - maxRowWidth / 2 - margin
  const gridRight = circle.center.x + maxRowWidth / 2 + margin
  
  // Quick bounds check - reject if clearly outside grid area
  if (point.y < gridTop || point.y > gridBottom ||
      point.x < gridLeft || point.x > gridRight) {
    return null
  }
  
  // Find the closest dot
  let closestDot = -1
  let closestDistSq = Infinity
  
  for (let i = 0; i < totalShapes; i++) {
    const dotPos = getDotPosition(circle.center, i, totalShapes, zoom)
    const dx = point.x - dotPos.x
    const dy = point.y - dotPos.y
    const distSq = dx * dx + dy * dy
    
    if (distSq < closestDistSq) {
      closestDistSq = distSq
      closestDot = i
    }
  }
  
  // Return closest dot if within reasonable range
  // Use generous hit radius that covers the diagonal between dots
  // This ensures no gaps in the clickable area
  const maxHitRadius = spacing * 0.75 + dotRadius
  
  if (closestDot >= 0 && closestDistSq <= maxHitRadius * maxHitRadius) {
    return closestDot
  }
  
  return null
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
  shapeOrder: string[],
  closedPath: boolean = true,
  useStartPoint: boolean = true,
  useEndPoint: boolean = true
): TangentHandleInfo | null {
  const orderIndex = shapeOrder.indexOf(circle.id)
  if (orderIndex === -1) return null
  
  const n = shapeOrder.length
  if (n < 2) return null
  
  const isFirst = orderIndex === 0
  const isLast = orderIndex === n - 1
  
  const prevIndex = (orderIndex - 1 + n) % n
  const nextIndex = (orderIndex + 1) % n
  
  // Build map for O(1) lookup
  const circleMap = new Map(circles.map(c => [c.id, c]))
  const prevCircle = circleMap.get(shapeOrder[prevIndex])
  const nextCircle = circleMap.get(shapeOrder[nextIndex])
  
  if (!prevCircle || !nextCircle) return null
  
  const clockwise = (circle.direction ?? 'cw') === 'cw'
  
  const entryTangent = getTangentForDirections(
    prevCircle.center, prevCircle.radius, prevCircle.direction ?? 'cw',
    circle.center, circle.radius, circle.direction ?? 'cw'
  )
  
  const exitTangent = getTangentForDirections(
    circle.center, circle.radius, circle.direction ?? 'cw',
    nextCircle.center, nextCircle.radius, nextCircle.direction ?? 'cw'
  )
  
  if (!entryTangent || !exitTangent) return null
  
  // Base angles from tangent computation
  let baseEntryAngle = entryTangent.angle2
  let baseExitAngle = exitTangent.angle1
  
  // For open paths with useStartPoint/useEndPoint enabled, use opposite side of the circle
  // instead of calculating from the wrap-around tangent (which doesn't exist logically)
  if (!closedPath && isFirst && useStartPoint) {
    // First circle in open path: set entry angle opposite to exit angle
    baseEntryAngle = baseExitAngle + Math.PI
  }
  if (!closedPath && isLast && useEndPoint) {
    // Last circle in open path: set exit angle opposite to entry angle
    baseExitAngle = baseEntryAngle + Math.PI
  }
  
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
  
  const entryTangentOffset = clockwise ? Math.PI / 2 : -Math.PI / 2
  const exitTangentOffset = clockwise ? Math.PI / 2 : -Math.PI / 2
  
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
// TANGENT HANDLE HIT TESTING
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
  tolerance: number,
  closedPath: boolean = true,
  useStartPoint: boolean = true,
  useEndPoint: boolean = true
): TangentHandleType {
  const info = computeTangentHandleInfo(circle, circles, shapeOrder, closedPath, useStartPoint, useEndPoint)
  if (!info) return null
  
  // Determine which handles are visible (same logic as rendering)
  // This ensures hit testing matches what's actually rendered
  const orderIndex = shapeOrder.indexOf(circle.id)
  const isFirst = orderIndex === 0
  const isLast = orderIndex === shapeOrder.length - 1
  
  let showEntry = true
  let showExit = true
  // Length handles are only shown when offset is non-zero (bezier curve exists)
  let showEntryLength = info.hasEntryOffset
  let showExitLength = info.hasExitOffset
  
  if (!closedPath) {
    if (isFirst) {
      showEntry = useStartPoint
      // Don't show entry length handle for start point (no bezier connection)
      showEntryLength = false
    }
    if (isLast) {
      showExit = useEndPoint
      // Don't show exit length handle for end point (no bezier connection)
      showExitLength = false
    }
  }
  
  // Check handles first (they're on top)
  if (showEntry && distance(point, info.entryPoint) <= tolerance) {
    return 'entry-offset'
  }
  
  if (showExit && distance(point, info.exitPoint) <= tolerance) {
    return 'exit-offset'
  }
  
  // Only check length handles if they're visible
  if (showEntryLength && distance(point, info.entryLengthHandle) <= tolerance) {
    return 'entry-length'
  }
  
  if (showExitLength && distance(point, info.exitLengthHandle) <= tolerance) {
    return 'exit-length'
  }
  
  // Check slots (only exist when there's an offset from default)
  // Slots are smaller, so use smaller tolerance
  const slotTolerance = tolerance * SLOT_TOLERANCE_FACTOR
  
  if (showEntry && info.hasEntryOffset && distance(point, info.rawEntryPoint) <= slotTolerance) {
    return 'entry-offset-slot'
  }
  
  if (showExit && info.hasExitOffset && distance(point, info.rawExitPoint) <= slotTolerance) {
    return 'exit-offset-slot'
  }
  
  // Length slots also respect visibility
  if (showEntryLength && info.hasEntryLengthOffset && distance(point, info.rawEntryLengthHandle) <= slotTolerance) {
    return 'entry-length-slot'
  }
  
  if (showExitLength && info.hasExitLengthOffset && distance(point, info.rawExitLengthHandle) <= slotTolerance) {
    return 'exit-length-slot'
  }
  
  return null
}

