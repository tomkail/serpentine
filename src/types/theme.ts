/**
 * Theme type definitions for Serpentine visual language
 */

export interface CanvasTheme {
  name: string
  isDark: boolean          // Whether this is a dark theme
  
  // Accent color (single hue with opacity variations)
  accent: string           // Primary interactive color
  accentDim: string        // 40% opacity - secondary elements
  accentGhost: string      // 15% opacity - slots, references
  accentGlow: string       // Selection halos
  
  // Neutrals
  background: string       // Canvas background
  stroke: string           // Shape outlines
  strokeHover: string      // Hovered shape outlines
  fill: string             // Shape fills
  chrome: string           // Guides, connections, UI lines
  pathStroke: string       // Main path/serpentine line color
  gridColor: string        // Grid dots and mirror axis line
  
  // Danger state (for delete)
  danger: string
  dangerDim: string
  
  // Smart guides (alignment lines)
  smartGuide: string
  
  // Stroke weights (in CSS pixels, scaled by zoom)
  weights: {
    hairline: number       // 1px - guides, slots
    light: number          // 1.5px - secondary strokes
    medium: number         // 2px - primary strokes
    heavy: number          // 3px - emphasis, selection
  }
  
  // Handle rendering configuration
  handle: {
    size: number           // Base size in pixels
    innerStroke: string    // Dark outline for contrast
    outerStroke: string    // Light halo for visibility
    innerWidth: number     // Inner stroke weight
    outerWidth: number     // Outer stroke weight
  }
  
  // UI Colors (panels, menus, text)
  ui: {
    // Panel colors
    panelBg: string
    panelBorder: string
    panelItemBg: string
    panelItemHover: string
    panelItemSelected: string
    
    // Text colors
    textPrimary: string
    textSecondary: string
    textMuted: string
    
    // Menu colors (can be same as panel)
    menuBg: string
    menuHover: string
    menuBorder: string
    
    // Scrollbar
    scrollbarTrack: string
    scrollbarThumb: string
    scrollbarThumbHover: string
  }
}


