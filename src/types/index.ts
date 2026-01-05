// Core geometry types
export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

// Shape types
export type WrapSide = 'left' | 'right'

export interface CircleShape {
  id: string
  type: 'circle'
  name: string
  center: Point
  radius: number
  wrapSide: WrapSide  // Which side the path wraps around this circle
  // Stretch: deforms the circular arc into an elliptical arc
  // 0 = circular arc (no stretch)
  // Positive = MORE elongated perpendicular to chord (more bulge)
  // Negative = flatter along chord (less bulge)
  // Range: -1 to 1
  stretch?: number  // Circle-level stretch, inherits from global if undefined
  // Tangent offset: rotates contact points around the circle from true tangent
  // Positive = rotate in wrap direction, negative = rotate against
  // When non-zero, line segments become bezier curves to maintain tangent continuity
  entryOffset?: number    // Entry point offset angle in radians (0 = true tangent)
  exitOffset?: number     // Exit point offset angle in radians (0 = true tangent)
  // Tangent length multipliers control how far control points extend along the tangent
  // 1.0 = default smooth curve, <1 = tighter curve, >1 = more extended curve
  entryTangentLength?: number  // Multiplier for entry tangent control point distance
  exitTangentLength?: number   // Multiplier for exit tangent control point distance
  // Mirror: when enabled, creates a virtual mirrored circle across the vertical axis
  // The mirrored circle is inserted after all originals in reverse order
  mirrored?: boolean
}

// Extensible for Phase 2: ellipses, rounded polygons, etc.
export type Shape = CircleShape

export type ShapeType = Shape['type']

// Path computation types
export interface LineSegment {
  type: 'line'
  start: Point
  end: Point
  length: number
}

export interface BezierSegment {
  type: 'bezier'
  start: Point
  cp1: Point  // First control point (near start)
  cp2: Point  // Second control point (near end)
  end: Point
  length: number
}

export interface ArcSegment {
  type: 'arc'
  center: Point
  radius: number
  startAngle: number
  endAngle: number
  clockwise: boolean
  length: number
}

export interface EllipseArcSegment {
  type: 'ellipse-arc'
  center: Point       // Center of the ellipse (chord midpoint)
  radiusX: number     // Semi-axis along the chord
  radiusY: number     // Semi-axis perpendicular to chord (the "bulge")
  rotation: number    // Rotation angle of the ellipse (chord direction)
  startAngle: number  // Start angle in ellipse local coords
  endAngle: number    // End angle in ellipse local coords
  counterclockwise: boolean  // Direction to draw the arc
  length: number
}

export type PathSegment = LineSegment | BezierSegment | ArcSegment | EllipseArcSegment

export interface PathData {
  segments: PathSegment[]
  totalLength: number
}

// Interaction types
export type DragMode = 
  | 'move' 
  | 'scale' 
  | 'tangent-entry-offset' 
  | 'tangent-exit-offset'
  | 'tangent-entry-length'
  | 'tangent-exit-length'
  | null

export interface DragState {
  mode: DragMode
  shapeId: string
  startPoint: Point
  startCenter: Point
  startRadius: number
  // For tangent dragging
  startAngle?: number  // Base angle for offset calculation
  startOffset?: number // Initial offset value
  startTangentLength?: number // Initial tangent length multiplier
}

// Settings types
export type MeasurementMode = 'clean' | 'minimal' | 'detailed'

// File format types
export interface SerpentineDocument {
  version: number
  name: string
  created?: string
  modified?: string
  settings?: {
    gridSize?: number
    globalTension?: number  // Legacy, kept for backwards compatibility
    globalStretch?: number  // -1 to 1, 0 = circular
    closedPath?: boolean    // Whether the path loops back to start (default true)
    useStartPoint?: boolean // Whether to use tangent point on first circle (when not looping)
    useEndPoint?: boolean   // Whether to use tangent point on last circle (when not looping)
  }
  viewport?: {
    pan: Point
    zoom: number
  }
  shapes: Shape[]
  pathOrder: string[]
}

// Re-export theme types
export type { CanvasTheme, HoverTarget } from './theme'

