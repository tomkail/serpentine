/**
 * Design Token System for Serpentine
 * 
 * Three-tier architecture:
 * 1. Primitives - Raw color values
 * 2. Semantic - Generic purpose tokens
 * 3. Component - Specific usage tokens (in CanvasTheme)
 */

// ============================================================================
// TIER 1: PRIMITIVES
// Raw color values - the only place hex codes should appear
// ============================================================================

export const primitives = {
  // Neutral scale (dark to light)
  black: '#000000',
  gray950: '#0a0a0a',
  gray900: '#0f0f0f',
  gray800: '#1a1a1a',
  gray700: '#2a2a2a',
  gray600: '#3a3a45',
  gray500: '#5a5a65',
  gray400: '#8a8a95',
  gray300: '#a3a3a3',
  gray200: '#d4d4d4',
  gray100: '#e5e5e5',
  gray50: '#fafaf9',
  white: '#ffffff',
  
  // Blue scale (accent - midnight theme)
  blue600: '#2563eb',
  blue500: '#3b82f6',
  blue400: '#5eb3f0',
  blue300: '#7cc4f4',
  
  // Coral scale (accent - sunset theme)
  coral600: '#dc5a3a',
  coral500: '#f07058',
  coral400: '#f4917d',
  coral300: '#f8b4a6',
  
  // Green scale (accent - forest theme)
  emerald600: '#059669',
  emerald500: '#10b981',
  emerald400: '#34d399',
  emerald300: '#6ee7b7',
  
  // Purple scale (accent - lavender theme)
  violet600: '#7c3aed',
  violet500: '#8b5cf6',
  violet400: '#a78bfa',
  violet300: '#c4b5fd',
  
  // Teal scale (accent - ocean theme)
  teal600: '#0891b2',
  teal500: '#06b6d4',
  teal400: '#22d3ee',
  teal300: '#67e8f9',
  
  // Amber scale (accent - amber theme)
  amber600: '#d97706',
  amber500: '#f59e0b',
  amber400: '#fbbf24',
  amber300: '#fcd34d',
  
  // Red scale (danger)
  red600: '#dc2626',
  red500: '#ef4444',
  red400: '#f87171',
  
  // Theme-specific backgrounds
  warmGray950: '#0c0a09',
  warmGray900: '#1a1918',
  warmGray800: '#292524',
  warmGray700: '#3d3733',
  
  coolGray950: '#08090a',
  coolGray900: '#0d1117',
  coolGray800: '#161b22',
  coolGray700: '#21262d',
  
  slateGray950: '#0a0b0f',
  slateGray900: '#0f1016',
  slateGray800: '#181924',
  slateGray700: '#252836',
} as const

// ============================================================================
// TIER 2: SEMANTIC TOKENS
// Generic purpose - what the color means, not where it's used
// ============================================================================

export interface SemanticTokens {
  // Surfaces
  surface: {
    canvas: string      // Main canvas background
    shape: string       // Shape fill color
    elevated: string    // UI panels, tooltips
  }
  
  // Borders & strokes
  border: {
    default: string     // Default shape outline
    hover: string       // Hovered shape outline
    muted: string       // Subtle borders, guides
  }
  
  // Interactive (accent color)
  interactive: {
    default: string     // Primary interactive color
    muted: string       // Secondary interactive elements
    subtle: string      // Very subtle interactive hints
  }
  
  // Feedback
  feedback: {
    danger: string      // Delete, destructive actions
    dangerMuted: string // Dimmed danger state
  }
  
  // Contrast pair (for double-stroke visibility)
  contrast: {
    light: string       // Light stroke for dark backgrounds
    dark: string        // Dark stroke for light backgrounds
  }
}

export const darkSemanticTokens: SemanticTokens = {
  surface: {
    canvas: primitives.gray950,
    shape: primitives.gray900,
    elevated: primitives.gray800,
  },
  border: {
    default: primitives.gray600,
    hover: primitives.gray500,
    muted: primitives.gray700,
  },
  interactive: {
    default: primitives.blue400,
    muted: primitives.gray500,
    subtle: primitives.gray700,
  },
  feedback: {
    danger: primitives.red500,
    dangerMuted: primitives.red400,
  },
  contrast: {
    light: primitives.white,
    dark: primitives.black,
  },
}

export const lightSemanticTokens: SemanticTokens = {
  surface: {
    canvas: primitives.gray50,
    shape: primitives.white,
    elevated: primitives.white,
  },
  border: {
    default: primitives.gray400,    // Much darker for visibility
    hover: primitives.gray500,      // Even darker on hover
    muted: primitives.gray300,      // Subtle but visible
  },
  interactive: {
    default: primitives.blue600,
    muted: primitives.gray500,
    subtle: primitives.gray300,
  },
  feedback: {
    danger: primitives.red600,
    dangerMuted: primitives.red500,
  },
  contrast: {
    light: primitives.white,
    dark: primitives.black,
  },
}

// Sunset theme - warm coral tones on dark warm gray
export const sunsetSemanticTokens: SemanticTokens = {
  surface: {
    canvas: primitives.warmGray950,
    shape: primitives.warmGray900,
    elevated: primitives.warmGray800,
  },
  border: {
    default: primitives.warmGray700,
    hover: primitives.gray500,
    muted: primitives.warmGray700,
  },
  interactive: {
    default: primitives.coral400,
    muted: primitives.gray500,
    subtle: primitives.warmGray700,
  },
  feedback: {
    danger: primitives.red500,
    dangerMuted: primitives.red400,
  },
  contrast: {
    light: primitives.white,
    dark: primitives.black,
  },
}

// Forest theme - emerald greens on cool dark
export const forestSemanticTokens: SemanticTokens = {
  surface: {
    canvas: primitives.coolGray950,
    shape: primitives.coolGray900,
    elevated: primitives.coolGray800,
  },
  border: {
    default: primitives.coolGray700,
    hover: primitives.gray500,
    muted: primitives.coolGray700,
  },
  interactive: {
    default: primitives.emerald400,
    muted: primitives.gray500,
    subtle: primitives.coolGray700,
  },
  feedback: {
    danger: primitives.red500,
    dangerMuted: primitives.red400,
  },
  contrast: {
    light: primitives.white,
    dark: primitives.black,
  },
}

// Lavender theme - violet purples on slate
export const lavenderSemanticTokens: SemanticTokens = {
  surface: {
    canvas: primitives.slateGray950,
    shape: primitives.slateGray900,
    elevated: primitives.slateGray800,
  },
  border: {
    default: primitives.slateGray700,
    hover: primitives.gray500,
    muted: primitives.slateGray700,
  },
  interactive: {
    default: primitives.violet400,
    muted: primitives.gray500,
    subtle: primitives.slateGray700,
  },
  feedback: {
    danger: primitives.red500,
    dangerMuted: primitives.red400,
  },
  contrast: {
    light: primitives.white,
    dark: primitives.black,
  },
}

// Ocean theme - teal cyans on cool dark
export const oceanSemanticTokens: SemanticTokens = {
  surface: {
    canvas: primitives.coolGray950,
    shape: primitives.coolGray900,
    elevated: primitives.coolGray800,
  },
  border: {
    default: primitives.coolGray700,
    hover: primitives.gray500,
    muted: primitives.coolGray700,
  },
  interactive: {
    default: primitives.teal400,
    muted: primitives.gray500,
    subtle: primitives.coolGray700,
  },
  feedback: {
    danger: primitives.red500,
    dangerMuted: primitives.red400,
  },
  contrast: {
    light: primitives.white,
    dark: primitives.black,
  },
}

// Amber theme - warm golden on dark warm
export const amberSemanticTokens: SemanticTokens = {
  surface: {
    canvas: primitives.warmGray950,
    shape: primitives.warmGray900,
    elevated: primitives.warmGray800,
  },
  border: {
    default: primitives.warmGray700,
    hover: primitives.gray500,
    muted: primitives.warmGray700,
  },
  interactive: {
    default: primitives.amber400,
    muted: primitives.gray500,
    subtle: primitives.warmGray700,
  },
  feedback: {
    danger: primitives.red500,
    dangerMuted: primitives.red400,
  },
  contrast: {
    light: primitives.white,
    dark: primitives.black,
  },
}

// ============================================================================
// TIER 3: COMPONENT TOKENS
// Specific usage - exactly where each color is applied
// Defined in CanvasTheme interface, built from semantic tokens
// ============================================================================

import type { CanvasTheme } from '../types/theme'

/**
 * Build a CanvasTheme from semantic tokens
 * This is where semantic tokens map to specific component usage
 */
export function buildTheme(
  name: string,
  semantic: SemanticTokens,
  isDark: boolean
): CanvasTheme {
  return {
    name,
    
    // Accent colors - from interactive semantic tokens
    accent: semantic.interactive.default,
    accentDim: semantic.interactive.muted,
    accentGhost: semantic.interactive.subtle,
    accentGlow: semantic.interactive.muted,
    
    // Neutrals - from surface and border semantic tokens
    background: semantic.surface.canvas,
    stroke: semantic.border.default,
    strokeHover: semantic.border.hover,
    fill: semantic.surface.shape,
    chrome: semantic.border.muted,
    pathStroke: isDark ? semantic.contrast.light : semantic.contrast.dark,
    gridColor: semantic.border.muted,
    
    // Danger state
    danger: semantic.feedback.danger,
    dangerDim: semantic.feedback.dangerMuted,
    
    // Stroke weights (constant across themes)
    weights: {
      hairline: 1,
      light: 1.5,
      medium: 2,
      heavy: 3,
    },
    
    // Handle rendering - uses contrast pair for visibility
    handle: {
      size: 6,
      innerStroke: isDark ? semantic.contrast.dark : semantic.contrast.light,
      outerStroke: isDark ? semantic.contrast.light : semantic.contrast.dark,
      innerWidth: 2,
      outerWidth: 1.5,
    },
  }
}

