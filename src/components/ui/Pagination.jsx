import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'
import styles from './Pagination.module.css'

// Nhận đúng dạng PagedResult của API: { page, pageSize, totalCount, totalPages }.
export function Pagination({ page, pageSize, totalCount, totalPages, onPageChange, disabled }) {
  if (!totalCount) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalCount)

  return (
    <nav className={styles.pagination} aria-label="Phân trang">
      <p className={styles.summary}>
        {from}–{to} / {totalCount}
      </p>
      <div className={styles.controls}>
        <Button
          variant="secondary"
          size="sm"
          icon={ChevronLeft}
          iconOnly
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Trang trước
        </Button>
        <span className={styles.current} aria-current="page">
          {page} / {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="secondary"
          size="sm"
          icon={ChevronRight}
          iconOnly
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Trang sau
        </Button>
      </div>
    </nav>
  )
}
