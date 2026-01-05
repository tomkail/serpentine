import type { Point } from '../types'
import { distance, angle, pointOnCircle, normalizeAngle } from './math'

export interface TangentResult {
  p1: Point  // Tangent point on first circle
  p2: Point  // Tangent point on second circle
  angle1: number  // Angle on first circle where tangent touches
  angle2: number  // Angle on second circle where tangent touches
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
 * @param side - determines which of the two internal tangents to use
 */
export function internalTangent(
  c1: Point, r1: number,
  c2: Point, r2: number,
  side: 'left' | 'right' = 'right'
): TangentResult | null {
  const d = distance(c1, c2)
  
  // Circles overlap - no internal tangent possible
  if (d < r1 + r2 + 0.001) {
    return null
  }
  
  // Angle from c1 to c2
  const theta = angle(c1, c2)
  
  // For internal tangent:
  // The tangent line crosses between circles at some point P
  // P divides the segment c1-c2 in ratio r1:r2
  // cos(touchAngle1 - theta) = r1 / d1 where d1 = distance from c1 to crossing point
  // The crossing point is at distance d * r1 / (r1 + r2) from c1
  
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
 * @param fromDir - direction path travels around first circle ('cw' or 'ccw')
 * @param toDir - direction path travels around second circle
 */
export function getTangentForDirections(
  c1: Point, r1: number, fromDir: 'cw' | 'ccw',
  c2: Point, r2: number, toDir: 'cw' | 'ccw'
): TangentResult | null {
  const sameDirection = fromDir === toDir
  
  // Map direction to tangent side: 'cw' → 'right', 'ccw' → 'left'
  const side = fromDir === 'cw' ? 'right' : 'left'
  
  if (sameDirection) {
    // Same direction: use external tangent
    return externalTangent(c1, r1, c2, r2, side)
  } else {
    // Opposite directions: use internal (crossing) tangent
    return internalTangent(c1, r1, c2, r2, side)
  }
}
