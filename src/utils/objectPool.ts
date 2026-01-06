/**
 * Object pooling utilities to reduce GC pressure
 * 
 * Instead of creating new objects each frame, we reuse objects from a pool.
 * This significantly reduces garbage collection pauses.
 */

import type { Point } from '../types'

// ============================================================================
// POINT POOL
// ============================================================================

const pointPool: Point[] = []
const MAX_POOL_SIZE = 500

/**
 * Get a point from the pool (or create a new one if pool is empty)
 */
export function getPoint(x: number = 0, y: number = 0): Point {
  const point = pointPool.pop()
  if (point) {
    point.x = x
    point.y = y
    return point
  }
  return { x, y }
}

/**
 * Return a point to the pool for reuse
 */
export function releasePoint(point: Point): void {
  if (pointPool.length < MAX_POOL_SIZE) {
    pointPool.push(point)
  }
}

/**
 * Release multiple points at once
 */
export function releasePoints(points: Point[]): void {
  for (let i = 0; i < points.length && pointPool.length < MAX_POOL_SIZE; i++) {
    pointPool.push(points[i])
  }
}

// ============================================================================
// ARRAY REUSE
// ============================================================================

// Pre-allocated arrays for filtering operations
// These are reused across frames to avoid creating new arrays

// For renderShapes - reused arrays for separating selected/non-selected
const _nonSelectedShapes: any[] = []
const _selectedShapes: any[] = []

/**
 * Partition shapes into selected and non-selected without creating new arrays
 * Returns references to internal arrays - DO NOT STORE THESE
 */
export function partitionShapes<T extends { id: string }>(
  shapes: T[],
  selectedIds: string[]
): { nonSelected: T[], selected: T[] } {
  _nonSelectedShapes.length = 0
  _selectedShapes.length = 0
  
  const selectedSet = new Set(selectedIds)
  
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i]
    if (selectedSet.has(shape.id)) {
      _selectedShapes.push(shape)
    } else {
      _nonSelectedShapes.push(shape)
    }
  }
  
  return {
    nonSelected: _nonSelectedShapes,
    selected: _selectedShapes
  }
}

// For filtering circles
const _circleBuffer: any[] = []

/**
 * Filter shapes to only circles without creating a new array
 * Returns reference to internal array - DO NOT STORE THIS
 */
export function filterCircles<T extends { type: string }>(shapes: T[]): T[] {
  _circleBuffer.length = 0
  for (let i = 0; i < shapes.length; i++) {
    if (shapes[i].type === 'circle') {
      _circleBuffer.push(shapes[i])
    }
  }
  return _circleBuffer
}

// ============================================================================
// MAP POOLING
// ============================================================================

// Reusable Map for shape lookups (avoid creating new Map each render)
const _shapeMap = new Map<string, any>()

/**
 * Build a shape lookup map using a pooled Map instance
 * Returns reference to internal Map - DO NOT STORE THIS
 */
export function buildShapeMap<T extends { id: string }>(shapes: T[]): Map<string, T> {
  _shapeMap.clear()
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i]
    _shapeMap.set(shape.id, shape)
  }
  return _shapeMap as Map<string, T>
}

// ============================================================================
// SET POOLING
// ============================================================================

const _idSet = new Set<string>()

/**
 * Create a Set from an array of IDs using a pooled Set instance
 * Returns reference to internal Set - DO NOT STORE THIS
 */
export function buildIdSet(ids: string[]): Set<string> {
  _idSet.clear()
  for (let i = 0; i < ids.length; i++) {
    _idSet.add(ids[i])
  }
  return _idSet
}

// ============================================================================
// SHALLOW CLONE UTILITIES
// ============================================================================

/**
 * Shallow clone an array (faster than [...array] in hot paths)
 * This still allocates, but is faster than spread operator
 */
export function shallowCloneArray<T>(arr: T[]): T[] {
  const result = new Array(arr.length)
  for (let i = 0; i < arr.length; i++) {
    result[i] = arr[i]
  }
  return result
}

/**
 * Clone an array of simple objects (shapes) more efficiently than structuredClone
 * Only clones top-level properties - nested objects are shared references
 */
export function cloneShapesShallow<T extends object>(shapes: T[]): T[] {
  const result = new Array(shapes.length)
  for (let i = 0; i < shapes.length; i++) {
    result[i] = { ...shapes[i] }
  }
  return result
}

/**
 * Deep clone shapes array - faster than structuredClone for our specific shape structure
 * Handles nested Point objects (center) explicitly
 */
export function cloneShapesDeep<T extends { center?: Point }>(shapes: T[]): T[] {
  const result = new Array(shapes.length)
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i]
    const cloned = { ...shape } as T
    // Deep clone the center point if it exists
    if (shape.center) {
      (cloned as any).center = { x: shape.center.x, y: shape.center.y }
    }
    result[i] = cloned
  }
  return result
}

// ============================================================================
// STATS
// ============================================================================

export function getPoolStats(): { pointPoolSize: number } {
  return {
    pointPoolSize: pointPool.length
  }
}

