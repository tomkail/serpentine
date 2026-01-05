import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Point, Rect } from '../types'
import {
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  FIT_TO_RECT_PADDING
} from '../constants'

interface ViewportState {
  // State
  pan: Point
  zoom: number
  
  // Actions
  setPan: (pan: Point) => void
  setZoom: (zoom: number, center?: Point) => void
  panBy: (delta: Point) => void
  zoomBy: (factor: number, center?: Point) => void
  fitToRect: (bounds: Rect, canvasWidth: number, canvasHeight: number, padding?: number) => void
  reset: () => void
}

export const useViewportStore = create<ViewportState>()(
  persist(
    (set, get) => ({
      pan: { x: 0, y: 0 },
      zoom: DEFAULT_ZOOM,
      
      setPan: (pan) => set({ pan }),
      
      setZoom: (zoom, center) => {
        const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
        
        if (center) {
          // Zoom centered on a point
          const state = get()
          const zoomRatio = clampedZoom / state.zoom
          
          // Adjust pan to keep the center point stationary
          const newPan = {
            x: center.x - (center.x - state.pan.x) * zoomRatio,
            y: center.y - (center.y - state.pan.y) * zoomRatio
          }
          
          set({ zoom: clampedZoom, pan: newPan })
        } else {
          set({ zoom: clampedZoom })
        }
      },
      
      panBy: (delta) => set((state) => ({
        pan: {
          x: state.pan.x + delta.x,
          y: state.pan.y + delta.y
        }
      })),
      
      zoomBy: (factor, center) => {
        const state = get()
        const newZoom = state.zoom * factor
        state.setZoom(newZoom, center)
      },
      
      fitToRect: (bounds, canvasWidth, canvasHeight, padding = FIT_TO_RECT_PADDING) => {
        if (bounds.width <= 0 || bounds.height <= 0) return
        
        // Calculate the zoom needed to fit the bounds
        const availableWidth = canvasWidth - padding * 2
        const availableHeight = canvasHeight - padding * 2
        
        const scaleX = availableWidth / bounds.width
        const scaleY = availableHeight / bounds.height
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(scaleX, scaleY)))
        
        // Calculate pan to center the bounds
        const centerX = bounds.x + bounds.width / 2
        const centerY = bounds.y + bounds.height / 2
        
        const newPan = {
          x: canvasWidth / 2 - centerX * newZoom,
          y: canvasHeight / 2 - centerY * newZoom
        }
        
        set({ zoom: newZoom, pan: newPan })
      },
      
      reset: () => set({
        pan: { x: 0, y: 0 },
        zoom: DEFAULT_ZOOM
      })
    }),
    {
      name: 'stringpath-viewport',
      partialize: (state) => ({
        pan: state.pan,
        zoom: state.zoom
      })
    }
  )
)

// Helper to convert screen coordinates to world coordinates
export function screenToWorld(screenPoint: Point, pan: Point, zoom: number): Point {
  return {
    x: (screenPoint.x - pan.x) / zoom,
    y: (screenPoint.y - pan.y) / zoom
  }
}

// Helper to convert world coordinates to screen coordinates
export function worldToScreen(worldPoint: Point, pan: Point, zoom: number): Point {
  return {
    x: worldPoint.x * zoom + pan.x,
    y: worldPoint.y * zoom + pan.y
  }
}

