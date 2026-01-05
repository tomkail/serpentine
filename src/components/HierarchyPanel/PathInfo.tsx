import { useMemo } from 'react'
import { useDocumentStore } from '../../stores/documentStore'
import { computeTangentHull } from '../../geometry/path'
import type { CircleShape } from '../../types'
import styles from './HierarchyPanel.module.css'

export function PathInfo() {
  const shapes = useDocumentStore(state => state.shapes)
  const shapeOrder = useDocumentStore(state => state.shapeOrder)
  const closedPath = useDocumentStore(state => state.closedPath)
  const toggleClosedPath = useDocumentStore(state => state.toggleClosedPath)
  
  const pathData = useMemo(() => {
    const circles = shapes.filter((s): s is CircleShape => s.type === 'circle')
    if (circles.length < 2) return null
    return computeTangentHull(circles, shapeOrder, 0, closedPath)
  }, [shapes, shapeOrder, closedPath])
  
  if (!pathData) {
    return (
      <div className={styles.pathInfo}>
        <div className={styles.pathInfoTitle}>PATH</div>
        <div className={styles.pathInfoContent}>
          Add at least 2 circles to create a path
        </div>
      </div>
    )
  }
  
  const segmentCount = pathData.segments.length
  const lineCount = pathData.segments.filter(s => s.type === 'line').length
  const arcCount = pathData.segments.filter(s => s.type === 'arc').length
  
  return (
    <div className={styles.pathInfo}>
      <div className={styles.pathInfoTitle}>PATH</div>
      <div className={styles.pathInfoContent}>
        <div className={styles.pathInfoRow}>
          <label className={styles.pathToggle}>
            <input
              type="checkbox"
              checked={closedPath}
              onChange={toggleClosedPath}
            />
            <span>Loop path</span>
          </label>
        </div>
        <div className={styles.pathInfoRow}>
          <span>Total length:</span>
          <span className={styles.pathInfoValue}>
            {pathData.totalLength.toFixed(1)}
          </span>
        </div>
        <div className={styles.pathInfoRow}>
          <span>Segments:</span>
          <span className={styles.pathInfoValue}>{segmentCount}</span>
        </div>
        <div className={styles.pathInfoRow}>
          <span>Lines / Arcs:</span>
          <span className={styles.pathInfoValue}>{lineCount} / {arcCount}</span>
        </div>
      </div>
    </div>
  )
}

