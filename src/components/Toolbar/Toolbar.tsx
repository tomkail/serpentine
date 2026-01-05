import { useViewportStore } from '../../stores/viewportStore'
import { useSettingsStore } from '../../stores/settingsStore'
import styles from './Toolbar.module.css'

export function Toolbar() {
  const zoom = useViewportStore(state => state.zoom)
  const setZoom = useViewportStore(state => state.setZoom)
  
  const snapToGrid = useSettingsStore(state => state.snapToGrid)
  const toggleSnap = useSettingsStore(state => state.toggleSnap)
  const measurementMode = useSettingsStore(state => state.measurementMode)
  const cycleMeasurementMode = useSettingsStore(state => state.cycleMeasurementMode)
  
  const zoomPercent = Math.round(zoom * 100)
  
  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseInt(e.target.value) / 100
    setZoom(newZoom)
  }
  
  return (
    <div className={styles.toolbar}>
      <div className={styles.group}>
        <button
          className={`${styles.toggle} ${snapToGrid ? styles.active : ''}`}
          onClick={toggleSnap}
          title="Toggle snap to grid (S)"
        >
          Snap: {snapToGrid ? 'ON' : 'OFF'}
        </button>
      </div>
      
      <div className={styles.group}>
        <label className={styles.label}>Zoom</label>
        <input
          type="range"
          min="10"
          max="500"
          value={zoomPercent}
          onChange={handleZoomChange}
          className={styles.slider}
        />
        <span className={styles.value}>{zoomPercent}%</span>
      </div>
      
      <div className={styles.group}>
        <button
          className={styles.toggle}
          onClick={cycleMeasurementMode}
          title="Cycle measurement mode (M)"
        >
          {measurementMode.charAt(0).toUpperCase() + measurementMode.slice(1)}
        </button>
      </div>
    </div>
  )
}

