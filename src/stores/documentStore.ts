import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Shape, StringPathDocument, CircleShape } from '../types'
import { createCircle } from '../geometry/shapes/Circle'

interface DocumentState {
  // State
  shapes: Shape[]
  shapeOrder: string[]
  globalStretch: number  // Project-level stretch (-1 to 1, 0 = circular)
  closedPath: boolean    // Whether the path loops back to start
  fileName: string | null
  
  // Actions
  addShape: (shape: Shape) => void
  insertShapeAt: (shape: Shape, orderIndex: number) => void  // Insert at specific position in order
  updateShape: (id: string, updates: Partial<Shape>) => void
  removeShape: (id: string) => void
  reorderShapes: (newOrder: string[]) => void
  
  // Stretch actions (circle-level or global)
  setGlobalStretch: (stretch: number) => void
  setCircleStretch: (id: string, stretch: number | undefined) => void
  
  // Tangent offset actions (entry/exit separately)
  setEntryOffset: (id: string, offset: number | undefined) => void
  setExitOffset: (id: string, offset: number | undefined) => void
  setEntryTangentLength: (id: string, length: number | undefined) => void
  setExitTangentLength: (id: string, length: number | undefined) => void
  
  // Helper to get effective stretch for a circle
  getEffectiveStretch: (id: string) => number
  
  renameShape: (id: string, name: string) => void
  duplicateShape: (id: string) => void
  toggleWrapSide: (id: string) => void
  toggleMirror: (id: string) => void
  toggleClosedPath: () => void
  setClosedPath: (closed: boolean) => void
  reset: () => void
  loadDocument: (data: StringPathDocument) => void
  setFileName: (name: string | null) => void
}

// Default starting document with a few circles
const createDefaultDocument = (): Pick<DocumentState, 'shapes' | 'shapeOrder' | 'globalStretch' | 'closedPath' | 'fileName'> => {
  const c1 = createCircle({ x: 200, y: 200 }, 60, undefined, 'Circle 1')
  const c2 = createCircle({ x: 400, y: 150 }, 40, undefined, 'Circle 2')
  const c3 = createCircle({ x: 350, y: 350 }, 70, undefined, 'Circle 3')
  
  return {
    shapes: [c1, c2, c3],
    shapeOrder: [c1.id, c2.id, c3.id],
    globalStretch: 0,  // 0 = circular arcs (no stretch)
    closedPath: true,  // Path loops by default
    fileName: null
  }
}

export const useDocumentStore = create<DocumentState>()(
  persist(
    (set, get) => ({
      ...createDefaultDocument(),
      
      addShape: (shape) => set((state) => ({
        shapes: [...state.shapes, shape],
        shapeOrder: [...state.shapeOrder, shape.id]
      })),
      
      insertShapeAt: (shape, orderIndex) => set((state) => {
        const newOrder = [...state.shapeOrder]
        // Clamp index to valid range
        const insertIndex = Math.max(0, Math.min(orderIndex, newOrder.length))
        newOrder.splice(insertIndex, 0, shape.id)
        return {
          shapes: [...state.shapes, shape],
          shapeOrder: newOrder
        }
      }),
      
      updateShape: (id, updates) => set((state) => ({
        shapes: state.shapes.map(shape => 
          shape.id === id ? { ...shape, ...updates } : shape
        )
      })),
      
      removeShape: (id) => set((state) => ({
        shapes: state.shapes.filter(shape => shape.id !== id),
        shapeOrder: state.shapeOrder.filter(shapeId => shapeId !== id)
      })),
      
      reorderShapes: (newOrder) => set({ shapeOrder: newOrder }),
      
      // Stretch setters
      setGlobalStretch: (stretch) => set({ 
        globalStretch: Math.max(-1, Math.min(1, stretch)) 
      }),
      
      setCircleStretch: (id, stretch) => set((state) => ({
        shapes: state.shapes.map(shape =>
          shape.id === id && shape.type === 'circle'
            ? { ...shape, stretch: stretch !== undefined ? Math.max(-1, Math.min(1, stretch)) : undefined }
            : shape
        )
      })),
      
      // Tangent offset: angle in radians to rotate contact points (entry/exit separately)
      setEntryOffset: (id, offset) => set((state) => ({
        shapes: state.shapes.map(shape =>
          shape.id === id && shape.type === 'circle'
            ? { ...shape, entryOffset: offset }
            : shape
        )
      })),
      
      setExitOffset: (id, offset) => set((state) => ({
        shapes: state.shapes.map(shape =>
          shape.id === id && shape.type === 'circle'
            ? { ...shape, exitOffset: offset }
            : shape
        )
      })),
      
      // Tangent length multipliers
      setEntryTangentLength: (id, length) => set((state) => ({
        shapes: state.shapes.map(shape =>
          shape.id === id && shape.type === 'circle'
            ? { ...shape, entryTangentLength: length }
            : shape
        )
      })),
      
      setExitTangentLength: (id, length) => set((state) => ({
        shapes: state.shapes.map(shape =>
          shape.id === id && shape.type === 'circle'
            ? { ...shape, exitTangentLength: length }
            : shape
        )
      })),
      
      // Get effective stretch for a circle (circle override or global)
      getEffectiveStretch: (id) => {
        const state = get()
        const shape = state.shapes.find(s => s.id === id)
        if (!shape || shape.type !== 'circle') return state.globalStretch
        
        const circle = shape as CircleShape
        
        // Circle-level override, or fall back to global
        if (circle.stretch !== undefined) {
          return circle.stretch
        }
        
        return state.globalStretch
      },
      
      renameShape: (id, name) => set((state) => ({
        shapes: state.shapes.map(shape =>
          shape.id === id ? { ...shape, name } : shape
        )
      })),
      
      duplicateShape: (id) => {
        const state = get()
        const shape = state.shapes.find(s => s.id === id)
        if (!shape) return
        
        const newShape: Shape = {
          ...shape,
          id: crypto.randomUUID(),
          name: `${shape.name} Copy`,
          center: {
            x: shape.center.x + 20,
            y: shape.center.y + 20
          }
        }
        
        set({
          shapes: [...state.shapes, newShape],
          shapeOrder: [...state.shapeOrder, newShape.id]
        })
      },
      
      toggleWrapSide: (id) => set((state) => ({
        shapes: state.shapes.map(shape => {
          if (shape.id === id && shape.type === 'circle') {
            return {
              ...shape,
              wrapSide: shape.wrapSide === 'right' ? 'left' : 'right'
            }
          }
          return shape
        })
      })),
      
      toggleMirror: (id) => set((state) => ({
        shapes: state.shapes.map(shape => {
          if (shape.id === id && shape.type === 'circle') {
            return {
              ...shape,
              mirrored: !shape.mirrored
            }
          }
          return shape
        })
      })),
      
      toggleClosedPath: () => set((state) => ({
        closedPath: !state.closedPath
      })),
      
      setClosedPath: (closed) => set({ closedPath: closed }),
      
      reset: () => set(createDefaultDocument()),
      
      loadDocument: (data) => set({
        // Ensure backwards compatibility - add default wrapSide if missing
        // Stretch is left as undefined if not specified (inherits from global)
        shapes: data.shapes.map(shape => ({
          ...shape,
          wrapSide: shape.wrapSide ?? 'right',
          // Migrate: fling (0-1) maps to stretch (0-1), tension (0-1) maps to stretch (1-0)
          stretch: shape.stretch ?? shape.fling ?? (shape.tension !== undefined ? 1 - shape.tension : undefined)
        })),
        shapeOrder: data.pathOrder,
        // Migrate old settings to globalStretch
        globalStretch: data.settings?.globalStretch ?? data.settings?.globalFling ?? (data.settings?.globalTension !== undefined ? 1 - data.settings.globalTension : 0),
        closedPath: data.settings?.closedPath ?? true,  // Default to closed for backwards compatibility
        fileName: data.name
      }),
      
      setFileName: (name) => set({ fileName: name })
    }),
    {
      name: 'stringpath-document',
      partialize: (state) => ({
        shapes: state.shapes,
        shapeOrder: state.shapeOrder,
        globalStretch: state.globalStretch,
        closedPath: state.closedPath,
        fileName: state.fileName
      }),
      // Migrate old data
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<DocumentState> & { globalTension?: number; globalFling?: number }
        return {
          ...currentState,
          ...persisted,
          // Migrate old globalFling/globalTension to globalStretch
          globalStretch: persisted.globalStretch ?? persisted.globalFling ?? (persisted.globalTension !== undefined ? 1 - persisted.globalTension : currentState.globalStretch),
          // Default closedPath to true for backwards compatibility
          closedPath: persisted.closedPath ?? true,
          // Ensure all shapes have wrapSide property and migrate to stretch
          shapes: (persisted.shapes ?? currentState.shapes).map(shape => ({
            ...shape,
            wrapSide: shape.wrapSide ?? 'right',
            // Migrate: fling → stretch, tension (inverted) → stretch
            stretch: (shape as any).stretch ?? (shape as any).fling ?? ((shape as any).tension !== undefined ? 1 - (shape as any).tension : undefined)
          }))
        }
      }
    }
  )
)

