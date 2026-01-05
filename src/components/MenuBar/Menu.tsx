import { useRef, useEffect, ReactNode } from 'react'
import styles from './MenuBar.module.css'

interface MenuProps {
  label: string
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  children: ReactNode
}

export function Menu({ label, isOpen, onToggle, onClose, children }: MenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return
    
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    
    // Delay to avoid immediate close
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
  
  return (
    <div ref={menuRef} className={styles.menu}>
      <button
        className={`${styles.menuButton} ${isOpen ? styles.active : ''}`}
        onClick={onToggle}
      >
        {label}
      </button>
      
      {isOpen && (
        <div className={styles.dropdown}>
          {children}
        </div>
      )}
    </div>
  )
}


