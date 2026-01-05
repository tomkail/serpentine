import { create } from 'zustand'
import type { DragMode, Point, HoverTarget } from '../types'

interface DragState {
  mode: DragMode
  shapeId: string
  startPoint: Point
  startCenter: Point
  startRadius: number
}

interface SelectionState {
  // State
  selectedIds: string[]
  hoveredId: string | null
  hoverTarget: HoverTarget  // What specific element is being hovered
  dragState: DragState | null
  
  // Actions
  select: (id: string, additive?: boolean) => void
  deselect: (id: string) => void
  clearSelection: () => void
  setHovered: (id: string | null) => void
  setHoverTarget: (target: HoverTarget) => void
  setDragState: (state: DragState | null) => void
  selectAll: (ids: string[]) => void
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  selectedIds: [],
  hoveredId: null,
  hoverTarget: null,
  dragState: null,
  
  select: (id, additive = false) => set((state) => {
    if (additive) {
      // Toggle selection
      if (state.selectedIds.includes(id)) {
        return { selectedIds: state.selectedIds.filter(i => i !== id) }
      }
      return { selectedIds: [...state.selectedIds, id] }
    }
    // Replace selection
    return { selectedIds: [id] }
  }),
  
  deselect: (id) => set((state) => ({
    selectedIds: state.selectedIds.filter(i => i !== id)
  })),
  
  clearSelection: () => set({ selectedIds: [] }),
  
  setHovered: (id) => set({ hoveredId: id }),
  
  setHoverTarget: (target) => set({ hoverTarget: target }),
  
  setDragState: (dragState) => set({ dragState }),
  
  selectAll: (ids) => set({ selectedIds: ids })
}))
