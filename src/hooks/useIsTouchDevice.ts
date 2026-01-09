import { useState, useEffect } from 'react'

/**
 * Hook to detect if the current device primarily uses touch input
 * Uses pointer: coarse media query which is the most reliable method
 */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(() => {
    // Initial check on mount (SSR-safe)
    if (typeof window === 'undefined') return false
    return window.matchMedia('(pointer: coarse)').matches
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia('(pointer: coarse)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsTouch(e.matches)
    }
    
    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
    
    // Fallback for older browsers
    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  return isTouch
}

