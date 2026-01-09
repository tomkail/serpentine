import type { Shape, CircleShape, Point, CanvasTheme, HoverTarget, MirrorConfig } from '../../../types'
import type { ModifierKeys } from '../../../stores/selectionStore'
import { getDotPosition, computeTangentHandleInfo } from './hitTesting'
import { expandMirroredCircles } from '../../../geometry/path'
import { ACTION_ROW_OFFSET, ACTION_ICON_SPACING, POSITION_SNAP_INCREMENT } from '../../../constants'
import { normalize, subtract, snapPointToGrid } from '../../../geometry/math'

/**
 * Configuration for tooltip labels
 */
const TOOLTIP_CONFIG = {
  fontSize: 11,            // Base font size in screen pixels
  fontFamily: '"JetBrains Mono", monospace',
  padding: { x: 10, y: 8 }, // Padding inside the tooltip background
  offset: 16,              // Distance from the pivot point
  borderRadius: 5,
  opacity: 1.0,            // Full opacity for legibility
  lineHeight: 1.5,         // Line height multiplier
  sectionGap: 6,           // Extra gap between value and action sections
}

/**
 * Configuration for pivot marker
 */
const PIVOT_MARKER_CONFIG = {
  size: 8,        // Size of the X in screen pixels
  strokeWidth: 2, // Line width in screen pixels
}

/**
 * Check if a modifier hint text corresponds to an active modifier key
 * Modifier hints use symbols: ⌥ (Alt/Option), ⇧ (Shift)
 * Also handles combined modifiers like "⇧/⌥"
 */
function isModifierActive(modifierText: string, modifierKeys: ModifierKeys | undefined): boolean {
  if (!modifierKeys) return false
  
  const text = modifierText.toLowerCase()
  
  // Check for Alt/Option (⌥)
  if (text.includes('⌥') && modifierKeys.alt) return true
  
  // Check for Shift (⇧)
  if (text.includes('⇧') && modifierKeys.shift) return true
  
  // Check for Ctrl (⌃) - not currently used but good to have
  if (text.includes('⌃') && modifierKeys.ctrl) return true
  
  // Check for Cmd/Meta (⌘) - not currently used but good to have
  if (text.includes('⌘') && modifierKeys.meta) return true
  
  return false
}

/**
 * Calculate the exact opposite point on the circle from the cursor
 */
function findExactOppositePoint(circle: CircleShape, cursor: Point): Point {
  const { center, radius } = circle
  const dir = normalize(subtract(cursor, center))
  // Return the point on the opposite side
  return {
    x: center.x - dir.x * radius,
    y: center.y - dir.y * radius
  }
}

/**
 * Draw an X marker at the specified position to indicate a pivot point
 * @param active - When true, marker is fully visible (Alt held). When false, marker is subtle preview.
 */
function drawPivotMarker(
  ctx: CanvasRenderingContext2D,
  position: Point,
  theme: CanvasTheme,
  uiScale: number,
  active: boolean = true
) {
  const size = PIVOT_MARKER_CONFIG.size * uiScale
  const strokeWidth = PIVOT_MARKER_CONFIG.strokeWidth * uiScale
  
  ctx.save()
  
  ctx.strokeStyle = theme.accent
  ctx.lineWidth = strokeWidth
  ctx.lineCap = 'round'
  ctx.globalAlpha = active ? 1.0 : 0.6
  
  // Draw X shape
  ctx.beginPath()
  // Top-left to bottom-right
  ctx.moveTo(position.x - size / 2, position.y - size / 2)
  ctx.lineTo(position.x + size / 2, position.y + size / 2)
  // Top-right to bottom-left
  ctx.moveTo(position.x + size / 2, position.y - size / 2)
  ctx.lineTo(position.x - size / 2, position.y + size / 2)
  ctx.stroke()
  
  ctx.restore()
}

/**
 * Render pivot marker for scale operations (during drag or hover with Alt)
 * This is exported separately so it can be called during drag operations
 * when tooltips are not shown.
 */
export function renderScalePivotMarker(
  ctx: CanvasRenderingContext2D,
  pivotPoint: Point | undefined,
  theme: CanvasTheme,
  zoom: number,
  active: boolean = true
) {
  if (!pivotPoint) return
  
  const uiScale = 1 / zoom
  drawPivotMarker(ctx, pivotPoint, theme, uiScale, active)
}

/**
 * Tooltip content with optional multi-line support
 */
interface TooltipContent {
  /** Primary value line (e.g., "r: 50") */
  value?: string
  /** Action description (e.g., "Drag to scale") */
  action?: string
  /** Modifier key hints (e.g., ["⌥ opposite edge", "⇧ snap"]) */
  modifiers?: string[]
}

/**
 * Get tooltip content and position for a given hover target
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
  mirrorConfig: MirrorConfig = { planeCount: 1, startAngle: 0 },
  mouseWorldPos: Point | null = null,
  selectedCount: number = 1
): { content: TooltipContent; position: Point; anchor: 'above' | 'below' | 'left' | 'right' } | null {
  if (!hoverTarget || !shape) return null

  const uiScale = 1 / zoom
  
  // Helper to get tangent info
  const getTangentInfo = () => {
    const circles = shapes.filter((s): s is CircleShape => s.type === 'circle')
    const { expandedShapes, expandedOrder } = expandMirroredCircles(circles, shapeOrder, mirrorConfig)
    return computeTangentHandleInfo(shape, expandedShapes, expandedOrder, closedPath, useStartPoint, useEndPoint)
  }

  switch (hoverTarget.type) {
    case 'shape-edge': {
      // Position above the closest point on the circle edge to the cursor
      let edgePosition: Point
      if (mouseWorldPos) {
        // Calculate the point on the circle closest to the cursor
        const dx = mouseWorldPos.x - shape.center.x
        const dy = mouseWorldPos.y - shape.center.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 0) {
          edgePosition = {
            x: shape.center.x + (dx / dist) * shape.radius,
            y: shape.center.y + (dy / dist) * shape.radius
          }
        } else {
          // Fallback to top of circle if cursor is exactly at center
          edgePosition = { x: shape.center.x, y: shape.center.y - shape.radius }
        }
      } else {
        // Fallback to top of circle
        edgePosition = { x: shape.center.x, y: shape.center.y - shape.radius }
      }
      
      // Build modifiers list - only show "scale all" when multiple circles are selected
      const scaleModifiers = ['⌥ from opposite']
      if (selectedCount > 1) {
        scaleModifiers.push('⇧ scale all')
      }
      
      return {
        content: {
          value: `r: ${shape.radius}`,
          action: 'Drag to scale',
          modifiers: scaleModifiers
        },
        position: edgePosition,
        anchor: 'above'
      }
    }

    case 'entry-offset':
    case 'exit-offset': {
      const info = getTangentInfo()
      if (!info) return null
      
      const isEntry = hoverTarget.type === 'entry-offset'
      const offset = isEntry ? (shape.entryOffset ?? 0) : (shape.exitOffset ?? 0)
      const degrees = offset * (180 / Math.PI)
      // Position above the tangent point (pivot for offset adjustment)
      const position = isEntry ? info.entryPoint : info.exitPoint
      
      return {
        content: {
          value: `${degrees.toFixed(1)}°`,
          action: 'Drag to adjust offset',
          modifiers: ['⇧ link both', '⌥ mirror', 'Right-click reset']
        },
        position,
        anchor: 'above'
      }
    }

    case 'entry-length':
    case 'exit-length': {
      const info = getTangentInfo()
      if (!info) return null
      
      const isEntry = hoverTarget.type === 'entry-length'
      const length = isEntry ? (shape.entryTangentLength ?? 1.0) : (shape.exitTangentLength ?? 1.0)
      // Position above the length handle (the actual handle being hovered)
      const position = isEntry ? info.entryLengthHandle : info.exitLengthHandle
      
      return {
        content: {
          value: `${length.toFixed(2)}×`,
          action: 'Drag to adjust length',
          modifiers: ['⇧ link both', '⌥ mirror', 'Right-click reset']
        },
        position,
        anchor: 'above'
      }
    }

    case 'index-dot': {
      const currentIndex = shapeOrder.indexOf(shape.id)
      const targetIndex = hoverTarget.dotIndex
      const position = getDotPosition(shape.center, targetIndex, shapeOrder.length, zoom)
      
      if (currentIndex === targetIndex) {
        return {
          content: {
            value: `${targetIndex + 1} of ${shapeOrder.length}`,
            action: 'Current position'
          },
          position,
          anchor: 'above'
        }
      } else {
        return {
          content: {
            action: `Reorder to ${targetIndex + 1}`
          },
          position,
          anchor: 'above'
        }
      }
    }

    case 'direction-ring': {
      const direction = shape.direction === 'cw' ? 'clockwise' : 'counter-clockwise'
      return {
        content: {
          value: direction,
          action: 'Click to reverse',
          modifiers: selectedCount > 1 ? ['⇧ toggle all selected'] : undefined
        },
        position: {
          x: shape.center.x,
          y: shape.center.y - shape.radius * 0.81
        },
        anchor: 'above'
      }
    }

    case 'delete-icon': {
      const rowY = shape.center.y + shape.radius + ACTION_ROW_OFFSET * uiScale
      return {
        content: {
          action: 'Delete circle',
          modifiers: selectedCount > 1 ? ['⇧ delete all selected'] : undefined
        },
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
        content: {
          value: isMirrored ? 'mirrored' : 'not mirrored',
          action: isMirrored ? 'Click to disable' : 'Click to enable',
          modifiers: selectedCount > 1 ? ['⇧ toggle all selected'] : undefined
        },
        position: {
          x: shape.center.x - (ACTION_ICON_SPACING / 2) * uiScale,
          y: rowY
        },
        anchor: 'below'
      }
    }

    case 'entry-offset-slot':
    case 'exit-offset-slot': {
      const info = getTangentInfo()
      if (!info) return null

      const isEntry = hoverTarget.type === 'entry-offset-slot'
      return {
        content: {
          action: 'Click to reset offset',
          modifiers: ['⇧/⌥ reset both']
        },
        position: isEntry ? info.rawEntryPoint : info.rawExitPoint,
        anchor: 'above'
      }
    }

    case 'entry-length-slot':
    case 'exit-length-slot': {
      const info = getTangentInfo()
      if (!info) return null

      const isEntry = hoverTarget.type === 'entry-length-slot'
      return {
        content: {
          action: 'Click to reset length',
          modifiers: ['⇧/⌥ reset both']
        },
        position: isEntry ? info.rawEntryLengthHandle : info.rawExitLengthHandle,
        anchor: 'above'
      }
    }

    case 'shape-body': {
      // Position above the center of the circle
      const position = {
        x: shape.center.x,
        y: shape.center.y - shape.radius * 0.3
      }
      
      return {
        content: {
          action: 'Drag to move',
          modifiers: ['⇧ constrain to axis']
        },
        position,
        anchor: 'above'
      }
    }

    default:
      return null
  }
}

/**
 * Draw a multi-line tooltip with background at the specified position
 */
function drawTooltip(
  ctx: CanvasRenderingContext2D,
  content: TooltipContent,
  position: Point,
  anchor: 'above' | 'below' | 'left' | 'right',
  theme: CanvasTheme,
  uiScale: number,
  modifierKeys?: ModifierKeys
) {
  const fontSize = TOOLTIP_CONFIG.fontSize * uiScale
  const smallFontSize = fontSize * 0.9
  const padding = {
    x: TOOLTIP_CONFIG.padding.x * uiScale,
    y: TOOLTIP_CONFIG.padding.y * uiScale
  }
  const offset = TOOLTIP_CONFIG.offset * uiScale
  const borderRadius = TOOLTIP_CONFIG.borderRadius * uiScale
  const lineHeight = fontSize * TOOLTIP_CONFIG.lineHeight
  const smallLineHeight = smallFontSize * TOOLTIP_CONFIG.lineHeight
  const sectionGap = TOOLTIP_CONFIG.sectionGap * uiScale

  ctx.save()

  // Build lines array with styling info
  interface Line {
    text: string
    color: string
    fontSize: number
    lineHeight: number
    opacity: number
  }
  const lines: Line[] = []
  
  // Value line (accent color, full opacity, normal size)
  if (content.value) {
    lines.push({
      text: content.value,
      color: theme.accent,
      fontSize: fontSize,
      lineHeight: lineHeight,
      opacity: 1.0
    })
  }
  
  // Action line (white/bright, slightly smaller)
  if (content.action) {
    lines.push({
      text: content.action,
      color: '#ffffff',
      fontSize: smallFontSize,
      lineHeight: smallLineHeight,
      opacity: 0.85
    })
  }
  
  // Modifier lines (highlight when corresponding key is held)
  if (content.modifiers && content.modifiers.length > 0) {
    for (const mod of content.modifiers) {
      const isActive = isModifierActive(mod, modifierKeys)
      lines.push({
        text: mod,
        color: isActive ? theme.accent : '#ffffff',
        fontSize: smallFontSize,
        lineHeight: smallLineHeight,
        opacity: isActive ? 1.0 : 0.6
      })
    }
  }

  if (lines.length === 0) {
    ctx.restore()
    return
  }

  // Measure all lines to find max width
  let maxWidth = 0
  for (const line of lines) {
    ctx.font = `500 ${line.fontSize}px ${TOOLTIP_CONFIG.fontFamily}`
    const metrics = ctx.measureText(line.text)
    maxWidth = Math.max(maxWidth, metrics.width)
  }

  // Calculate total height
  let totalHeight = 0
  for (let i = 0; i < lines.length; i++) {
    totalHeight += lines[i].lineHeight
    // Add section gap between value and action
    if (i === 0 && content.value && (content.action || content.modifiers)) {
      totalHeight += sectionGap
    }
  }

  // Calculate label dimensions
  const labelWidth = maxWidth + padding.x * 2
  const labelHeight = totalHeight + padding.y * 2

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

  // Draw text lines
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  let currentY = labelY + padding.y
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    ctx.globalAlpha = line.opacity
    ctx.font = `500 ${line.fontSize}px ${TOOLTIP_CONFIG.fontFamily}`
    ctx.fillStyle = line.color
    ctx.fillText(line.text, labelX + labelWidth / 2, currentY + line.lineHeight / 2)
    currentY += line.lineHeight
    
    // Add section gap after value line
    if (i === 0 && content.value && (content.action || content.modifiers)) {
      currentY += sectionGap
    }
  }

  ctx.restore()
}

/**
 * Render tooltips for hovered interactive elements
 * 
 * Shows contextual help with:
 * - Current value (if applicable)
 * - Action description
 * - Modifier key hints
 * 
 * Supported elements:
 * - Shape edge: radius, scale action, Alt/Shift modifiers
 * - Tangent handles: offset/length values, adjust action, Shift/Alt modifiers
 * - Index dots: current position or reorder action
 * - Direction ring: current direction, reverse action
 * - Delete/Mirror icons: action description
 * - Slot markers: reset action
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
  mirrorConfig: MirrorConfig = { planeCount: 1, startAngle: 0 },
  modifierKeys?: ModifierKeys,
  mouseWorldPos: Point | null = null,
  snapToGrid: boolean = false,
  _smartGuides: boolean = false,
  selectedCount: number = 1
) {
  // Only show tooltips when not dragging
  if (!hoverTarget || !hoveredId) return

  const uiScale = 1 / zoom

  // Get the shape being hovered
  const shape = shapes.find(s => s.id === hoveredId)
  if (!shape || shape.type !== 'circle') return

  // Draw pivot marker when Alt is held while hovering over scale handle
  if (hoverTarget.type === 'shape-edge' && mouseWorldPos && modifierKeys?.alt) {
    // Calculate exact opposite point on the circle
    let pivotPoint = findExactOppositePoint(shape, mouseWorldPos)
    // Snap to grid if snapping is enabled
    if (snapToGrid) {
      pivotPoint = snapPointToGrid(pivotPoint, POSITION_SNAP_INCREMENT)
    }
    drawPivotMarker(ctx, pivotPoint, theme, uiScale, true)
  }

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
    mirrorConfig,
    mouseWorldPos,
    selectedCount
  )
  
  if (!tooltipInfo) return

  // Draw the tooltip
  drawTooltip(ctx, tooltipInfo.content, tooltipInfo.position, tooltipInfo.anchor, theme, uiScale, modifierKeys)
}

