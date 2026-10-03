import { ChevronDown, LogOut, MonitorSmartphone, User } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Badge } from '@/components/ui'
import { ROLE_LABELS } from '@/constants/enums'
import { useAuth } from '@/features/auth/AuthContext'
import { initials } from '@/lib/format'
import styles from './UserMenu.module.css'

// Menu tài khoản: hồ sơ, đăng xuất, đăng xuất mọi thiết bị (docs/api/auth.md#đăng-xuất).
export function UserMenu() {
  const { user, logout, logoutAll } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return undefined
    menuRef.current?.querySelector('[role="menuitem"]')?.focus()

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Phím mũi tên di chuyển giữa các mục (pattern WAI-ARIA menu).
  const onMenuKeyDown = (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const items = [...menuRef.current.querySelectorAll('[role="menuitem"]:not(:disabled)')]
    const index = items.indexOf(document.activeElement)
    const next =
      event.key === 'Home' ? 0
      : event.key === 'End' ? items.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }

  const run = (action) => async () => {
    setBusy(true)
    try {
      await action()
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  if (!user) return null

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.avatar} aria-hidden>
          {initials(user.fullName)}
        </span>
        <span className={styles.identity}>
          <span className={styles.name}>{user.fullName}</span>
          <span className={styles.role}>{ROLE_LABELS[user.role] ?? user.role}</span>
        </span>
        <ChevronDown size={16} className={styles.chevron} aria-hidden />
        <span className="visually-hidden">Mở menu tài khoản</span>
      </button>

      {open && (
        <div id={menuId} ref={menuRef} className={styles.menu} role="menu" aria-label="Tài khoản" onKeyDown={onMenuKeyDown}>
          <div className={styles.menuHeader}>
            <p className={styles.menuName}>{user.fullName}</p>
            <p className={styles.menuContact}>{user.phone || user.email}</p>
            <div className={styles.menuMeta}>
              <Badge tone="primary">{ROLE_LABELS[user.role] ?? user.role}</Badge>
              {user.organization && <span className={styles.menuOrg}>{user.organization.name}</span>}
            </div>
          </div>
          <div className={styles.menuGroup}>
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => {
                setOpen(false)
                navigate('/profile')
              }}
            >
              <User size={16} aria-hidden /> Hồ sơ của tôi
            </button>
          </div>
          <div className={styles.menuGroup}>
            <button type="button" role="menuitem" className={styles.item} disabled={busy} onClick={run(logout)}>
              <LogOut size={16} aria-hidden /> Đăng xuất
            </button>
            <button type="button" role="menuitem" className={styles.item} disabled={busy} onClick={run(logoutAll)}>
              <MonitorSmartphone size={16} aria-hidden /> Đăng xuất mọi thiết bị
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
