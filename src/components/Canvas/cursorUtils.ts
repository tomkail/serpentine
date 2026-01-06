/**
 * Cursor utilities for canvas interactions
 * Generates custom SVG cursors for different interaction states
 */

import { CURSOR_ANGLE_INCREMENT } from '../../constants'
import type { HoverTarget, DragMode, MarqueeMode } from '../../types'

/**
 * Generate a "reverse" cursor SVG for the direction toggle
 * Two curved arrows chasing each other around a circle - a clear "flip direction" icon
 */
function getReverseCursor(): string {
  // Create two curved arrows going in opposite directions around a circle
  // This clearly conveys "reverse/flip the circular direction"
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <!-- Top arc with arrow (clockwise arrow on top) -->
    <g>
      <!-- Outer stroke for visibility -->
      <path d="M19 8 A7 7 0 0 0 5 8" 
            fill="none" stroke="white" stroke-width="4" stroke-linecap="round"/>
      <path d="M19 8 L16 4 M19 8 L22 5" 
            fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Inner stroke -->
      <path d="M19 8 A7 7 0 0 0 5 8" 
            fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
      <path d="M19 8 L16 4 M19 8 L22 5" 
            fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <!-- Bottom arc with arrow (counter-clockwise arrow on bottom) -->
    <g>
      <!-- Outer stroke for visibility -->
      <path d="M5 16 A7 7 0 0 0 19 16" 
            fill="none" stroke="white" stroke-width="4" stroke-linecap="round"/>
      <path d="M5 16 L8 20 M5 16 L2 19" 
            fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Inner stroke -->
      <path d="M5 16 A7 7 0 0 0 19 16" 
            fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
      <path d="M5 16 L8 20 M5 16 L2 19" 
            fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </svg>`
  
  return `url('data:image/svg+xml,${encodeURIComponent(svg)}') 12 12, pointer`
}

// Cache the reverse cursor
export const reverseCursor = getReverseCursor()

/**
 * Generate a marquee selection cursor with a modifier indicator
 * Shows a crosshair with a + or - symbol to indicate add/subtract mode
 */
function generateMarqueeCursor(mode: MarqueeMode): string {
  let symbol = ''
  let symbolColor = 'black'
  
  if (mode === 'add') {
    symbol = `
      <!-- Plus sign -->
      <line x1="18" y1="14" x2="22" y2="14" stroke="white" stroke-width="3" stroke-linecap="round"/>
      <line x1="20" y1="12" x2="20" y2="16" stroke="white" stroke-width="3" stroke-linecap="round"/>
      <line x1="18" y1="14" x2="22" y2="14" stroke="${symbolColor}" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="20" y1="12" x2="20" y2="16" stroke="${symbolColor}" stroke-width="1.5" stroke-linecap="round"/>
    `
  } else if (mode === 'subtract') {
    symbol = `
      <!-- Minus sign -->
      <line x1="17" y1="14" x2="23" y2="14" stroke="white" stroke-width="3" stroke-linecap="round"/>
      <line x1="17" y1="14" x2="23" y2="14" stroke="${symbolColor}" stroke-width="1.5" stroke-linecap="round"/>
    `
  }
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <!-- Crosshair -->
    <line x1="12" y1="2" x2="12" y2="9" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="12" y1="15" x2="12" y2="22" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="2" y1="12" x2="9" y2="12" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="15" y1="12" x2="22" y2="12" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="12" y1="2" x2="12" y2="9" stroke="black" stroke-width="1" stroke-linecap="round"/>
    <line x1="12" y1="15" x2="12" y2="22" stroke="black" stroke-width="1" stroke-linecap="round"/>
    <line x1="2" y1="12" x2="9" y2="12" stroke="black" stroke-width="1" stroke-linecap="round"/>
    <line x1="15" y1="12" x2="22" y2="12" stroke="black" stroke-width="1" stroke-linecap="round"/>
    ${symbol}
  </svg>`
  
  return `url('data:image/svg+xml,${encodeURIComponent(svg)}') 12 12, crosshair`
}

// Cache marquee cursors
export const marqueeCursors: Record<MarqueeMode, string> = {
  replace: generateMarqueeCursor('replace'),
  add: generateMarqueeCursor('add'),
  subtract: generateMarqueeCursor('subtract')
}

/**
 * Get the marquee cursor based on the mode
 */
export function getMarqueeCursor(mode: MarqueeMode): string {
  return marqueeCursors[mode]
}

/**
 * Generate a rotated scale cursor SVG data URL
 * The cursor arrows point along the circle edge (tangent direction)
 */
function generateScaleCursor(angleRad: number): string {
  // Convert to degrees for SVG rotation, add 90° to make arrows tangent to the circle
  const angleDeg = (angleRad * 180 / Math.PI) + 90
  
  // SVG scale cursor - double-headed arrow
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <g transform="rotate(${angleDeg}, 12, 12)">
      <!-- Outer stroke for visibility -->
      <path d="M12 2 L16 7 L13.5 7 L13.5 17 L16 17 L12 22 L8 17 L10.5 17 L10.5 7 L8 7 Z" 
            fill="none" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
      <!-- Inner fill -->
      <path d="M12 2 L16 7 L13.5 7 L13.5 17 L16 17 L12 22 L8 17 L10.5 17 L10.5 7 L8 7 Z" 
            fill="black" stroke="none"/>
    </g>
  </svg>`
  
  return `url('data:image/svg+xml,${encodeURIComponent(svg)}') 12 12, nwse-resize`
}

// Cache for generated cursors to avoid regenerating on every frame
const cursorCache = new Map<number, string>()

/**
 * Get a cached rotated scale cursor for the given angle
 * Quantizes to degree increments for caching efficiency
 */
export function getScaleCursor(angleRad: number): string {
  // Quantize to degree increments (based on constant)
  const quantizedDeg = Math.round((angleRad * 180 / Math.PI) / CURSOR_ANGLE_INCREMENT) * CURSOR_ANGLE_INCREMENT
  const normalizedDeg = ((quantizedDeg % 360) + 360) % 360
  
  if (!cursorCache.has(normalizedDeg)) {
    cursorCache.set(normalizedDeg, generateScaleCursor(normalizedDeg * Math.PI / 180))
  }
  
  return cursorCache.get(normalizedDeg)!
}

/**
 * Get cursor based on hover target and drag state
 */
export function getCursorForTarget(
  hoverTarget: HoverTarget,
  isDragging: boolean,
  dragMode: DragMode,
  scaleCursorAngle: number,
  marqueeMode?: MarqueeMode
): string {
  if (isDragging) {
    if (dragMode === 'move') return 'move'
    if (dragMode === 'scale') return getScaleCursor(scaleCursorAngle)
    if (dragMode?.startsWith('tangent-')) return 'crosshair'
    if (dragMode === 'marquee' && marqueeMode) return getMarqueeCursor(marqueeMode)
    return 'grabbing'
  }
  
  if (!hoverTarget) return ''
  
  switch (hoverTarget.type) {
    case 'shape-body':
      return 'move'
    case 'shape-edge':
      return getScaleCursor(scaleCursorAngle)
    case 'direction-ring':
      return reverseCursor
    case 'delete-icon':
    case 'mirror-icon':
    case 'index-dot':
      return 'pointer'
    case 'entry-offset':
    case 'exit-offset':
    case 'entry-length':
    case 'exit-length':
      return 'grab'
    case 'entry-offset-slot':
    case 'exit-offset-slot':
    case 'entry-length-slot':
    case 'exit-length-slot':
      return 'pointer'
    default:
      return ''
  }
}

