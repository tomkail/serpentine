import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CanvasTheme } from '../types/theme'
import { themes, defaultTheme } from '../themes'

interface ThemeState {
  // Current theme name
  themeName: string
  
  // Computed theme object
  theme: CanvasTheme
  
  // Actions
  setTheme: (name: string) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeName: 'midnight',
      theme: defaultTheme,
      
      setTheme: (name) => {
        const theme = themes[name] ?? defaultTheme
        set({ themeName: name, theme })
      },
    }),
    {
      name: 'serpentine-theme',
      // Only persist the theme name, recompute theme on load
      partialize: (state) => ({ themeName: state.themeName }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.theme = themes[state.themeName] ?? defaultTheme
        }
      },
    }
  )
)

