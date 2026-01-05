import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MeasurementMode } from '../types'
import { DEFAULT_GRID_SIZE, MIN_GRID_SIZE, MAX_GRID_SIZE } from '../constants'

interface SettingsState {
  // State
  snapToGrid: boolean
  gridSize: number
  measurementMode: MeasurementMode
  showGrid: boolean
  
  // Actions
  toggleSnap: () => void
  setSnapToGrid: (enabled: boolean) => void
  setGridSize: (size: number) => void
  cycleMeasurementMode: () => void
  setMeasurementMode: (mode: MeasurementMode) => void
  toggleGrid: () => void
}

const MEASUREMENT_MODES: MeasurementMode[] = ['clean', 'minimal', 'detailed']

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      snapToGrid: true,
      gridSize: DEFAULT_GRID_SIZE,
      measurementMode: 'minimal',
      showGrid: true,
      
      toggleSnap: () => set((state) => ({
        snapToGrid: !state.snapToGrid
      })),
      
      setSnapToGrid: (enabled) => set({ snapToGrid: enabled }),
      
      setGridSize: (size) => set({
        gridSize: Math.max(MIN_GRID_SIZE, Math.min(MAX_GRID_SIZE, size))
      }),
      
      cycleMeasurementMode: () => set((state) => {
        const currentIndex = MEASUREMENT_MODES.indexOf(state.measurementMode)
        const nextIndex = (currentIndex + 1) % MEASUREMENT_MODES.length
        return { measurementMode: MEASUREMENT_MODES[nextIndex] }
      }),
      
      setMeasurementMode: (mode) => set({ measurementMode: mode }),
      
      toggleGrid: () => set((state) => ({
        showGrid: !state.showGrid
      }))
    }),
    {
      name: 'serpentine-settings',
      partialize: (state) => ({
        snapToGrid: state.snapToGrid,
        gridSize: state.gridSize,
        measurementMode: state.measurementMode,
        showGrid: state.showGrid
      })
    }
  )
)

