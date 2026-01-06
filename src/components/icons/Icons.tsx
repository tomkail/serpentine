/**
 * SVG Icons for consistent use across canvas and UI
 * Each icon is designed to work at small sizes with good visibility
 */

interface IconProps {
  size?: number
  className?: string
  color?: string
}

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

/**
 * Mirror Icon - Double horizontal arrows indicating reflection
 */
export function MirrorIcon({ size = 16, className, color = 'currentColor' }: IconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 16 16" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left arrow */}
      <path 
        d="M1 8L4 5M1 8L4 11M1 8H7" 
        stroke={color} 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      {/* Right arrow */}
      <path 
        d="M15 8L12 5M15 8L12 11M15 8H9" 
        stroke={color} 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      {/* Center divider (mirror axis) */}
      <path 
        d="M8 3V13" 
        stroke={color} 
        strokeWidth="1" 
        strokeLinecap="round" 
        strokeDasharray="2 2"
      />
    </svg>
  )
}

/**
 * Delete Icon - X mark
 */
export function DeleteIcon({ size = 16, className, color = 'currentColor' }: IconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 16 16" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        d="M4 4L12 12M12 4L4 12" 
        stroke={color} 
        strokeWidth="1.5" 
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Magnet Icon - Simple U-magnet with distinct pole markings
 */
export function MagnetIcon({ size = 16, className, color = 'currentColor' }: IconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 16 16" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Magnet body - U shape */}
      <path 
        d="M3 14V6C3 3.24 5.24 1 8 1C10.76 1 13 3.24 13 6V14" 
        stroke={color} 
        strokeWidth="2.5" 
        strokeLinecap="round"
        fill="none"
      />
      {/* Left pole marking - horizontal stripe */}
      <line x1="1.5" y1="11" x2="4.5" y2="11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Right pole marking - horizontal stripe */}
      <line x1="11.5" y1="11" x2="14.5" y2="11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Eye Icon - For isolate/focus view toggle
 */
export function EyeIcon({ size = 16, className, color = 'currentColor' }: IconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 16 16" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Eye outline */}
      <path 
        d="M2 8C2 8 4 4 8 4C12 4 14 8 14 8C14 8 12 12 8 12C4 12 2 8 2 8Z" 
        stroke={color} 
        strokeWidth="1.5" 
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Pupil */}
      <circle cx="8" cy="8" r="2" fill={color} />
    </svg>
  )
}

/**
 * Vertical Mirror Axis Icon - Shows a vertical dashed line with horizontal arrows
 */
export function VerticalAxisIcon({ size = 16, className, color = 'currentColor' }: IconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 16 16" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Vertical dashed line (mirror axis) */}
      <path 
        d="M8 2V14" 
        stroke={color} 
        strokeWidth="1.5" 
        strokeLinecap="round"
        strokeDasharray="2 2"
      />
      {/* Left arrow */}
      <path 
        d="M5 8L2.5 8M5 5.5L2.5 8L5 10.5" 
        stroke={color} 
        strokeWidth="1.25" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      {/* Right arrow */}
      <path 
        d="M11 8L13.5 8M11 5.5L13.5 8L11 10.5" 
        stroke={color} 
        strokeWidth="1.25" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Horizontal Mirror Axis Icon - Shows a horizontal dashed line with vertical arrows
 */
export function HorizontalAxisIcon({ size = 16, className, color = 'currentColor' }: IconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 16 16" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Horizontal dashed line (mirror axis) */}
      <path 
        d="M2 8H14" 
        stroke={color} 
        strokeWidth="1.5" 
        strokeLinecap="round"
        strokeDasharray="2 2"
      />
      {/* Top arrow */}
      <path 
        d="M8 5L8 2.5M5.5 5L8 2.5L10.5 5" 
        stroke={color} 
        strokeWidth="1.25" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      {/* Bottom arrow */}
      <path 
        d="M8 11L8 13.5M5.5 11L8 13.5L10.5 11" 
        stroke={color} 
        strokeWidth="1.25" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Smart Guides Icon - Crosshair with alignment lines
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
      {/* Vertical guide line */}
      <path 
        d="M8 1V15" 
        stroke={color} 
        strokeWidth="1.25" 
        strokeLinecap="round"
      />
      {/* Horizontal guide line */}
      <path 
        d="M1 8H15" 
        stroke={color} 
        strokeWidth="1.25" 
        strokeLinecap="round"
      />
      {/* Center circle (represents aligned object) */}
      <circle cx="8" cy="8" r="2.5" stroke={color} strokeWidth="1.25" fill="none" />
      {/* Small alignment markers */}
      <circle cx="8" cy="3" r="1" fill={color} />
      <circle cx="8" cy="13" r="1" fill={color} />
      <circle cx="3" cy="8" r="1" fill={color} />
      <circle cx="13" cy="8" r="1" fill={color} />
    </svg>
  )
}

/**
 * Frame/Fit Icon - Corner brackets framing a rectangle
 */
export function FrameIcon({ size = 16, className, color = 'currentColor' }: IconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 16 16" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Top-left corner */}
      <path 
        d="M2 5.5V3C2 2.45 2.45 2 3 2H5.5" 
        stroke={color} 
        strokeWidth="1.5" 
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Top-right corner */}
      <path 
        d="M10.5 2H13C13.55 2 14 2.45 14 3V5.5" 
        stroke={color} 
        strokeWidth="1.5" 
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bottom-left corner */}
      <path 
        d="M2 10.5V13C2 13.55 2.45 14 3 14H5.5" 
        stroke={color} 
        strokeWidth="1.5" 
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bottom-right corner */}
      <path 
        d="M10.5 14H13C13.55 14 14 13.55 14 13V10.5" 
        stroke={color} 
        strokeWidth="1.5" 
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner rectangle representing content */}
      <rect x="5" y="5" width="6" height="6" rx="0.5" stroke={color} strokeWidth="1" fill="none" />
    </svg>
  )
}

/**
 * Canvas drawing functions for the same icons
 * These draw the icons using Canvas 2D API with the same visual design
 */

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

