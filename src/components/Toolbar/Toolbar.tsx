import { useState, useRef, useEffect, ReactNode } from 'react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useDocumentStore } from '../../stores/documentStore'
import { useDebugStore } from '../../stores/debugStore'
import { useHistoryStore, undo, redo } from '../../stores/historyStore'
import { useThemeStore } from '../../stores/themeStore'
import { fitToView } from '../../utils/viewportActions'
import { createNewDocument, saveDocument, loadDocument, exportSvg, loadPreset } from '../../utils/fileIO'
import { presets } from '../../utils/presets'
import { themeList } from '../../themes'
import { 
  Magnet as MagnetIcon,
  Eye as EyeIcon,
  Scan as FrameIcon,
  FlipHorizontal as VerticalAxisIcon,
  FlipVertical as HorizontalAxisIcon,
  FileCode as SvgPreviewIcon,
  Ruler as RulerIcon,
  Undo2 as UndoIcon,
  Redo2 as RedoIcon,
  File as FileIcon,
  ChevronDown as ChevronDownIcon,
  Settings as SettingsIcon
} from 'lucide-react'
import { 
  LoopPathIcon, OpenPathIcon, StartPointIcon, EndPointIcon, SmartGuidesIcon 
} from '../icons/Icons'
import { Tooltip } from '../Tooltip/Tooltip'
import styles from './Toolbar.module.css'

// Menu dropdown that opens upward
interface DropdownMenuProps {
  trigger: ReactNode
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  children: ReactNode
  tooltip?: string
  align?: 'left' | 'right'
}

function DropdownMenu({ trigger, isOpen, onToggle, onClose, children, tooltip, align = 'left' }: DropdownMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return
    
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    
    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])
  
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])
  
  const button = (
    <button
      className={`${styles.menuButton} ${isOpen ? styles.active : ''}`}
      onClick={onToggle}
    >
      {trigger}
    </button>
  )
  
  return (
    <div ref={menuRef} className={styles.dropdownContainer}>
      {tooltip ? <Tooltip text={tooltip}>{button}</Tooltip> : button}
      {isOpen && (
        <div className={align === 'right' ? styles.dropdownRight : styles.dropdown}>
          {children}
        </div>
      )}
    </div>
  )
}

interface MenuItemProps {
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
}

function MenuItem({ label, shortcut, onClick, disabled }: MenuItemProps) {
  return (
    <button 
      className={styles.menuItem} 
      onClick={onClick}
      disabled={disabled}
    >
      <span className={styles.menuItemLabel}>{label}</span>
      {shortcut && <span className={styles.menuItemShortcut}>{shortcut}</span>}
    </button>
  )
}

function MenuDivider() {
  return <div className={styles.menuDivider} />
}

function MenuLabel({ children }: { children: ReactNode }) {
  return <div className={styles.menuLabel}>{children}</div>
}

export function Toolbar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  
  // Settings store
  const snapToGrid = useSettingsStore(state => state.snapToGrid)
  const toggleSnap = useSettingsStore(state => state.toggleSnap)
  const smartGuides = useSettingsStore(state => state.smartGuides)
  const toggleSmartGuides = useSettingsStore(state => state.toggleSmartGuides)
  const measurementMode = useSettingsStore(state => state.measurementMode)
  const cycleMeasurementMode = useSettingsStore(state => state.cycleMeasurementMode)
  const isolatePath = useSettingsStore(state => state.isolatePath)
  const setIsolatePath = useSettingsStore(state => state.setIsolatePath)
  const showSvgPreview = useSettingsStore(state => state.showSvgPreview)
  const toggleSvgPreview = useSettingsStore(state => state.toggleSvgPreview)
  
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
  
  // History state
  const canUndo = useHistoryStore(state => state.canUndo)
  const canRedo = useHistoryStore(state => state.canRedo)
  
  // Debug state
  const showTangentPoints = useDebugStore(state => state.showTangentPoints)
  const showTangentLabels = useDebugStore(state => state.showTangentLabels)
  const showArcAngles = useDebugStore(state => state.showArcAngles)
  const showPathOrder = useDebugStore(state => state.showPathOrder)
  const showCircleCenters = useDebugStore(state => state.showCircleCenters)
  const showArcDirection = useDebugStore(state => state.showArcDirection)
  const toggleTangentPoints = useDebugStore(state => state.toggleTangentPoints)
  const toggleTangentLabels = useDebugStore(state => state.toggleTangentLabels)
  const toggleArcAngles = useDebugStore(state => state.toggleArcAngles)
  const togglePathOrder = useDebugStore(state => state.togglePathOrder)
  const toggleCircleCenters = useDebugStore(state => state.toggleCircleCenters)
  const toggleArcDirection = useDebugStore(state => state.toggleArcDirection)
  const resetDebug = useDebugStore(state => state.resetDebug)
  const profilingEnabled = useDebugStore(state => state.profilingEnabled)
  const showPerformanceOverlay = useDebugStore(state => state.showPerformanceOverlay)
  const toggleProfiling = useDebugStore(state => state.toggleProfiling)
  const togglePerformanceOverlay = useDebugStore(state => state.togglePerformanceOverlay)
  const printProfilingReport = useDebugStore(state => state.printProfilingReport)
  const clearProfilingDataAction = useDebugStore(state => state.clearProfilingData)
  
  // Theme state
  const themeName = useThemeStore(state => state.themeName)
  const setTheme = useThemeStore(state => state.setTheme)
  
  // Check if any shape has mirroring enabled
  const hasMirroredShapes = shapes.some(s => s.type === 'circle' && s.mirrored)
  
  const closeMenu = () => setOpenMenu(null)
  const toggleMenu = (menu: string) => setOpenMenu(openMenu === menu ? null : menu)
  
  // File handlers
  const handleNew = () => { createNewDocument(); closeMenu() }
  const handleSave = () => { saveDocument(); closeMenu() }
  const handleLoad = () => { loadDocument(); closeMenu() }
  const handleExportSvg = () => { exportSvg(); closeMenu() }
  const handleLoadPreset = (index: number) => {
    const preset = presets[index]
    if (preset) loadPreset(preset)
    closeMenu()
  }
  
  // Settings handlers
  const handleToggleSetting = (toggle: () => void) => () => { toggle(); closeMenu() }
  const handleSetTheme = (id: string) => { setTheme(id); closeMenu() }
  
  return (
    <div className={styles.toolbar}>
      {/* === DOCUMENT ZONE === */}
      
      {/* File Menu */}
      <div className={styles.group}>
        <DropdownMenu
          trigger={<><FileIcon size={18} /><ChevronDownIcon size={12} /></>}
          isOpen={openMenu === 'file'}
          onToggle={() => toggleMenu('file')}
          onClose={closeMenu}
          tooltip="File"
        >
          <MenuItem label="New" shortcut="⌘N" onClick={handleNew} />
          <MenuItem label="Open..." shortcut="⌘O" onClick={handleLoad} />
          <MenuItem label="Save" shortcut="⌘S" onClick={handleSave} />
          <MenuDivider />
          <MenuItem label="Export SVG..." shortcut="⌘E" onClick={handleExportSvg} />
          <MenuDivider />
          <MenuLabel>Test Presets</MenuLabel>
          {presets.map((preset, index) => (
            <MenuItem 
              key={preset.name}
              label={preset.name} 
              onClick={() => handleLoadPreset(index)} 
            />
          ))}
        </DropdownMenu>
        
        {/* Undo/Redo inline with File */}
        <Tooltip text="Undo" shortcut="⌘Z">
          <button
            className={`${styles.iconButton} ${!canUndo() ? styles.disabled : ''}`}
            onClick={undo}
            disabled={!canUndo()}
            aria-label="Undo"
          >
            <UndoIcon size={18} />
          </button>
        </Tooltip>
        <Tooltip text="Redo" shortcut="⌘⇧Z">
          <button
            className={`${styles.iconButton} ${!canRedo() ? styles.disabled : ''}`}
            onClick={redo}
            disabled={!canRedo()}
            aria-label="Redo"
          >
            <RedoIcon size={18} />
          </button>
        </Tooltip>
      </div>
      
      <div className={styles.separator} />
      
      {/* === PATH ZONE === */}
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
          <Tooltip text={mirrorAxis === 'vertical' ? "Switch to horizontal mirror" : "Switch to vertical mirror"}>
            <button
              className={styles.iconToggle}
              onClick={toggleMirrorAxis}
              aria-label={`Mirror axis: ${mirrorAxis}`}
            >
              {mirrorAxis === 'vertical' ? <VerticalAxisIcon size={20} /> : <HorizontalAxisIcon size={20} />}
            </button>
          </Tooltip>
        )}
      </div>
      
      <div className={styles.separator} />
      
      {/* === PRECISION AIDS === */}
      <div className={styles.group}>
        <Tooltip text="Snap to grid" shortcut="S">
          <button
            className={`${styles.iconToggle} ${snapToGrid ? styles.active : ''}`}
            onClick={toggleSnap}
            aria-label={`Snap to grid: ${snapToGrid ? 'on' : 'off'}`}
          >
            <MagnetIcon size={18} />
          </button>
        </Tooltip>
        <Tooltip text="Smart guides">
          <button
            className={`${styles.iconToggle} ${smartGuides ? styles.active : ''}`}
            onClick={toggleSmartGuides}
            aria-label={`Smart guides: ${smartGuides ? 'on' : 'off'}`}
          >
            <SmartGuidesIcon size={18} />
          </button>
        </Tooltip>
      </div>
      
      <div className={styles.separator} />
      
      {/* === VIEW TOOLS === */}
      <div className={styles.group}>
        <Tooltip text="Fit to view" shortcut="F">
          <button
            className={styles.iconButton}
            onClick={() => fitToView()}
            aria-label="Fit to view"
          >
            <FrameIcon size={18} />
          </button>
        </Tooltip>
        <Tooltip text="Measurement mode" shortcut="M">
          <button
            className={`${styles.iconToggle} ${measurementMode === 'detailed' ? styles.active : ''}`}
            onClick={cycleMeasurementMode}
            aria-label={`Measurement mode: ${measurementMode}`}
          >
            <RulerIcon size={18} />
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
            <EyeIcon size={18} />
          </button>
        </Tooltip>
      </div>
      
      <div className={styles.separator} />
      
      {/* === OUTPUT === */}
      <div className={styles.group}>
        <Tooltip text="SVG preview window">
          <button
            className={`${styles.iconToggle} ${showSvgPreview ? styles.active : ''}`}
            onClick={toggleSvgPreview}
            aria-label={`SVG preview: ${showSvgPreview ? 'on' : 'off'}`}
          >
            <SvgPreviewIcon size={18} />
          </button>
        </Tooltip>
      </div>
      
      <div className={styles.separator} />
      
      {/* === SETTINGS === */}
      <div className={styles.group}>
        <DropdownMenu
          trigger={<><SettingsIcon size={18} /><ChevronDownIcon size={12} /></>}
          isOpen={openMenu === 'settings'}
          onToggle={() => toggleMenu('settings')}
          onClose={closeMenu}
          tooltip="Settings"
          align="right"
        >
          <MenuLabel>Theme</MenuLabel>
          {themeList.map(theme => (
            <MenuItem 
              key={theme.id}
              label={`${themeName === theme.id ? '✓ ' : '   '}${theme.icon} ${theme.name}`}
              onClick={() => handleSetTheme(theme.id)}
            />
          ))}
          
          <MenuDivider />
          <MenuLabel>Debug Overlays</MenuLabel>
          <MenuItem 
            label={`${showTangentPoints ? '✓ ' : '   '}Tangent Points`} 
            onClick={handleToggleSetting(toggleTangentPoints)} 
          />
          <MenuItem 
            label={`${showTangentLabels ? '✓ ' : '   '}Tangent Labels`} 
            onClick={handleToggleSetting(toggleTangentLabels)} 
          />
          <MenuItem 
            label={`${showArcAngles ? '✓ ' : '   '}Arc Angles`} 
            onClick={handleToggleSetting(toggleArcAngles)} 
          />
          <MenuItem 
            label={`${showPathOrder ? '✓ ' : '   '}Path Order`} 
            onClick={handleToggleSetting(togglePathOrder)} 
          />
          <MenuItem 
            label={`${showCircleCenters ? '✓ ' : '   '}Circle Centers`} 
            onClick={handleToggleSetting(toggleCircleCenters)} 
          />
          <MenuItem 
            label={`${showArcDirection ? '✓ ' : '   '}Arc Direction`} 
            onClick={handleToggleSetting(toggleArcDirection)} 
          />
          <MenuItem label="Hide All Debug" onClick={handleToggleSetting(resetDebug)} />
          
          <MenuDivider />
          <MenuLabel>Performance</MenuLabel>
          <MenuItem 
            label={`${profilingEnabled ? '✓ ' : '   '}Enable Profiling`} 
            onClick={handleToggleSetting(toggleProfiling)} 
          />
          <MenuItem 
            label={`${showPerformanceOverlay ? '✓ ' : '   '}Show FPS Overlay`} 
            onClick={handleToggleSetting(togglePerformanceOverlay)}
            disabled={!profilingEnabled}
          />
          <MenuItem 
            label="Print Report to Console" 
            onClick={() => { printProfilingReport(); closeMenu() }}
            disabled={!profilingEnabled}
          />
          <MenuItem 
            label="Clear Profiling Data" 
            onClick={() => { clearProfilingDataAction(); closeMenu() }}
            disabled={!profilingEnabled}
          />
        </DropdownMenu>
      </div>
    </div>
  )
}
