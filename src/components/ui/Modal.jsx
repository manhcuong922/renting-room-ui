import { X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { useScrollLock } from '@/hooks/useScrollLock'
import { cx } from '@/lib/cx'
import { Button } from './Button'
import styles from './Modal.module.css'

/**
 * Hộp thoại dựa trên <dialog> gốc: focus bị giữ bên trong, Esc để đóng, nằm trên mọi lớp.
 * Mobile: dạng sheet trượt từ dưới lên, chiếm gần hết màn hình.
 * `dismissible={false}` khi đang gửi dữ liệu → không đóng bằng Esc / bấm nền.
 */
export function Modal({ open, onClose, title, description, size = 'md', dismissible = true, footer, children }) {
  const ref = useRef(null)
  const titleId = useId()
  const descId = useId()
  useScrollLock(open)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      className={cx(styles.dialog, styles[size])}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault()
        if (dismissible) onClose()
      }}
      onClick={(e) => {
        // Bấm vào nền (chính phần tử dialog, ngoài khung nội dung) → đóng.
        if (e.target === e.currentTarget && dismissible) onClose()
      }}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <div className={styles.headings}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {description && (
              <p id={descId} className={styles.description}>
                {description}
              </p>
            )}
          </div>
          <Button variant="ghost" iconOnly icon={X} onClick={onClose} disabled={!dismissible} className={styles.close}>
            Đóng
          </Button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </dialog>
  )
}
