import type { CircleShape, Point } from '../types'
import { distance, normalize, subtract, angle, pointOnCircle } from './math'

/**
 * Circle Edge Snapping
 * 
 * When snapping is enabled, dragged circles snap to touch the edges of nearby circles.
 * The circle can orbit freely along the "touching ring" around a target circle,
 * but grid points on that ring are "sticky" and have extra snapping force.
 */

export interface CircleEdgeSnapResult {
  /** The target circle being snapped to, or null if no snap */
  snappedToCircle: CircleShape | null
  /** The constrained center position (on the ring if snapped) */
  snappedCenter: Point
  /** Whether circle edge snapping is active */
  isOnRing: boolean
  /** Angle from target center to snapped position (for visualization) */
  snapAngle: number | null
}

// Hysteresis state to prevent jitter when circles are touching
// Once snapped to a circle, we stay snapped until moved further away
let lastSnappedCircleId: string | null = null
const HYSTERESIS_MULTIPLIER = 1.5 // Exit threshold is 1.5x the entry threshold

/**
 * Compute circle edge snapping for a dragged circle.
 * 
 * When the dragged circle's edge is close enough to another circle's edge,
 * constrains the center to lie on a ring around the target circle where
 * the two circles would be touching.
 * 
 * Uses hysteresis to prevent jitter: once snapped, stays snapped until
 * the user moves further away (1.5x the entry threshold).
 * 
 * @param draggedCenter - Current center position of the dragged circle
 * @param draggedRadius - Radius of the dragged circle
 * @param otherCircles - All other circles to check against
 * @param zoom - Current zoom level (for pixel-based threshold)
 * @param thresholdPx - Threshold in screen pixels
 * @returns Snap result with constrained position
 */
export function computeCircleEdgeSnap(
  draggedCenter: Point,
  draggedRadius: number,
  otherCircles: CircleShape[],
  zoom: number,
  thresholdPx: number
): CircleEdgeSnapResult {
  // Convert threshold from screen pixels to world units
  const entryThreshold = thresholdPx / zoom
  const exitThreshold = entryThreshold * HYSTERESIS_MULTIPLIER
  
  let closestTarget: CircleShape | null = null
  let closestEdgeDistance = Infinity
  
  // Find the circle whose edge is closest to the dragged circle's edge
  for (const target of otherCircles) {
    const centerDist = distance(draggedCenter, target.center)
    // Distance between edges (positive = gap, negative = overlap)
    const edgeDist = centerDist - draggedRadius - target.radius
    const absEdgeDist = Math.abs(edgeDist)
    
    // Use hysteresis: if we're already snapped to this circle, use larger threshold
    const effectiveThreshold = (target.id === lastSnappedCircleId) 
      ? exitThreshold 
      : entryThreshold
    
    if (absEdgeDist < effectiveThreshold && absEdgeDist < closestEdgeDistance) {
      closestEdgeDistance = absEdgeDist
      closestTarget = target
    }
  }
  
  // No target within threshold
  if (!closestTarget) {
    lastSnappedCircleId = null
    return {
      snappedToCircle: null,
      snappedCenter: draggedCenter,
      isOnRing: false,
      snapAngle: null
    }
  }
  
  // Update hysteresis state
  lastSnappedCircleId = closestTarget.id
  
  // Calculate the constrained position on the "touching ring"
  // The ring radius is the sum of both radii (where edges touch)
  const ringRadius = draggedRadius + closestTarget.radius
  
  // Get direction from target center to dragged center
  const dir = subtract(draggedCenter, closestTarget.center)
  const dirNorm = normalize(dir)
  
  // Handle case where centers coincide (shouldn't happen in practice)
  if (dirNorm.x === 0 && dirNorm.y === 0) {
    return {
      snappedToCircle: closestTarget,
      snappedCenter: {
        x: closestTarget.center.x + ringRadius,
        y: closestTarget.center.y
      },
      isOnRing: true,
      snapAngle: 0
    }
  }
  
  // Constrain center to lie on the ring
  const snappedCenter: Point = {
    x: closestTarget.center.x + dirNorm.x * ringRadius,
    y: closestTarget.center.y + dirNorm.y * ringRadius
  }
  
  const snapAngle = angle(closestTarget.center, snappedCenter)
  
  return {
    snappedToCircle: closestTarget,
    snappedCenter,
    isOnRing: true,
    snapAngle
  }
}

/**
 * Reset the hysteresis state. Call this when starting a new drag operation.
 */
export function resetCircleEdgeSnapState() {
  lastSnappedCircleId = null
}

// Maximum threshold in world units to prevent jumping to far-away points when zoomed out
const MAX_STICKY_THRESHOLD_WORLD = 30

/**
 * Find the closest grid point that lies on a ring around a target circle.
 * 
 * Grid points on the ring are "sticky" - they have extra snapping force.
 * This function checks nearby grid points and returns one that lies on the ring
 * within the given threshold.
 * 
 * @param targetCenter - Center of the target circle
 * @param ringRadius - Radius of the touching ring (r_dragged + r_target)
 * @param currentAngle - Current angle on the ring (from computeCircleEdgeSnap)
 * @param gridSize - Grid spacing in world units
 * @param thresholdPx - Threshold in screen pixels for "stickiness"
 * @param zoom - Current zoom level
 * @returns The sticky grid point, or null if none found
 */
export function findStickyGridPointOnRing(
  targetCenter: Point,
  ringRadius: number,
  currentAngle: number,
  gridSize: number,
  thresholdPx: number,
  zoom: number
): Point | null {
  // Cap the threshold to prevent jumping to far-away points when zoomed out
  const thresholdWorld = Math.min(thresholdPx / zoom, MAX_STICKY_THRESHOLD_WORLD)
  
  // Current position on the ring
  const currentPoint = pointOnCircle(targetCenter, ringRadius, currentAngle)
  
  // Check grid points in the vicinity of the current position
  // We need to check a region around the current point
  const searchRadius = thresholdWorld * 2
  
  const minGridX = Math.floor((currentPoint.x - searchRadius) / gridSize)
  const maxGridX = Math.ceil((currentPoint.x + searchRadius) / gridSize)
  const minGridY = Math.floor((currentPoint.y - searchRadius) / gridSize)
  const maxGridY = Math.ceil((currentPoint.y + searchRadius) / gridSize)
  
  let closestGridPoint: Point | null = null
  let closestDist = thresholdWorld
  
  for (let gx = minGridX; gx <= maxGridX; gx++) {
    for (let gy = minGridY; gy <= maxGridY; gy++) {
      const gridPoint: Point = { x: gx * gridSize, y: gy * gridSize }
      
      // Check if this grid point lies on the ring (within tolerance)
      const distToTarget = distance(gridPoint, targetCenter)
      const ringError = Math.abs(distToTarget - ringRadius)
      
      // Grid point must be close to the ring AND close to current position
      if (ringError < thresholdWorld) {
        const distToCurrent = distance(gridPoint, currentPoint)
        if (distToCurrent < closestDist) {
          closestDist = distToCurrent
          // Project the grid point onto the ring to ensure we stay exactly on it
          const dir = subtract(gridPoint, targetCenter)
          const dirNorm = normalize(dir)
          if (dirNorm.x !== 0 || dirNorm.y !== 0) {
            closestGridPoint = {
              x: targetCenter.x + dirNorm.x * ringRadius,
              y: targetCenter.y + dirNorm.y * ringRadius
            }
          }
        }
      }
    }
  }
  
  return closestGridPoint
}

/**
 * Find sticky smart guide positions on a ring.
 * 
 * When orbiting around a target circle, certain angles align with
 * smart guide positions (center alignment, edge alignment with other circles).
 * These positions should be "sticky".
 * 
 * @param targetCircle - The circle being orbited
 * @param draggedRadius - Radius of the dragged circle
 * @param currentAngle - Current angle on the ring
 * @param otherCircles - Other circles for smart guide alignment
 * @param thresholdPx - Threshold in screen pixels
 * @param zoom - Current zoom level
 * @returns The sticky position, or null if none found
 */
export function findStickyGuidePointOnRing(
  targetCircle: CircleShape,
  draggedRadius: number,
  currentAngle: number,
  otherCircles: CircleShape[],
  thresholdPx: number,
  zoom: number
): Point | null {
  // Cap the threshold to prevent jumping to far-away points when zoomed out
  const thresholdWorld = Math.min(thresholdPx / zoom, MAX_STICKY_THRESHOLD_WORLD)
  const ringRadius = draggedRadius + targetCircle.radius
  const currentPoint = pointOnCircle(targetCircle.center, ringRadius, currentAngle)
  
  let closestPoint: Point | null = null
  let closestDist = thresholdWorld
  
  // Check alignment with other circles' centers and edges
  for (const other of otherCircles) {
    if (other.id === targetCircle.id) continue
    
    // Check center-to-center alignment (vertical or horizontal)
    // Vertical alignment: dragged center x = other center x
    const verticalAlignPoint = findRingIntersectionAtX(
      targetCircle.center, ringRadius, other.center.x
    )
    for (const pt of verticalAlignPoint) {
      const dist = distance(pt, currentPoint)
      if (dist < closestDist) {
        closestDist = dist
        closestPoint = pt
      }
    }
    
    // Horizontal alignment: dragged center y = other center y
    const horizontalAlignPoint = findRingIntersectionAtY(
      targetCircle.center, ringRadius, other.center.y
    )
    for (const pt of horizontalAlignPoint) {
      const dist = distance(pt, currentPoint)
      if (dist < closestDist) {
        closestDist = dist
        closestPoint = pt
      }
    }
    
    // Edge alignments
    const otherEdgeXs = [
      other.center.x - other.radius, // left
      other.center.x + other.radius  // right
    ]
    const otherEdgeYs = [
      other.center.y - other.radius, // top
      other.center.y + other.radius  // bottom
    ]
    
    for (const edgeX of otherEdgeXs) {
      // Dragged circle edge aligns with other's edge
      // For left edge alignment: draggedCenter.x - draggedRadius = edgeX
      // So draggedCenter.x = edgeX + draggedRadius
      const alignX = edgeX + draggedRadius
      const pts = findRingIntersectionAtX(targetCircle.center, ringRadius, alignX)
      for (const pt of pts) {
        const dist = distance(pt, currentPoint)
        if (dist < closestDist) {
          closestDist = dist
          closestPoint = pt
        }
      }
      // For right edge alignment: draggedCenter.x + draggedRadius = edgeX
      // So draggedCenter.x = edgeX - draggedRadius
      const alignX2 = edgeX - draggedRadius
      const pts2 = findRingIntersectionAtX(targetCircle.center, ringRadius, alignX2)
      for (const pt of pts2) {
        const dist = distance(pt, currentPoint)
        if (dist < closestDist) {
          closestDist = dist
          closestPoint = pt
        }
      }
    }
    
    for (const edgeY of otherEdgeYs) {
      // Similar for Y alignment
      const alignY = edgeY + draggedRadius
      const pts = findRingIntersectionAtY(targetCircle.center, ringRadius, alignY)
      for (const pt of pts) {
        const dist = distance(pt, currentPoint)
        if (dist < closestDist) {
          closestDist = dist
          closestPoint = pt
        }
      }
      const alignY2 = edgeY - draggedRadius
      const pts2 = findRingIntersectionAtY(targetCircle.center, ringRadius, alignY2)
      for (const pt of pts2) {
        const dist = distance(pt, currentPoint)
        if (dist < closestDist) {
          closestDist = dist
          closestPoint = pt
        }
      }
    }
  }
  
  // Also check alignment with origin (0, 0)
  const originVertical = findRingIntersectionAtX(targetCircle.center, ringRadius, 0)
  for (const pt of originVertical) {
    const dist = distance(pt, currentPoint)
    if (dist < closestDist) {
      closestDist = dist
      closestPoint = pt
    }
  }
  
  const originHorizontal = findRingIntersectionAtY(targetCircle.center, ringRadius, 0)
  for (const pt of originHorizontal) {
    const dist = distance(pt, currentPoint)
    if (dist < closestDist) {
      closestDist = dist
      closestPoint = pt
    }
  }
  
  return closestPoint
}

/**
 * Find points on a ring where x equals a given value.
 * Returns 0, 1, or 2 points depending on intersection.
 */
function findRingIntersectionAtX(center: Point, radius: number, x: number): Point[] {
  const dx = x - center.x
  if (Math.abs(dx) > radius) return []
  
  const dy = Math.sqrt(radius * radius - dx * dx)
  if (dy === 0) {
    return [{ x, y: center.y }]
  }
  return [
    { x, y: center.y + dy },
    { x, y: center.y - dy }
  ]
}

/**
 * Find points on a ring where y equals a given value.
 * Returns 0, 1, or 2 points depending on intersection.
 */
function findRingIntersectionAtY(center: Point, radius: number, y: number): Point[] {
  const dy = y - center.y
  if (Math.abs(dy) > radius) return []
  
  const dx = Math.sqrt(radius * radius - dy * dy)
  if (dx === 0) {
    return [{ x: center.x, y }]
  }
  return [
    { x: center.x + dx, y },
    { x: center.x - dx, y }
  ]
}

