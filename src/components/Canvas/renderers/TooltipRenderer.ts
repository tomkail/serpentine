import type { Shape, CircleShape, Point, CanvasTheme, HoverTarget, MirrorAxis } from '../../../types'
import { getDotPosition, computeTangentHandleInfo } from './hitTesting'
import { expandMirroredCircles } from '../../../geometry/path'
import { ACTION_ROW_OFFSET, ACTION_ICON_SPACING } from '../../../constants'

/**
 * Configuration for tooltip labels
 */
const TOOLTIP_CONFIG = {
  fontSize: 10,            // Base font size in screen pixels
  fontFamily: '"JetBrains Mono", monospace',
  padding: { x: 8, y: 5 }, // Padding inside the tooltip background
  offset: 20,              // Distance from the element
  borderRadius: 4,
  opacity: 0.95,
}

/**
 * Get tooltip text and position for a given hover target
 */
function getTooltipInfo(
  hoverTarget: HoverTarget,
  shape: CircleShape | null,
  shapes: Shape[],
  shapeOrder: string[],
  zoom: number,
  closedPath: boolean,
  useStartPoint: boolean,
  useEndPoint: boolean,
  mirrorAxis: MirrorAxis = 'vertical'
): { text: string; position: Point; anchor: 'above' | 'below' | 'left' | 'right' } | null {
  if (!hoverTarget || !shape) return null

  const uiScale = 1 / zoom

  switch (hoverTarget.type) {
    case 'index-dot': {
      const currentIndex = shapeOrder.indexOf(shape.id)
      const targetIndex = hoverTarget.dotIndex
      const position = getDotPosition(shape.center, targetIndex, shapeOrder.length, zoom)
      
      if (currentIndex === targetIndex) {
        return {
          text: `Order: ${targetIndex + 1} of ${shapeOrder.length}`,
          position,
          anchor: 'above'
        }
      } else {
        return {
          text: `Reorder to ${targetIndex + 1}`,
          position,
          anchor: 'above'
        }
      }
    }

    case 'direction-ring': {
      return {
        text: 'Reverse direction',
        position: {
          x: shape.center.x,
          y: shape.center.y - shape.radius * 0.81  // At direction ring radius
        },
        anchor: 'above'
      }
    }

    case 'delete-icon': {
      const rowY = shape.center.y + shape.radius + ACTION_ROW_OFFSET * uiScale
      return {
        text: 'Delete circle',
        position: {
          x: shape.center.x + (ACTION_ICON_SPACING / 2) * uiScale,
          y: rowY
        },
        anchor: 'below'
      }
    }

    case 'mirror-icon': {
      const rowY = shape.center.y + shape.radius + ACTION_ROW_OFFSET * uiScale
      const isMirrored = shape.mirrored ?? false
      return {
        text: isMirrored ? 'Disable mirror' : 'Enable mirror',
        position: {
          x: shape.center.x - (ACTION_ICON_SPACING / 2) * uiScale,
          y: rowY
        },
        anchor: 'below'
      }
    }

    case 'entry-offset-slot':
    case 'exit-offset-slot': {
      // Get tangent info to find slot position
      const circles = shapes.filter((s): s is CircleShape => s.type === 'circle')
      const { expandedShapes, expandedOrder } = expandMirroredCircles(circles, shapeOrder, mirrorAxis)
      const info = computeTangentHandleInfo(shape, expandedShapes, expandedOrder, closedPath, useStartPoint, useEndPoint)
      if (!info) return null

      const isEntry = hoverTarget.type === 'entry-offset-slot'
      return {
        text: 'Reset offset',
        position: isEntry ? info.rawEntryPoint : info.rawExitPoint,
        anchor: 'above'
      }
    }

    case 'entry-length-slot':
    case 'exit-length-slot': {
      // Get tangent info to find slot position
      const circles = shapes.filter((s): s is CircleShape => s.type === 'circle')
      const { expandedShapes, expandedOrder } = expandMirroredCircles(circles, shapeOrder, mirrorAxis)
      const info = computeTangentHandleInfo(shape, expandedShapes, expandedOrder, closedPath, useStartPoint, useEndPoint)
      if (!info) return null

      const isEntry = hoverTarget.type === 'entry-length-slot'
      return {
        text: 'Reset length',
        position: isEntry ? info.rawEntryLengthHandle : info.rawExitLengthHandle,
        anchor: 'above'
      }
    }

    default:
      return null
  }
}

/**
 * Draw a tooltip with background at the specified position
 */
function drawTooltip(
  ctx: CanvasRenderingContext2D,
  text: string,
  position: Point,
  anchor: 'above' | 'below' | 'left' | 'right',
  theme: CanvasTheme,
  uiScale: number
) {
  const fontSize = TOOLTIP_CONFIG.fontSize * uiScale
  const padding = {
    x: TOOLTIP_CONFIG.padding.x * uiScale,
    y: TOOLTIP_CONFIG.padding.y * uiScale
  }
  const offset = TOOLTIP_CONFIG.offset * uiScale
  const borderRadius = TOOLTIP_CONFIG.borderRadius * uiScale

  ctx.save()

  // Set up font for measurement
  ctx.font = `500 ${fontSize}px ${TOOLTIP_CONFIG.fontFamily}`
  const metrics = ctx.measureText(text)
  const textWidth = metrics.width
  const textHeight = fontSize

  // Calculate label dimensions
  const labelWidth = textWidth + padding.x * 2
  const labelHeight = textHeight + padding.y * 2

  // Calculate label position based on anchor
  let labelX = position.x
  let labelY = position.y

  switch (anchor) {
    case 'above':
      labelX -= labelWidth / 2
      labelY -= offset + labelHeight
      break
    case 'below':
      labelX -= labelWidth / 2
      labelY += offset
      break
    case 'left':
      labelX -= offset + labelWidth
      labelY -= labelHeight / 2
      break
    case 'right':
      labelX += offset
      labelY -= labelHeight / 2
      break
  }

  // Draw background with slight transparency
  ctx.globalAlpha = TOOLTIP_CONFIG.opacity
  ctx.fillStyle = theme.fill
  ctx.strokeStyle = theme.chrome
  ctx.lineWidth = 1 * uiScale

  // Draw rounded rectangle background
  ctx.beginPath()
  ctx.roundRect(labelX, labelY, labelWidth, labelHeight, borderRadius)
  ctx.fill()
  ctx.stroke()

  // Draw text (use accent color for consistency with handle value labels)
  ctx.globalAlpha = 1
  ctx.fillStyle = theme.accent
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, labelX + labelWidth / 2, labelY + labelHeight / 2)

  ctx.restore()
}

/**
 * Render tooltips for hovered interactive elements
 * 
 * Shows contextual help text for:
 * - Index dots: "Click to move to position X" / "Current position"
 * - Direction ring: "Click to toggle direction"
 * - Delete icon: "Delete shape"
 * - Mirror icon: "Toggle mirror"
 * - Slot markers: "Click to reset"
 */
export function renderTooltips(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  shapeOrder: string[],
  hoveredId: string | null,
  hoverTarget: HoverTarget,
  theme: CanvasTheme,
  zoom: number,
  closedPath: boolean = true,
  useStartPoint: boolean = true,
  useEndPoint: boolean = true,
  mirrorAxis: MirrorAxis = 'vertical'
) {
  // Only show tooltips when not dragging
  if (!hoverTarget || !hoveredId) return

  const uiScale = 1 / zoom

  // Get the shape being hovered
  const shape = shapes.find(s => s.id === hoveredId)
  if (!shape || shape.type !== 'circle') return

  // Get tooltip info for the current hover target
  const tooltipInfo = getTooltipInfo(
    hoverTarget,
    shape,
    shapes,
    shapeOrder,
    zoom,
    closedPath,
    useStartPoint,
    useEndPoint,
    mirrorAxis
  )
  
  if (!tooltipInfo) return

  // Draw the tooltip
  drawTooltip(ctx, tooltipInfo.text, tooltipInfo.position, tooltipInfo.anchor, theme, uiScale)
}

