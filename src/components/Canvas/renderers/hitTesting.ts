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
  TANGENT_DISTANCE_FACTOR
} from '../../../constants'

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

