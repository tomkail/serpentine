import type { CircleShape, PathData, LineSegment, BezierSegment, ArcSegment, EllipseArcSegment, Point } from '../types'
import { distance, pointOnCircle } from './math'
import { getTangentForDirections, type TangentResult } from './tangent'
import {
  NON_OVERLAP_MIN_RADIUS,
  NON_OVERLAP_MAX_RADIUS,
  CIRCLE_GAP,
  TANGENT_DISTANCE_FACTOR,
  DEFAULT_TANGENT_LENGTH
} from '../constants'

/**
 * Create a mirrored version of a circle across the vertical axis (x=0)
 * The mirrored circle has:
 * - x position negated
 * - direction preserved (path continues same rotational direction)
 * - entry/exit offsets swapped and negated (to maintain symmetry)
 */
export function createMirroredCircle(circle: CircleShape): CircleShape {
  return {
    ...circle,
    id: `${circle.id}_mirror`,
    name: `${circle.name} (Mirror)`,
    center: {
      x: -circle.center.x,
      y: circle.center.y
    },
    // Keep the same direction (don't flip)
    direction: circle.direction,
    // Swap and preserve entry/exit offsets for symmetry
    entryOffset: circle.exitOffset !== undefined ? -circle.exitOffset : undefined,
    exitOffset: circle.entryOffset !== undefined ? -circle.entryOffset : undefined,
    // Swap tangent lengths
    entryTangentLength: circle.exitTangentLength,
    exitTangentLength: circle.entryTangentLength,
    // Mirror flag is false for virtual circles
    mirrored: false
  }
}

/**
 * Expand shapes and order to include mirrored circles.
 * Mirrored circles are added after all originals in reverse order.
 * 
 * Example: If circles A, B, C all have mirrored=true:
 * - Original order: [A, B, C]
 * - Expanded order: [A, B, C, C', B', A']
 * - The path goes: A → B → C → C' → B' → A' → (back to A)
 */
export function expandMirroredCircles(
  shapes: CircleShape[],
  order: string[]
): { expandedShapes: CircleShape[], expandedOrder: string[] } {
  // Get ordered circles
  const orderedCircles = order
    .map(id => shapes.find(s => s.id === id))
    .filter((s): s is CircleShape => s !== undefined && s.type === 'circle')
  
  // Find circles that should be mirrored
  const mirroredCircles = orderedCircles.filter(c => c.mirrored)
  
  if (mirroredCircles.length === 0) {
    return { expandedShapes: shapes, expandedOrder: order }
  }
  
  // Create mirrored versions
  const mirrorCopies = mirroredCircles.map(c => createMirroredCircle(c))
  
  // Reverse the mirrored copies so they connect properly
  // A → B → C then C' → B' → A'
  const reversedMirrorCopies = [...mirrorCopies].reverse()
  
  // Build expanded shapes list (include all original shapes + mirror copies)
  const expandedShapes = [...shapes, ...mirrorCopies]
  
  // Build expanded order: original order + mirrored IDs in reverse
  const expandedOrder = [
    ...order,
    ...reversedMirrorCopies.map(c => c.id)
  ]
  
  return { expandedShapes, expandedOrder }
}

/**
 * Get mirrored circles for rendering purposes.
 * Returns the virtual mirror circles that should be drawn as ghosts.
 */
export function getMirroredCircles(shapes: CircleShape[]): CircleShape[] {
  return shapes
    .filter(c => c.mirrored)
    .map(c => createMirroredCircle(c))
}

/**
 * Stretch resolver function type.
 * Given a circle ID, returns the effective stretch value (-1 to 1).
 */
export type StretchResolver = (circleId: string) => number

/**
 * Create a stretch resolver from shapes and a global stretch value
 */
export function createStretchResolver(
  shapes: CircleShape[],
  globalStretch: number
): StretchResolver {
  return (circleId: string): number => {
    const circle = shapes.find(s => s.id === circleId)
    if (!circle) return globalStretch
    
    // Circle-level override, or fall back to global
    if (circle.stretch !== undefined) {
      return circle.stretch
    }
    
    return globalStretch
  }
}

/**
 * Compute the tangent hull path around an ordered list of circles.
 * 
 * Each circle has a direction property:
 * - 'cw' = clockwise - path goes clockwise around this circle
 * - 'ccw' = counter-clockwise - path goes counter-clockwise around this circle
 * 
 * Stretch deforms the circular arc into an elliptical arc:
 * - 0 = circular arc
 * - Positive = stretched along chord (flatter)
 * - Negative = stretched perpendicular (bulgier)
 * 
 * @param closed - If true, the path loops back from the last circle to the first.
 *                 If false, the path is open-ended.
 * @param useStartPoint - If false and not closed, skip the first circle's exit connector
 * @param useEndPoint - If false and not closed, skip the last circle's entry connector
 */
export function computeTangentHull(
  shapes: CircleShape[],
  order: string[],
  globalStretch: number = 0,
  closed: boolean = true,
  useStartPoint: boolean = true,
  useEndPoint: boolean = true
): PathData {
  const segments: (LineSegment | BezierSegment | ArcSegment | EllipseArcSegment)[] = []
  
  // Expand shapes to include mirrored circles
  const { expandedShapes, expandedOrder } = expandMirroredCircles(shapes, order)
  
  // Get ordered circles from expanded set
  const orderedCircles = expandedOrder
    .map(id => expandedShapes.find(s => s.id === id))
    .filter((s): s is CircleShape => s !== undefined && s.type === 'circle')
  
  if (orderedCircles.length < 2) {
    return { segments: [], totalLength: 0 }
  }
  
  const n = orderedCircles.length
  
  // Compute all tangent lines between consecutive circles
  // For open paths, we always compute all n tangents (including wrap-around)
  // so that useStartPoint/useEndPoint can use them for arc calculations
  const tangents: (TangentResult | null)[] = []
  
  for (let i = 0; i < n; i++) {
    const curr = orderedCircles[i]
    const next = orderedCircles[(i + 1) % n]
    
    const tangent = getTangentForDirections(
      curr.center, curr.radius, curr.direction ?? 'cw',
      next.center, next.radius, next.direction ?? 'cw'
    )
    
    tangents.push(tangent)
  }
  
  // Check if we have valid tangents
  const allValid = tangents.every(t => t !== null)
  if (!allValid) {
    return computePartialPath(tangents)
  }
  
  // Create stretch resolver (use expanded shapes to include mirror copies)
  const resolveStretch = createStretchResolver(expandedShapes, globalStretch)
  
  // Build the path: for each circle, draw arc then connector to next circle
  let totalLength = 0
  
  // For open paths, we iterate through all circles but handle first/last specially
  // useStartPoint/useEndPoint control whether arcs are drawn on first/last circles
  const circleCount = n
  
  for (let i = 0; i < circleCount; i++) {
    const circle = orderedCircles[i]
    const clockwise = (circle.direction ?? 'cw') === 'cw'
    
    // Get stretch for this circle
    const stretch = resolveStretch(circle.id)
    
    // For open paths, determine which tangents are available based on useStartPoint/useEndPoint
    // - First circle (i=0): has prev tangent if closed OR useStartPoint
    // - Last circle (i=n-1): has next tangent if closed OR useEndPoint
    const isFirst = i === 0
    const isLast = i === n - 1
    
    // Skip first circle entirely if path is open and useStartPoint is false
    if (!closed && isFirst && !useStartPoint) {
      // For open path without start point: just add connector to next
      const currTangent = tangents[i]!
      const nextCircle = orderedCircles[i + 1]
      const exitAngle = currTangent.angle1
      const exitOffsetAmount = circle.exitOffset ?? 0
      const offsetDir = clockwise ? 1 : -1
      const adjustedExitAngle = exitOffsetAmount !== 0 
        ? exitAngle + exitOffsetAmount * offsetDir 
        : exitAngle
      const exitPoint = pointOnCircle(circle.center, circle.radius, adjustedExitAngle)
      const exitTangentLengthMult = circle.exitTangentLength ?? DEFAULT_TANGENT_LENGTH
      
      // Calculate entry point on next circle
      const nextClockwise = (nextCircle.direction ?? 'cw') === 'cw'
      let nextEntryAngle = currTangent.angle2
      const nextEntryOffset = nextCircle.entryOffset ?? 0
      if (nextEntryOffset !== 0) {
        const nextOffsetDir = nextClockwise ? 1 : -1
        nextEntryAngle += nextEntryOffset * nextOffsetDir
      }
      const nextEntryPoint = pointOnCircle(nextCircle.center, nextCircle.radius, nextEntryAngle)
      const nextEntryTangentLengthMult = nextCircle.entryTangentLength ?? DEFAULT_TANGENT_LENGTH
      
      const hasOffsets = exitOffsetAmount !== 0 || nextEntryOffset !== 0
      const hasCustomLengths = exitTangentLengthMult !== DEFAULT_TANGENT_LENGTH || nextEntryTangentLengthMult !== DEFAULT_TANGENT_LENGTH
      
      if (hasOffsets || hasCustomLengths) {
        const connectorSeg = createTangentConnector(
          exitPoint, adjustedExitAngle, clockwise, exitTangentLengthMult,
          nextEntryPoint, nextEntryAngle, nextClockwise, nextEntryTangentLengthMult
        )
        segments.push(connectorSeg)
        totalLength += connectorSeg.length
      } else {
        const lineLen = distance(exitPoint, nextEntryPoint)
        segments.push({ type: 'line', start: exitPoint, end: nextEntryPoint, length: lineLen })
        totalLength += lineLen
      }
      continue
    }
    
    // Skip last circle entirely if path is open and useEndPoint is false
    if (!closed && isLast && !useEndPoint) {
      // Path already ended at entry to this circle, nothing more to draw
      continue
    }
    
    const nextCircle = orderedCircles[(i + 1) % n]
    
    // Tangent from previous circle TO this circle
    const prevTangentIndex = (i - 1 + n) % n
    const prevTangent = tangents[prevTangentIndex]!
    // Tangent from this circle TO next circle
    const currTangent = tangents[i]!
    
    // Base entry/exit angles from tangent computation
    let entryAngle = prevTangent.angle2
    let exitAngle = currTangent.angle1
    
    // For open paths with useStartPoint/useEndPoint enabled, use opposite side of the circle
    // instead of calculating from the wrap-around tangent (which doesn't exist logically)
    if (!closed && isFirst && useStartPoint) {
      // First circle in open path: set entry angle opposite to exit angle
      entryAngle = exitAngle + Math.PI
    }
    if (!closed && isLast && useEndPoint) {
      // Last circle in open path: set exit angle opposite to entry angle
      exitAngle = entryAngle + Math.PI
    }
    
    // Apply separate entry/exit offsets to this circle's contact points
    const entryOffsetAmount = circle.entryOffset ?? 0
    const exitOffsetAmount = circle.exitOffset ?? 0
    const offsetDir = clockwise ? 1 : -1
    
    if (entryOffsetAmount !== 0) {
      entryAngle += entryOffsetAmount * offsetDir
    }
    if (exitOffsetAmount !== 0) {
      exitAngle += exitOffsetAmount * offsetDir
    }
    
    // Get tangent length multipliers (default to 1.0)
    const exitTangentLengthMult = circle.exitTangentLength ?? DEFAULT_TANGENT_LENGTH
    
    // Calculate actual entry/exit points (potentially offset from true tangent)
    const entryPoint = pointOnCircle(circle.center, circle.radius, entryAngle)
    const exitPoint = pointOnCircle(circle.center, circle.radius, exitAngle)
    
    // Arc around this circle
    // Draw the arc from entry to exit
    if (Math.abs(stretch) < 0.01) {
      // No stretch: use circular arc
      const arcLen = calculateArcLength(circle.radius, entryAngle, exitAngle, clockwise)
      
      const arcSeg: ArcSegment = {
        type: 'arc',
        center: circle.center,
        radius: circle.radius,
        startAngle: entryAngle,
        endAngle: exitAngle,
        counterclockwise: clockwise,  // 'cw' direction → counterclockwise canvas param (see notes)
        length: arcLen
      }
      segments.push(arcSeg)
      totalLength += arcLen
    } else {
      // Stretch applied: use elliptical arc
      const ellipseSeg = createStretchedArc(
        entryPoint,
        exitPoint,
        circle.center,
        circle.radius,
        entryAngle,
        exitAngle,
        clockwise,
        stretch
      )
      segments.push(ellipseSeg)
      totalLength += ellipseSeg.length
    }
    
    // === Connector segment from this circle to next circle ===
    // Skip if this is the last circle in an open path (no connector to first circle)
    // The path ends at this circle's exit point
    if (!closed && isLast) continue
    
    // Calculate the entry point on the NEXT circle (potentially with its own offset)
    const nextClockwise = (nextCircle.direction ?? 'cw') === 'cw'
    let nextEntryAngle = currTangent.angle2
    const nextEntryOffset = nextCircle.entryOffset ?? 0
    if (nextEntryOffset !== 0) {
      const nextOffsetDir = nextClockwise ? 1 : -1
      nextEntryAngle += nextEntryOffset * nextOffsetDir
    }
    const nextEntryPoint = pointOnCircle(nextCircle.center, nextCircle.radius, nextEntryAngle)
    
    // Get tangent length multiplier for next circle's entry
    const nextEntryTangentLengthMult = nextCircle.entryTangentLength ?? DEFAULT_TANGENT_LENGTH
    
    // Check if either circle has a tangent offset or custom tangent length - if so, we need a bezier
    const hasOffsets = exitOffsetAmount !== 0 || nextEntryOffset !== 0
    const hasCustomLengths = exitTangentLengthMult !== DEFAULT_TANGENT_LENGTH || nextEntryTangentLengthMult !== DEFAULT_TANGENT_LENGTH
    const needsBezierConnector = hasOffsets || hasCustomLengths
    
    if (needsBezierConnector) {
      // Create bezier connector that maintains tangent continuity
      const connectorSeg = createTangentConnector(
        exitPoint,
        exitAngle,
        clockwise,
        exitTangentLengthMult,
        nextEntryPoint,
        nextEntryAngle,
        nextClockwise,
        nextEntryTangentLengthMult
      )
      segments.push(connectorSeg)
      totalLength += connectorSeg.length
    } else {
      // No offset: straight line connector (original behavior)
      const lineLen = distance(exitPoint, nextEntryPoint)
      const lineSeg: LineSegment = {
        type: 'line',
        start: exitPoint,
        end: nextEntryPoint,
        length: lineLen
      }
      segments.push(lineSeg)
      totalLength += lineLen
    }
  }
  
  return { segments, totalLength }
}

/**
 * Create a stretched arc using an ellipse centered at the chord midpoint.
 * 
 * The approach:
 * 1. Center the ellipse at the midpoint of the chord between entry and exit points
 * 2. radiusX (along chord) = half chord length - this guarantees passing through both endpoints
 * 3. radiusY (perpendicular to chord) = sagitta adjusted by stretch
 * 
 * This ensures the ellipse ALWAYS passes through both entry and exit points.
 * 
 * Stretch parameter:
 * - 0 = circular (sagitta matches original circle arc)
 * - Positive = MORE bulge (larger sagitta)
 * - Negative = LESS bulge (smaller sagitta)
 */
function createStretchedArc(
  entryPoint: Point,
  exitPoint: Point,
  circleCenter: Point,
  circleRadius: number,
  entryAngle: number,
  exitAngle: number,
  clockwise: boolean,
  stretch: number
): EllipseArcSegment {
  // Calculate the chord midpoint - this will be the ellipse center
  const chordMidpoint: Point = {
    x: (entryPoint.x + exitPoint.x) / 2,
    y: (entryPoint.y + exitPoint.y) / 2
  }
  
  // Calculate half chord length - this is radiusX (along chord direction)
  const halfChordLength = distance(entryPoint, exitPoint) / 2
  
  // Calculate chord direction angle
  const chordAngle = Math.atan2(exitPoint.y - entryPoint.y, exitPoint.x - entryPoint.x)
  
  // Calculate arc midpoint angle (halfway between entry and exit, accounting for direction)
  let arcSpan = exitAngle - entryAngle
  if (clockwise) {
    while (arcSpan < 0) arcSpan += Math.PI * 2
    while (arcSpan > Math.PI * 2) arcSpan -= Math.PI * 2
  } else {
    while (arcSpan > 0) arcSpan -= Math.PI * 2
    while (arcSpan < -Math.PI * 2) arcSpan += Math.PI * 2
  }
  const midAngle = entryAngle + arcSpan / 2
  
  // Calculate the arc midpoint on the original circle
  const arcMidpoint = pointOnCircle(circleCenter, circleRadius, midAngle)
  
  // Calculate the sagitta (distance from chord midpoint to arc midpoint)
  // This is the "height" of the circular arc
  const sagitta = distance(chordMidpoint, arcMidpoint)
  
  // Apply stretch to the sagitta
  // stretch = 0: use original sagitta (circular)
  // stretch > 0: increase sagitta (more bulge)
  // stretch < 0: decrease sagitta (flatter)
  const stretchedSagitta = sagitta * (1 + stretch)
  
  // Ensure minimum sagitta to avoid degenerate ellipse
  const minSagitta = 1
  const finalSagitta = Math.max(minSagitta, stretchedSagitta)
  
  // Ellipse parameters:
  // - Center at chord midpoint
  // - radiusX along chord = half chord length (guarantees passing through endpoints)
  // - radiusY perpendicular to chord = stretched sagitta
  const radiusX = halfChordLength
  const radiusY = finalSagitta
  
  // Rotation: align ellipse X-axis with chord direction
  const rotation = chordAngle
  
  // In the ellipse's local coordinate system:
  // - Entry point is at (-radiusX, 0) -> angle = π
  // - Exit point is at (+radiusX, 0) -> angle = 0
  // We always go from entry to exit, the question is which way around
  
  // Set start and end angles  
  // In ellipse local coords: entry is at (-halfChordLength, 0), exit is at (+halfChordLength, 0)
  // Canvas ellipse angles are measured from the rotated +X axis
  // After rotation by chordAngle, the ellipse +X axis points from entry toward exit
  // So: entry (at -halfChordLength in local X) is at angle π
  //     exit (at +halfChordLength in local X) is at angle 0
  // We want to START at entry and END at exit
  const startAngle = Math.PI  // Entry point
  const endAngle = 0          // Exit point (or 2π, same thing)
  
  // Determine which side of the chord the arc midpoint is on
  // Use a simple dot product with the perpendicular direction
  
  // In canvas, the ellipse's local +Y axis (angle π/2) is perpendicular to its +X axis
  // After rotation by chordAngle, local +X points in the chord direction
  // Local +Y is at angle (chordAngle + π/2)
  const localYAngle = chordAngle + Math.PI / 2
  const perpX = Math.cos(localYAngle)
  const perpY = Math.sin(localYAngle)
  
  // Vector from chord midpoint to arc midpoint
  const toMidX = arcMidpoint.x - chordMidpoint.x
  const toMidY = arcMidpoint.y - chordMidpoint.y
  
  // Dot product with perpendicular tells us which side
  // Positive = arc midpoint is in the +Y direction of the ellipse
  const dotWithPerp = toMidX * perpX + toMidY * perpY
  
  // In canvas:
  // - counterclockwise from π to 0 goes through π/2 (the +Y direction in local coords)
  // - clockwise from π to 0 goes through -π/2 (the -Y direction in local coords)
  // If arc midpoint is in the +Y direction (dot > 0), use counterclockwise
  const counterclockwise = dotWithPerp > 0
  
  // Approximate arc length
  const length = approximateEllipseArcLength(radiusX, radiusY, Math.PI)
  
  return {
    type: 'ellipse-arc',
    center: chordMidpoint,
    radiusX,
    radiusY,
    rotation,
    startAngle,
    endAngle,
    counterclockwise,
    length
  }
}

/**
 * Approximate the arc length of an ellipse sector.
 * Uses Ramanujan's approximation for ellipse circumference, then scales by arc fraction.
 */
function approximateEllipseArcLength(radiusX: number, radiusY: number, arcSpan: number): number {
  // Ramanujan's approximation for ellipse circumference
  const a = Math.max(radiusX, radiusY)
  const b = Math.min(radiusX, radiusY)
  const h = Math.pow((a - b) / (a + b), 2)
  const circumference = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))
  
  // Arc is approximately (arcSpan / 2π) of the circumference
  return circumference * Math.abs(arcSpan) / (2 * Math.PI)
}

/**
 * Create a bezier connector between two circles that maintains tangent continuity.
 */
function createTangentConnector(
  startPoint: Point,
  startAngle: number,
  startClockwise: boolean,
  startTangentLengthMult: number,
  endPoint: Point,
  endAngle: number,
  endClockwise: boolean,
  endTangentLengthMult: number
): BezierSegment {
  const startTangentOffset = startClockwise ? -Math.PI / 2 : Math.PI / 2
  const endTangentOffset = endClockwise ? -Math.PI / 2 : Math.PI / 2
  
  const startTangentAngle = startAngle + startTangentOffset
  const endTangentAngle = endAngle + endTangentOffset
  
  const dist = distance(startPoint, endPoint)
  const baseCpDist = dist * TANGENT_DISTANCE_FACTOR
  
  const startCpDist = baseCpDist * startTangentLengthMult
  const endCpDist = baseCpDist * endTangentLengthMult
  
  const cp1: Point = {
    x: startPoint.x + Math.cos(startTangentAngle) * startCpDist,
    y: startPoint.y + Math.sin(startTangentAngle) * startCpDist
  }
  
  const cp2: Point = {
    x: endPoint.x - Math.cos(endTangentAngle) * endCpDist,
    y: endPoint.y - Math.sin(endTangentAngle) * endCpDist
  }
  
  const controlPolyLen = distance(startPoint, cp1) + distance(cp1, cp2) + distance(cp2, endPoint)
  const approxLength = (dist + controlPolyLen) / 2
  
  return {
    type: 'bezier',
    start: startPoint,
    cp1,
    cp2,
    end: endPoint,
    length: approxLength
  }
}

/**
 * Calculate arc length going from startAngle to endAngle in the specified direction
 */
function calculateArcLength(
  radius: number,
  startAngle: number,
  endAngle: number,
  clockwise: boolean
): number {
  let delta = endAngle - startAngle
  
  if (clockwise) {
    while (delta < 0) delta += Math.PI * 2
    while (delta > Math.PI * 2) delta -= Math.PI * 2
  } else {
    while (delta > 0) delta -= Math.PI * 2
    while (delta < -Math.PI * 2) delta += Math.PI * 2
  }
  
  return radius * Math.abs(delta)
}

/**
 * Compute a partial path when some tangents are invalid
 */
function computePartialPath(
  tangents: (TangentResult | null)[]
): PathData {
  const segments: (LineSegment | ArcSegment)[] = []
  let totalLength = 0
  
  for (const tangent of tangents) {
    if (tangent) {
      const lineLen = distance(tangent.p1, tangent.p2)
      segments.push({
        type: 'line',
        start: tangent.p1,
        end: tangent.p2,
        length: lineLen
      })
      totalLength += lineLen
    }
  }
  
  return { segments, totalLength }
}

/**
 * Get ordered path segments for canvas rendering
 */
export function getOrderedPathSegments(
  shapes: CircleShape[],
  order: string[],
  globalStretch: number = 0,
  closed: boolean = true,
  useStartPoint: boolean = true,
  useEndPoint: boolean = true
): PathData {
  return computeTangentHull(shapes, order, globalStretch, closed, useStartPoint, useEndPoint)
}

/**
 * Information about a hit on a path segment
 */
export interface PathHitInfo {
  segmentIndex: number
  point: Point  // The closest point on the segment
  // For connector segments (line/bezier), this is the index of the circle the segment exits FROM
  // The new circle should be inserted at position (fromCircleIndex + 1) in the order
  fromCircleIndex: number
}

/**
 * Calculate the distance from a point to a line segment
 */
function distanceToLineSegment(point: Point, lineStart: Point, lineEnd: Point): { distance: number, closest: Point } {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y
  const lengthSq = dx * dx + dy * dy
  
  if (lengthSq === 0) {
    // Line segment is a point
    const dist = distance(point, lineStart)
    return { distance: dist, closest: lineStart }
  }
  
  // Project point onto line, clamped to segment
  let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq
  t = Math.max(0, Math.min(1, t))
  
  const closest: Point = {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy
  }
  
  return { distance: distance(point, closest), closest }
}

/**
 * Calculate the distance from a point to a bezier curve (approximated by sampling)
 */
function distanceToBezier(
  point: Point,
  start: Point,
  cp1: Point,
  cp2: Point,
  end: Point,
  samples: number = 20
): { distance: number, closest: Point } {
  let minDist = Infinity
  let closestPoint = start
  
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const t2 = t * t
    const t3 = t2 * t
    const mt = 1 - t
    const mt2 = mt * mt
    const mt3 = mt2 * mt
    
    const samplePoint: Point = {
      x: mt3 * start.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * end.x,
      y: mt3 * start.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * end.y
    }
    
    const dist = distance(point, samplePoint)
    if (dist < minDist) {
      minDist = dist
      closestPoint = samplePoint
    }
  }
  
  return { distance: minDist, closest: closestPoint }
}

/**
 * Find the path segment closest to a given point.
 * Returns null if no segment is within the threshold.
 * Only considers connector segments (line/bezier), not arc segments on circles.
 */
export function findPathSegmentAt(
  shapes: CircleShape[],
  order: string[],
  point: Point,
  threshold: number,
  globalStretch: number = 0,
  closed: boolean = true,
  useStartPoint: boolean = true,
  useEndPoint: boolean = true
): PathHitInfo | null {
  // Expand shapes to include mirrored circles
  const { expandedShapes, expandedOrder } = expandMirroredCircles(shapes, order)
  
  const circles = expandedOrder
    .map(id => expandedShapes.find(s => s.id === id))
    .filter((s): s is CircleShape => s !== undefined && s.type === 'circle')
  
  if (circles.length < 2) return null
  
  const pathData = computeTangentHull(shapes, order, globalStretch, closed, useStartPoint, useEndPoint)
  if (pathData.segments.length === 0) return null
  
  let closestHit: PathHitInfo | null = null
  let closestDist = Infinity
  
  // Track which circle we're "after" as we iterate segments
  // The path structure is: arc0, connector0, arc1, connector1, ...
  // connector[i] goes from circle[i] to circle[(i+1) % n]
  let connectorIndex = 0
  
  for (let i = 0; i < pathData.segments.length; i++) {
    const seg = pathData.segments[i]
    
    // We only want to detect clicks on connector segments (lines and beziers), not arcs
    if (seg.type === 'arc' || seg.type === 'ellipse-arc') {
      continue
    }
    
    let result: { distance: number, closest: Point }
    
    if (seg.type === 'line') {
      result = distanceToLineSegment(point, seg.start, seg.end)
    } else if (seg.type === 'bezier') {
      result = distanceToBezier(point, seg.start, seg.cp1, seg.cp2, seg.end)
    } else {
      continue
    }
    
    if (result.distance < threshold && result.distance < closestDist) {
      closestDist = result.distance
      closestHit = {
        segmentIndex: i,
        point: result.closest,
        fromCircleIndex: connectorIndex
      }
    }
    
    connectorIndex++
  }
  
  return closestHit
}

/**
 * Calculate the maximum radius for a new circle at a given position
 * such that it doesn't overlap any existing circles.
 * 
 * @param center - The center position for the new circle
 * @param shapes - Existing shapes to avoid
 * @param minRadius - Minimum radius to return
 * @param maxRadius - Maximum radius to return
 */
export function calculateNonOverlappingRadius(
  center: Point,
  shapes: CircleShape[],
  minRadius: number = NON_OVERLAP_MIN_RADIUS,
  maxRadius: number = NON_OVERLAP_MAX_RADIUS
): number {
  let maxAllowedRadius = maxRadius
  
  for (const shape of shapes) {
    if (shape.type === 'circle') {
      const dist = distance(center, shape.center)
      // The maximum radius we can use without overlapping this circle
      // is the distance to its center minus its radius, with a small gap
      const allowedRadius = dist - shape.radius - CIRCLE_GAP
      maxAllowedRadius = Math.min(maxAllowedRadius, allowedRadius)
    }
  }
  
  // Clamp to min/max
  return Math.max(minRadius, Math.min(maxRadius, maxAllowedRadius))
}
