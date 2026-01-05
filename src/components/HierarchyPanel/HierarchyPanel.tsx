import { useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { useDocumentStore } from '../../stores/documentStore'
import { useViewportStore, screenToWorld } from '../../stores/viewportStore'
import { useCanvasStore } from '../../stores/canvasStore'
import { ShapeListItem } from './ShapeListItem'
import { PathInfo } from './PathInfo'
import { createCircle } from '../../geometry/shapes/Circle'
import styles from './HierarchyPanel.module.css'
import { DEFAULT_CIRCLE_RADIUS, DND_ACTIVATION_DISTANCE } from '../../constants'

export function HierarchyPanel() {
  const shapes = useDocumentStore(state => state.shapes)
  const shapeOrder = useDocumentStore(state => state.shapeOrder)
  const reorderShapes = useDocumentStore(state => state.reorderShapes)
  const addShape = useDocumentStore(state => state.addShape)
  
  // Viewport state for positioning new circles
  const pan = useViewportStore(state => state.pan)
  const zoom = useViewportStore(state => state.zoom)
  const canvasWidth = useCanvasStore(state => state.width)
  const canvasHeight = useCanvasStore(state => state.height)
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: DND_ACTIVATION_DISTANCE
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )
  
  const orderedShapes = useMemo(() => {
    return shapeOrder
      .map(id => shapes.find(s => s.id === id))
      .filter((s): s is NonNullable<typeof s> => s !== undefined)
  }, [shapes, shapeOrder])
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    if (over && active.id !== over.id) {
      const oldIndex = shapeOrder.indexOf(active.id as string)
      const newIndex = shapeOrder.indexOf(over.id as string)
      const newOrder = arrayMove(shapeOrder, oldIndex, newIndex)
      reorderShapes(newOrder)
    }
  }
  
  const handleAddCircle = () => {
    // Calculate the center of the viewport in world coordinates
    const screenCenter = { x: canvasWidth / 2, y: canvasHeight / 2 }
    const worldCenter = screenToWorld(screenCenter, pan, zoom)
    
    // Create circle at viewport center with default settings
    const newCircle = createCircle(
      worldCenter,
      DEFAULT_CIRCLE_RADIUS,
      undefined,
      `Circle ${shapes.length + 1}`
    )
    addShape(newCircle)
  }
  
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>SHAPES</span>
      </div>
      
      <div className={styles.list}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={shapeOrder}
            strategy={verticalListSortingStrategy}
          >
            {orderedShapes.map(shape => (
              <ShapeListItem key={shape.id} shape={shape} />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      
      <button className={styles.addButton} onClick={handleAddCircle}>
        + Add Circle
      </button>
      
      <PathInfo />
    </div>
  )
}

