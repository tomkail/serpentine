import type { CircleShape, Point, Rect, Shape } from '../../types'
import { distance } from '../math'
import { DEFAULT_CIRCLE_RADIUS, MIN_CIRCLE_RADIUS, DUPLICATE_OFFSET } from '../../constants'

/**
 * Check if a point is inside the circle (with optional threshold for selection)
 */
export function containsPoint(circle: CircleShape, point: Point, threshold: number = 0): boolean {
  const dist = distance(circle.center, point)
  return dist <= circle.radius + threshold
}

/**
 * Check if a point is on the edge of the circle (within threshold)
 */
export function isOnEdge(circle: CircleShape, point: Point, threshold: number = 5): boolean {
  const dist = distance(circle.center, point)
  return Math.abs(dist - circle.radius) <= threshold
}

/**
 * Check if a point is near the center of the circle (for move handle)
 */
export function isNearCenter(circle: CircleShape, point: Point, threshold: number = 10): boolean {
  return distance(circle.center, point) <= threshold
}

/**
 * Get the bounding box of the circle
 */
export function getBounds(circle: CircleShape): Rect {
  return {
    x: circle.center.x - circle.radius,
    y: circle.center.y - circle.radius,
    width: circle.radius * 2,
    height: circle.radius * 2
  }
}

/**
 * Get a point on the circle's edge at a given angle
 */
export function pointOnEdge(circle: CircleShape, angle: number): Point {
  return {
    x: circle.center.x + circle.radius * Math.cos(angle),
    y: circle.center.y + circle.radius * Math.sin(angle)
  }
}

/**
 * Calculate the angle from the circle's center to a point
 */
export function angleToPoint(circle: CircleShape, point: Point): number {
  return Math.atan2(point.y - circle.center.y, point.x - circle.center.x)
}

/**
 * Create a new circle with default values
 * By default, tension is undefined so circles inherit from project fling
 */
export function createCircle(
  center: Point,
  radius: number = DEFAULT_CIRCLE_RADIUS,
  id?: string,
  name?: string,
  wrapSide: 'left' | 'right' = 'right',
  tension?: number  // undefined = inherit from project
): CircleShape {
  const circleId = id ?? crypto.randomUUID()
  const circle: CircleShape = {
    id: circleId,
    type: 'circle',
    name: name ?? `Circle`,
    center,
    radius,
    wrapSide
  }
  // Only set tension if explicitly provided
  if (tension !== undefined) {
    circle.tension = tension
  }
  return circle
}

/**
 * Move a circle to a new center position
 */
export function moveCircle(circle: CircleShape, newCenter: Point): CircleShape {
  return {
    ...circle,
    center: newCenter
  }
}

/**
 * Scale a circle to a new radius
 */
export function scaleCircle(circle: CircleShape, newRadius: number): CircleShape {
  return {
    ...circle,
    radius: Math.max(MIN_CIRCLE_RADIUS, newRadius)
  }
}

/**
 * Duplicate a circle with a new ID and offset position
 */
export function duplicateCircle(circle: CircleShape, offset: Point = DUPLICATE_OFFSET): CircleShape {
  return {
    ...circle,
    id: crypto.randomUUID(),
    name: `${circle.name} Copy`,
    center: {
      x: circle.center.x + offset.x,
      y: circle.center.y + offset.y
    }
  }
}

/**
 * Toggle the wrap side of a circle
 */
export function toggleWrapSide(circle: CircleShape): CircleShape {
  return {
    ...circle,
    wrapSide: circle.wrapSide === 'right' ? 'left' : 'right'
  }
}

/**
 * Calculate the bounding box containing all shapes
 */
export function getShapesBounds(shapes: Shape[]): Rect | null {
  if (shapes.length === 0) return null
  
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  
  for (const shape of shapes) {
    const bounds = getBounds(shape as CircleShape)
    minX = Math.min(minX, bounds.x)
    minY = Math.min(minY, bounds.y)
    maxX = Math.max(maxX, bounds.x + bounds.width)
    maxY = Math.max(maxY, bounds.y + bounds.height)
  }
  
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return null
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

