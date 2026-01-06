import { useMemo } from 'react'
import { useDocumentStore } from '../../stores/documentStore'
import { computeTangentHull } from '../../geometry/path'
import { LoopPathIcon, OpenPathIcon, StartPointIcon, EndPointIcon } from '../icons/Icons'
import type { CircleShape } from '../../types'
import styles from './HierarchyPanel.module.css'

export function PathInfo() {
  const shapes = useDocumentStore(state => state.shapes)
  const shapeOrder = useDocumentStore(state => state.shapeOrder)
  const closedPath = useDocumentStore(state => state.closedPath)
  const useStartPoint = useDocumentStore(state => state.useStartPoint)
  const useEndPoint = useDocumentStore(state => state.useEndPoint)
  const mirrorAxis = useDocumentStore(state => state.mirrorAxis)
  const toggleClosedPath = useDocumentStore(state => state.toggleClosedPath)
  const toggleUseStartPoint = useDocumentStore(state => state.toggleUseStartPoint)
  const toggleUseEndPoint = useDocumentStore(state => state.toggleUseEndPoint)
  
  const pathData = useMemo(() => {
    const circles = shapes.filter((s): s is CircleShape => s.type === 'circle')
    if (circles.length < 2) return null
    return computeTangentHull(circles, shapeOrder, 0, closedPath, useStartPoint, useEndPoint, mirrorAxis)
  }, [shapes, shapeOrder, closedPath, useStartPoint, useEndPoint, mirrorAxis])
  
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
  
  return (
    <div className={styles.pathInfo}>
      <div className={styles.pathInfoTitle}>PATH</div>
      <div className={styles.pathInfoContent}>
        <div className={styles.pathInfoRow}>
          <div className={styles.endModeGroup}>
            <button
              className={`${styles.endModeButton} ${closedPath ? styles.endModeActive : ''}`}
              onClick={toggleClosedPath}
              title={closedPath ? "Open path (has start and end)" : "Loop path (connect end to start)"}
            >
              {closedPath ? <LoopPathIcon size={16} /> : <OpenPathIcon size={16} />}
            </button>
            <button
              className={`${styles.endModeButton} ${useStartPoint ? styles.endModeActive : ''} ${closedPath ? styles.endModeDisabled : ''}`}
              onClick={toggleUseStartPoint}
              disabled={closedPath}
              title="Use start point on first circle"
            >
              <StartPointIcon size={16} />
            </button>
            <button
              className={`${styles.endModeButton} ${useEndPoint ? styles.endModeActive : ''} ${closedPath ? styles.endModeDisabled : ''}`}
              onClick={toggleUseEndPoint}
              disabled={closedPath}
              title="Use end point on last circle"
            >
              <EndPointIcon size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

