/**
 * Theme definitions for Serpentine
 * 
 * Built from the three-tier design token system:
 * - Primitives: Raw color values (tokens.ts)
 * - Semantic: Generic purpose tokens (tokens.ts)
 * - Component: Specific usage (CanvasTheme)
 */

import type { CanvasTheme } from '../types/theme'
import { 
  buildTheme, 
  darkSemanticTokens, 
  lightSemanticTokens,
  sunsetSemanticTokens,
  forestSemanticTokens,
  lavenderSemanticTokens,
  oceanSemanticTokens,
  amberSemanticTokens,
  primitives 
} from './tokens'

/**
 * Midnight theme - Dark background with blue accent
 * This is the default theme
 */
export const midnightTheme: CanvasTheme = buildTheme(
  'Midnight',
  darkSemanticTokens,
  true
)

/**
 * Paper theme - Light background with blue accent
 * For users who prefer light mode
 */
export const paperTheme: CanvasTheme = buildTheme(
  'Paper',
  lightSemanticTokens,
  false
)

/**
 * Sunset theme - Warm coral accent on dark warm gray
 */
export const sunsetTheme: CanvasTheme = buildTheme(
  'Sunset',
  sunsetSemanticTokens,
  true
)

/**
 * Forest theme - Emerald green accent on cool dark
 */
export const forestTheme: CanvasTheme = buildTheme(
  'Forest',
  forestSemanticTokens,
  true
)

/**
 * Lavender theme - Purple/violet accent on slate
 */
export const lavenderTheme: CanvasTheme = buildTheme(
  'Lavender',
  lavenderSemanticTokens,
  true
)

/**
 * Ocean theme - Teal/cyan accent on cool dark
 */
export const oceanTheme: CanvasTheme = buildTheme(
  'Ocean',
  oceanSemanticTokens,
  true
)

/**
 * Amber theme - Golden warm accent on warm gray
 */
export const amberTheme: CanvasTheme = buildTheme(
  'Amber',
  amberSemanticTokens,
  true
)

/**
 * All available themes
 */
export const themes: Record<string, CanvasTheme> = {
  midnight: midnightTheme,
  paper: paperTheme,
  sunset: sunsetTheme,
  forest: forestTheme,
  lavender: lavenderTheme,
  ocean: oceanTheme,
  amber: amberTheme,
}

/**
 * Theme metadata for UI display
 */
export const themeList = [
  { id: 'midnight', name: 'Midnight', icon: '🌙' },
  { id: 'paper', name: 'Paper', icon: '📄' },
  { id: 'sunset', name: 'Sunset', icon: '🌅' },
  { id: 'forest', name: 'Forest', icon: '🌲' },
  { id: 'lavender', name: 'Lavender', icon: '💜' },
  { id: 'ocean', name: 'Ocean', icon: '🌊' },
  { id: 'amber', name: 'Amber', icon: '🔶' },
] as const

/**
 * Default theme
 */
export const defaultTheme = midnightTheme

/**
 * Export primitives for any code that needs raw values
 * (should be rare - prefer using theme tokens)
 */
export { primitives }
