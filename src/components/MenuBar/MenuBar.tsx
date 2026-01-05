import { useState } from 'react'
import { Menu } from './Menu'
import { MenuItem } from './MenuItem'
import { createNewDocument, saveDocument, loadDocument } from '../../utils/fileIO'
import { fitToView, resetView } from '../../utils/viewportActions'
import { useDocumentStore } from '../../stores/documentStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useDebugStore } from '../../stores/debugStore'
import { useHistoryStore, undo, redo } from '../../stores/historyStore'
import { presets } from '../../utils/presets'
import styles from './MenuBar.module.css'

export function MenuBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const fileName = useDocumentStore(state => state.fileName)
  const loadDocumentState = useDocumentStore(state => state.loadDocument)
  const setFileName = useDocumentStore(state => state.setFileName)
  const toggleSnap = useSettingsStore(state => state.toggleSnap)
  const cycleMeasurementMode = useSettingsStore(state => state.cycleMeasurementMode)
  const toggleGrid = useSettingsStore(state => state.toggleGrid)
  
  // History state
  const canUndo = useHistoryStore(state => state.canUndo)
  const canRedo = useHistoryStore(state => state.canRedo)
  
  // Debug state
  const showTangentPoints = useDebugStore(state => state.showTangentPoints)
  const showTangentLabels = useDebugStore(state => state.showTangentLabels)
  const showArcAngles = useDebugStore(state => state.showArcAngles)
  const showPathOrder = useDebugStore(state => state.showPathOrder)
  const showCircleCenters = useDebugStore(state => state.showCircleCenters)
  const toggleTangentPoints = useDebugStore(state => state.toggleTangentPoints)
  const toggleTangentLabels = useDebugStore(state => state.toggleTangentLabels)
  const toggleArcAngles = useDebugStore(state => state.toggleArcAngles)
  const togglePathOrder = useDebugStore(state => state.togglePathOrder)
  const toggleCircleCenters = useDebugStore(state => state.toggleCircleCenters)
  const resetDebug = useDebugStore(state => state.resetDebug)
  
  const handleMenuClick = (menuId: string) => {
    setOpenMenu(openMenu === menuId ? null : menuId)
  }
  
  const closeMenu = () => {
    setOpenMenu(null)
  }
  
  const handleNew = () => {
    createNewDocument()
    closeMenu()
  }
  
  const handleSave = () => {
    saveDocument()
    closeMenu()
  }
  
  const handleLoad = () => {
    loadDocument()
    closeMenu()
  }
  
  const handleLoadPreset = (presetIndex: number) => {
    const preset = presets[presetIndex]
    if (preset) {
      loadDocumentState(preset.document)
      setFileName(preset.document.name)
      setTimeout(() => fitToView(), 50)
    }
    closeMenu()
  }
  
  const handleToggleSnap = () => {
    toggleSnap()
    closeMenu()
  }
  
  const handleCycleMeasurements = () => {
    cycleMeasurementMode()
    closeMenu()
  }
  
  const handleToggleGrid = () => {
    toggleGrid()
    closeMenu()
  }
  
  const handleFitToView = () => {
    fitToView()
    closeMenu()
  }
  
  const handleResetView = () => {
    resetView()
    closeMenu()
  }
  
  // Debug handlers
  const handleToggleTangentPoints = () => {
    toggleTangentPoints()
    closeMenu()
  }
  
  const handleToggleTangentLabels = () => {
    toggleTangentLabels()
    closeMenu()
  }
  
  const handleToggleArcAngles = () => {
    toggleArcAngles()
    closeMenu()
  }
  
  const handleTogglePathOrder = () => {
    togglePathOrder()
    closeMenu()
  }
  
  const handleToggleCircleCenters = () => {
    toggleCircleCenters()
    closeMenu()
  }
  
  const handleResetDebug = () => {
    resetDebug()
    closeMenu()
  }
  
  // Edit handlers
  const handleUndo = () => {
    undo()
    closeMenu()
  }
  
  const handleRedo = () => {
    redo()
    closeMenu()
  }
  
  return (
    <div className={styles.menuBar}>
      <div className={styles.menus}>
        <Menu
          label="File"
          isOpen={openMenu === 'file'}
          onToggle={() => handleMenuClick('file')}
          onClose={closeMenu}
        >
          <MenuItem label="New" shortcut="⌘N" onClick={handleNew} />
          <MenuItem label="Open..." shortcut="⌘O" onClick={handleLoad} />
          <MenuItem label="Save" shortcut="⌘S" onClick={handleSave} />
          <div style={{ height: 1, background: 'var(--menu-border)', margin: '4px 0' }} />
          <div style={{ padding: '4px 12px', color: 'var(--text-muted)', fontSize: '11px' }}>
            Test Presets
          </div>
          {presets.map((preset, index) => (
            <MenuItem 
              key={preset.name}
              label={preset.name} 
              onClick={() => handleLoadPreset(index)} 
            />
          ))}
        </Menu>
        
        <Menu
          label="Edit"
          isOpen={openMenu === 'edit'}
          onToggle={() => handleMenuClick('edit')}
          onClose={closeMenu}
        >
          <MenuItem label="Undo" shortcut="⌘Z" onClick={handleUndo} disabled={!canUndo()} />
          <MenuItem label="Redo" shortcut="⌘⇧Z" onClick={handleRedo} disabled={!canRedo()} />
        </Menu>
        
        <Menu
          label="View"
          isOpen={openMenu === 'view'}
          onToggle={() => handleMenuClick('view')}
          onClose={closeMenu}
        >
          <MenuItem label="Fit to View" shortcut="F" onClick={handleFitToView} />
          <MenuItem label="Reset View" shortcut="0" onClick={handleResetView} />
          <div style={{ height: 1, background: 'var(--menu-border)', margin: '4px 0' }} />
          <MenuItem label="Toggle Grid" shortcut="G" onClick={handleToggleGrid} />
          <MenuItem label="Toggle Snap" shortcut="S" onClick={handleToggleSnap} />
          <MenuItem label="Cycle Measurements" shortcut="M" onClick={handleCycleMeasurements} />
        </Menu>
        
        <Menu
          label="Debug"
          isOpen={openMenu === 'debug'}
          onToggle={() => handleMenuClick('debug')}
          onClose={closeMenu}
        >
          <MenuItem 
            label={`${showTangentPoints ? '✓ ' : '   '}Tangent Points`} 
            onClick={handleToggleTangentPoints} 
          />
          <MenuItem 
            label={`${showTangentLabels ? '✓ ' : '   '}Tangent Labels`} 
            onClick={handleToggleTangentLabels} 
          />
          <MenuItem 
            label={`${showArcAngles ? '✓ ' : '   '}Arc Angles`} 
            onClick={handleToggleArcAngles} 
          />
          <MenuItem 
            label={`${showPathOrder ? '✓ ' : '   '}Path Order`} 
            onClick={handleTogglePathOrder} 
          />
          <MenuItem 
            label={`${showCircleCenters ? '✓ ' : '   '}Circle Centers`} 
            onClick={handleToggleCircleCenters} 
          />
          <div style={{ height: 1, background: 'var(--menu-border)', margin: '4px 0' }} />
          <MenuItem label="Hide All Debug" onClick={handleResetDebug} />
        </Menu>
      </div>
      
      <div className={styles.title}>
        {fileName || 'StringPath'}
      </div>
      
      <div className={styles.spacer} />
    </div>
  )
}
