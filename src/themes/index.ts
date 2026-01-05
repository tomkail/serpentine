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
 * All available themes
 */
export const themes: Record<string, CanvasTheme> = {
  midnight: midnightTheme,
  paper: paperTheme,
}

/**
 * Default theme
 */
export const defaultTheme = midnightTheme

/**
 * Export primitives for any code that needs raw values
 * (should be rare - prefer using theme tokens)
 */
export { primitives }
