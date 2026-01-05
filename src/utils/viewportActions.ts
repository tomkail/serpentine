import { useDocumentStore } from '../stores/documentStore'
import { useViewportStore } from '../stores/viewportStore'
import { useCanvasStore } from '../stores/canvasStore'
import { useNotificationStore } from '../stores/notificationStore'
import { getShapesBounds } from '../geometry/shapes/Circle'
import { getMirroredCircles } from '../geometry/path'
import type { CircleShape } from '../types'

/**
 * Fit the viewport to show all shapes (including mirrored shapes)
 */
export function fitToView(): void {
  const shapes = useDocumentStore.getState().shapes
  const { width, height } = useCanvasStore.getState()
  const fitToRect = useViewportStore.getState().fitToRect
  const info = useNotificationStore.getState().info
  
  if (shapes.length === 0) {
    info('No shapes to fit')
    return
  }
  
  // Include mirrored circles in the bounds calculation
  const mirroredCircles = getMirroredCircles(shapes as CircleShape[])
  const allShapes = [...shapes, ...mirroredCircles]
  
  const bounds = getShapesBounds(allShapes)
  if (!bounds) {
    info('Could not calculate bounds')
    return
  }
  
  fitToRect(bounds, width, height, 60)
  info('Fit to view')
}

/**
 * Reset viewport to default (origin at top-left, zoom 100%)
 */
export function resetView(): void {
  useViewportStore.getState().reset()
  useNotificationStore.getState().info('View reset')
}

