import { create } from 'zustand'
import type { DragState, HoverTarget, Point, Rect } from '../types'
import type { SmartGuide } from '../geometry/smartGuides'

// Double-click timeout in milliseconds
const DOUBLE_CLICK_TIMEOUT = 400

// Animation timing (as fraction of DOUBLE_CLICK_TIMEOUT)
const FADE_IN_DURATION = 0.10   // Fade in over first 10%
const FADE_OUT_START = 0.50    // Start fading out at 50%

export interface ClickPreview {
  position: Point
  radius: number
  startTime: number  // Timestamp when preview was shown
}

/**
 * Calculate the opacity of the click preview based on elapsed time
 * - Fades in over the first 10% of the double-click timeout
 * - Stays visible until 50% of the timeout
 * - Fades out over the last 50% of the timeout
 */
export function getClickPreviewOpacity(preview: ClickPreview | null): number {
  if (!preview) return 0
  
  const elapsed = Date.now() - preview.startTime
  const progress = elapsed / DOUBLE_CLICK_TIMEOUT
  
  if (progress >= 1) return 0
  
  // Fade in phase (0% to 10%)
  if (progress < FADE_IN_DURATION) {
    return progress / FADE_IN_DURATION
  }
  
  // Visible phase (10% to 50%)
  if (progress < FADE_OUT_START) {
    return 1
  }
  
  // Fade out phase (50% to 100%)
  const fadeOutProgress = (progress - FADE_OUT_START) / (1 - FADE_OUT_START)
  return 1 - fadeOutProgress
}

/**
 * Get the marquee rectangle from a drag state
 * Returns null if not in marquee mode
 */
export function getMarqueeRect(dragState: DragState | null): Rect | null {
  if (!dragState || dragState.mode !== 'marquee' || !dragState.marqueeStart || !dragState.marqueeCurrent) {
    return null
  }
  
  const { marqueeStart, marqueeCurrent } = dragState
  const minX = Math.min(marqueeStart.x, marqueeCurrent.x)
  const maxX = Math.max(marqueeStart.x, marqueeCurrent.x)
  const minY = Math.min(marqueeStart.y, marqueeCurrent.y)
  const maxY = Math.max(marqueeStart.y, marqueeCurrent.y)
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

interface SelectionState {
  // State
  selectedIds: string[]
  hoveredId: string | null
  hoverTarget: HoverTarget  // What specific element is being hovered
  dragState: DragState | null
  clickPreview: ClickPreview | null  // Preview circle shown after single-click
  activeGuides: SmartGuide[]  // Smart guides shown during drag
  
  // Actions
  select: (id: string, additive?: boolean) => void
  deselect: (id: string) => void
  clearSelection: () => void
  setHovered: (id: string | null) => void
  setHoverTarget: (target: HoverTarget) => void
  setDragState: (state: DragState | null) => void
  selectAll: (ids: string[]) => void
  showClickPreview: (position: Point, radius: number) => void
  clearClickPreview: () => void
  setActiveGuides: (guides: SmartGuide[]) => void
  clearActiveGuides: () => void
}

// Store timeout ID for clearing preview
let previewTimeoutId: ReturnType<typeof setTimeout> | null = null

export const useSelectionStore = create<SelectionState>()((set) => ({
  selectedIds: [],
  hoveredId: null,
  hoverTarget: null,
  dragState: null,
  clickPreview: null,
  activeGuides: [],
  
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
  
  selectAll: (ids) => set({ selectedIds: ids }),
  
  showClickPreview: (position, radius) => {
    // Clear any existing timeout
    if (previewTimeoutId) {
      clearTimeout(previewTimeoutId)
    }
    
    // Set the preview with start time for animation
    set({ clickPreview: { position, radius, startTime: Date.now() } })
    
    // Auto-clear after double-click timeout expires
    previewTimeoutId = setTimeout(() => {
      set({ clickPreview: null })
      previewTimeoutId = null
    }, DOUBLE_CLICK_TIMEOUT)
  },
  
  clearClickPreview: () => {
    if (previewTimeoutId) {
      clearTimeout(previewTimeoutId)
      previewTimeoutId = null
    }
    set({ clickPreview: null })
  },
  
  setActiveGuides: (guides) => set({ activeGuides: guides }),
  
  clearActiveGuides: () => set({ activeGuides: [] })
}))
