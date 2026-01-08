import type { Point } from '../types'
import { distance, angle, pointOnCircle, normalizeAngle, circleIntersections } from './math'

export interface TangentResult {
  p1: Point  // Tangent point on first circle
  p2: Point  // Tangent point on second circle
  angle1: number  // Angle on first circle where tangent touches
  angle2: number  // Angle on second circle where tangent touches
  isIntersection?: boolean  // True if this is an intersection point (not a true tangent)
}

/**
 * Calculate external tangent line between two circles.
 * 
 * External tangents don't cross between the circles - the belt goes
 * around the outside of both circles on the same side.
 * 
 * For circles with radii r1 and r2, and distance d between centers:
 * - The tangent touches both circles at points that make the tangent line
 *   perpendicular to both radii at those points
 * - cos(touchAngle - centerAngle) = (r1 - r2) / d
 * 
 * @param side - 'right' means the tangent on the right when traveling from c1 to c2
 */
export function externalTangent(
  c1: Point, r1: number,
  c2: Point, r2: number,
  side: 'left' | 'right' = 'right'
): TangentResult | null {
  const d = distance(c1, c2)
  
  // Circles are too close or one contains the other
  if (d < Math.abs(r1 - r2) + 0.001) {
    return null
  }
  
  // Angle from c1 to c2
  const theta = angle(c1, c2)
  
  // For external tangent with different radii:
  // cos(touchAngle - theta) = (r1 - r2) / d
  // This gives the angle offset from the center line
  const cosDelta = (r1 - r2) / d
  
  if (Math.abs(cosDelta) > 1) {
    return null
  }
  
  const delta = Math.acos(cosDelta)
  
  // Two external tangents exist: one on each side
  // 'right' side: touchAngle = theta + delta (tangent on right when going from c1 to c2)
  // 'left' side: touchAngle = theta - delta
  const sign = side === 'right' ? 1 : -1
  const touchAngle = theta + sign * delta
  
  const p1 = pointOnCircle(c1, r1, touchAngle)
  const p2 = pointOnCircle(c2, r2, touchAngle)
  
  return {
    p1,
    p2,
    angle1: normalizeAngle(touchAngle),
    angle2: normalizeAngle(touchAngle)
  }
}

/**
 * Calculate internal (cross) tangent line between two circles.
 * 
 * Internal tangents cross between the circles - used when circles
 * rotate in opposite directions.
 * 
 * For internal tangent:
 * - The tangent line crosses between the two circles
 * - Touch points are on opposite sides of each circle relative to the tangent direction
 * - cos(touchAngle1 - theta) = (r1 + r2) / d (approximately, for the crossing point)
 * 
 * When circles overlap (no true internal tangent exists), this function returns
 * the intersection point as a fallback - the path will go to the intersection point
 * on the first circle and continue from the intersection point on the second circle.
 * 
 * @param side - determines which of the two internal tangents to use
 * @param useEntryIntersection - if true, use the "entry" intersection instead of "exit" (for mirrored shapes)
 */
export function internalTangent(
  c1: Point, r1: number,
  c2: Point, r2: number,
  side: 'left' | 'right' = 'right',
  useEntryIntersection: boolean = false
): TangentResult | null {
  const d = distance(c1, c2)
  
  // Angle from c1 to c2
  const theta = angle(c1, c2)
  
  // Circles overlap - use intersection point as fallback
  if (d < r1 + r2 + 0.001) {
    const intersections = circleIntersections(c1, r1, c2, r2)
    
    if (!intersections || intersections.length === 0) {
      // One circle contains the other or they're concentric - no valid connection
      return null
    }
    
    // Choose the appropriate intersection point based on 'side'
    // For internal tangent with 'right' side, we want the intersection point
    // that's on the right when looking from c1 to c2
    // For mirrored shapes, we flip the selection (use entry instead of exit)
    let intersectionPoint: Point
    let selectedIdx = 0
    
    if (intersections.length === 1) {
      // Circles are tangent - only one intersection point
      intersectionPoint = intersections[0]
    } else {
      // Two intersection points - choose based on side relative to center line
      // Calculate which point is on which side using cross product
      const dx = c2.x - c1.x
      const dy = c2.y - c1.y
      
      // Cross product to determine which side each intersection is on
      const cross0 = dx * (intersections[0].y - c1.y) - dy * (intersections[0].x - c1.x)
      
      // For REFLECTION sectors (odd sector numbers), flip the selection
      // because the path direction is reversed in reflections.
      // For ROTATION sectors (even sector numbers), don't flip.
      // The useEntryIntersection flag now indicates whether the source circle
      // is from a reflection sector.
      const effectiveSide = useEntryIntersection 
        ? (side === 'right' ? 'left' : 'right')
        : side
      
      // Positive cross = left side, negative cross = right side
      if (effectiveSide === 'right') {
        selectedIdx = cross0 < 0 ? 0 : 1
      } else {
        selectedIdx = cross0 > 0 ? 0 : 1
      }
      intersectionPoint = intersections[selectedIdx]
    }
    
    // Calculate angles from each center to the intersection point
    const angle1 = angle(c1, intersectionPoint)
    const angle2 = angle(c2, intersectionPoint)
    
    return {
      p1: intersectionPoint,
      p2: intersectionPoint,  // Same point - they meet at the intersection
      angle1: normalizeAngle(angle1),
      angle2: normalizeAngle(angle2),
      isIntersection: true
    }
  }
  
  // Normal case: circles don't overlap, calculate true internal tangent
  
  // Simpler approach: sin(offset) = (r1 + r2) / d
  const sinOffset = (r1 + r2) / d
  
  if (sinOffset > 1) {
    return null
  }
  
  const offset = Math.asin(sinOffset)
  
  // For internal tangent, the touch points are on opposite sides
  const sign = side === 'right' ? 1 : -1
  
  // Touch angle on first circle: perpendicular to the tangent line direction
  // The tangent line makes angle (theta + π/2 - offset) or (theta - π/2 + offset) with horizontal
  const angle1 = theta + sign * (Math.PI / 2 - offset)
  
  // Touch angle on second circle: opposite side (add π)
  const angle2 = angle1 + Math.PI
  
  const p1 = pointOnCircle(c1, r1, angle1)
  const p2 = pointOnCircle(c2, r2, angle2)
  
  return {
    p1,
    p2,
    angle1: normalizeAngle(angle1),
    angle2: normalizeAngle(angle2)
  }
}

/**
 * Get the appropriate tangent between two circles based on their path directions.
 * 
 * For CW rotation, velocity at TOP points right, at BOTTOM points left.
 * For CCW rotation, velocity at TOP points left, at BOTTOM points right.
 * 
 * The tangent should exit from the point where velocity points toward the next circle.
 * 'left' side tangent = tangent line is above/left of center line (exits from top when c2 is right)
 * 'right' side tangent = tangent line is below/right of center line (exits from bottom when c2 is right)
 * 
 * @param fromDir - direction path travels around first circle ('cw' or 'ccw')
 * @param toDir - direction path travels around second circle
 * @param fromIsMirror - if true, the first circle is a mirrored copy (use entry intersection instead of exit)
 */
export function getTangentForDirections(
  c1: Point, r1: number, fromDir: 'cw' | 'ccw',
  c2: Point, r2: number, toDir: 'cw' | 'ccw',
  fromIsReflection: boolean = false
): TangentResult | null {
  const sameDirection = fromDir === toDir
  
  // Map direction to tangent side:
  // CW exits from where velocity points toward next circle = 'left' side (top when c2 is right)
  // CCW exits from where velocity points toward next circle = 'right' side (bottom when c2 is right)
  const side = fromDir === 'cw' ? 'left' : 'right'
  
  if (sameDirection) {
    // Same direction: use external tangent
    return externalTangent(c1, r1, c2, r2, side)
  } else {
    // Opposite directions: use internal (crossing) tangent
    // For reflection sectors, flip the intersection selection
    return internalTangent(c1, r1, c2, r2, side, fromIsReflection)
  }
}
