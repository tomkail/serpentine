import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Shape, SerpentineDocument, CircleShape, MirrorConfig } from '../types'
import { defaultPreset } from '../utils/presets'
import { startMeasure, endMeasure } from '../utils/profiler'
import type { PathMode } from '../components/icons/Icons'

// Startup timing - runs during module evaluation
const moduleStartTime = performance.now()
console.log('%c[Store] documentStore module loading...', 'color: #ffd93d;')

/**
 * Common mirror presets for cycling through
 * - None: no mirroring
 * - 2-way vertical: 1 plane at 90° (vertical axis, left-right symmetry)
 * - 2-way horizontal: 1 plane at 0° (horizontal axis, up-down symmetry)
 * - 4-way: 2 planes at 0° and 90°
 * - 6-way: 3 planes at 0°, 60°, 120°
 * - 8-way: 4 planes at 0°, 45°, 90°, 135°
 */
export const MIRROR_PRESETS: { name: string; config: MirrorConfig }[] = [
  { name: 'None', config: { planeCount: 0, startAngle: 0 } }, // No mirroring
  { name: '2-way (vertical)', config: { planeCount: 1, startAngle: Math.PI / 2 } }, // Y-axis reflection (left-right symmetry)
  { name: '2-way (horizontal)', config: { planeCount: 1, startAngle: 0 } }, // X-axis reflection (up-down symmetry)
  { name: '4-way', config: { planeCount: 2, startAngle: 0 } },
  { name: '6-way', config: { planeCount: 3, startAngle: 0 } },
  { name: '8-way', config: { planeCount: 4, startAngle: 0 } },
]

interface DocumentState {
  // State
  shapes: Shape[]
  shapeOrder: string[]
  globalStretch: number  // Project-level stretch (-1 to 1, 0 = circular)
  closedPath: boolean    // Whether the path loops back to start
  useStartPoint: boolean // Whether to use tangent point on first circle (when not looping)
  useEndPoint: boolean   // Whether to use tangent point on last circle (when not looping)
  mirrorConfig: MirrorConfig // Mirror configuration (planeCount + startAngle)
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
  cycleMirrorPreset: () => void
  setMirrorConfig: (config: MirrorConfig) => void
  toggleClosedPath: () => void
  setClosedPath: (closed: boolean) => void
  toggleUseStartPoint: () => void
  setUseStartPoint: (use: boolean) => void
  toggleUseEndPoint: () => void
  setUseEndPoint: (use: boolean) => void
  getPathMode: () => PathMode
  cyclePathMode: () => void
  setPathMode: (mode: PathMode) => void
  reset: () => void
  loadDocument: (data: SerpentineDocument) => void
  setFileName: (name: string | null) => void
  markDirty: () => void
  markClean: () => void
}

// Default starting document - uses the default preset with fresh UUIDs
const createDefaultDocument = (): Pick<DocumentState, 'shapes' | 'shapeOrder' | 'globalStretch' | 'closedPath' | 'useStartPoint' | 'useEndPoint' | 'mirrorConfig' | 'fileName' | 'isDirty'> => {
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
    mirrorConfig: MIRROR_PRESETS[0].config, // Default to None
    fileName: null,
    isDirty: false
  }
}

/**
 * Find the index of the current mirror config in MIRROR_PRESETS
 * Returns -1 if not found (custom config)
 */
function findMirrorPresetIndex(config: MirrorConfig): number {
  return MIRROR_PRESETS.findIndex(p => 
    p.config.planeCount === config.planeCount && 
    Math.abs(p.config.startAngle - config.startAngle) < 0.001
  )
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
      
      cycleMirrorPreset: () => set((state) => {
        const currentIndex = findMirrorPresetIndex(state.mirrorConfig)
        const nextIndex = (currentIndex + 1) % MIRROR_PRESETS.length
        return {
          mirrorConfig: MIRROR_PRESETS[nextIndex].config,
          isDirty: true
        }
      }),
      
      setMirrorConfig: (config) => set({ mirrorConfig: config, isDirty: true }),
      
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
      
      // Get current path mode from state
      getPathMode: () => {
        const state = get()
        if (state.closedPath) return 'closed'
        if (state.useStartPoint && state.useEndPoint) return 'both-arcs'
        if (state.useStartPoint) return 'left-arc'
        if (state.useEndPoint) return 'right-arc'
        return 'tangent'
      },
      
      // Cycle through path modes: tangent → left-arc → right-arc → both-arcs → closed → tangent
      cyclePathMode: () => set((state) => {
        const currentMode = state.closedPath ? 'closed' 
          : (state.useStartPoint && state.useEndPoint) ? 'both-arcs'
          : state.useStartPoint ? 'left-arc'
          : state.useEndPoint ? 'right-arc'
          : 'tangent'
        
        const modeOrder: PathMode[] = ['tangent', 'left-arc', 'right-arc', 'both-arcs', 'closed']
        const currentIndex = modeOrder.indexOf(currentMode)
        const nextMode = modeOrder[(currentIndex + 1) % modeOrder.length]
        
        switch (nextMode) {
          case 'tangent':
            return { closedPath: false, useStartPoint: false, useEndPoint: false, isDirty: true }
          case 'left-arc':
            return { closedPath: false, useStartPoint: true, useEndPoint: false, isDirty: true }
          case 'right-arc':
            return { closedPath: false, useStartPoint: false, useEndPoint: true, isDirty: true }
          case 'both-arcs':
            return { closedPath: false, useStartPoint: true, useEndPoint: true, isDirty: true }
          case 'closed':
            return { closedPath: true, isDirty: true }
          default:
            return {}
        }
      }),
      
      // Set a specific path mode
      setPathMode: (mode: PathMode) => set(() => {
        switch (mode) {
          case 'tangent':
            return { closedPath: false, useStartPoint: false, useEndPoint: false, isDirty: true }
          case 'left-arc':
            return { closedPath: false, useStartPoint: true, useEndPoint: false, isDirty: true }
          case 'right-arc':
            return { closedPath: false, useStartPoint: false, useEndPoint: true, isDirty: true }
          case 'both-arcs':
            return { closedPath: false, useStartPoint: true, useEndPoint: true, isDirty: true }
          case 'closed':
            return { closedPath: true, isDirty: true }
          default:
            return {}
        }
      }),
      
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
          mirrorConfig: data.settings?.mirrorConfig ?? MIRROR_PRESETS[0].config,  // Default to None
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
        mirrorConfig: state.mirrorConfig,
        fileName: state.fileName
      }),
      // Migrate old data
      merge: (persistedState, currentState) => {
        console.log('%c[Store] documentStore hydrating from localStorage...', 'color: #ffd93d;')
        const hydrateStart = performance.now()
        
        const persisted = persistedState as Partial<DocumentState> & { 
          globalTension?: number
          globalFling?: number
          mirrorAxis?: 'vertical' | 'horizontal' | 'both'  // Legacy field
        }
        
        // Migrate old mirrorAxis to mirrorConfig
        const migrateMirrorConfig = (): MirrorConfig => {
          if (persisted.mirrorConfig) return persisted.mirrorConfig
          // Migrate from legacy mirrorAxis
          switch (persisted.mirrorAxis) {
            case 'horizontal': return { planeCount: 1, startAngle: Math.PI / 2 }
            case 'both': return { planeCount: 2, startAngle: 0 }
            case 'vertical':
            default: return { planeCount: 1, startAngle: 0 }
          }
        }
        
        const result = {
          ...currentState,
          ...persisted,
          // Migrate old globalFling/globalTension to globalStretch
          globalStretch: persisted.globalStretch ?? persisted.globalFling ?? (persisted.globalTension !== undefined ? 1 - persisted.globalTension : currentState.globalStretch),
          // Default closedPath to true for backwards compatibility
          closedPath: persisted.closedPath ?? true,
          // Default start/end point settings to true for backwards compatibility
          useStartPoint: persisted.useStartPoint ?? true,
          useEndPoint: persisted.useEndPoint ?? true,
          // Migrate mirrorAxis to mirrorConfig
          mirrorConfig: migrateMirrorConfig(),
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
        
        console.log(`%c[Store] documentStore hydrated in ${(performance.now() - hydrateStart).toFixed(1)}ms (${result.shapes.length} shapes)`, 'color: #ffd93d;')
        return result
      },
      onRehydrateStorage: () => {
        console.log('%c[Store] documentStore onRehydrateStorage start', 'color: #ffd93d;')
        return (_state, error) => {
          if (error) {
            console.error('[Store] documentStore hydration error:', error)
          } else {
            console.log(`%c[Store] documentStore rehydration complete`, 'color: #00ff88;')
          }
        }
      }
    }
  )
)

// Log when module finishes loading
console.log(`%c[Store] documentStore module loaded in ${(performance.now() - moduleStartTime).toFixed(1)}ms`, 'color: #00ff88;')

