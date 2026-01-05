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
  
  // Blue scale (accent)
  blue600: '#2563eb',
  blue500: '#3b82f6',
  blue400: '#5eb3f0',
  blue300: '#7cc4f4',
  
  // Red scale (danger)
  red600: '#dc2626',
  red500: '#ef4444',
  red400: '#f87171',
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
    default: primitives.gray200,
    hover: primitives.gray300,
    muted: primitives.gray100,
  },
  interactive: {
    default: primitives.blue600,
    muted: primitives.gray400,
    subtle: primitives.gray200,
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

