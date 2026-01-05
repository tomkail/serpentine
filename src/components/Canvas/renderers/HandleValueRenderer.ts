import type { Shape, CircleShape, Point, CanvasTheme, HoverTarget, DragMode } from '../../../types'
import { computeTangentHandleInfo, TangentHandleInfo } from './ShapeRenderer'
import { expandMirroredCircles } from '../../../geometry/path'

/**
 * Configuration for handle value labels
 */
const LABEL_CONFIG = {
  fontSize: 11,            // Base font size in screen pixels
  fontFamily: '"JetBrains Mono", monospace',
  padding: { x: 6, y: 3 }, // Padding inside the label background
  offset: 16,              // Distance from the handle
  borderRadius: 4,
  opacity: 0.95,
}

/**
 * Format a number for display
 * - Integers: no decimals
 * - Small decimals: 1 decimal place
 * - Very small: 2 decimal places
 */
function formatValue(value: number, decimals: number = 1): string {
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(decimals)
}

/**
 * Format an angle in radians to degrees
 */
function formatAngle(radians: number): string {
  const degrees = radians * (180 / Math.PI)
  return `${formatValue(degrees, 1)}°`
}

/**
 * Format a position as (x, y)
 */
function formatPosition(point: Point): string {
  return `${formatValue(point.x)}, ${formatValue(point.y)}`
}

/**
 * Format a tangent length multiplier
 */
function formatLength(length: number): string {
  return `${formatValue(length, 2)}×`
}

/**
 * Get the label text and position for a given hover target
 */
function getHandleValueInfo(
  hoverTarget: HoverTarget,
  shape: CircleShape | null,
  tangentInfo: TangentHandleInfo | null,
  dragMode: DragMode
): { text: string; position: Point; anchor: 'above' | 'below' | 'left' | 'right' } | null {
  if (!shape) return null

  // Determine what value to show based on hover target or drag mode
  const targetType = dragMode ?? hoverTarget?.type

  switch (targetType) {
    case 'shape-body':
    case 'move':
      return {
        text: formatPosition(shape.center),
        position: shape.center,
        anchor: 'above'
      }

    case 'shape-edge':
    case 'scale':
      // Position the label at the edge being hovered/scaled
      return {
        text: `r: ${formatValue(shape.radius)}`,
        position: {
          x: shape.center.x + shape.radius,
          y: shape.center.y
        },
        anchor: 'right'
      }

    case 'entry-offset':
    case 'tangent-entry-offset':
      if (!tangentInfo) return null
      const entryOffset = shape.entryOffset ?? 0
      return {
        text: formatAngle(entryOffset),
        position: tangentInfo.entryPoint,
        anchor: 'above'
      }

    case 'exit-offset':
    case 'tangent-exit-offset':
      if (!tangentInfo) return null
      const exitOffset = shape.exitOffset ?? 0
      return {
        text: formatAngle(exitOffset),
        position: tangentInfo.exitPoint,
        anchor: 'above'
      }

    case 'entry-length':
    case 'tangent-entry-length':
      if (!tangentInfo) return null
      const entryLength = shape.entryTangentLength ?? 1.0
      return {
        text: formatLength(entryLength),
        position: tangentInfo.entryLengthHandle,
        anchor: 'above'
      }

    case 'exit-length':
    case 'tangent-exit-length':
      if (!tangentInfo) return null
      const exitLength = shape.exitTangentLength ?? 1.0
      return {
        text: formatLength(exitLength),
        position: tangentInfo.exitLengthHandle,
        anchor: 'above'
      }

    default:
      return null
  }
}

/**
 * Draw a label with background at the specified position
 */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  position: Point,
  anchor: 'above' | 'below' | 'left' | 'right',
  theme: CanvasTheme,
  uiScale: number
) {
  const fontSize = LABEL_CONFIG.fontSize * uiScale
  const padding = {
    x: LABEL_CONFIG.padding.x * uiScale,
    y: LABEL_CONFIG.padding.y * uiScale
  }
  const offset = LABEL_CONFIG.offset * uiScale
  const borderRadius = LABEL_CONFIG.borderRadius * uiScale

  ctx.save()

  // Set up font for measurement
  ctx.font = `500 ${fontSize}px ${LABEL_CONFIG.fontFamily}`
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
  ctx.globalAlpha = LABEL_CONFIG.opacity
  ctx.fillStyle = theme.fill
  ctx.strokeStyle = theme.accent
  ctx.lineWidth = 1 * uiScale

  // Draw rounded rectangle background
  ctx.beginPath()
  ctx.roundRect(labelX, labelY, labelWidth, labelHeight, borderRadius)
  ctx.fill()
  ctx.stroke()

  // Draw text
  ctx.globalAlpha = 1
  ctx.fillStyle = theme.accent
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, labelX + labelWidth / 2, labelY + labelHeight / 2)

  ctx.restore()
}

/**
 * Render handle value labels for hovered or selected handles
 * 
 * This unified component displays values for:
 * - Position (x, y) when hovering/dragging shape body
 * - Radius when hovering/dragging shape edge
 * - Tangent offset angles in degrees
 * - Tangent length multipliers
 */
export function renderHandleValues(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  shapeOrder: string[],
  selectedIds: string[],
  hoveredId: string | null,
  hoverTarget: HoverTarget,
  dragMode: DragMode,
  dragShapeId: string | null,
  theme: CanvasTheme,
  zoom: number
) {
  const uiScale = 1 / zoom

  // Get the shape being interacted with
  const interactedId = dragShapeId ?? hoveredId
  if (!interactedId) return

  const shape = shapes.find(s => s.id === interactedId)
  if (!shape || shape.type !== 'circle') return

  // Only show values for selected shapes or while dragging
  const isSelected = selectedIds.includes(interactedId)
  const isDragging = dragMode !== null

  // For body/edge hover, only show when selected or dragging
  if (!isSelected && !isDragging) {
    // Exception: still show for tangent handles on selected shapes
    const isTangentHandle = hoverTarget?.type?.includes('offset') || 
                           hoverTarget?.type?.includes('length')
    if (!isTangentHandle) return
  }

  // Compute tangent info if needed
  let tangentInfo: TangentHandleInfo | null = null
  const circles = shapes.filter((s): s is CircleShape => s.type === 'circle')
  const { expandedShapes, expandedOrder } = expandMirroredCircles(circles, shapeOrder)
  
  if (hoverTarget?.type?.includes('offset') || 
      hoverTarget?.type?.includes('length') ||
      dragMode?.includes('tangent')) {
    tangentInfo = computeTangentHandleInfo(shape, expandedShapes, expandedOrder)
  }

  // Get value info for the current interaction
  const valueInfo = getHandleValueInfo(hoverTarget, shape, tangentInfo, dragMode)
  if (!valueInfo) return

  // Draw the label
  drawLabel(ctx, valueInfo.text, valueInfo.position, valueInfo.anchor, theme, uiScale)
}

