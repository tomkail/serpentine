import { create } from 'zustand'

interface CanvasState {
  width: number
  height: number
  setDimensions: (width: number, height: number) => void
}

export const useCanvasStore = create<CanvasState>()((set) => ({
  width: 800,
  height: 600,
  setDimensions: (width, height) => set({ width, height })
}))

