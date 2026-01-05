import type { Point } from '../types'

// Vector operations
export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function scale(p: Point, s: number): Point {
  return { x: p.x * s, y: p.y * s }
}

export function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y
}

export function length(p: Point): number {
  return Math.sqrt(p.x * p.x + p.y * p.y)
}

export function normalize(p: Point): Point {
  const len = length(p)
  if (len === 0) return { x: 0, y: 0 }
  return { x: p.x / len, y: p.y / len }
}

export function perpendicular(p: Point): Point {
  return { x: -p.y, y: p.x }
}

// Distance and angle
export function distance(a: Point, b: Point): number {
  return length(subtract(b, a))
}

export function angle(from: Point, to: Point): number {
  const delta = subtract(to, from)
  return Math.atan2(delta.y, delta.x)
}

// Circle helpers
export function pointOnCircle(center: Point, radius: number, angle: number): Point {
  return {
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle)
  }
}

// Angle utilities
export function normalizeAngle(angle: number): number {
  while (angle < 0) angle += Math.PI * 2
  while (angle >= Math.PI * 2) angle -= Math.PI * 2
  return angle
}

export function angleDifference(from: number, to: number, clockwise: boolean): number {
  let diff = normalizeAngle(to - from)
  if (clockwise && diff > 0) diff -= Math.PI * 2
  if (!clockwise && diff < 0) diff += Math.PI * 2
  return Math.abs(diff)
}

// Arc length
export function arcLength(radius: number, startAngle: number, endAngle: number, clockwise: boolean): number {
  const diff = angleDifference(startAngle, endAngle, clockwise)
  return radius * diff
}

// Lerp
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function lerpPoint(a: Point, b: Point, t: number): Point {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t)
  }
}

// Clamp
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// Snap to grid
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}

export function snapPointToGrid(point: Point, gridSize: number): Point {
  return {
    x: snapToGrid(point.x, gridSize),
    y: snapToGrid(point.y, gridSize)
  }
}

/**
 * Calculate intersection points of two circles.
 * Returns null if circles don't intersect, or an array of 1-2 intersection points.
 * 
 * When circles overlap (not concentric), there are exactly 2 intersection points.
 * When circles are tangent, there is 1 intersection point.
 * When circles don't intersect or one contains the other, returns null.
 */
export function circleIntersections(
  c1: Point, r1: number,
  c2: Point, r2: number
): Point[] | null {
  const d = distance(c1, c2)
  
  // Circles are too far apart (no intersection)
  if (d > r1 + r2) return null
  
  // One circle contains the other (no intersection)
  if (d < Math.abs(r1 - r2)) return null
  
  // Circles are concentric (infinite or no intersections)
  if (d === 0) return null
  
  // Calculate intersection points using the standard formula
  // a = distance from c1 to the line connecting intersection points
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d)
  
  // h = half the distance between the two intersection points
  const hSquared = r1 * r1 - a * a
  
  // Due to floating point errors, hSquared might be slightly negative when circles are tangent
  if (hSquared < 0) {
    // Circles are tangent (single intersection point)
    const ratio = a / d
    return [{
      x: c1.x + ratio * (c2.x - c1.x),
      y: c1.y + ratio * (c2.y - c1.y)
    }]
  }
  
  const h = Math.sqrt(hSquared)
  
  // Point P is on the line between centers, at distance 'a' from c1
  const px = c1.x + a * (c2.x - c1.x) / d
  const py = c1.y + a * (c2.y - c1.y) / d
  
  // The two intersection points are perpendicular to the line between centers
  // at distance h from point P
  const dx = h * (c2.y - c1.y) / d
  const dy = h * (c2.x - c1.x) / d
  
  return [
    { x: px + dx, y: py - dy },
    { x: px - dx, y: py + dy }
  ]
}

