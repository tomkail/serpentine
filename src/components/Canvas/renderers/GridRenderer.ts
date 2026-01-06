import type { Point, MirrorAxis } from '../../../types'
import {
  GRID_LEVEL_MULTIPLIER,
  GRID_MIN_SCREEN_SPACING,
  GRID_IDEAL_SCREEN_SPACING,
  GRID_DOT_RADIUS_SCREEN
} from '../../../constants'

/**
 * Render multi-level dot grid background with smooth crossfading
 * 
 * Inspired by Unity's scene view grid:
 * - Multiple grid levels visible simultaneously
 * - Each level has different spacing (powers of 5)
 * - Opacity crossfades smoothly between levels as you zoom
 * - Dots maintain constant screen-space size
 */
export function renderGrid(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  pan: Point,
  zoom: number,
  baseGridSize: number,
  gridColor: string = '#2a2a2a'
) {
  const rgb = parseColor(gridColor)
  
  // Calculate visible area in world coordinates
  const worldLeft = -pan.x / zoom
  const worldTop = -pan.y / zoom
  const worldRight = (canvasWidth - pan.x) / zoom
  const worldBottom = (canvasHeight - pan.y) / zoom
  
  // Max screen spacing is ideal * multiplier (above this, start fading)
  const MAX_SCREEN_SPACING = GRID_IDEAL_SCREEN_SPACING * GRID_LEVEL_MULTIPLIER
  
  // Calculate the base screen spacing
  const baseScreenSpacing = baseGridSize * zoom
  
  // Determine which level is closest to the ideal screen spacing
  // log5(idealSpacing / baseScreenSpacing) = level where spacing is ideal
  const idealLevel = Math.log(GRID_IDEAL_SCREEN_SPACING / baseScreenSpacing) / Math.log(GRID_LEVEL_MULTIPLIER)
  
  // We'll render levels around this ideal level
  // Start a few levels below and go a few levels above to ensure smooth transitions
  const minLevel = Math.floor(idealLevel) - 1
  const maxLevel = Math.ceil(idealLevel) + 2
  
  // Render each level
  for (let level = minLevel; level <= maxLevel; level++) {
    const levelMultiplier = Math.pow(GRID_LEVEL_MULTIPLIER, level)
    const levelGridSize = baseGridSize * levelMultiplier
    const levelScreenSpacing = levelGridSize * zoom
    
    // Skip if screen spacing is way too small (would create too many dots)
    if (levelScreenSpacing < GRID_MIN_SCREEN_SPACING * 0.3) continue
    
    // Skip if screen spacing is way too large (dots too spread out)
    if (levelScreenSpacing > MAX_SCREEN_SPACING * 3) continue
    
    // Calculate opacity based on screen spacing
    // Uses a smooth bell-curve-like function centered around ideal spacing
    const opacity = calculateLevelOpacity(levelScreenSpacing, GRID_MIN_SCREEN_SPACING, GRID_IDEAL_SCREEN_SPACING, MAX_SCREEN_SPACING)
    
    if (opacity < 0.01) continue // Skip nearly invisible levels
    
    // Find the first grid point inside visible area (with some margin)
    const margin = levelGridSize
    const startX = Math.floor((worldLeft - margin) / levelGridSize) * levelGridSize
    const startY = Math.floor((worldTop - margin) / levelGridSize) * levelGridSize
    const endX = worldRight + margin
    const endY = worldBottom + margin
    
    // Count dots to prevent rendering too many
    const dotsX = Math.ceil((endX - startX) / levelGridSize)
    const dotsY = Math.ceil((endY - startY) / levelGridSize)
    const totalDots = dotsX * dotsY
    
    // Skip if too many dots (performance safeguard)
    if (totalDots > 50000) continue
    
    // Convert fixed screen radius to world radius
    const dotRadiusWorld = GRID_DOT_RADIUS_SCREEN / zoom
    
    // Set color with calculated opacity
    ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`
    
    // Draw dots for this level
    ctx.beginPath()
    for (let x = startX; x <= endX; x += levelGridSize) {
      for (let y = startY; y <= endY; y += levelGridSize) {
        ctx.moveTo(x + dotRadiusWorld, y)
        ctx.arc(x, y, dotRadiusWorld, 0, Math.PI * 2)
      }
    }
    ctx.fill()
  }
}

/**
 * Calculate the opacity for a grid level based on its screen spacing
 * 
 * Creates smooth transitions:
 * - Fades in from MIN to IDEAL spacing
 * - Full opacity around IDEAL spacing  
 * - Fades out from IDEAL to MAX spacing
 */
function calculateLevelOpacity(
  screenSpacing: number,
  minSpacing: number,
  idealSpacing: number,
  maxSpacing: number
): number {
  // Normalize the spacing to a 0-1 scale relative to ideal
  // Using log scale since grid levels are exponential
  const logSpacing = Math.log(screenSpacing)
  const logMin = Math.log(minSpacing)
  const logIdeal = Math.log(idealSpacing)
  const logMax = Math.log(maxSpacing)
  
  let opacity: number
  
  if (screenSpacing < minSpacing) {
    // Below minimum - fade out quickly
    opacity = Math.pow(screenSpacing / minSpacing, 2)
  } else if (screenSpacing < idealSpacing) {
    // Between min and ideal - fade in
    const t = (logSpacing - logMin) / (logIdeal - logMin)
    // Use smooth ease-in curve
    opacity = smoothstep(t)
  } else if (screenSpacing < maxSpacing) {
    // Between ideal and max - full opacity with slight fade
    const t = (logSpacing - logIdeal) / (logMax - logIdeal)
    // Stay mostly opaque, then fade
    opacity = 1 - smoothstep(t) * 0.3
  } else {
    // Above max - fade out
    const fadeRange = maxSpacing * 2
    if (screenSpacing > fadeRange) {
      opacity = 0
    } else {
      const t = (screenSpacing - maxSpacing) / (fadeRange - maxSpacing)
      opacity = (1 - smoothstep(t)) * 0.7
    }
  }
  
  return Math.max(0, Math.min(1, opacity))
}

/**
 * Smooth interpolation function (ease in-out)
 */
function smoothstep(t: number): number {
  t = Math.max(0, Math.min(1, t))
  return t * t * (3 - 2 * t)
}

/**
 * Render the mirror axis line when mirroring is active
 * Draws a dashed line at x=0 (vertical) or y=0 (horizontal)
 * Uses grid color (not accent) since it's non-interactive
 */
export function renderMirrorAxis(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  pan: Point,
  zoom: number,
  gridColor: string = '#2a2a2a',
  axis: MirrorAxis = 'vertical'
) {
  // Calculate visible area in world coordinates
  const worldLeft = -pan.x / zoom
  const worldRight = (canvasWidth - pan.x) / zoom
  const worldTop = -pan.y / zoom
  const worldBottom = (canvasHeight - pan.y) / zoom
  
  // Add some margin to ensure the line extends beyond visible area
  const margin = 100 / zoom
  
  const uiScale = 1 / zoom
  
  // Parse grid color to RGB for alpha blending
  const rgb = parseColor(gridColor)
  
  ctx.save()
  
  ctx.beginPath()
  
  if (axis === 'vertical') {
    // Draw vertical mirror axis line at x = 0
    ctx.moveTo(0, worldTop - margin)
    ctx.lineTo(0, worldBottom + margin)
  } else {
    // Draw horizontal mirror axis line at y = 0
    ctx.moveTo(worldLeft - margin, 0)
    ctx.lineTo(worldRight + margin, 0)
  }
  
  // Dashed line style - uses grid color with higher opacity for visibility
  ctx.setLineDash([12 * uiScale, 6 * uiScale])
  ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`
  ctx.lineWidth = 2 * uiScale
  ctx.stroke()
  
  // Draw small marker near the axis
  ctx.setLineDash([])
  ctx.font = `${11 * uiScale}px system-ui, sans-serif`
  ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  if (axis === 'vertical') {
    ctx.fillText('⧫', 0, worldTop + 30 * uiScale)
  } else {
    ctx.fillText('⧫', worldLeft + 30 * uiScale, 0)
  }
  
  ctx.restore()
}

/**
 * Parse a CSS color string to RGB values
 */
function parseColor(color: string): { r: number; g: number; b: number } {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1)
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16)
      }
    } else if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      }
    }
  }
  
  // Handle rgb/rgba colors
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3])
    }
  }
  
  // Default fallback
  return { r: 26, g: 26, b: 26 }
}
