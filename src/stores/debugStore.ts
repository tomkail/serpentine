import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface DebugState {
  // Visibility toggles
  showTangentPoints: boolean
  showTangentLabels: boolean
  showArcAngles: boolean
  showPathOrder: boolean
  showCircleCenters: boolean
  showGridCoords: boolean
  
  // Actions
  toggleTangentPoints: () => void
  toggleTangentLabels: () => void
  toggleArcAngles: () => void
  togglePathOrder: () => void
  toggleCircleCenters: () => void
  toggleGridCoords: () => void
  resetDebug: () => void
}

export const useDebugStore = create<DebugState>()(
  persist(
    (set) => ({
      // All debug settings disabled by default
      showTangentPoints: false,
      showTangentLabels: false,
      showArcAngles: false,
      showPathOrder: false,
      showCircleCenters: false,
      showGridCoords: false,
      
      toggleTangentPoints: () => set((state) => ({ showTangentPoints: !state.showTangentPoints })),
      toggleTangentLabels: () => set((state) => ({ showTangentLabels: !state.showTangentLabels })),
      toggleArcAngles: () => set((state) => ({ showArcAngles: !state.showArcAngles })),
      togglePathOrder: () => set((state) => ({ showPathOrder: !state.showPathOrder })),
      toggleCircleCenters: () => set((state) => ({ showCircleCenters: !state.showCircleCenters })),
      toggleGridCoords: () => set((state) => ({ showGridCoords: !state.showGridCoords })),
      resetDebug: () => set({
        showTangentPoints: false,
        showTangentLabels: false,
        showArcAngles: false,
        showPathOrder: false,
        showCircleCenters: false,
        showGridCoords: false,
      }),
    }),
    {
      name: 'serpentine-debug-settings',
      // Only persist the visibility toggles, not the actions
      partialize: (state) => ({
        showTangentPoints: state.showTangentPoints,
        showTangentLabels: state.showTangentLabels,
        showArcAngles: state.showArcAngles,
        showPathOrder: state.showPathOrder,
        showCircleCenters: state.showCircleCenters,
        showGridCoords: state.showGridCoords,
      }),
    }
  )
)

