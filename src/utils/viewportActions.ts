import { useDocumentStore } from '../stores/documentStore'
import { useViewportStore } from '../stores/viewportStore'
import { useCanvasStore } from '../stores/canvasStore'
import { useNotificationStore } from '../stores/notificationStore'
import { getShapesBounds } from '../geometry/shapes/Circle'
import { getMirroredCircles } from '../geometry/path'
import type { CircleShape } from '../types'

/**
 * Fit the viewport to show all shapes (including mirrored shapes)
 * @param silent - If true, don't show notification
 * @returns true if fit was performed, false if no shapes to fit
 */
export function fitToView(silent = false): boolean {
  const shapes = useDocumentStore.getState().shapes
  const { width, height } = useCanvasStore.getState()
  const fitToRect = useViewportStore.getState().fitToRect
  const info = useNotificationStore.getState().info
  
  if (shapes.length === 0) {
    if (!silent) info('No shapes to fit')
    return false
  }
  
  // Include mirrored circles in the bounds calculation
  const mirroredCircles = getMirroredCircles(shapes as CircleShape[])
  const allShapes = [...shapes, ...mirroredCircles]
  
  const bounds = getShapesBounds(allShapes)
  if (!bounds) {
    if (!silent) info('Could not calculate bounds')
    return false
  }
  
  fitToRect(bounds, width, height, 60)
  if (!silent) info('Fit to view')
  return true
}

/**
 * Reset viewport to default (origin at top-left, zoom 100%)
 */
export function resetView(): void {
  useViewportStore.getState().reset()
  useNotificationStore.getState().info('View reset')
}

