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
  // Build lookup map for O(1) access
  const shapeMap = new Map(shapes.map(s => [s.id, s]))
  
  // Get ordered circles using map lookup
  const orderedCircles = order
    .map(id => shapeMap.get(id))
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
  // Build lookup map once for O(1) access in the resolver
  const shapeMap = new Map(shapes.map(s => [s.id, s]))
  
  return (circleId: string): number => {
    const circle = shapeMap.get(circleId)
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
  
  // Build lookup map for O(1) access
  const shapeMap = new Map(expandedShapes.map(s => [s.id, s]))
  
  // Get ordered circles from expanded set using map lookup
  const orderedCircles = expandedOrder
    .map(id => shapeMap.get(id))
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
    
    // Check if current circle is a mirror copy (ID ends with '_mirror')
    const currIsMirror = curr.id.endsWith('_mirror')
    
    const tangent = getTangentForDirections(
      curr.center, curr.radius, curr.direction ?? 'cw',
      next.center, next.radius, next.direction ?? 'cw',
      currIsMirror
    )
    
    tangents.push(tangent)
  }
  
  // Note: We no longer bail out early when some tangents are null.
  // Instead, we handle invalid tangents gracefully in the main loop,
  // skipping problematic segments while still drawing valid ones.
  
  // Create stretch resolver (use expanded shapes to include mirror copies)
  const resolveStretch = createStretchResolver(expandedShapes, globalStretch)
  
  // Build the path: for each circle, draw arc then connector to next circle
  let totalLength = 0
  
  // Track if we need to start a new sub-path (after skipping invalid segments)
  let needsMoveTo = true
  
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
    
    // Get the tangent from this circle to the next
    const currTangent = tangents[i]
    
    // Skip first circle entirely if path is open and useStartPoint is false
    if (!closed && isFirst && !useStartPoint) {
      // For open path without start point: just add connector to next (if tangent is valid)
      if (currTangent === null) {
        // Can't connect - skip this segment entirely
        needsMoveTo = true
        continue
      }
      
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
        connectorSeg.needsMoveTo = needsMoveTo
        segments.push(connectorSeg)
        totalLength += connectorSeg.length
      } else {
        const lineLen = distance(exitPoint, nextEntryPoint)
        segments.push({ type: 'line', start: exitPoint, end: nextEntryPoint, length: lineLen, needsMoveTo })
        totalLength += lineLen
      }
      needsMoveTo = false
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
    const prevTangent = tangents[prevTangentIndex]
    
    // Check if we can draw this circle's arc
    // For the arc, we need entry angle (from prevTangent) and exit angle (from currTangent)
    // Handle cases where one or both tangents are null
    
    const hasPrevTangent = prevTangent !== null || (!closed && isFirst && useStartPoint)
    const hasCurrTangent = currTangent !== null || (!closed && isLast && useEndPoint)
    
    // If we can't determine both entry and exit angles, skip this circle's arc
    if (!hasPrevTangent && !hasCurrTangent) {
      // Can't draw anything for this circle
      needsMoveTo = true
      continue
    }
    
    // Determine entry angle
    // For open paths with useStartPoint on first circle: entry is 180° opposite exit
    // This must be checked BEFORE prevTangent to avoid using the wrap-around tangent
    let entryAngle: number
    if (!closed && isFirst && useStartPoint && currTangent !== null) {
      // First circle in open path: set entry angle opposite to exit angle
      entryAngle = currTangent.angle1 + Math.PI
    } else if (prevTangent !== null) {
      entryAngle = prevTangent.angle2
    } else if (currTangent !== null) {
      // No prev tangent but we have curr tangent - use opposite of exit
      entryAngle = currTangent.angle1 + Math.PI
    } else {
      // Can't determine entry angle
      needsMoveTo = true
      continue
    }
    
    // Determine exit angle
    // For open paths with useEndPoint on last circle: exit is 180° opposite entry
    // This must be checked BEFORE currTangent to avoid using the wrap-around tangent
    let exitAngle: number
    if (!closed && isLast && useEndPoint && prevTangent !== null) {
      // Last circle in open path: set exit angle opposite to entry angle
      exitAngle = prevTangent.angle2 + Math.PI
    } else if (currTangent !== null) {
      exitAngle = currTangent.angle1
    } else if (prevTangent !== null) {
      // No curr tangent but we have prev tangent - use opposite of entry
      exitAngle = entryAngle + Math.PI
    } else {
      // Can't determine exit angle
      needsMoveTo = true
      continue
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
        counterclockwise: !clockwise,  // Flipped: CW circle uses decreasing angles, CCW uses increasing
        length: arcLen,
        needsMoveTo
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
      ellipseSeg.needsMoveTo = needsMoveTo
      segments.push(ellipseSeg)
      totalLength += ellipseSeg.length
    }
    
    needsMoveTo = false
    
    // === Connector segment from this circle to next circle ===
    // Skip if this is the last circle in an open path (no connector to first circle)
    // The path ends at this circle's exit point
    if (!closed && isLast) continue
    
    // Skip connector if the tangent to the next circle is invalid
    if (currTangent === null) {
      // Can't connect to next circle - the next circle will start a new sub-path
      needsMoveTo = true
      continue
    }
    
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
  // Arc direction is flipped: CW circle uses decreasing angles, CCW uses increasing
  let arcSpan = exitAngle - entryAngle
  if (clockwise) {
    // CW circle: decreasing angles (counterclockwise=false), negative span
    while (arcSpan > 0) arcSpan -= Math.PI * 2
    while (arcSpan < -Math.PI * 2) arcSpan += Math.PI * 2
  } else {
    // CCW circle: increasing angles (counterclockwise=true), positive span
    while (arcSpan < 0) arcSpan += Math.PI * 2
    while (arcSpan > Math.PI * 2) arcSpan -= Math.PI * 2
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
  const startTangentOffset = startClockwise ? Math.PI / 2 : -Math.PI / 2
  const endTangentOffset = endClockwise ? Math.PI / 2 : -Math.PI / 2
  
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
 * Arc direction is flipped: CW circle uses decreasing angles, CCW uses increasing
 */
function calculateArcLength(
  radius: number,
  startAngle: number,
  endAngle: number,
  clockwise: boolean
): number {
  let delta = endAngle - startAngle
  
  if (clockwise) {
    // CW circle: decreasing angles, negative delta
    while (delta > 0) delta -= Math.PI * 2
    while (delta < -Math.PI * 2) delta += Math.PI * 2
  } else {
    // CCW circle: increasing angles, positive delta
    while (delta < 0) delta += Math.PI * 2
    while (delta > Math.PI * 2) delta -= Math.PI * 2
  }
  
  return radius * Math.abs(delta)
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
 * If the closest segment is on the mirrored portion, the index is mapped back.
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
  
  // Build lookup map for O(1) access
  const shapeMap = new Map(expandedShapes.map(s => [s.id, s]))
  
  const circles = expandedOrder
    .map(id => shapeMap.get(id))
    .filter((s): s is CircleShape => s !== undefined && s.type === 'circle')
  
  if (circles.length < 2) return null
  
  const pathData = computeTangentHull(shapes, order, globalStretch, closed, useStartPoint, useEndPoint)
  if (pathData.segments.length === 0) return null
  
  // Number of original (non-mirrored) circles
  const originalCircleCount = order.length
  
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
      
      // Map mirrored circle indices back to original order
      let mappedIndex = connectorIndex
      if (connectorIndex >= originalCircleCount) {
        // Map from mirrored portion back to original
        mappedIndex = 2 * originalCircleCount - 1 - connectorIndex
        mappedIndex = Math.max(0, Math.min(originalCircleCount - 1, mappedIndex))
      }
      
      closestHit = {
        segmentIndex: i,
        point: result.closest,
        fromCircleIndex: mappedIndex
      }
    }
    
    connectorIndex++
  }
  
  return closestHit
}

/**
 * Calculate distance from a point to a circular arc
 */
function distanceToArc(
  point: Point,
  center: Point,
  radius: number,
  startAngle: number,
  endAngle: number,
  counterclockwise: boolean
): { distance: number, closest: Point } {
  // Angle from center to the point
  const angleToPoint = Math.atan2(point.y - center.y, point.x - center.x)
  
  // Normalize the arc span
  let arcStart = startAngle
  let arcEnd = endAngle
  
  // Calculate arc span based on direction
  let arcSpan: number
  if (counterclockwise) {
    // CCW: angles increase
    arcSpan = arcEnd - arcStart
    while (arcSpan < 0) arcSpan += Math.PI * 2
    while (arcSpan > Math.PI * 2) arcSpan -= Math.PI * 2
  } else {
    // CW: angles decrease
    arcSpan = arcStart - arcEnd
    while (arcSpan < 0) arcSpan += Math.PI * 2
    while (arcSpan > Math.PI * 2) arcSpan -= Math.PI * 2
  }
  
  // Check if the angle to the point falls within the arc
  const isWithinArc = (() => {
    // Normalize angle relative to start
    let relAngle = angleToPoint - arcStart
    while (relAngle < 0) relAngle += Math.PI * 2
    while (relAngle >= Math.PI * 2) relAngle -= Math.PI * 2
    
    if (counterclockwise) {
      return relAngle <= arcSpan
    } else {
      // For CW, the "within" range is in the negative direction
      let negRelAngle = arcStart - angleToPoint
      while (negRelAngle < 0) negRelAngle += Math.PI * 2
      while (negRelAngle >= Math.PI * 2) negRelAngle -= Math.PI * 2
      return negRelAngle <= arcSpan
    }
  })()
  
  if (isWithinArc) {
    // Closest point is on the arc at the same angle
    const closest = pointOnCircle(center, radius, angleToPoint)
    return { distance: Math.abs(distance(point, center) - radius), closest }
  } else {
    // Closest point is one of the arc endpoints
    const startPoint = pointOnCircle(center, radius, arcStart)
    const endPoint = pointOnCircle(center, radius, arcEnd)
    const distToStart = distance(point, startPoint)
    const distToEnd = distance(point, endPoint)
    
    if (distToStart < distToEnd) {
      return { distance: distToStart, closest: startPoint }
    } else {
      return { distance: distToEnd, closest: endPoint }
    }
  }
}

/**
 * Find the closest point on the entire path from a given point.
 * Unlike findPathSegmentAt, this considers ALL segments (arcs included)
 * and doesn't require a threshold - it always returns the closest point.
 * 
 * Returns the closest point and which circle index to insert after.
 * If the closest point is on the mirrored portion of the path, the index
 * is mapped back to the corresponding position in the original order.
 */
export function findClosestPointOnPath(
  shapes: CircleShape[],
  order: string[],
  point: Point,
  globalStretch: number = 0,
  closed: boolean = true,
  useStartPoint: boolean = true,
  useEndPoint: boolean = true
): PathHitInfo | null {
  // Expand shapes to include mirrored circles
  const { expandedShapes, expandedOrder } = expandMirroredCircles(shapes, order)
  
  // Build lookup map for O(1) access
  const shapeMap = new Map(expandedShapes.map(s => [s.id, s]))
  
  const circles = expandedOrder
    .map(id => shapeMap.get(id))
    .filter((s): s is CircleShape => s !== undefined && s.type === 'circle')
  
  if (circles.length < 2) return null
  
  const pathData = computeTangentHull(shapes, order, globalStretch, closed, useStartPoint, useEndPoint)
  if (pathData.segments.length === 0) return null
  
  // Number of original (non-mirrored) circles
  const originalCircleCount = order.length
  
  let closestHit: PathHitInfo | null = null
  let closestDist = Infinity
  
  // Track which circle we're "after" as we iterate segments
  // The path structure alternates: arc0, connector0, arc1, connector1, ...
  // - arc[i] wraps around circle[i]
  // - connector[i] goes from circle[i] to circle[(i+1) % n]
  // For any point on arc[i] or connector[i], insert after circle[i]
  let circleIndex = 0
  
  for (let i = 0; i < pathData.segments.length; i++) {
    const seg = pathData.segments[i]
    let result: { distance: number, closest: Point }
    let isConnector = false
    
    if (seg.type === 'arc') {
      result = distanceToArc(point, seg.center, seg.radius, seg.startAngle, seg.endAngle, seg.counterclockwise)
    } else if (seg.type === 'ellipse-arc') {
      // For ellipse arcs, approximate as circular arc for hit testing
      // Use the average of radiusX and radiusY
      const avgRadius = (seg.radiusX + seg.radiusY) / 2
      result = distanceToArc(point, seg.center, avgRadius, seg.startAngle, seg.endAngle, seg.counterclockwise)
    } else if (seg.type === 'line') {
      result = distanceToLineSegment(point, seg.start, seg.end)
      isConnector = true
    } else if (seg.type === 'bezier') {
      result = distanceToBezier(point, seg.start, seg.cp1, seg.cp2, seg.end)
      isConnector = true
    } else {
      continue
    }
    
    if (result.distance < closestDist) {
      closestDist = result.distance
      
      // Map mirrored circle indices back to original order
      // Mirrored circles go in reverse order after the originals:
      // [0, 1, 2, 2', 1', 0'] for n=3 with all mirrored
      // Index 3 (2') maps to 2, index 4 (1') maps to 1, index 5 (0') maps to 0
      let mappedIndex = circleIndex
      if (circleIndex >= originalCircleCount) {
        // Map from mirrored portion back to original
        // Formula: (2 * originalCount - 1 - circleIndex)
        mappedIndex = 2 * originalCircleCount - 1 - circleIndex
        // Clamp to valid range
        mappedIndex = Math.max(0, Math.min(originalCircleCount - 1, mappedIndex))
      }
      
      closestHit = {
        segmentIndex: i,
        point: result.closest,
        fromCircleIndex: mappedIndex
      }
    }
    
    // After processing a connector, we move to the next circle
    if (isConnector) {
      circleIndex++
    }
  }
  
  return closestHit
}

/**
 * Calculate the maximum radius for a new circle at a given position
 * such that it doesn't overlap any existing circles (including mirrored circles).
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
  
  // Include mirrored circles in the calculation
  const mirroredCircles = getMirroredCircles(shapes)
  const allCircles = [...shapes, ...mirroredCircles]
  
  for (const shape of allCircles) {
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
