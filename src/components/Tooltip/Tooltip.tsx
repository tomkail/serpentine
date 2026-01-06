import { ReactNode } from 'react'
import styles from './Tooltip.module.css'

interface TooltipProps {
  children: ReactNode
  text: string
  shortcut?: string
}

export function Tooltip({ children, text, shortcut }: TooltipProps) {
  const tooltipText = shortcut ? `${text} (${shortcut})` : text
  
  return (
    <div className={styles.tooltipWrapper}>
      {children}
      <span className={styles.tooltip} role="tooltip">
        {tooltipText}
      </span>
    </div>
  )
}

