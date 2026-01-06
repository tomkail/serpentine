import type { Shape, CircleShape, MeasurementMode, LineSegment, BezierSegment, ArcSegment, EllipseArcSegment, MirrorAxis } from '../../../types'
import { computeTangentHull } from '../../../geometry/path'
import { MEASUREMENT_LABEL_OFFSET } from '../../../constants'

// Cache for measurement CSS values
let measureCssCache: { textColor: string } | null = null
let lastMeasureThemeCheck = 0

function getMeasureCssValues(): { textColor: string } {
  const now = performance.now()
  if (measureCssCache && now - lastMeasureThemeCheck < 16) {
    return measureCssCache
  }
  lastMeasureThemeCheck = now
  
  const style = getComputedStyle(document.documentElement)
  measureCssCache = {
    textColor: style.getPropertyValue('--measure-text').trim() || '#4a4a4a'
  }
  return measureCssCache
}

// Allow external invalidation when theme changes
export function invalidateMeasurementStyleCache() {
  measureCssCache = null
}

/**
 * Render measurements on the canvas
 */
export function renderMeasurements(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  order: string[],
  mode: MeasurementMode,
  zoom: number = 1,
  closed: boolean = true,
  useStartPoint: boolean = true,
  useEndPoint: boolean = true,
  mirrorAxis: MirrorAxis = 'vertical'
) {
  if (mode === 'clean') return
  
  const { textColor } = getMeasureCssValues()
  
  // Scale factor for constant screen size
  const uiScale = 1 / zoom
  const fontSize = Math.round(10 * uiScale)
  
  ctx.fillStyle = textColor
  ctx.font = `${fontSize}px "JetBrains Mono", monospace`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  
  const circles = shapes.filter((s): s is CircleShape => s.type === 'circle')
  
  // Render path measurements
  if (circles.length >= 2) {
    const pathData = computeTangentHull(circles, order, 0, closed, useStartPoint, useEndPoint, mirrorAxis)
    
    // Segment lengths (only in detailed mode)
    if (mode === 'detailed') {
      const lines = pathData.segments.filter((s): s is LineSegment => s.type === 'line')
      const beziers = pathData.segments.filter((s): s is BezierSegment => s.type === 'bezier')
      const arcs = pathData.segments.filter((s): s is ArcSegment => s.type === 'arc')
      const ellipseArcs = pathData.segments.filter((s): s is EllipseArcSegment => s.type === 'ellipse-arc')
      
      renderSegmentLengths(ctx, lines, textColor, uiScale)
      renderBezierLengths(ctx, beziers, textColor, uiScale)
      renderArcLengths(ctx, arcs, textColor, uiScale)
      renderEllipseArcLengths(ctx, ellipseArcs, textColor, uiScale)
    }
  }
}

function renderSegmentLengths(
  ctx: CanvasRenderingContext2D,
  lines: LineSegment[],
  color: string,
  uiScale: number
) {
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  const lineWidth = 1 * uiScale
  
  // Render line segment lengths
  for (const line of lines) {
    const midX = (line.start.x + line.end.x) / 2
    const midY = (line.start.y + line.end.y) / 2
    
    // Calculate perpendicular offset for label (constant screen offset)
    const dx = line.end.x - line.start.x
    const dy = line.end.y - line.start.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len === 0) continue
    
    // Calculate the angle of the line
    let angle = Math.atan2(dy, dx)
    
    // Normalize angle so text is never upside down (readable from bottom or right)
    if (angle > Math.PI / 2) {
      angle -= Math.PI
    } else if (angle < -Math.PI / 2) {
      angle += Math.PI
    }
    
    const offset = MEASUREMENT_LABEL_OFFSET * uiScale
    const perpX = -dy / len * offset
    const perpY = dx / len * offset
    
    // Calculate measurement line endpoints (offset from main line endpoints)
    const measureStartX = line.start.x + perpX
    const measureStartY = line.start.y + perpY
    const measureEndX = line.end.x + perpX
    const measureEndY = line.end.y + perpY
    
    // Position for the label (offset from line midpoint)
    const labelX = midX + perpX
    const labelY = midY + perpY
    
    const lengthText = line.length.toFixed(1)
    
    // Measure text width to create gap for text
    const textMetrics = ctx.measureText(lengthText)
    const textWidth = textMetrics.width
    const textPadding = 4 * uiScale
    const halfTextWidth = textWidth / 2 + textPadding
    
    ctx.lineWidth = lineWidth
    
    // Draw connecting line from main line start to measurement line start
    ctx.beginPath()
    ctx.moveTo(line.start.x, line.start.y)
    ctx.lineTo(measureStartX, measureStartY)
    ctx.stroke()
    
    // Draw connecting line from main line end to measurement line end
    ctx.beginPath()
    ctx.moveTo(line.end.x, line.end.y)
    ctx.lineTo(measureEndX, measureEndY)
    ctx.stroke()
    
    // Draw measurement line with gap for text (in rotated coordinates)
    ctx.save()
    ctx.translate(labelX, labelY)
    ctx.rotate(angle)
    
    const halfLineLen = len / 2
    
    // Left measurement line (from start to text gap)
    ctx.beginPath()
    ctx.moveTo(-halfLineLen, 0)
    ctx.lineTo(-halfTextWidth, 0)
    ctx.stroke()
    
    // Right measurement line (from text gap to end)
    ctx.beginPath()
    ctx.moveTo(halfTextWidth, 0)
    ctx.lineTo(halfLineLen, 0)
    ctx.stroke()
    
    // Draw text
    ctx.fillText(lengthText, 0, 0)
    
    ctx.restore()
  }
}

/**
 * Calculate a point on a cubic bezier curve at parameter t (0-1)
 */
function bezierPoint(
  start: { x: number; y: number },
  cp1: { x: number; y: number },
  cp2: { x: number; y: number },
  end: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  const t2 = t * t
  const t3 = t2 * t
  
  return {
    x: mt3 * start.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * end.x,
    y: mt3 * start.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * end.y
  }
}

/**
 * Calculate the tangent (derivative) of a cubic bezier curve at parameter t
 */
function bezierTangent(
  start: { x: number; y: number },
  cp1: { x: number; y: number },
  cp2: { x: number; y: number },
  end: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t
  
  return {
    x: 3 * mt2 * (cp1.x - start.x) + 6 * mt * t * (cp2.x - cp1.x) + 3 * t2 * (end.x - cp2.x),
    y: 3 * mt2 * (cp1.y - start.y) + 6 * mt * t * (cp2.y - cp1.y) + 3 * t2 * (end.y - cp2.y)
  }
}

/**
 * Calculate the normal (perpendicular) at a point on a bezier curve
 */
function bezierNormal(
  start: { x: number; y: number },
  cp1: { x: number; y: number },
  cp2: { x: number; y: number },
  end: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const tangent = bezierTangent(start, cp1, cp2, end, t)
  const len = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y)
  if (len === 0) return { x: 0, y: -1 }
  // Rotate tangent 90 degrees counterclockwise for normal
  return { x: -tangent.y / len, y: tangent.x / len }
}

function renderBezierLengths(
  ctx: CanvasRenderingContext2D,
  beziers: BezierSegment[],
  color: string,
  uiScale: number
) {
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  const lineWidth = 1 * uiScale
  const offset = MEASUREMENT_LABEL_OFFSET * uiScale
  
  for (const bezier of beziers) {
    // Get the midpoint of the curve (t = 0.5)
    const midPoint = bezierPoint(bezier.start, bezier.cp1, bezier.cp2, bezier.end, 0.5)
    
    // Get the tangent at the midpoint for text rotation
    const tangent = bezierTangent(bezier.start, bezier.cp1, bezier.cp2, bezier.end, 0.5)
    const tangentLen = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y)
    if (tangentLen === 0) continue
    
    // Calculate the angle of the tangent for text
    let textAngle = Math.atan2(tangent.y, tangent.x)
    
    // Normalize angle so text is never upside down
    if (textAngle > Math.PI / 2) {
      textAngle -= Math.PI
    } else if (textAngle < -Math.PI / 2) {
      textAngle += Math.PI
    }
    
    // Calculate perpendicular offset for label position
    const midNormal = bezierNormal(bezier.start, bezier.cp1, bezier.cp2, bezier.end, 0.5)
    const labelX = midPoint.x + midNormal.x * offset
    const labelY = midPoint.y + midNormal.y * offset
    
    const lengthText = bezier.length.toFixed(1)
    const textMetrics = ctx.measureText(lengthText)
    const textWidth = textMetrics.width
    const textPadding = 4 * uiScale
    const halfTextWidth = textWidth / 2 + textPadding
    
    // Find t values where the curve is halfTextWidth away from the label (for text gap)
    // We approximate by finding t values based on arc length proportion
    const gapStartT = Math.max(0, 0.5 - (halfTextWidth / bezier.length) * 0.5)
    const gapEndT = Math.min(1, 0.5 + (halfTextWidth / bezier.length) * 0.5)
    
    ctx.lineWidth = lineWidth
    
    // Draw offset bezier curve from start to gap start
    ctx.beginPath()
    const numSegments = 20
    for (let i = 0; i <= numSegments; i++) {
      const t = (i / numSegments) * gapStartT
      const pt = bezierPoint(bezier.start, bezier.cp1, bezier.cp2, bezier.end, t)
      const normal = bezierNormal(bezier.start, bezier.cp1, bezier.cp2, bezier.end, t)
      const ox = pt.x + normal.x * offset
      const oy = pt.y + normal.y * offset
      if (i === 0) {
        ctx.moveTo(ox, oy)
      } else {
        ctx.lineTo(ox, oy)
      }
    }
    ctx.stroke()
    
    // Draw offset bezier curve from gap end to end
    ctx.beginPath()
    for (let i = 0; i <= numSegments; i++) {
      const t = gapEndT + (i / numSegments) * (1 - gapEndT)
      const pt = bezierPoint(bezier.start, bezier.cp1, bezier.cp2, bezier.end, t)
      const normal = bezierNormal(bezier.start, bezier.cp1, bezier.cp2, bezier.end, t)
      const ox = pt.x + normal.x * offset
      const oy = pt.y + normal.y * offset
      if (i === 0) {
        ctx.moveTo(ox, oy)
      } else {
        ctx.lineTo(ox, oy)
      }
    }
    ctx.stroke()
    
    // Draw connecting lines from main curve to measurement line at start and end
    const startNormal = bezierNormal(bezier.start, bezier.cp1, bezier.cp2, bezier.end, 0)
    const startCapX = bezier.start.x + startNormal.x * offset
    const startCapY = bezier.start.y + startNormal.y * offset
    
    // Line from curve start to measurement line start
    ctx.beginPath()
    ctx.moveTo(bezier.start.x, bezier.start.y)
    ctx.lineTo(startCapX, startCapY)
    ctx.stroke()
    
    const endNormal = bezierNormal(bezier.start, bezier.cp1, bezier.cp2, bezier.end, 1)
    const endCapX = bezier.end.x + endNormal.x * offset
    const endCapY = bezier.end.y + endNormal.y * offset
    
    // Line from curve end to measurement line end
    ctx.beginPath()
    ctx.moveTo(bezier.end.x, bezier.end.y)
    ctx.lineTo(endCapX, endCapY)
    ctx.stroke()
    
    // Draw text
    ctx.save()
    ctx.translate(labelX, labelY)
    ctx.rotate(textAngle)
    ctx.fillText(lengthText, 0, 0)
    ctx.restore()
  }
}

function renderArcLengths(
  ctx: CanvasRenderingContext2D,
  arcs: ArcSegment[],
  color: string,
  uiScale: number
) {
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  const lineWidth = 1 * uiScale
  const offset = MEASUREMENT_LABEL_OFFSET * uiScale
  
  for (const arc of arcs) {
    // Calculate the normalized angles for proper arc traversal
    let startAngle = arc.startAngle
    let endAngle = arc.endAngle
    
    // Normalize angles for midpoint calculation
    if (arc.counterclockwise) {
      if (endAngle > startAngle) {
        endAngle -= 2 * Math.PI
      }
    } else {
      if (endAngle < startAngle) {
        endAngle += 2 * Math.PI
      }
    }
    
    const midAngle = (startAngle + endAngle) / 2
    const arcSpan = Math.abs(endAngle - startAngle)
    
    // Tangent is perpendicular to radius at the midpoint
    let tangentAngle = arc.counterclockwise ? midAngle - Math.PI / 2 : midAngle + Math.PI / 2
    
    // Normalize angle so text is never upside down
    if (tangentAngle > Math.PI / 2) {
      tangentAngle -= Math.PI
    } else if (tangentAngle < -Math.PI / 2) {
      tangentAngle += Math.PI
    }
    
    // Offset radius for measurement line (outward from center)
    const measureRadius = arc.radius + offset
    
    // Label position at the midpoint of the offset arc
    const labelX = arc.center.x + measureRadius * Math.cos(midAngle)
    const labelY = arc.center.y + measureRadius * Math.sin(midAngle)
    
    const lengthText = arc.length.toFixed(1)
    const textMetrics = ctx.measureText(lengthText)
    const textWidth = textMetrics.width
    const textPadding = 4 * uiScale
    const halfTextWidth = textWidth / 2 + textPadding
    
    // Calculate the angular gap needed for the text
    // Arc length = radius * angle, so angle = arc length / radius
    const textGapAngle = (halfTextWidth / measureRadius)
    
    // Calculate gap angles around midpoint
    const gapStartAngle = midAngle - textGapAngle
    const gapEndAngle = midAngle + textGapAngle
    
    ctx.lineWidth = lineWidth
    
    // Draw the first arc segment (from start to gap)
    ctx.beginPath()
    if (arc.counterclockwise) {
      // For counterclockwise, draw from startAngle to gapEndAngle (going negative)
      ctx.arc(arc.center.x, arc.center.y, measureRadius, arc.startAngle, gapEndAngle, true)
    } else {
      // For clockwise, draw from startAngle to gapStartAngle (going positive)
      ctx.arc(arc.center.x, arc.center.y, measureRadius, arc.startAngle, gapStartAngle, false)
    }
    ctx.stroke()
    
    // Draw the second arc segment (from gap to end)
    ctx.beginPath()
    if (arc.counterclockwise) {
      // For counterclockwise, draw from gapStartAngle to endAngle (going negative)
      ctx.arc(arc.center.x, arc.center.y, measureRadius, gapStartAngle, arc.endAngle, true)
    } else {
      // For clockwise, draw from gapEndAngle to endAngle (going positive)
      ctx.arc(arc.center.x, arc.center.y, measureRadius, gapEndAngle, arc.endAngle, false)
    }
    ctx.stroke()
    
    // Draw connecting lines from main arc to measurement arc at start and end
    // Start point on main arc
    const mainStartX = arc.center.x + arc.radius * Math.cos(arc.startAngle)
    const mainStartY = arc.center.y + arc.radius * Math.sin(arc.startAngle)
    // Start point on measurement arc
    const measureStartX = arc.center.x + measureRadius * Math.cos(arc.startAngle)
    const measureStartY = arc.center.y + measureRadius * Math.sin(arc.startAngle)
    
    ctx.beginPath()
    ctx.moveTo(mainStartX, mainStartY)
    ctx.lineTo(measureStartX, measureStartY)
    ctx.stroke()
    
    // End point on main arc
    const mainEndX = arc.center.x + arc.radius * Math.cos(arc.endAngle)
    const mainEndY = arc.center.y + arc.radius * Math.sin(arc.endAngle)
    // End point on measurement arc
    const measureEndX = arc.center.x + measureRadius * Math.cos(arc.endAngle)
    const measureEndY = arc.center.y + measureRadius * Math.sin(arc.endAngle)
    
    ctx.beginPath()
    ctx.moveTo(mainEndX, mainEndY)
    ctx.lineTo(measureEndX, measureEndY)
    ctx.stroke()
    
    // Draw length text
    ctx.save()
    ctx.translate(labelX, labelY)
    ctx.rotate(tangentAngle)
    ctx.fillText(lengthText, 0, 0)
    ctx.restore()
    
    // Draw angle indicator with lines extending from center to circle edge
    const angleArcRadius = Math.min(arc.radius * 0.4, 40 * uiScale) // Smaller arc for angle label
    const angleDegrees = (arcSpan * 180 / Math.PI)
    const angleText = angleDegrees.toFixed(1) + '°'
    const radiusText = 'r: ' + arc.radius.toFixed(0)
    
    // Draw line from center to start of arc (full radius)
    ctx.beginPath()
    ctx.moveTo(arc.center.x, arc.center.y)
    ctx.lineTo(
      arc.center.x + arc.radius * Math.cos(arc.startAngle),
      arc.center.y + arc.radius * Math.sin(arc.startAngle)
    )
    ctx.stroke()
    
    // Draw line from center to end of arc (full radius)
    ctx.beginPath()
    ctx.moveTo(arc.center.x, arc.center.y)
    ctx.lineTo(
      arc.center.x + arc.radius * Math.cos(arc.endAngle),
      arc.center.y + arc.radius * Math.sin(arc.endAngle)
    )
    ctx.stroke()
    
    // Draw the angle arc (smaller radius for the angle indicator)
    ctx.beginPath()
    ctx.arc(arc.center.x, arc.center.y, angleArcRadius, arc.startAngle, arc.endAngle, arc.counterclockwise)
    ctx.stroke()
    
    // Position angle text on the angle arc
    const angleLabelRadius = angleArcRadius + offset * 0.5 + 2 * uiScale
    const angleLabelX = arc.center.x + angleLabelRadius * Math.cos(midAngle)
    const angleLabelY = arc.center.y + angleLabelRadius * Math.sin(midAngle)
    
    // Calculate text rotation to follow the arc
    let angleTextRotation = midAngle + Math.PI / 2 // Perpendicular to radius
    if (arc.counterclockwise) {
      angleTextRotation = midAngle - Math.PI / 2
    }
    
    // Normalize so text is never upside down
    if (angleTextRotation > Math.PI / 2) {
      angleTextRotation -= Math.PI
    } else if (angleTextRotation < -Math.PI / 2) {
      angleTextRotation += Math.PI
    }
    
    ctx.save()
    ctx.translate(angleLabelX, angleLabelY)
    ctx.rotate(angleTextRotation)
    ctx.fillText(angleText, 0, 0)
    ctx.restore()
    
    // Draw radius label on the start angle line (at midpoint of the line)
    const radiusMidX = arc.center.x + (arc.radius / 2) * Math.cos(arc.startAngle)
    const radiusMidY = arc.center.y + (arc.radius / 2) * Math.sin(arc.startAngle)
    
    // Calculate text rotation to align with the radius line
    let radiusTextRotation = arc.startAngle
    // Normalize so text is never upside down
    if (radiusTextRotation > Math.PI / 2) {
      radiusTextRotation -= Math.PI
    } else if (radiusTextRotation < -Math.PI / 2) {
      radiusTextRotation += Math.PI
    }
    
    // Offset the text perpendicular to the line
    const radiusLabelOffset = offset * 0.6
    const radiusLabelX = radiusMidX + Math.cos(arc.startAngle + Math.PI / 2) * radiusLabelOffset
    const radiusLabelY = radiusMidY + Math.sin(arc.startAngle + Math.PI / 2) * radiusLabelOffset
    
    ctx.save()
    ctx.translate(radiusLabelX, radiusLabelY)
    ctx.rotate(radiusTextRotation)
    ctx.fillText(radiusText, 0, 0)
    ctx.restore()
  }
}

/**
 * Get a point on an ellipse at a given angle, transformed by rotation and center
 */
function ellipsePoint(
  center: { x: number; y: number },
  radiusX: number,
  radiusY: number,
  rotation: number,
  angle: number
): { x: number; y: number } {
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const localX = radiusX * Math.cos(angle)
  const localY = radiusY * Math.sin(angle)
  return {
    x: center.x + localX * cos - localY * sin,
    y: center.y + localX * sin + localY * cos
  }
}

/**
 * Get the normal vector at a point on an ellipse
 */
function ellipseNormal(
  radiusX: number,
  radiusY: number,
  rotation: number,
  angle: number,
  counterclockwise: boolean
): { x: number; y: number } {
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  // Tangent in local coords: (-radiusX*sin(angle), radiusY*cos(angle))
  let localTangentX = -radiusX * Math.sin(angle)
  let localTangentY = radiusY * Math.cos(angle)
  
  if (counterclockwise) {
    localTangentX = -localTangentX
    localTangentY = -localTangentY
  }
  
  // Rotate tangent to world coords
  const tangentX = localTangentX * cos - localTangentY * sin
  const tangentY = localTangentX * sin + localTangentY * cos
  
  // Normal is perpendicular to tangent (rotate 90 degrees counterclockwise)
  const len = Math.sqrt(tangentX * tangentX + tangentY * tangentY)
  if (len === 0) return { x: 0, y: -1 }
  return { x: -tangentY / len, y: tangentX / len }
}

function renderEllipseArcLengths(
  ctx: CanvasRenderingContext2D,
  ellipseArcs: EllipseArcSegment[],
  color: string,
  uiScale: number
) {
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  const lineWidth = 1 * uiScale
  const offset = MEASUREMENT_LABEL_OFFSET * uiScale
  
  for (const arc of ellipseArcs) {
    // Calculate the normalized angles for proper arc traversal
    let startAngle = arc.startAngle
    let endAngle = arc.endAngle
    
    if (arc.counterclockwise) {
      if (endAngle > startAngle) {
        endAngle -= 2 * Math.PI
      }
    } else {
      if (endAngle < startAngle) {
        endAngle += 2 * Math.PI
      }
    }
    
    const midAngle = (startAngle + endAngle) / 2
    
    // Calculate midpoint position on the ellipse
    const midPoint = ellipsePoint(arc.center, arc.radiusX, arc.radiusY, arc.rotation, midAngle)
    const midNormal = ellipseNormal(arc.radiusX, arc.radiusY, arc.rotation, midAngle, arc.counterclockwise)
    
    // Calculate tangent direction at midpoint for text rotation
    const cos = Math.cos(arc.rotation)
    const sin = Math.sin(arc.rotation)
    let localTangentX = -arc.radiusX * Math.sin(midAngle)
    let localTangentY = arc.radiusY * Math.cos(midAngle)
    if (arc.counterclockwise) {
      localTangentX = -localTangentX
      localTangentY = -localTangentY
    }
    const tangentX = localTangentX * cos - localTangentY * sin
    const tangentY = localTangentX * sin + localTangentY * cos
    
    let tangentAngle = Math.atan2(tangentY, tangentX)
    if (tangentAngle > Math.PI / 2) {
      tangentAngle -= Math.PI
    } else if (tangentAngle < -Math.PI / 2) {
      tangentAngle += Math.PI
    }
    
    // Label position
    const labelX = midPoint.x + midNormal.x * offset
    const labelY = midPoint.y + midNormal.y * offset
    
    const lengthText = arc.length.toFixed(1)
    const textMetrics = ctx.measureText(lengthText)
    const textWidth = textMetrics.width
    const textPadding = 4 * uiScale
    const halfTextWidth = textWidth / 2 + textPadding
    
    // Calculate the angular gap needed for the text (approximate)
    const avgRadius = (arc.radiusX + arc.radiusY) / 2 + offset
    const textGapAngle = halfTextWidth / avgRadius
    
    const gapStartAngle = midAngle - textGapAngle
    const gapEndAngle = midAngle + textGapAngle
    
    ctx.lineWidth = lineWidth
    
    // Draw the offset ellipse arc as a polyline
    const drawOffsetEllipseArc = (fromAngle: number, toAngle: number) => {
      ctx.beginPath()
      const steps = Math.max(10, Math.abs(toAngle - fromAngle) / (Math.PI / 20))
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const angle = fromAngle + t * (toAngle - fromAngle)
        const pt = ellipsePoint(arc.center, arc.radiusX, arc.radiusY, arc.rotation, angle)
        const normal = ellipseNormal(arc.radiusX, arc.radiusY, arc.rotation, angle, arc.counterclockwise)
        const ox = pt.x + normal.x * offset
        const oy = pt.y + normal.y * offset
        if (i === 0) {
          ctx.moveTo(ox, oy)
        } else {
          ctx.lineTo(ox, oy)
        }
      }
      ctx.stroke()
    }
    
    // Draw first segment (from start to gap)
    if (arc.counterclockwise) {
      drawOffsetEllipseArc(arc.startAngle, gapEndAngle)
      drawOffsetEllipseArc(gapStartAngle, arc.endAngle)
    } else {
      drawOffsetEllipseArc(arc.startAngle, gapStartAngle)
      drawOffsetEllipseArc(gapEndAngle, arc.endAngle)
    }
    
    // Draw connecting lines from main ellipse arc to measurement arc at start and end
    // Start point on main ellipse arc
    const startPt = ellipsePoint(arc.center, arc.radiusX, arc.radiusY, arc.rotation, arc.startAngle)
    const startNormal = ellipseNormal(arc.radiusX, arc.radiusY, arc.rotation, arc.startAngle, arc.counterclockwise)
    // Start point on measurement arc
    const startMeasureX = startPt.x + startNormal.x * offset
    const startMeasureY = startPt.y + startNormal.y * offset
    
    ctx.beginPath()
    ctx.moveTo(startPt.x, startPt.y)
    ctx.lineTo(startMeasureX, startMeasureY)
    ctx.stroke()
    
    // End point on main ellipse arc
    const endPt = ellipsePoint(arc.center, arc.radiusX, arc.radiusY, arc.rotation, arc.endAngle)
    const endNormal = ellipseNormal(arc.radiusX, arc.radiusY, arc.rotation, arc.endAngle, arc.counterclockwise)
    // End point on measurement arc
    const endMeasureX = endPt.x + endNormal.x * offset
    const endMeasureY = endPt.y + endNormal.y * offset
    
    ctx.beginPath()
    ctx.moveTo(endPt.x, endPt.y)
    ctx.lineTo(endMeasureX, endMeasureY)
    ctx.stroke()
    
    // Draw length text
    ctx.save()
    ctx.translate(labelX, labelY)
    ctx.rotate(tangentAngle)
    ctx.fillText(lengthText, 0, 0)
    ctx.restore()
    
    // Draw angle indicator with lines extending from center to ellipse edge
    const ellipseAvgRadius = (arc.radiusX + arc.radiusY) / 2
    const angleArcRadius = Math.min(ellipseAvgRadius * 0.4, 40 * uiScale)
    const arcSpan = Math.abs(endAngle - startAngle)
    const angleDegrees = (arcSpan * 180 / Math.PI)
    const angleText = angleDegrees.toFixed(1) + '°'
    const radiusText = 'r: ' + arc.radiusX.toFixed(0) + '×' + arc.radiusY.toFixed(0)
    
    // Get full-radius points for the angle lines
    const startFullPt = ellipsePoint(arc.center, arc.radiusX, arc.radiusY, arc.rotation, arc.startAngle)
    const endFullPt = ellipsePoint(arc.center, arc.radiusX, arc.radiusY, arc.rotation, arc.endAngle)
    
    // Draw line from center to start of arc (full radius)
    ctx.beginPath()
    ctx.moveTo(arc.center.x, arc.center.y)
    ctx.lineTo(startFullPt.x, startFullPt.y)
    ctx.stroke()
    
    // Draw line from center to end of arc (full radius)
    ctx.beginPath()
    ctx.moveTo(arc.center.x, arc.center.y)
    ctx.lineTo(endFullPt.x, endFullPt.y)
    ctx.stroke()
    
    // Draw the angle arc (smaller radius for the angle indicator)
    const indicatorScale = angleArcRadius / ellipseAvgRadius
    ctx.beginPath()
    ctx.ellipse(
      arc.center.x, 
      arc.center.y, 
      arc.radiusX * indicatorScale, 
      arc.radiusY * indicatorScale, 
      arc.rotation, 
      arc.startAngle, 
      arc.endAngle, 
      arc.counterclockwise
    )
    ctx.stroke()
    
    // Position angle text on the angle arc
    const angleLabelPt = ellipsePoint(
      arc.center, 
      arc.radiusX * indicatorScale + offset * 0.5 + 2 * uiScale, 
      arc.radiusY * indicatorScale + offset * 0.5 + 2 * uiScale, 
      arc.rotation, 
      midAngle
    )
    
    // Calculate text rotation to follow the arc
    let angleTextRotation = tangentAngle
    
    ctx.save()
    ctx.translate(angleLabelPt.x, angleLabelPt.y)
    ctx.rotate(angleTextRotation)
    ctx.fillText(angleText, 0, 0)
    ctx.restore()
    
    // Draw radius label on the start angle line (at midpoint)
    const radiusMidPt = ellipsePoint(arc.center, arc.radiusX / 2, arc.radiusY / 2, arc.rotation, arc.startAngle)
    
    // Calculate text rotation to align with the radius line
    const radiusLineAngle = Math.atan2(startFullPt.y - arc.center.y, startFullPt.x - arc.center.x)
    let radiusTextRotation = radiusLineAngle
    // Normalize so text is never upside down
    if (radiusTextRotation > Math.PI / 2) {
      radiusTextRotation -= Math.PI
    } else if (radiusTextRotation < -Math.PI / 2) {
      radiusTextRotation += Math.PI
    }
    
    // Offset the text perpendicular to the line
    const radiusLabelOffset = offset * 0.6
    const radiusLabelX = radiusMidPt.x + Math.cos(radiusLineAngle + Math.PI / 2) * radiusLabelOffset
    const radiusLabelY = radiusMidPt.y + Math.sin(radiusLineAngle + Math.PI / 2) * radiusLabelOffset
    
    ctx.save()
    ctx.translate(radiusLabelX, radiusLabelY)
    ctx.rotate(radiusTextRotation)
    ctx.fillText(radiusText, 0, 0)
    ctx.restore()
  }
}
