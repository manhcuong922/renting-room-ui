import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import styles from './PageHeader.module.css'

// Tiêu đề trang + mô tả + nút hành động (tự xuống dòng trên mobile). `backTo` → nút quay lại danh sách.
export function PageHeader({ title, description, actions, backTo, backLabel = 'Quay lại', meta }) {
  return (
    <header className={styles.header}>
      <div className={styles.text}>
        {backTo && (
          <Link to={backTo} className={styles.back}>
            <ArrowLeft size={16} aria-hidden /> {backLabel}
          </Link>
        )}
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{title}</h1>
          {meta && <div className={styles.meta}>{meta}</div>}
        </div>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}
