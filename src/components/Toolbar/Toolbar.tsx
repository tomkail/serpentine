import { useSettingsStore } from '../../stores/settingsStore'
import { useDocumentStore } from '../../stores/documentStore'
import { fitToView } from '../../utils/viewportActions'
import { MagnetIcon, SmartGuidesIcon, EyeIcon, FrameIcon, LoopPathIcon, OpenPathIcon, StartPointIcon, EndPointIcon, VerticalAxisIcon, HorizontalAxisIcon } from '../icons/Icons'
import { Tooltip } from '../Tooltip/Tooltip'
import styles from './Toolbar.module.css'

export function Toolbar() {
  const snapToGrid = useSettingsStore(state => state.snapToGrid)
  const toggleSnap = useSettingsStore(state => state.toggleSnap)
  const smartGuides = useSettingsStore(state => state.smartGuides)
  const toggleSmartGuides = useSettingsStore(state => state.toggleSmartGuides)
  const measurementMode = useSettingsStore(state => state.measurementMode)
  const cycleMeasurementMode = useSettingsStore(state => state.cycleMeasurementMode)
  const isolatePath = useSettingsStore(state => state.isolatePath)
  const setIsolatePath = useSettingsStore(state => state.setIsolatePath)
  
  // Path options
  const closedPath = useDocumentStore(state => state.closedPath)
  const useStartPoint = useDocumentStore(state => state.useStartPoint)
  const useEndPoint = useDocumentStore(state => state.useEndPoint)
  const mirrorAxis = useDocumentStore(state => state.mirrorAxis)
  const shapes = useDocumentStore(state => state.shapes)
  const toggleClosedPath = useDocumentStore(state => state.toggleClosedPath)
  const toggleUseStartPoint = useDocumentStore(state => state.toggleUseStartPoint)
  const toggleUseEndPoint = useDocumentStore(state => state.toggleUseEndPoint)
  const toggleMirrorAxis = useDocumentStore(state => state.toggleMirrorAxis)
  
  // Check if any shape has mirroring enabled
  const hasMirroredShapes = shapes.some(s => s.type === 'circle' && s.mirrored)
  
  return (
    <div className={styles.toolbar}>
      {/* Path options */}
      <div className={styles.group}>
        <Tooltip text={closedPath ? "Open path" : "Loop path"}>
          <button
            className={`${styles.iconToggle} ${closedPath ? styles.active : ''}`}
            onClick={toggleClosedPath}
            aria-label={closedPath ? "Loop path (closed)" : "Open path"}
          >
            {closedPath ? <LoopPathIcon size={20} /> : <OpenPathIcon size={20} />}
          </button>
        </Tooltip>
        <Tooltip text="Wrap path around start circle">
          <button
            className={`${styles.iconToggle} ${useStartPoint ? styles.active : ''} ${closedPath ? styles.disabled : ''}`}
            onClick={toggleUseStartPoint}
            disabled={closedPath}
            aria-label={`Start point: ${useStartPoint ? 'on' : 'off'}`}
          >
            <StartPointIcon size={20} />
          </button>
        </Tooltip>
        <Tooltip text="Wrap path around end circle">
          <button
            className={`${styles.iconToggle} ${useEndPoint ? styles.active : ''} ${closedPath ? styles.disabled : ''}`}
            onClick={toggleUseEndPoint}
            disabled={closedPath}
            aria-label={`End point: ${useEndPoint ? 'on' : 'off'}`}
          >
            <EndPointIcon size={20} />
          </button>
        </Tooltip>
        
        {hasMirroredShapes && (
          <>
            <div className={styles.smallSeparator} />
            
            <Tooltip text={mirrorAxis === 'vertical' ? "Switch to horizontal mirror" : "Switch to vertical mirror"}>
              <button
                className={styles.iconToggle}
                onClick={toggleMirrorAxis}
                aria-label={`Mirror axis: ${mirrorAxis}`}
              >
                {mirrorAxis === 'vertical' ? <VerticalAxisIcon size={20} /> : <HorizontalAxisIcon size={20} />}
              </button>
            </Tooltip>
          </>
        )}
      </div>
      
      <div className={styles.separator} />
      
      {/* View controls */}
      <div className={styles.group}>
        <Tooltip text="Snap to grid" shortcut="S">
          <button
            className={`${styles.iconToggle} ${snapToGrid ? styles.active : ''}`}
            onClick={toggleSnap}
            aria-label={`Snap to grid: ${snapToGrid ? 'on' : 'off'}`}
          >
            <MagnetIcon size={20} />
          </button>
        </Tooltip>
        <Tooltip text="Smart guides">
          <button
            className={`${styles.iconToggle} ${smartGuides ? styles.active : ''}`}
            onClick={toggleSmartGuides}
            aria-label={`Smart guides: ${smartGuides ? 'on' : 'off'}`}
          >
            <SmartGuidesIcon size={20} />
          </button>
        </Tooltip>
        
        <div className={styles.smallSeparator} />
        
        <Tooltip text="Fit to view" shortcut="F">
          <button
            className={styles.iconToggle}
            onClick={() => fitToView()}
            aria-label="Fit to view"
          >
            <FrameIcon size={20} />
          </button>
        </Tooltip>
        <Tooltip text="Measurement mode" shortcut="M">
          <button
            className={styles.toggle}
            onClick={cycleMeasurementMode}
          >
            {measurementMode.charAt(0).toUpperCase() + measurementMode.slice(1)}
          </button>
        </Tooltip>
        <Tooltip text="Hold to isolate" shortcut="I">
          <button
            className={`${styles.iconToggle} ${isolatePath ? styles.active : ''}`}
            onMouseDown={() => setIsolatePath(true)}
            onMouseUp={() => setIsolatePath(false)}
            onMouseLeave={() => setIsolatePath(false)}
            aria-label={`Isolate path: ${isolatePath ? 'on' : 'off'}`}
          >
            <EyeIcon size={20} />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}

