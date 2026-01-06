import type { SmartGuide } from '../../../geometry/smartGuides'
import type { Point } from '../../../types'

/**
 * Smart Guides Renderer
 * 
 * Draws alignment guide lines when dragging circles.
 * Lines are red (like Figma) and extend across the entire visible canvas area.
 * X markers are drawn at the target alignment points.
 */

// Guide line styling
const GUIDE_COLOR = '#FF3366'  // Bright red/pink like Figma
const GUIDE_LINE_WIDTH = 1      // Thin line in screen pixels
const MARKER_SIZE = 5           // X marker size in screen pixels

/**
 * Draw an X marker at the specified position
 */
function drawXMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
): void {
  ctx.beginPath()
  ctx.moveTo(x - size, y - size)
  ctx.lineTo(x + size, y + size)
  ctx.moveTo(x + size, y - size)
  ctx.lineTo(x - size, y + size)
  ctx.stroke()
}

/**
 * Render smart guide lines on the canvas
 * 
 * @param ctx - Canvas rendering context (already transformed to world coordinates)
 * @param guides - Active alignment guides to render
 * @param canvasWidth - Canvas width in screen pixels
 * @param canvasHeight - Canvas height in screen pixels
 * @param pan - Current viewport pan offset
 * @param zoom - Current viewport zoom level
 */
export function renderSmartGuides(
  ctx: CanvasRenderingContext2D,
  guides: SmartGuide[],
  canvasWidth: number,
  canvasHeight: number,
  pan: Point,
  zoom: number
): void {
  if (guides.length === 0) return
  
  // Calculate visible area in world coordinates
  const worldLeft = -pan.x / zoom
  const worldTop = -pan.y / zoom
  const worldRight = (canvasWidth - pan.x) / zoom
  const worldBottom = (canvasHeight - pan.y) / zoom
  
  // Add margin to ensure lines extend beyond visible area
  const margin = 100 / zoom
  
  // Line width and marker size should be constant in screen space
  const lineWidth = GUIDE_LINE_WIDTH / zoom
  const markerSize = MARKER_SIZE / zoom
  const markerLineWidth = 1.5 / zoom
  
  ctx.save()
  ctx.strokeStyle = GUIDE_COLOR
  ctx.lineCap = 'round'
  
  // Draw each guide line
  ctx.lineWidth = lineWidth
  for (const guide of guides) {
    ctx.beginPath()
    
    if (guide.axis === 'vertical') {
      // Vertical line at x = guide.position
      ctx.moveTo(guide.position, worldTop - margin)
      ctx.lineTo(guide.position, worldBottom + margin)
    } else {
      // Horizontal line at y = guide.position
      ctx.moveTo(worldLeft - margin, guide.position)
      ctx.lineTo(worldRight + margin, guide.position)
    }
    
    ctx.stroke()
  }
  
  // Draw X markers at target points
  ctx.lineWidth = markerLineWidth
  for (const guide of guides) {
    drawXMarker(ctx, guide.targetPoint.x, guide.targetPoint.y, markerSize)
  }
  
  ctx.restore()
}

