import { LoaderCircle } from 'lucide-react'
import { Link } from 'react-router'
import { cx } from '@/lib/cx'
import styles from './Button.module.css'

/**
 * @param {{ variant?: 'primary'|'secondary'|'ghost'|'danger', size?: 'sm'|'md'|'lg', loading?: boolean,
 *           icon?: React.ComponentType, iconOnly?: boolean, block?: boolean } & React.ButtonHTMLAttributes} props
 */
export function Button({
  ref,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconOnly = false,
  block = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(styles.button, styles[variant], styles[size], iconOnly && styles.iconOnly, block && styles.block, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoaderCircle className={styles.spin} size={16} aria-hidden /> : Icon && <Icon size={16} aria-hidden />}
      {iconOnly ? <span className="visually-hidden">{children}</span> : children}
    </button>
  )
}

/** Liên kết điều hướng trông như nút (VD "Tạo khu" → /properties/new). */
export function ButtonLink({ to, variant = 'primary', size = 'md', icon: Icon, block = false, className, children, ...rest }) {
  return (
    <Link to={to} className={cx(styles.button, styles[variant], styles[size], block && styles.block, className)} {...rest}>
      {Icon && <Icon size={16} aria-hidden />}
      {children}
    </Link>
  )
}
