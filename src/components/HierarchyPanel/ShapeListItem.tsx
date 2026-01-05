import { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDocumentStore } from '../../stores/documentStore'
import { useSelectionStore } from '../../stores/selectionStore'
import type { Shape, CircleShape } from '../../types'
import styles from './HierarchyPanel.module.css'

interface ShapeListItemProps {
  shape: Shape
}

export function ShapeListItem({ shape }: ShapeListItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(shape.name)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const removeShape = useDocumentStore(state => state.removeShape)
  const renameShape = useDocumentStore(state => state.renameShape)
  const toggleWrapSide = useDocumentStore(state => state.toggleWrapSide)
  const toggleMirror = useDocumentStore(state => state.toggleMirror)
  const setEntryOffset = useDocumentStore(state => state.setEntryOffset)
  const setExitOffset = useDocumentStore(state => state.setExitOffset)
  const setEntryTangentLength = useDocumentStore(state => state.setEntryTangentLength)
  const setExitTangentLength = useDocumentStore(state => state.setExitTangentLength)
  
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const select = useSelectionStore(state => state.select)
  
  const isSelected = selectedIds.includes(shape.id)
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: shape.id })
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }
  
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])
  
  const handleDoubleClick = () => {
    setEditName(shape.name)
    setIsEditing(true)
  }
  
  const handleNameChange = () => {
    if (editName.trim()) {
      renameShape(shape.id, editName.trim())
    }
    setIsEditing(false)
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameChange()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }
  
  const handleClick = (e: React.MouseEvent) => {
    select(shape.id, e.shiftKey)
  }
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    removeShape(shape.id)
  }
  
  const handleToggleSide = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleWrapSide(shape.id)
  }
  
  const handleToggleMirror = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleMirror(shape.id)
  }
  
  const radiusDisplay = shape.type === 'circle' 
    ? `r: ${shape.radius % 1 === 0 ? shape.radius : shape.radius.toFixed(1)}`
    : ''
  
  const wrapSide = shape.type === 'circle' ? shape.wrapSide : 'right'
  
  // Get circle for tangent controls
  const circle = shape.type === 'circle' ? shape as CircleShape : null
  
  // Tangent offset values (in degrees for display)
  const entryOffsetDegrees = ((circle?.entryOffset ?? 0) * 180 / Math.PI)
  const exitOffsetDegrees = ((circle?.exitOffset ?? 0) * 180 / Math.PI)
  
  // Tangent length multipliers (displayed as percentage)
  const entryTangentLength = circle?.entryTangentLength ?? 1.0
  const exitTangentLength = circle?.exitTangentLength ?? 1.0
  
  // Handlers for entry/exit tangent offsets
  const handleEntryOffsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    const degrees = parseInt(e.target.value)
    const radians = degrees * Math.PI / 180
    setEntryOffset(shape.id, radians === 0 ? undefined : radians)
  }
  
  const handleExitOffsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    const degrees = parseInt(e.target.value)
    const radians = degrees * Math.PI / 180
    setExitOffset(shape.id, radians === 0 ? undefined : radians)
  }
  
  const handleResetEntryOffset = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEntryOffset(shape.id, undefined)
  }
  
  const handleResetExitOffset = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExitOffset(shape.id, undefined)
  }
  
  // Handlers for tangent length multipliers
  const handleEntryTangentLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    const percent = parseInt(e.target.value)
    const mult = percent / 100
    setEntryTangentLength(shape.id, mult === 1.0 ? undefined : mult)
  }
  
  const handleExitTangentLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    const percent = parseInt(e.target.value)
    const mult = percent / 100
    setExitTangentLength(shape.id, mult === 1.0 ? undefined : mult)
  }
  
  const handleResetEntryTangentLength = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEntryTangentLength(shape.id, undefined)
  }
  
  const handleResetExitTangentLength = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExitTangentLength(shape.id, undefined)
  }
  
  const toggleAdvanced = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowAdvanced(!showAdvanced)
  }
  
  // Check if values are at defaults for enabling/disabling reset buttons
  const isEntryOffsetDefault = (circle?.entryOffset ?? 0) === 0
  const isExitOffsetDefault = (circle?.exitOffset ?? 0) === 0
  const isEntryTangentLengthDefault = entryTangentLength === 1.0
  const isExitTangentLengthDefault = exitTangentLength === 1.0
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.item} ${isSelected ? styles.selected : ''}`}
      onClick={handleClick}
    >
      <div className={styles.mainRow}>
        <div className={styles.dragHandle} {...attributes} {...listeners}>
          ≡
        </div>
        
        <div className={styles.itemContent} onDoubleClick={handleDoubleClick}>
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameChange}
              onKeyDown={handleKeyDown}
              className={styles.nameInput}
            />
          ) : (
            <span className={styles.name}>{shape.name}</span>
          )}
          <span className={styles.radius}>{radiusDisplay}</span>
        </div>
        
        <div className={styles.buttonGroup}>
          <button 
            className={styles.actionButton}
            onClick={handleToggleSide}
            title={`Path direction (click to toggle)`}
          >
            {wrapSide === 'right' ? '↺' : '↻'}
          </button>
          
          <button 
            className={`${styles.actionButton} ${circle?.mirrored ? styles.actionButtonActive : ''}`}
            onClick={handleToggleMirror}
            title={`Mirror across vertical axis (${circle?.mirrored ? 'enabled' : 'disabled'})`}
          >
            ⇆
          </button>
          
          <button className={styles.actionButton} onClick={handleDelete} title="Delete shape">
            🗑
          </button>
        </div>
      </div>
      
      {/* Advanced controls for circles */}
      {shape.type === 'circle' && (
        <div className={styles.tensionSection} onClick={(e) => e.stopPropagation()}>
          {/* Toggle for advanced settings */}
          <div className={styles.tensionRow}>
            <button 
              className={`${styles.advancedToggle} ${showAdvanced ? styles.expanded : ''}`}
              onClick={toggleAdvanced}
              title="Show offset and tangent length controls"
            >
              ▾
            </button>
            <span className={styles.tensionLabel}>Advanced</span>
          </div>
          
          {/* Advanced: Offset and tangent length controls */}
          {showAdvanced && (
            <div className={styles.advancedTension}>
              {/* Entry section */}
              <div className={styles.sectionLabel}>Entry</div>
              
              {/* Entry offset */}
              <div className={styles.tensionRow}>
                <span className={styles.tensionLabelSmall}>Offset</span>
                <input
                  type="range"
                  min="-90"
                  max="90"
                  value={Math.round(entryOffsetDegrees)}
                  onChange={handleEntryOffsetChange}
                  className={styles.tensionSliderSmall}
                  title="Entry offset: rotates entry point around the circle"
                />
                <span className={styles.tensionValueSmall}>
                  {Math.round(entryOffsetDegrees)}°
                </span>
                <button
                  className={styles.resetButtonSmall}
                  onClick={handleResetEntryOffset}
                  disabled={isEntryOffsetDefault}
                  title="Reset to 0°"
                >
                  ↩
                </button>
              </div>
              
              {/* Entry tangent length */}
              <div className={styles.tensionRow}>
                <span className={styles.tensionLabelSmall}>Length</span>
                <input
                  type="range"
                  min="0"
                  max="300"
                  value={Math.round(entryTangentLength * 100)}
                  onChange={handleEntryTangentLengthChange}
                  className={styles.tensionSliderSmall}
                  title="Entry tangent length: controls curve tightness at entry"
                />
                <span className={styles.tensionValueSmall}>
                  {Math.round(entryTangentLength * 100)}%
                </span>
                <button
                  className={styles.resetButtonSmall}
                  onClick={handleResetEntryTangentLength}
                  disabled={isEntryTangentLengthDefault}
                  title="Reset to 100%"
                >
                  ↩
                </button>
              </div>
              
              {/* Exit section */}
              <div className={styles.sectionLabel}>Exit</div>
              
              {/* Exit offset */}
              <div className={styles.tensionRow}>
                <span className={styles.tensionLabelSmall}>Offset</span>
                <input
                  type="range"
                  min="-90"
                  max="90"
                  value={Math.round(exitOffsetDegrees)}
                  onChange={handleExitOffsetChange}
                  className={styles.tensionSliderSmall}
                  title="Exit offset: rotates exit point around the circle"
                />
                <span className={styles.tensionValueSmall}>
                  {Math.round(exitOffsetDegrees)}°
                </span>
                <button
                  className={styles.resetButtonSmall}
                  onClick={handleResetExitOffset}
                  disabled={isExitOffsetDefault}
                  title="Reset to 0°"
                >
                  ↩
                </button>
              </div>
              
              {/* Exit tangent length */}
              <div className={styles.tensionRow}>
                <span className={styles.tensionLabelSmall}>Length</span>
                <input
                  type="range"
                  min="0"
                  max="300"
                  value={Math.round(exitTangentLength * 100)}
                  onChange={handleExitTangentLengthChange}
                  className={styles.tensionSliderSmall}
                  title="Exit tangent length: controls curve tightness at exit"
                />
                <span className={styles.tensionValueSmall}>
                  {Math.round(exitTangentLength * 100)}%
                </span>
                <button
                  className={styles.resetButtonSmall}
                  onClick={handleResetExitTangentLength}
                  disabled={isExitTangentLengthDefault}
                  title="Reset to 100%"
                >
                  ↩
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
