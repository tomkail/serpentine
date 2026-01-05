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

