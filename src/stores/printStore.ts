import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultPaperId, type PrintOptions } from '@tomkail/workshop-kit'

export interface SerpentinePrintSettings extends PrintOptions {
  /** 'fit' scales to the paper; 'physical' prints at mmPerUnit, tiling if needed */
  scaleMode: 'fit' | 'physical'
  /** Millimetres per canvas unit for true-size prints */
  mmPerUnit: number
  showCircles: boolean
  fill: boolean
  /** Path stroke width on paper, mm */
  strokeWidth: number
}

interface PrintState {
  isOpen: boolean
  settings: SerpentinePrintSettings
  open: () => void
  close: () => void
  update: (changes: Partial<SerpentinePrintSettings>) => void
}

export const usePrintStore = create<PrintState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      settings: {
        paperId: defaultPaperId(),
        landscape: false,
        labels: true,
        scaleCheck: true,
        scaleMode: 'fit',
        mmPerUnit: 1,
        showCircles: false,
        fill: false,
        strokeWidth: 0.35,
      },
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      update: (changes) => set({ settings: { ...get().settings, ...changes } }),
    }),
    {
      name: 'serpentine-print',
      partialize: (state) => ({ settings: state.settings }),
      merge: (persisted, current) => ({ ...current, settings: { ...current.settings, ...(persisted as Partial<PrintState>)?.settings } }),
    }
  )
)
