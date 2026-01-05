import { useEffect } from 'react'
import { useThemeStore } from '../stores/themeStore'
import type { CanvasTheme } from '../types/theme'

/**
 * Convert a CanvasTheme to CSS custom properties
 */
function themeToCssVars(theme: CanvasTheme): Record<string, string> {
  return {
    // Canvas colors
    '--canvas-bg': theme.background,
    '--grid-dot': theme.gridColor,
    
    // Shape colors
    '--shape-fill': theme.fill,
    '--shape-stroke': theme.stroke,
    '--shape-stroke-hover': theme.strokeHover,
    '--shape-stroke-selected': theme.accent,
    '--shape-handle': theme.chrome,
    '--shape-selection-glow': hexToRgba(theme.accent, 0.35),
    
    // Path colors
    '--path-stroke': theme.pathStroke,
    
    // Measurement colors
    '--measure-text': theme.strokeHover,
    '--measure-line': theme.chrome,
    
    // Accent color
    '--accent-color': theme.accent,
    '--accent-dim': theme.accentDim,
    '--accent-ghost': theme.accentGhost,
    '--accent-glow': hexToRgba(theme.accent, 0.35),
    
    // Danger colors
    '--danger': theme.danger,
    '--danger-dim': theme.dangerDim,
    
    // Panel colors
    '--panel-bg': theme.ui.panelBg,
    '--panel-border': theme.ui.panelBorder,
    '--panel-item-bg': theme.ui.panelItemBg,
    '--panel-item-hover': theme.ui.panelItemHover,
    '--panel-item-selected': theme.ui.panelItemSelected,
    
    // Menu colors
    '--menu-bg': theme.ui.menuBg,
    '--menu-hover': theme.ui.menuHover,
    '--menu-border': theme.ui.menuBorder,
    
    // Text colors
    '--text-primary': theme.ui.textPrimary,
    '--text-secondary': theme.ui.textSecondary,
    '--text-muted': theme.ui.textMuted,
    
    // Scrollbar colors
    '--scrollbar-track': theme.ui.scrollbarTrack,
    '--scrollbar-thumb': theme.ui.scrollbarThumb,
    '--scrollbar-thumb-hover': theme.ui.scrollbarThumbHover,
    
    // Interactive overlay colors (for buttons, etc.)
    '--overlay-subtle': theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    '--overlay-light': theme.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
    '--overlay-medium': theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
    '--overlay-strong': theme.isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
    '--border-subtle': theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    '--border-medium': theme.isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
    
    // Shadow
    '--shadow-color': theme.isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.15)',
  }
}

/**
 * Convert hex color to rgba
 */
function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '')
  const r = parseInt(cleanHex.substr(0, 2), 16)
  const g = parseInt(cleanHex.substr(2, 2), 16)
  const b = parseInt(cleanHex.substr(4, 2), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * ThemeProvider component
 * Applies theme CSS custom properties to the document root
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore(state => state.theme)
  
  useEffect(() => {
    const cssVars = themeToCssVars(theme)
    const root = document.documentElement
    
    // Apply all CSS variables
    for (const [property, value] of Object.entries(cssVars)) {
      root.style.setProperty(property, value)
    }
    
    // Set color-scheme for native elements
    root.style.setProperty('color-scheme', theme.isDark ? 'dark' : 'light')
    
    // Clean up on unmount (though this component typically never unmounts)
    return () => {
      for (const property of Object.keys(cssVars)) {
        root.style.removeProperty(property)
      }
    }
  }, [theme])
  
  return <>{children}</>
}

