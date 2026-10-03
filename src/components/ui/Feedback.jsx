import { Inbox, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react'
import { getErrorMessage } from '@/lib/http/ApiError'
import { cx } from '@/lib/cx'
import { Button } from './Button'
import styles from './Feedback.module.css'

export function Spinner({ size = 20, label = 'Đang tải…', className }) {
  return (
    <span className={cx(styles.spinner, className)} role="status">
      <LoaderCircle size={size} className={styles.spin} aria-hidden />
      <span className="visually-hidden">{label}</span>
    </span>
  )
}

export function PageLoader({ label = 'Đang tải…', fullScreen = false }) {
  return (
    <div className={cx(styles.loader, fullScreen && styles.fullScreen)}>
      <Spinner size={28} label={label} />
    </div>
  )
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className={styles.state}>
      <span className={styles.iconWrap}>
        <Icon size={24} aria-hidden />
      </span>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}

export function ErrorState({ error, title = 'Không tải được dữ liệu', description, onRetry }) {
  return (
    <div className={styles.state} role="alert">
      <span className={cx(styles.iconWrap, styles.danger)}>
        <TriangleAlert size={24} aria-hidden />
      </span>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description ?? getErrorMessage(error)}</p>
      {onRetry && (
        <div className={styles.action}>
          <Button variant="secondary" icon={RefreshCw} onClick={onRetry}>
            Thử lại
          </Button>
        </div>
      )}
    </div>
  )
}

export function Alert({ tone = 'danger', children }) {
  return (
    <div className={cx(styles.alert, styles[`alert_${tone}`])} role={tone === 'danger' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
