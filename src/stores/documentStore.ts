import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Shape, SerpentineDocument, CircleShape, MirrorAxis } from '../types'
import { defaultPreset } from '../utils/presets'
import { startMeasure, endMeasure } from '../utils/profiler'

interface DocumentState {
  // State
  shapes: Shape[]
  shapeOrder: string[]
  globalStretch: number  // Project-level stretch (-1 to 1, 0 = circular)
  closedPath: boolean    // Whether the path loops back to start
  useStartPoint: boolean // Whether to use tangent point on first circle (when not looping)
  useEndPoint: boolean   // Whether to use tangent point on last circle (when not looping)
  mirrorAxis: MirrorAxis // Which axis to mirror across ('vertical' = x=0, 'horizontal' = y=0)
  fileName: string | null
  isDirty: boolean       // Whether document has unsaved changes
  
  // Actions
  addShape: (shape: Shape) => void
  insertShapeAt: (shape: Shape, orderIndex: number) => void  // Insert at specific position in order
  updateShape: (id: string, updates: Partial<Shape>) => void
  updateShapes: (updates: Map<string, Partial<Shape>>) => void  // Batch update multiple shapes
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
  toggleMirrorAxis: () => void
  toggleClosedPath: () => void
  setClosedPath: (closed: boolean) => void
  toggleUseStartPoint: () => void
  setUseStartPoint: (use: boolean) => void
  toggleUseEndPoint: () => void
  setUseEndPoint: (use: boolean) => void
  reset: () => void
  loadDocument: (data: SerpentineDocument) => void
  setFileName: (name: string | null) => void
  markDirty: () => void
  markClean: () => void
}

// Default starting document - uses the default preset with fresh UUIDs
const createDefaultDocument = (): Pick<DocumentState, 'shapes' | 'shapeOrder' | 'globalStretch' | 'closedPath' | 'useStartPoint' | 'useEndPoint' | 'mirrorAxis' | 'fileName' | 'isDirty'> => {
  const doc = defaultPreset.document
  
  // Create a mapping from preset IDs to new UUIDs
  const idMap = new Map<string, string>()
  doc.shapes.forEach(shape => {
    idMap.set(shape.id, crypto.randomUUID())
  })
  
  // Create shapes with new IDs
  const shapes = doc.shapes.map(shape => ({
    ...shape,
    id: idMap.get(shape.id)!
  })) as CircleShape[]
  
  // Map the path order to new IDs
  const shapeOrder = doc.pathOrder.map(id => idMap.get(id)!)
  
  return {
    shapes,
    shapeOrder,
    globalStretch: 0,
    closedPath: doc.settings?.closedPath ?? false,
    useStartPoint: doc.settings?.useStartPoint ?? true,
    useEndPoint: doc.settings?.useEndPoint ?? true,
    mirrorAxis: 'vertical' as MirrorAxis,
    fileName: null,
    isDirty: false
  }
}

// Helper to update a specific circle by ID
const updateCircleById = (
  shapes: Shape[],
  id: string,
  update: Partial<CircleShape>
): Shape[] => shapes.map(shape =>
  shape.id === id && shape.type === 'circle'
    ? { ...shape, ...update }
    : shape
)

export const useDocumentStore = create<DocumentState>()(
  persist(
    (set, get) => ({
      ...createDefaultDocument(),
      
      addShape: (shape) => {
        startMeasure('addShape')
        set((state) => ({
          shapes: [...state.shapes, shape],
          shapeOrder: [...state.shapeOrder, shape.id],
          isDirty: true
        }))
        endMeasure('addShape')
      },
      
      insertShapeAt: (shape, orderIndex) => set((state) => {
        const newOrder = [...state.shapeOrder]
        // Clamp index to valid range
        const insertIndex = Math.max(0, Math.min(orderIndex, newOrder.length))
        newOrder.splice(insertIndex, 0, shape.id)
        return {
          shapes: [...state.shapes, shape],
          shapeOrder: newOrder,
          isDirty: true
        }
      }),
      
      updateShape: (id, updates) => set((state) => ({
        shapes: state.shapes.map(shape => 
          shape.id === id ? { ...shape, ...updates } : shape
        ),
        isDirty: true
      })),
      
      updateShapes: (updates) => set((state) => ({
        shapes: state.shapes.map(shape => {
          const shapeUpdates = updates.get(shape.id)
          return shapeUpdates ? { ...shape, ...shapeUpdates } : shape
        }),
        isDirty: true
      })),
      
      removeShape: (id) => set((state) => {
        // Prevent removal if it would leave fewer than 2 circles
        const circleCount = state.shapes.filter(s => s.type === 'circle').length
        if (circleCount <= 2) {
          return state // No change - must keep at least 2 circles
        }
        return {
          shapes: state.shapes.filter(shape => shape.id !== id),
          shapeOrder: state.shapeOrder.filter(shapeId => shapeId !== id),
          isDirty: true
        }
      }),
      
      reorderShapes: (newOrder) => set({ shapeOrder: newOrder, isDirty: true }),
      
      // Stretch setters
      setGlobalStretch: (stretch) => set({ 
        globalStretch: Math.max(-1, Math.min(1, stretch)),
        isDirty: true 
      }),
      
      setCircleStretch: (id, stretch) => set((state) => ({
        shapes: updateCircleById(state.shapes, id, {
          stretch: stretch !== undefined ? Math.max(-1, Math.min(1, stretch)) : undefined
        }),
        isDirty: true
      })),
      
      // Tangent offset: angle in radians to rotate contact points (entry/exit separately)
      setEntryOffset: (id, offset) => set((state) => ({
        shapes: updateCircleById(state.shapes, id, { entryOffset: offset }),
        isDirty: true
      })),
      
      setExitOffset: (id, offset) => set((state) => ({
        shapes: updateCircleById(state.shapes, id, { exitOffset: offset }),
        isDirty: true
      })),
      
      // Tangent length multipliers
      setEntryTangentLength: (id, length) => set((state) => ({
        shapes: updateCircleById(state.shapes, id, { entryTangentLength: length }),
        isDirty: true
      })),
      
      setExitTangentLength: (id, length) => set((state) => ({
        shapes: updateCircleById(state.shapes, id, { exitTangentLength: length }),
        isDirty: true
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
        ),
        isDirty: true
      })),
      
      duplicateShape: (id) => {
        startMeasure('duplicateShape')
        const state = get()
        const shape = state.shapes.find(s => s.id === id)
        if (!shape) {
          endMeasure('duplicateShape')
          return
        }
        
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
          shapeOrder: [...state.shapeOrder, newShape.id],
          isDirty: true
        })
        endMeasure('duplicateShape')
      },
      
      toggleDirection: (id) => set((state) => ({
        shapes: updateCircleById(state.shapes, id, {
          direction: (state.shapes.find(s => s.id === id) as CircleShape)?.direction === 'cw' ? 'ccw' : 'cw'
        }),
        isDirty: true
      })),
      
      toggleMirror: (id) => set((state) => ({
        shapes: updateCircleById(state.shapes, id, {
          mirrored: !(state.shapes.find(s => s.id === id) as CircleShape)?.mirrored
        }),
        isDirty: true
      })),
      
      toggleMirrorAxis: () => set((state) => ({
        mirrorAxis: state.mirrorAxis === 'vertical' ? 'horizontal' : 'vertical',
        isDirty: true
      })),
      
      toggleClosedPath: () => set((state) => ({
        closedPath: !state.closedPath,
        isDirty: true
      })),
      
      setClosedPath: (closed) => set({ closedPath: closed, isDirty: true }),
      
      toggleUseStartPoint: () => set((state) => ({
        useStartPoint: !state.useStartPoint,
        isDirty: true
      })),
      
      setUseStartPoint: (use) => set({ useStartPoint: use, isDirty: true }),
      
      toggleUseEndPoint: () => set((state) => ({
        useEndPoint: !state.useEndPoint,
        isDirty: true
      })),
      
      setUseEndPoint: (use) => set({ useEndPoint: use, isDirty: true }),
      
      reset: () => set(createDefaultDocument()),
      
      loadDocument: (data) => {
        startMeasure('loadDocument', { shapes: data.shapes.length })
        
        startMeasure('migrateShapes')
        // Ensure backwards compatibility and migrate old formats
        // Stretch is left as undefined if not specified (inherits from global)
        const migratedShapes = data.shapes.map(shape => {
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
        })
        endMeasure('migrateShapes')
        
        // Migrate old settings to globalStretch
        const globalStretch = (() => {
          const settings = data.settings as unknown as Record<string, unknown> | undefined
          if (settings?.globalStretch !== undefined) return settings.globalStretch as number
          if (settings?.globalFling !== undefined) return settings.globalFling as number
          if (settings?.globalTension !== undefined) return 1 - (settings.globalTension as number)
          return 0
        })()
        
        startMeasure('setState')
        set({
          shapes: migratedShapes,
          shapeOrder: data.pathOrder,
          globalStretch,
          closedPath: data.settings?.closedPath ?? true,  // Default to closed for backwards compatibility
          useStartPoint: data.settings?.useStartPoint ?? true,  // Default to true for backwards compatibility
          useEndPoint: data.settings?.useEndPoint ?? true,  // Default to true for backwards compatibility
          fileName: data.name,
          isDirty: false
        })
        endMeasure('setState')
        
        endMeasure('loadDocument')
      },
      
      setFileName: (name) => set({ fileName: name }),
      
      markDirty: () => set({ isDirty: true }),
      
      markClean: () => set({ isDirty: false })
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
        mirrorAxis: state.mirrorAxis,
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
          // Default mirrorAxis to vertical for backwards compatibility
          mirrorAxis: persisted.mirrorAxis ?? 'vertical',
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

