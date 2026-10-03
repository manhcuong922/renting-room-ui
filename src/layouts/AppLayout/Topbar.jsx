import { ChevronRight, Menu } from 'lucide-react'
import { useLocation } from 'react-router'
import { Button } from '@/components/ui'
import { findNavSection } from '@/config/navigation'
import styles from './Topbar.module.css'
import { UserMenu } from './UserMenu'

export function Topbar({ title, menuButtonRef, menuControls, menuExpanded, onOpenMenu }) {
  const { pathname } = useLocation()
  const sectionLabel = findNavSection(pathname)?.label

  return (
    <header className={styles.topbar}>
      <Button
        ref={menuButtonRef}
        variant="ghost"
        iconOnly
        icon={Menu}
        className={styles.menuButton}
        onClick={onOpenMenu}
        aria-controls={menuControls}
        aria-expanded={menuExpanded}
      >
        Mở menu điều hướng
      </Button>

      <nav className={styles.breadcrumb} aria-label="Vị trí hiện tại">
        {sectionLabel && (
          <>
            <span className={styles.crumbSection}>{sectionLabel}</span>
            <ChevronRight size={14} className={styles.crumbSeparator} aria-hidden />
          </>
        )}
        <span className={styles.crumbCurrent} aria-current="page">
          {title}
        </span>
      </nav>

      <div className={styles.actions}>
        <UserMenu />
      </div>
    </header>
  )
}
