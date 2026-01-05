import styles from './MenuBar.module.css'

interface MenuItemProps {
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
}

export function MenuItem({ label, shortcut, onClick, disabled }: MenuItemProps) {
  return (
    <button
      className={styles.menuItem}
      onClick={onClick}
      disabled={disabled}
    >
      <span className={styles.menuItemLabel}>{label}</span>
      {shortcut && (
        <span className={styles.menuItemShortcut}>{shortcut}</span>
      )}
    </button>
  )
}


