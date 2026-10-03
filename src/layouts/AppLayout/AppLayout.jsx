import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useMatches } from 'react-router'
import { PageLoader } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
import { RouteAccessGate } from '@/features/auth/guards'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { DESKTOP_QUERY, useMediaQuery } from '@/hooks/useMediaQuery'
import { usePersistentState } from '@/hooks/usePersistentState'
import { useScrollLock } from '@/hooks/useScrollLock'
import { cx } from '@/lib/cx'
import styles from './AppLayout.module.css'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

const SIDEBAR_ID = 'app-sidebar'

/**
 * Khung ứng dụng: sidebar trái + topbar + nội dung bên phải.
 *  - Desktop (≥1024px): sidebar cố định, thu gọn được thành thanh icon (nhớ lựa chọn).
 *  - Mobile/tablet (<1024px): sidebar là drawer trượt từ trái, có lớp phủ, khóa cuộn, Esc để đóng.
 */
export function AppLayout() {
  const { user } = useAuth()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const [collapsed, setCollapsed] = usePersistentState('rr.sidebarCollapsed', false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuButtonRef = useRef(null)
  const mainRef = useRef(null)
  const focusAfterCloseRef = useRef(null)

  const isDrawerMode = !isDesktop
  const drawerVisible = isDrawerMode && drawerOpen

  const matches = useMatches()
  const title = matches.findLast((m) => m.handle?.title)?.handle.title
  useDocumentTitle(title)
  useScrollLock(drawerVisible)

  // focusTo: 'menu' (đóng bằng Esc/nút X/lớp phủ) | 'main' (vừa chọn trang → đưa focus vào nội dung mới).
  const closeDrawer = useCallback(({ focusTo = 'menu' } = {}) => {
    focusAfterCloseRef.current = focusTo
    setDrawerOpen(false)
  }, [])

  // Chạy sau khi commit: vùng main đã hết `inert` nên mới focus được.
  useEffect(() => {
    if (drawerVisible || !focusAfterCloseRef.current) return
    const target = focusAfterCloseRef.current === 'main' ? mainRef.current : menuButtonRef.current
    focusAfterCloseRef.current = null
    target?.focus({ preventScroll: true })
  }, [drawerVisible])

  useEffect(() => {
    if (!drawerVisible) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeDrawer()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [drawerVisible, closeDrawer])

  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>
        Bỏ qua điều hướng
      </a>

      <Sidebar
        id={SIDEBAR_ID}
        user={user}
        isDrawerMode={isDrawerMode}
        open={drawerVisible}
        collapsed={isDesktop && collapsed}
        onClose={closeDrawer}
        onNavigate={() => drawerVisible && closeDrawer({ focusTo: 'main' })}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
      />

      <div
        className={cx(styles.overlay, drawerVisible && styles.overlayVisible)}
        onClick={() => closeDrawer()}
        aria-hidden="true"
      />

      {/* inert khi drawer mở → focus bị giữ trong drawer, đúng hành vi modal. */}
      <div className={styles.main} inert={drawerVisible}>
        <Topbar
          title={title}
          menuButtonRef={menuButtonRef}
          menuControls={SIDEBAR_ID}
          menuExpanded={drawerVisible}
          onOpenMenu={() => setDrawerOpen(true)}
        />
        <main id="main-content" ref={mainRef} tabIndex={-1} className={styles.content}>
          <Suspense fallback={<PageLoader />}>
            <RouteAccessGate>
              <Outlet />
            </RouteAccessGate>
          </Suspense>
        </main>
      </div>
    </div>
  )
}
