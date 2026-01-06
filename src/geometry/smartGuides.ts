import type { CircleShape, Point } from '../types'

/**
 * Smart Guides - Figma-style alignment guides for circles
 * 
 * Shows alignment lines when dragging circles to help align:
 * - Centers (x and y)
 * - Edges (left, right, top, bottom)
 */

export type AlignmentAxis = 'horizontal' | 'vertical'

export type AlignmentType = 'center' | 'left' | 'right' | 'top' | 'bottom'

export interface SmartGuide {
  /** Whether this is a horizontal (y-aligned) or vertical (x-aligned) line */
  axis: AlignmentAxis
  /** The position of the line in world coordinates */
  position: number
  /** What type of alignment on the dragged circle */
  draggedType: AlignmentType
  /** What type of alignment on the target circle */
  targetType: AlignmentType
  /** ID of the target circle that caused this alignment */
  targetId: string
  /** The point on the target circle where the alignment occurs (for drawing X marker) */
  targetPoint: Point
}

export interface SmartGuidesResult {
  /** Active alignment guides to render */
  guides: SmartGuide[]
  /** Suggested snap offset to apply to the dragged position */
  snapOffset: Point
}

/**
 * Get the 5 alignment reference points for a circle
 */
function getCircleAlignmentPoints(circle: CircleShape): {
  centerX: number
  centerY: number
  left: number
  right: number
  top: number
  bottom: number
} {
  return {
    centerX: circle.center.x,
    centerY: circle.center.y,
    left: circle.center.x - circle.radius,
    right: circle.center.x + circle.radius,
    top: circle.center.y - circle.radius,
    bottom: circle.center.y + circle.radius,
  }
}

/**
 * Compute smart guides for dragged circles against other circles
 * 
 * @param draggedCircles - Circles currently being dragged
 * @param otherCircles - All other circles to check alignment against
 * @param threshold - Distance threshold for alignment detection (in world units)
 * @returns Active guides and snap offset suggestion
 */
export function computeSmartGuides(
  draggedCircles: CircleShape[],
  otherCircles: CircleShape[],
  threshold: number
): SmartGuidesResult {
  const guides: SmartGuide[] = []
  let snapOffsetX = 0
  let snapOffsetY = 0
  let foundSnapX = false
  let foundSnapY = false
  
  // Track smallest distances for snapping (only snap to closest alignment)
  let minDistX = threshold
  let minDistY = threshold
  
  for (const dragged of draggedCircles) {
    const draggedPoints = getCircleAlignmentPoints(dragged)
    
    for (const target of otherCircles) {
      // Skip if target is one of the dragged circles
      if (draggedCircles.some(d => d.id === target.id)) continue
      
      const targetPoints = getCircleAlignmentPoints(target)
      
      // Helper to get the target point for X marker based on alignment type
      const getTargetPoint = (targetType: AlignmentType): Point => {
        switch (targetType) {
          case 'center':
            return { x: target.center.x, y: target.center.y }
          case 'left':
            return { x: target.center.x - target.radius, y: target.center.y }
          case 'right':
            return { x: target.center.x + target.radius, y: target.center.y }
          case 'top':
            return { x: target.center.x, y: target.center.y - target.radius }
          case 'bottom':
            return { x: target.center.x, y: target.center.y + target.radius }
        }
      }
      
      // Check vertical alignments (x positions)
      const xAlignments: Array<{ draggedType: AlignmentType; draggedVal: number; targetType: AlignmentType; targetVal: number }> = [
        { draggedType: 'center', draggedVal: draggedPoints.centerX, targetType: 'center', targetVal: targetPoints.centerX },
        { draggedType: 'center', draggedVal: draggedPoints.centerX, targetType: 'left', targetVal: targetPoints.left },
        { draggedType: 'center', draggedVal: draggedPoints.centerX, targetType: 'right', targetVal: targetPoints.right },
        { draggedType: 'left', draggedVal: draggedPoints.left, targetType: 'center', targetVal: targetPoints.centerX },
        { draggedType: 'left', draggedVal: draggedPoints.left, targetType: 'left', targetVal: targetPoints.left },
        { draggedType: 'left', draggedVal: draggedPoints.left, targetType: 'right', targetVal: targetPoints.right },
        { draggedType: 'right', draggedVal: draggedPoints.right, targetType: 'center', targetVal: targetPoints.centerX },
        { draggedType: 'right', draggedVal: draggedPoints.right, targetType: 'left', targetVal: targetPoints.left },
        { draggedType: 'right', draggedVal: draggedPoints.right, targetType: 'right', targetVal: targetPoints.right },
      ]
      
      for (const align of xAlignments) {
        const dist = Math.abs(align.draggedVal - align.targetVal)
        if (dist <= threshold) {
          // Check if we already have a guide at this exact position
          const existingGuide = guides.find(
            g => g.axis === 'vertical' && Math.abs(g.position - align.targetVal) < 0.001
          )
          
          if (!existingGuide) {
            guides.push({
              axis: 'vertical',
              position: align.targetVal,
              draggedType: align.draggedType,
              targetType: align.targetType,
              targetId: target.id,
              targetPoint: getTargetPoint(align.targetType),
            })
          }
          
          // Update snap if this is closer
          if (dist < minDistX) {
            minDistX = dist
            snapOffsetX = align.targetVal - align.draggedVal
            foundSnapX = true
          }
        }
      }
      
      // Check horizontal alignments (y positions)
      const yAlignments: Array<{ draggedType: AlignmentType; draggedVal: number; targetType: AlignmentType; targetVal: number }> = [
        { draggedType: 'center', draggedVal: draggedPoints.centerY, targetType: 'center', targetVal: targetPoints.centerY },
        { draggedType: 'center', draggedVal: draggedPoints.centerY, targetType: 'top', targetVal: targetPoints.top },
        { draggedType: 'center', draggedVal: draggedPoints.centerY, targetType: 'bottom', targetVal: targetPoints.bottom },
        { draggedType: 'top', draggedVal: draggedPoints.top, targetType: 'center', targetVal: targetPoints.centerY },
        { draggedType: 'top', draggedVal: draggedPoints.top, targetType: 'top', targetVal: targetPoints.top },
        { draggedType: 'top', draggedVal: draggedPoints.top, targetType: 'bottom', targetVal: targetPoints.bottom },
        { draggedType: 'bottom', draggedVal: draggedPoints.bottom, targetType: 'center', targetVal: targetPoints.centerY },
        { draggedType: 'bottom', draggedVal: draggedPoints.bottom, targetType: 'top', targetVal: targetPoints.top },
        { draggedType: 'bottom', draggedVal: draggedPoints.bottom, targetType: 'bottom', targetVal: targetPoints.bottom },
      ]
      
      for (const align of yAlignments) {
        const dist = Math.abs(align.draggedVal - align.targetVal)
        if (dist <= threshold) {
          // Check if we already have a guide at this exact position
          const existingGuide = guides.find(
            g => g.axis === 'horizontal' && Math.abs(g.position - align.targetVal) < 0.001
          )
          
          if (!existingGuide) {
            guides.push({
              axis: 'horizontal',
              position: align.targetVal,
              draggedType: align.draggedType,
              targetType: align.targetType,
              targetId: target.id,
              targetPoint: getTargetPoint(align.targetType),
            })
          }
          
          // Update snap if this is closer
          if (dist < minDistY) {
            minDistY = dist
            snapOffsetY = align.targetVal - align.draggedVal
            foundSnapY = true
          }
        }
      }
    }
  }
  
  return {
    guides,
    snapOffset: {
      x: foundSnapX ? snapOffsetX : 0,
      y: foundSnapY ? snapOffsetY : 0,
    },
  }
}

/**
 * Apply snap offset to a position
 */
export function applySnapOffset(position: Point, snapOffset: Point): Point {
  return {
    x: position.x + snapOffset.x,
    y: position.y + snapOffset.y,
  }
}

