import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Shape, SerpentineDocument, CircleShape } from '../types'

interface DocumentState {
  // State
  shapes: Shape[]
  shapeOrder: string[]
  globalStretch: number  // Project-level stretch (-1 to 1, 0 = circular)
  closedPath: boolean    // Whether the path loops back to start
  useStartPoint: boolean // Whether to use tangent point on first circle (when not looping)
  useEndPoint: boolean   // Whether to use tangent point on last circle (when not looping)
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
  toggleDirection: (id: string) => void
  toggleMirror: (id: string) => void
  toggleClosedPath: () => void
  setClosedPath: (closed: boolean) => void
  toggleUseStartPoint: () => void
  setUseStartPoint: (use: boolean) => void
  toggleUseEndPoint: () => void
  setUseEndPoint: (use: boolean) => void
  reset: () => void
  loadDocument: (data: SerpentineDocument) => void
  setFileName: (name: string | null) => void
}

// Default starting document
const createDefaultDocument = (): Pick<DocumentState, 'shapes' | 'shapeOrder' | 'globalStretch' | 'closedPath' | 'useStartPoint' | 'useEndPoint' | 'fileName'> => {
  const c1: CircleShape = {
    id: crypto.randomUUID(),
    type: 'circle',
    name: 'Circle 1',
    center: { x: 0, y: -80 },
    radius: 120,
    direction: 'ccw'
  }
  const c2: CircleShape = {
    id: crypto.randomUUID(),
    type: 'circle',
    name: 'Circle 2',
    center: { x: 210, y: -140 },
    radius: 60,
    direction: 'cw',
    entryOffset: -Math.PI / 2
  }
  const c3: CircleShape = {
    id: crypto.randomUUID(),
    type: 'circle',
    name: 'Circle 3',
    center: { x: 180, y: 110 },
    radius: 140,
    direction: 'cw'
  }
  const c4: CircleShape = {
    id: crypto.randomUUID(),
    type: 'circle',
    name: 'Circle 4',
    center: { x: 0, y: 130 },
    radius: 120,
    direction: 'cw',
    entryOffset: -Math.PI / 2
  }
  
  return {
    shapes: [c1, c2, c3, c4],
    shapeOrder: [c4.id, c3.id, c1.id, c2.id],  // Path order from the file
    globalStretch: 0,
    closedPath: false,
    useStartPoint: true,
    useEndPoint: true,
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
      
      removeShape: (id) => set((state) => {
        // Prevent removal if it would leave fewer than 2 circles
        const circleCount = state.shapes.filter(s => s.type === 'circle').length
        if (circleCount <= 2) {
          return state // No change - must keep at least 2 circles
        }
        return {
          shapes: state.shapes.filter(shape => shape.id !== id),
          shapeOrder: state.shapeOrder.filter(shapeId => shapeId !== id)
        }
      }),
      
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
      
      toggleDirection: (id) => set((state) => ({
        shapes: state.shapes.map(shape => {
          if (shape.id === id && shape.type === 'circle') {
            return {
              ...shape,
              direction: shape.direction === 'cw' ? 'ccw' : 'cw'
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
      
      toggleUseStartPoint: () => set((state) => ({
        useStartPoint: !state.useStartPoint
      })),
      
      setUseStartPoint: (use) => set({ useStartPoint: use }),
      
      toggleUseEndPoint: () => set((state) => ({
        useEndPoint: !state.useEndPoint
      })),
      
      setUseEndPoint: (use) => set({ useEndPoint: use }),
      
      reset: () => set(createDefaultDocument()),
      
      loadDocument: (data) => set({
        // Ensure backwards compatibility and migrate old formats
        // Stretch is left as undefined if not specified (inherits from global)
        shapes: data.shapes.map(shape => {
          // Cast to unknown first for backwards compatibility with old file formats
          const legacyShape = shape as unknown as Record<string, unknown>
          const legacyStretch = legacyShape.fling as number | undefined
          const legacyTension = legacyShape.tension as number | undefined
          // Migrate wrapSide → direction: 'right' → 'cw', 'left' → 'ccw'
          const legacyWrapSide = legacyShape.wrapSide as 'left' | 'right' | undefined
          const direction = shape.direction ?? (legacyWrapSide === 'left' ? 'ccw' : 'cw')
          return {
            ...shape,
            direction,
            // Migrate: fling (0-1) maps to stretch (0-1), tension (0-1) maps to stretch (1-0)
            stretch: shape.stretch ?? legacyStretch ?? (legacyTension !== undefined ? 1 - legacyTension : undefined)
          } as CircleShape
        }),
        shapeOrder: data.pathOrder,
        // Migrate old settings to globalStretch
        globalStretch: (() => {
          const settings = data.settings as unknown as Record<string, unknown> | undefined
          if (settings?.globalStretch !== undefined) return settings.globalStretch as number
          if (settings?.globalFling !== undefined) return settings.globalFling as number
          if (settings?.globalTension !== undefined) return 1 - (settings.globalTension as number)
          return 0
        })(),
        closedPath: data.settings?.closedPath ?? true,  // Default to closed for backwards compatibility
        useStartPoint: data.settings?.useStartPoint ?? true,  // Default to true for backwards compatibility
        useEndPoint: data.settings?.useEndPoint ?? true,  // Default to true for backwards compatibility
        fileName: data.name
      }),
      
      setFileName: (name) => set({ fileName: name })
    }),
    {
      name: 'serpentine-document',
      partialize: (state) => ({
        shapes: state.shapes,
        shapeOrder: state.shapeOrder,
        globalStretch: state.globalStretch,
        closedPath: state.closedPath,
        useStartPoint: state.useStartPoint,
        useEndPoint: state.useEndPoint,
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
          // Default start/end point settings to true for backwards compatibility
          useStartPoint: persisted.useStartPoint ?? true,
          useEndPoint: persisted.useEndPoint ?? true,
          // Migrate shapes: wrapSide → direction, fling/tension → stretch
          shapes: (persisted.shapes ?? currentState.shapes).map(shape => {
            const legacyWrapSide = (shape as any).wrapSide as 'left' | 'right' | undefined
            return {
              ...shape,
              direction: shape.direction ?? (legacyWrapSide === 'left' ? 'ccw' : 'cw'),
              // Migrate: fling → stretch, tension (inverted) → stretch
              stretch: (shape as any).stretch ?? (shape as any).fling ?? ((shape as any).tension !== undefined ? 1 - (shape as any).tension : undefined)
            }
          })
        }
      }
    }
  )
)

