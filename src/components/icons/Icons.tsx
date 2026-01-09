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
 * Path mode values for the cycle button
 */
export type PathMode = 'tangent' | 'left-arc' | 'right-arc' | 'both-arcs' | 'closed'

interface PathModeIconProps extends IconProps {
  mode: PathMode
}

/**
 * Path Mode Icon - Shows two circles with connecting path
 * Used as a cycle button to switch between 5 path construction modes:
 * 1. tangent - straight line only
 * 2. left-arc - left semicircle arc
 * 3. right-arc - right semicircle arc
 * 4. both-arcs - both arcs (open path)
 * 5. closed - complete closed stadium shape
 */
export function PathModeIcon({ size = 16, className, color = 'currentColor', mode }: PathModeIconProps) {
  // Circle centers and radius for the stadium shape
  // Left circle center: (4.5, 8), Right circle center: (11.5, 8), radius: 3.5
  const leftCx = 4.5
  const rightCx = 11.5
  const cy = 8
  const r = 3.5
  
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 16 16" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Guide circles (always shown, subtle) */}
      <circle cx={leftCx} cy={cy} r={r} stroke={color} strokeWidth="0.75" opacity="0.3" fill="none" />
      <circle cx={rightCx} cy={cy} r={r} stroke={color} strokeWidth="0.75" opacity="0.3" fill="none" />
      
      {/* Active path segments based on mode */}
      {mode === 'tangent' && (
        /* Just the bottom tangent line */
        <line 
          x1={leftCx} y1={cy + r} 
          x2={rightCx} y2={cy + r} 
          stroke={color} 
          strokeWidth="1.75" 
          strokeLinecap="round"
        />
      )}
      
      {mode === 'left-arc' && (
        /* Left arc + bottom tangent */
        <path 
          d={`M ${rightCx} ${cy + r} L ${leftCx} ${cy + r} A ${r} ${r} 0 1 1 ${leftCx} ${cy - r}`}
          stroke={color} 
          strokeWidth="1.75" 
          strokeLinecap="round"
          fill="none"
        />
      )}
      
      {mode === 'right-arc' && (
        /* Right arc + bottom tangent */
        <path 
          d={`M ${leftCx} ${cy + r} L ${rightCx} ${cy + r} A ${r} ${r} 0 1 0 ${rightCx} ${cy - r}`}
          stroke={color} 
          strokeWidth="1.75" 
          strokeLinecap="round"
          fill="none"
        />
      )}
      
      {mode === 'both-arcs' && (
        /* Both arcs + bottom tangent (open at top) */
        <path 
          d={`M ${leftCx} ${cy - r} A ${r} ${r} 0 1 0 ${leftCx} ${cy + r} L ${rightCx} ${cy + r} A ${r} ${r} 0 1 0 ${rightCx} ${cy - r}`}
          stroke={color} 
          strokeWidth="1.75" 
          strokeLinecap="round"
          fill="none"
        />
      )}
      
      {mode === 'closed' && (
        /* Complete closed stadium shape */
        <path 
          d={`M ${leftCx} ${cy - r} A ${r} ${r} 0 1 0 ${leftCx} ${cy + r} L ${rightCx} ${cy + r} A ${r} ${r} 0 1 0 ${rightCx} ${cy - r} Z`}
          stroke={color} 
          strokeWidth="1.75" 
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
    </svg>
  )
}

/**
 * Loop Path Icon - Continuous closed shape (legacy, uses PathModeIcon)
 */
export function LoopPathIcon({ size = 16, className, color = 'currentColor' }: IconProps) {
  return <PathModeIcon size={size} className={className} color={color} mode="closed" />
}

/**
 * No Mirror Icon - Square with no symmetry lines
 */
export function NoMirrorIcon({ size = 16, className, color = 'currentColor' }: IconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Square with rounded corners - same as 2-way and 4-way */}
      <rect 
        x="3" 
        y="3" 
        width="18" 
        height="18" 
        rx="2" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none" 
      />
    </svg>
  )
}

/**
 * Four Way Mirror Icon - Square with two perpendicular dotted lines (4-way symmetry)
 * Lines pass through gaps in the square
 */
export function FourWayMirrorIcon({ size = 16, className, color = 'currentColor' }: IconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Four corners of the square with gaps for the cross */}
      {/* Top-left corner */}
      <path 
        d="M9 3 L5 3 C3.89543 3 3 3.89543 3 5 L3 9" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Top-right corner */}
      <path 
        d="M15 3 L19 3 C20.1046 3 21 3.89543 21 5 L21 9" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bottom-right corner */}
      <path 
        d="M21 15 L21 19 C21 20.1046 20.1046 21 19 21 L15 21" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bottom-left corner */}
      <path 
        d="M9 21 L5 21 C3.89543 21 3 20.1046 3 19 L3 15" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Vertical dotted line through gap */}
      <path 
        d="M12 2 L12 22" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round"
        strokeDasharray="3 3"
        strokeDashoffset="0"
      />
      {/* Horizontal dotted line through gap */}
      <path 
        d="M2 12 L22 12" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round"
        strokeDasharray="3 3"
        strokeDashoffset="0"
      />
    </svg>
  )
}

/**
 * Six Way Mirror Icon - Three dotted lines at 60° intervals (6-way symmetry)
 */
export function SixWayMirrorIcon({ size = 16, className, color = 'currentColor' }: IconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Vertical dotted line */}
      <path 
        d="M12 2 L12 22" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round"
        strokeDasharray="3 3"
        strokeDashoffset="0"
      />
      {/* Diagonal dotted line (60°) - top-right to bottom-left */}
      <path 
        d="M20.928 6.5 L3.072 17.5" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round"
        strokeDasharray="3 3"
        strokeDashoffset="0"
      />
      {/* Diagonal dotted line (120°) - top-left to bottom-right */}
      <path 
        d="M3.072 6.5 L20.928 17.5" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round"
        strokeDasharray="3 3"
        strokeDashoffset="0"
      />
    </svg>
  )
}

/**
 * Eight Way Mirror Icon - Four dotted lines at 45° intervals (8-way symmetry)
 */
export function EightWayMirrorIcon({ size = 16, className, color = 'currentColor' }: IconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Vertical dotted line */}
      <path 
        d="M12 2 L12 22" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round"
        strokeDasharray="3 3"
        strokeDashoffset="0"
      />
      {/* Horizontal dotted line */}
      <path 
        d="M2 12 L22 12" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round"
        strokeDasharray="3 3"
        strokeDashoffset="0"
      />
      {/* Diagonal dotted line (45°) - top-left to bottom-right through center */}
      <path 
        d="M2.929 2.929 L21.071 21.071" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round"
        strokeDasharray="3 3"
        strokeDashoffset="0"
      />
      {/* Diagonal dotted line (135°) - top-right to bottom-left through center */}
      <path 
        d="M21.071 2.929 L2.929 21.071" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round"
        strokeDasharray="3 3"
        strokeDashoffset="0"
      />
    </svg>
  )
}

/**
 * Open Path Icon - Open path with both arcs (legacy, uses PathModeIcon)
 */
export function OpenPathIcon({ size = 16, className, color = 'currentColor' }: IconProps) {
  return <PathModeIcon size={size} className={className} color={color} mode="both-arcs" />
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
