import { useSelectionStore } from '../../stores/selectionStore'
import { useIsTouchDevice } from '../../hooks/useIsTouchDevice'
import styles from './ModifierBar.module.css'

/**
 * Floating modifier bar for touch devices
 * Provides Shift/Alt buttons since these modifier keys aren't available on mobile
 * 
 * On touch devices, these modifiers affect:
 * - Shift: Toggle selection, axis-constrained movement, proportional scaling, parallel handle adjustment
 * - Alt: Anchor-based scaling, mirrored handle adjustment
 */
export function ModifierBar() {
  const isTouchDevice = useIsTouchDevice()
  const modifierKeys = useSelectionStore(state => state.modifierKeys)
  const setModifierKeys = useSelectionStore(state => state.setModifierKeys)
  
  // Only show on touch devices
  if (!isTouchDevice) return null
  
  const handleShiftToggle = () => {
    setModifierKeys({
      ...modifierKeys,
      shift: !modifierKeys.shift
    })
  }
  
  const handleAltToggle = () => {
    setModifierKeys({
      ...modifierKeys,
      alt: !modifierKeys.alt
    })
  }
  
  // Only show when at least one modifier is enabled (to keep UI clean)
  // Users can tap to enable, then it stays visible while active
  const isVisible = modifierKeys.shift || modifierKeys.alt
  
  return (
    <div className={`${styles.modifierBar} ${isVisible ? styles.expanded : ''}`}>
      <button
        className={`${styles.modifierButton} ${modifierKeys.shift ? styles.active : ''}`}
        onClick={handleShiftToggle}
        aria-label={`Shift modifier: ${modifierKeys.shift ? 'on' : 'off'}`}
        title="Shift: axis constraint, proportional scaling, toggle selection"
      >
        ⇧
      </button>
      <button
        className={`${styles.modifierButton} ${modifierKeys.alt ? styles.active : ''}`}
        onClick={handleAltToggle}
        aria-label={`Alt modifier: ${modifierKeys.alt ? 'on' : 'off'}`}
        title="Alt: anchor scaling, mirror handles"
      >
        ⌥
      </button>
    </div>
  )
}

