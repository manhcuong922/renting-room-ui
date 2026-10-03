import { House } from 'lucide-react'
import { Suspense } from 'react'
import { Outlet, useMatches } from 'react-router'
import { PageLoader } from '@/components/ui'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import styles from './AuthLayout.module.css'

// Khung cho màn đăng nhập / đổi mật khẩu bắt buộc (không có sidebar).
export function AuthLayout() {
  const title = useMatches().findLast((m) => m.handle?.title)?.handle.title
  useDocumentTitle(title)

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.brand}>
          <span className={styles.logo}>
            <House size={22} aria-hidden />
          </span>
          <span className={styles.brandName}>Quản lý nhà trọ</span>
        </div>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  )
}
