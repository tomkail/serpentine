/**
 * Theme type definitions for Serpentine visual language
 */

export interface CanvasTheme {
  name: string
  
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
  
  // Danger state (for delete)
  danger: string
  dangerDim: string
  
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
}

/**
 * Hover target types for interaction tracking
 */
export type HoverTarget = 
  | { type: 'shape-body'; shapeId: string }
  | { type: 'shape-edge'; shapeId: string }
  | { type: 'direction-ring'; shapeId: string }
  | { type: 'delete-icon'; shapeId: string }
  | { type: 'mirror-icon'; shapeId: string }
  | { type: 'order-prev'; shapeId: string }
  | { type: 'order-next'; shapeId: string }
  | { type: 'index-dot'; shapeId: string; dotIndex: number }
  | { type: 'entry-offset'; shapeId: string }
  | { type: 'exit-offset'; shapeId: string }
  | { type: 'entry-length'; shapeId: string }
  | { type: 'exit-length'; shapeId: string }
  | { type: 'entry-offset-slot'; shapeId: string }
  | { type: 'exit-offset-slot'; shapeId: string }
  | { type: 'entry-length-slot'; shapeId: string }
  | { type: 'exit-length-slot'; shapeId: string }
  | null

