import type { Shape, CircleShape, ArcSegment, EllipseArcSegment, LineSegment, BezierSegment, PathSegment } from '../../../types'
import { computeTangentHull } from '../../../geometry/path'
import { pointOnCircle } from '../../../geometry/math'
import { useDebugStore } from '../../../stores/debugStore'
import { PATH_LABEL_OFFSET } from '../../../constants'

/**
 * Render the tangent hull path around the shapes.
 * Stretch deforms circular arcs into elliptical arcs.
 */
export function renderPath(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  order: string[],
  zoom: number = 1,
  globalStretch: number = 0,
  closed: boolean = true,
  useStartPoint: boolean = true,
  useEndPoint: boolean = true
) {
  const circles = shapes.filter((s): s is CircleShape => s.type === 'circle')
  
  if (circles.length < 2) return
  
  const pathData = computeTangentHull(circles, order, globalStretch, closed, useStartPoint, useEndPoint)
  
  if (pathData.segments.length === 0) return
  
  const style = getComputedStyle(document.documentElement)
  const pathStroke = style.getPropertyValue('--path-stroke').trim() || '#a0a0a0'
  const pathWidth = parseFloat(style.getPropertyValue('--path-width')) || 2
  
  // Scale factor for constant screen size
  const uiScale = 1 / zoom
  
  ctx.strokeStyle = pathStroke
  ctx.lineWidth = pathWidth * uiScale // Constant screen width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  
  // Draw the complete path by iterating through segments in order
  ctx.beginPath()
  
  let started = false
  
  for (let i = 0; i < pathData.segments.length; i++) {
    const seg = pathData.segments[i]
    
    if (seg.type === 'arc') {
      const arc = seg as ArcSegment
      
      if (!started) {
        // Move to the start of the arc
        const startPt = pointOnCircle(arc.center, arc.radius, arc.startAngle)
        ctx.moveTo(startPt.x, startPt.y)
        started = true
      }
      
      // Draw the arc
      ctx.arc(arc.center.x, arc.center.y, arc.radius, arc.startAngle, arc.endAngle, arc.counterclockwise)
      
    } else if (seg.type === 'line') {
      const line = seg as LineSegment
      
      if (!started) {
        ctx.moveTo(line.start.x, line.start.y)
        started = true
      }
      
      ctx.lineTo(line.end.x, line.end.y)
      
    } else if (seg.type === 'bezier') {
      const bezier = seg as BezierSegment
      
      if (!started) {
        ctx.moveTo(bezier.start.x, bezier.start.y)
        started = true
      }
      
      // Draw cubic bezier curve
      ctx.bezierCurveTo(
        bezier.cp1.x, bezier.cp1.y,
        bezier.cp2.x, bezier.cp2.y,
        bezier.end.x, bezier.end.y
      )
    } else if (seg.type === 'ellipse-arc') {
      const ellipse = seg as EllipseArcSegment
      
      if (!started) {
        // Calculate start point on ellipse
        const startX = ellipse.center.x + ellipse.radiusX * Math.cos(ellipse.startAngle) * Math.cos(ellipse.rotation) 
                     - ellipse.radiusY * Math.sin(ellipse.startAngle) * Math.sin(ellipse.rotation)
        const startY = ellipse.center.y + ellipse.radiusX * Math.cos(ellipse.startAngle) * Math.sin(ellipse.rotation) 
                     + ellipse.radiusY * Math.sin(ellipse.startAngle) * Math.cos(ellipse.rotation)
        ctx.moveTo(startX, startY)
        started = true
      }
      
      // Draw elliptical arc
      ctx.ellipse(
        ellipse.center.x,
        ellipse.center.y,
        ellipse.radiusX,
        ellipse.radiusY,
        ellipse.rotation,
        ellipse.startAngle,
        ellipse.endAngle,
        ellipse.counterclockwise
      )
    }
  }
  
  // Only close the path if it's meant to loop
  if (closed) {
    ctx.closePath()
  }
  ctx.stroke()
  
  // Debug visualizations
  const debug = useDebugStore.getState()
  renderDebugInfo(ctx, pathData.segments, circles, order, debug, zoom)
}

/**
 * Render debug visualizations
 */
function renderDebugInfo(
  ctx: CanvasRenderingContext2D,
  segments: PathSegment[],
  circles: CircleShape[],
  order: string[],
  debug: {
    showTangentPoints: boolean
    showTangentLabels: boolean
    showArcAngles: boolean
    showPathOrder: boolean
    showCircleCenters: boolean
  },
  zoom: number
) {
  // Scale factor for constant screen size
  const uiScale = 1 / zoom
  
  // Filter segments by type
  const arcs = segments.filter(s => s.type === 'arc') as ArcSegment[]
  
  // All "connector" segments (lines or beziers)
  const connectors = segments.filter(s => s.type === 'line' || s.type === 'bezier') as (LineSegment | BezierSegment)[]
  
  // Tangent points
  if (debug.showTangentPoints) {
    for (let i = 0; i < connectors.length; i++) {
      const conn = connectors[i]
      
      // Start point = green (exit point from source circle)
      ctx.fillStyle = '#00ff00'
      ctx.beginPath()
      ctx.arc(conn.start.x, conn.start.y, 6 * uiScale, 0, Math.PI * 2)
      ctx.fill()
      
      // End point = red (entry point on dest circle)
      ctx.fillStyle = '#ff0000'
      ctx.beginPath()
      ctx.arc(conn.end.x, conn.end.y, 4 * uiScale, 0, Math.PI * 2)
      ctx.fill()
      
      // If bezier, also show control points
      if (conn.type === 'bezier') {
        const bezier = conn as BezierSegment
        ctx.fillStyle = '#ffff00'
        ctx.beginPath()
        ctx.arc(bezier.cp1.x, bezier.cp1.y, 3 * uiScale, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(bezier.cp2.x, bezier.cp2.y, 3 * uiScale, 0, Math.PI * 2)
        ctx.fill()
        
        // Draw control point lines
        ctx.strokeStyle = '#ffff0066'
        ctx.lineWidth = 1 * uiScale
        ctx.beginPath()
        ctx.moveTo(bezier.start.x, bezier.start.y)
        ctx.lineTo(bezier.cp1.x, bezier.cp1.y)
        ctx.moveTo(bezier.end.x, bezier.end.y)
        ctx.lineTo(bezier.cp2.x, bezier.cp2.y)
        ctx.stroke()
      }
      
      // Labels
      if (debug.showTangentLabels) {
        const fontSize = Math.round(11 * uiScale)
        ctx.font = `${fontSize}px monospace`
        ctx.fillStyle = '#ffffff'
        const prefix = conn.type === 'bezier' ? 'B' : 'L'
        ctx.fillText(`${prefix}${i}s`, conn.start.x + 8 * uiScale, conn.start.y - 8 * uiScale)
        ctx.fillText(`${prefix}${i}e`, conn.end.x + 8 * uiScale, conn.end.y + 12 * uiScale)
      }
    }
  }
  
  // Arc angles
  if (debug.showArcAngles) {
    const fontSize = Math.round(10 * uiScale)
    ctx.font = `${fontSize}px monospace`
    for (let i = 0; i < arcs.length; i++) {
      const arc = arcs[i]
      const midAngle = (arc.startAngle + arc.endAngle) / 2
      const labelOffset = PATH_LABEL_OFFSET * uiScale
      const labelX = arc.center.x + (arc.radius + labelOffset) * Math.cos(midAngle)
      const labelY = arc.center.y + (arc.radius + labelOffset) * Math.sin(midAngle)
      
      ctx.fillStyle = '#ffff00'
      ctx.fillText(`A${i}`, labelX, labelY)
      
      // Draw angle indicators
      ctx.strokeStyle = '#ffff0066'
      ctx.lineWidth = 1 * uiScale
      
      // Start angle line
      ctx.beginPath()
      ctx.moveTo(arc.center.x, arc.center.y)
      const startPt = pointOnCircle(arc.center, arc.radius, arc.startAngle)
      ctx.lineTo(startPt.x, startPt.y)
      ctx.stroke()
      
      // End angle line
      ctx.beginPath()
      ctx.moveTo(arc.center.x, arc.center.y)
      const endPt = pointOnCircle(arc.center, arc.radius, arc.endAngle)
      ctx.lineTo(endPt.x, endPt.y)
      ctx.stroke()
      
      // Direction indicator
      ctx.fillStyle = arc.counterclockwise ? '#ff00ff' : '#00ffff'
      ctx.fillText(arc.counterclockwise ? 'CCW' : 'CW', arc.center.x - 10 * uiScale, arc.center.y)
    }
  }
  
  // Path order numbers
  if (debug.showPathOrder) {
    const fontSize = Math.round(14 * uiScale)
    ctx.font = `bold ${fontSize}px monospace`
    for (let i = 0; i < order.length; i++) {
      const circle = circles.find(c => c.id === order[i])
      if (circle) {
        // Draw order number in circle center
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 3 * uiScale
        const text = `${i + 1}`
        const metrics = ctx.measureText(text)
        ctx.strokeText(text, circle.center.x - metrics.width / 2, circle.center.y + 5 * uiScale)
        ctx.fillText(text, circle.center.x - metrics.width / 2, circle.center.y + 5 * uiScale)
      }
    }
  }
  
  // Circle centers with coordinates
  if (debug.showCircleCenters) {
    const fontSize = Math.round(9 * uiScale)
    ctx.font = `${fontSize}px monospace`
    for (const circle of circles) {
      // Center dot
      ctx.fillStyle = '#ff8800'
      ctx.beginPath()
      ctx.arc(circle.center.x, circle.center.y, 3 * uiScale, 0, Math.PI * 2)
      ctx.fill()
      
      // Coordinates
      ctx.fillStyle = '#ff8800'
      const coordText = `(${Math.round(circle.center.x)}, ${Math.round(circle.center.y)})`
      ctx.fillText(coordText, circle.center.x + 5 * uiScale, circle.center.y - 5 * uiScale)
      
      // Radius
      ctx.fillText(`r=${Math.round(circle.radius)}`, circle.center.x + 5 * uiScale, circle.center.y + 12 * uiScale)
    }
  }
}
