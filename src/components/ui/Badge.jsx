import { cx } from '@/lib/cx'
import styles from './Badge.module.css'

/** @param {{ tone?: 'neutral'|'success'|'warning'|'danger'|'info'|'orange'|'dark'|'primary' }} props */
export function Badge({ tone = 'neutral', className, children }) {
  return <span className={cx(styles.badge, styles[tone], className)}>{children}</span>
}
