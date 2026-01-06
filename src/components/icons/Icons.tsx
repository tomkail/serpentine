/**
 * Icon exports using Lucide React icons + custom path icons
 * Canvas drawing functions are kept custom for Canvas 2D API rendering
 */

// Re-export Lucide icons with consistent naming
export {
  // Mirror icons
  FlipHorizontal2 as MirrorIcon,
  FlipHorizontal as VerticalAxisIcon,
  FlipVertical as HorizontalAxisIcon,
  
  // Action icons
  X as DeleteIcon,
  Plus as PlusIcon,
  
  // Tool icons
  Magnet as MagnetIcon,
  Eye as EyeIcon,
  FileCode as SvgPreviewIcon,
  Ruler as RulerIcon,
  Scan as FrameIcon,
  
  // Edit icons
  Undo2 as UndoIcon,
  Redo2 as RedoIcon,
  
  // Menu icons
  Palette as ThemeIcon,
  Bug as DebugIcon,
  File as FileIcon,
  ChevronDown as ChevronDownIcon,
  Settings as SettingsIcon,
} from 'lucide-react'

// ============================================================================
// CUSTOM UI ICONS
// ============================================================================

interface IconProps {
  size?: number
  className?: string
  color?: string
}

/**
 * Smart Guides Icon - Two circles with an alignment line between them
 * Shows alignment assistance when moving objects
 */
export function SmartGuidesIcon({ size = 16, className, color = 'currentColor' }: IconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 16 16" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Top circle */}
      <circle cx="5" cy="4" r="2.5" stroke={color} strokeWidth="1.5" fill="none" />
      {/* Bottom circle */}
      <circle cx="11" cy="12" r="2.5" stroke={color} strokeWidth="1.5" fill="none" />
      {/* Vertical dashed alignment line */}
      <path 
        d="M8 1 L8 15" 
        stroke={color} 
        strokeWidth="1.25" 
        strokeLinecap="round"
        strokeDasharray="2 1.5"
      />
    </svg>
  )
}

// ============================================================================
// CUSTOM PATH ICONS
// These are specialized for the vector path editor and don't have good
// equivalents in standard icon libraries
// ============================================================================

/**
 * Loop Path Icon - Circular arrow showing closed loop
 * Indicates the path connects end back to start
 */
export function LoopPathIcon({ size = 16, className, color = 'currentColor' }: IconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 16 16" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Circular arc (most of a circle) */}
      <path 
        d="M8 3C5.24 3 3 5.24 3 8C3 10.76 5.24 13 8 13C10.76 13 13 10.76 13 8C13 6.5 12.3 5.15 11.2 4.2" 
        stroke={color} 
        strokeWidth="1.75" 
        strokeLinecap="round"
        fill="none"
      />
      {/* Arrow head at the end */}
      <path 
        d="M11 2L11.2 4.2L13.2 4.5" 
        stroke={color} 
        strokeWidth="1.5" 
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

/**
 * Open Path Icon - Line with distinct start and end dots
 * Indicates the path has distinct start and end points (not looped)
 */
export function OpenPathIcon({ size = 16, className, color = 'currentColor' }: IconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 16 16" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Connecting path line */}
      <path 
        d="M4 8 L12 8" 
        stroke={color} 
        strokeWidth="1.75" 
        strokeLinecap="round"
      />
      {/* Start dot */}
      <circle cx="4" cy="8" r="2" fill={color} />
      {/* End dot */}
      <circle cx="12" cy="8" r="2" fill={color} />
    </svg>
  )
}

/**
 * Start Point Icon - Filled dot at start with path line going out
 * Shows that path starts from a specific point
 */
export function StartPointIcon({ size = 16, className, color = 'currentColor' }: IconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 16 16" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Start point - filled circle with ring */}
      <circle cx="4.5" cy="8" r="3" stroke={color} strokeWidth="1.5" fill="none" />
      <circle cx="4.5" cy="8" r="1.25" fill={color} />
      {/* Path line going out */}
      <path 
        d="M8 8 L14 8" 
        stroke={color} 
        strokeWidth="1.75" 
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * End Point Icon - Path line coming in to a filled dot
 * Shows that path ends at a specific point
 */
export function EndPointIcon({ size = 16, className, color = 'currentColor' }: IconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 16 16" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Path line coming in */}
      <path 
        d="M2 8 L8 8" 
        stroke={color} 
        strokeWidth="1.75" 
        strokeLinecap="round"
      />
      {/* End point - filled circle with ring */}
      <circle cx="11.5" cy="8" r="3" stroke={color} strokeWidth="1.5" fill="none" />
      <circle cx="11.5" cy="8" r="1.25" fill={color} />
    </svg>
  )
}

// ============================================================================
// CANVAS DRAWING FUNCTIONS
// These draw icons using Canvas 2D API for direct canvas rendering
// ============================================================================

export interface CanvasIconOptions {
  ctx: CanvasRenderingContext2D
  x: number
  y: number
  size: number
  color: string
  haloColor?: string
  lineWidth?: number
  uiScale?: number
}

/**
 * Draw Mirror icon on canvas
 */
export function drawMirrorIconCanvas({
  ctx,
  x,
  y,
  size,
  color,
  haloColor,
  lineWidth = 1.5
}: CanvasIconOptions) {
  const halfSize = size / 2
  const arrowHead = size * 0.2
  
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  
  // Draw halo if specified (for visibility on any background)
  if (haloColor) {
    ctx.strokeStyle = haloColor
    ctx.lineWidth = lineWidth + 2
    
    // Left arrow
    ctx.beginPath()
    ctx.moveTo(x - halfSize, y)
    ctx.lineTo(x - halfSize + arrowHead, y - arrowHead)
    ctx.moveTo(x - halfSize, y)
    ctx.lineTo(x - halfSize + arrowHead, y + arrowHead)
    ctx.moveTo(x - halfSize, y)
    ctx.lineTo(x - arrowHead * 0.5, y)
    ctx.stroke()
    
    // Right arrow
    ctx.beginPath()
    ctx.moveTo(x + halfSize, y)
    ctx.lineTo(x + halfSize - arrowHead, y - arrowHead)
    ctx.moveTo(x + halfSize, y)
    ctx.lineTo(x + halfSize - arrowHead, y + arrowHead)
    ctx.moveTo(x + halfSize, y)
    ctx.lineTo(x + arrowHead * 0.5, y)
    ctx.stroke()
  }
  
  // Draw main icon
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  
  // Left arrow
  ctx.beginPath()
  ctx.moveTo(x - halfSize, y)
  ctx.lineTo(x - halfSize + arrowHead, y - arrowHead)
  ctx.moveTo(x - halfSize, y)
  ctx.lineTo(x - halfSize + arrowHead, y + arrowHead)
  ctx.moveTo(x - halfSize, y)
  ctx.lineTo(x - arrowHead * 0.5, y)
  ctx.stroke()
  
  // Right arrow
  ctx.beginPath()
  ctx.moveTo(x + halfSize, y)
  ctx.lineTo(x + halfSize - arrowHead, y - arrowHead)
  ctx.moveTo(x + halfSize, y)
  ctx.lineTo(x + halfSize - arrowHead, y + arrowHead)
  ctx.moveTo(x + halfSize, y)
  ctx.lineTo(x + arrowHead * 0.5, y)
  ctx.stroke()
  
  // Center dashed line (mirror axis)
  ctx.setLineDash([size * 0.1, size * 0.1])
  ctx.lineWidth = lineWidth * 0.7
  ctx.beginPath()
  ctx.moveTo(x, y - halfSize * 0.8)
  ctx.lineTo(x, y + halfSize * 0.8)
  ctx.stroke()
  ctx.setLineDash([])
  
  ctx.restore()
}

/**
 * Draw Delete (X) icon on canvas
 */
export function drawDeleteIconCanvas({
  ctx,
  x,
  y,
  size,
  color,
  haloColor,
  lineWidth = 1.5
}: CanvasIconOptions) {
  const halfSize = size * 0.35
  
  ctx.save()
  ctx.lineCap = 'round'
  
  // Draw halo if specified
  if (haloColor) {
    ctx.strokeStyle = haloColor
    ctx.lineWidth = lineWidth + 2
    
    ctx.beginPath()
    ctx.moveTo(x - halfSize, y - halfSize)
    ctx.lineTo(x + halfSize, y + halfSize)
    ctx.moveTo(x + halfSize, y - halfSize)
    ctx.lineTo(x - halfSize, y + halfSize)
    ctx.stroke()
  }
  
  // Draw main X
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  
  ctx.beginPath()
  ctx.moveTo(x - halfSize, y - halfSize)
  ctx.lineTo(x + halfSize, y + halfSize)
  ctx.moveTo(x + halfSize, y - halfSize)
  ctx.lineTo(x - halfSize, y + halfSize)
  ctx.stroke()
  
  ctx.restore()
}

/**
 * Draw Plus (+) icon on canvas
 */
export function drawPlusIconCanvas({
  ctx,
  x,
  y,
  size,
  color,
  haloColor,
  lineWidth = 1.5
}: CanvasIconOptions) {
  const halfSize = size * 0.4
  
  ctx.save()
  ctx.lineCap = 'round'
  
  // Draw halo if specified
  if (haloColor) {
    ctx.strokeStyle = haloColor
    ctx.lineWidth = lineWidth + 2
    
    ctx.beginPath()
    ctx.moveTo(x - halfSize, y)
    ctx.lineTo(x + halfSize, y)
    ctx.moveTo(x, y - halfSize)
    ctx.lineTo(x, y + halfSize)
    ctx.stroke()
  }
  
  // Draw main +
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  
  ctx.beginPath()
  ctx.moveTo(x - halfSize, y)
  ctx.lineTo(x + halfSize, y)
  ctx.moveTo(x, y - halfSize)
  ctx.lineTo(x, y + halfSize)
  ctx.stroke()
  
  ctx.restore()
}
