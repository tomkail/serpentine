import type { Shape, CircleShape, MeasurementMode, LineSegment } from '../../../types'
import { computeTangentHull } from '../../../geometry/path'
import { MEASUREMENT_LABEL_OFFSET } from '../../../constants'

/**
 * Render measurements on the canvas
 */
export function renderMeasurements(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  order: string[],
  mode: MeasurementMode,
  zoom: number = 1
) {
  if (mode === 'clean') return
  
  const style = getComputedStyle(document.documentElement)
  const textColor = style.getPropertyValue('--measure-text').trim() || '#4a4a4a'
  
  // Scale factor for constant screen size
  const uiScale = 1 / zoom
  const fontSize = Math.round(10 * uiScale)
  
  ctx.fillStyle = textColor
  ctx.font = `${fontSize}px "JetBrains Mono", monospace`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  
  const circles = shapes.filter((s): s is CircleShape => s.type === 'circle')
  
  // Render circle radii
  for (const circle of circles) {
    renderCircleRadius(ctx, circle, textColor, uiScale)
  }
  
  // Render path measurements
  if (circles.length >= 2) {
    const pathData = computeTangentHull(circles, order)
    
    // Segment lengths (only in detailed mode)
    if (mode === 'detailed') {
      const lines = pathData.segments.filter((s): s is LineSegment => s.type === 'line')
      renderSegmentLengths(ctx, lines, textColor, uiScale)
    }
  }
}

function renderCircleRadius(
  ctx: CanvasRenderingContext2D,
  circle: CircleShape,
  color: string,
  uiScale: number
) {
  const { center, radius } = circle
  
  // Position label above and to the right of the circle (constant screen offset)
  const labelX = center.x + radius * 0.7
  const labelY = center.y - radius - MEASUREMENT_LABEL_OFFSET * uiScale
  
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  
  // Format radius to 1 decimal place if needed
  const radiusText = radius % 1 === 0 ? radius.toString() : radius.toFixed(1)
  ctx.fillText(`r: ${radiusText}`, labelX, labelY)
}

function renderSegmentLengths(
  ctx: CanvasRenderingContext2D,
  lines: LineSegment[],
  color: string,
  uiScale: number
) {
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  
  // Render line segment lengths
  for (const line of lines) {
    const midX = (line.start.x + line.end.x) / 2
    const midY = (line.start.y + line.end.y) / 2
    
    // Calculate perpendicular offset for label (constant screen offset)
    const dx = line.end.x - line.start.x
    const dy = line.end.y - line.start.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len === 0) continue
    
    const offset = MEASUREMENT_LABEL_OFFSET * uiScale
    const perpX = -dy / len * offset
    const perpY = dx / len * offset
    
    const lengthText = line.length.toFixed(1)
    ctx.fillText(lengthText, midX + perpX, midY + perpY)
  }
}
