import { cx } from '@/lib/cx'
import styles from './Card.module.css'

export function Card({ as: Component = 'section', padded = true, className, children, ...rest }) {
  return (
    <Component className={cx(styles.card, padded && styles.padded, className)} {...rest}>
      {children}
    </Component>
  )
}
