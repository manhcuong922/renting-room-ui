import { House, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { Link, NavLink } from 'react-router'
import { Button, Tooltip } from '@/components/ui'
import { getHomePath, getNavigationForUser } from '@/config/navigation'
import { cx } from '@/lib/cx'
import styles from './Sidebar.module.css'

export function Sidebar({ id, user, isDrawerMode, open, collapsed, onClose, onNavigate, onToggleCollapsed }) {
  const sections = useMemo(() => getNavigationForUser(user), [user])
  const closeButtonRef = useRef(null)
  const homePath = getHomePath(user)
  const subtitle = user?.organization?.name ?? 'Quản trị nền tảng'

  // Mở drawer → đưa focus vào trong drawer.
  useEffect(() => {
    if (open) closeButtonRef.current?.focus()
  }, [open])

  return (
    <aside
      id={id}
      className={cx(styles.sidebar, collapsed && styles.collapsed, isDrawerMode && styles.drawer, open && styles.open)}
      aria-label="Điều hướng chính"
      // Drawer đóng → không cho tab vào / trình đọc màn hình bỏ qua.
      inert={isDrawerMode && !open}
      {...(isDrawerMode && open ? { role: 'dialog', 'aria-modal': true } : {})}
    >
      <div className={styles.header}>
        <Link to={homePath} className={styles.brand} onClick={onNavigate} aria-label="Về trang chủ">
          <span className={styles.logo}>
            <House size={20} aria-hidden />
          </span>
          <span className={styles.brandText}>
            <strong className={styles.brandName}>Quản lý nhà trọ</strong>
            <span className={styles.brandSub} title={subtitle}>
              {subtitle}
            </span>
          </span>
        </Link>
        {isDrawerMode && (
          <Button ref={closeButtonRef} variant="ghost" iconOnly icon={X} onClick={() => onClose()} className={styles.closeButton}>
            Đóng menu
          </Button>
        )}
      </div>

      <nav className={styles.nav}>
        {sections.map((section) => (
          <div key={section.id} className={styles.section}>
            {section.label && (
              <p className={styles.sectionLabel} aria-hidden={collapsed || undefined}>
                {section.label}
              </p>
            )}
            <ul className={styles.list}>
              {section.items.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <Tooltip content={label} disabled={!collapsed}>
                    <NavLink
                      to={to}
                      onClick={onNavigate}
                      className={({ isActive }) => cx(styles.link, isActive && styles.active)}
                      aria-label={collapsed ? label : undefined}
                    >
                      <Icon size={20} className={styles.linkIcon} aria-hidden />
                      <span className={styles.linkLabel}>{label}</span>
                    </NavLink>
                  </Tooltip>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {!isDrawerMode && (
        <div className={styles.footer}>
          <Tooltip content="Mở rộng menu" disabled={!collapsed}>
            <button
              type="button"
              className={styles.collapseButton}
              onClick={onToggleCollapsed}
              aria-controls={id}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            >
              {collapsed ? <PanelLeftOpen size={20} aria-hidden /> : <PanelLeftClose size={20} aria-hidden />}
              <span className={styles.linkLabel}>Thu gọn</span>
            </button>
          </Tooltip>
        </div>
      )}
    </aside>
  )
}
