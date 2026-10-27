import { CircleCheck, Info, TriangleAlert, X, CircleX } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cx } from '@/lib/cx'
import styles from './Toast.module.css'
import { ToastContext } from './toastContext'

const ICONS = { success: CircleCheck, error: CircleX, warning: TriangleAlert, info: Info }
const DURATION = { success: 4000, info: 5000, warning: 7000, error: 8000 }
// Cùng một câu báo 2 lần liền nhau (VD hộp thoại và nút hành động cùng báo một lỗi) → chỉ hiện 1.
const DEDUPE_MS = 1500

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)
  const regionRef = useRef(null)
  const lastRef = useRef({ key: '', at: 0, id: 0 })

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const show = useCallback(
    (tone, message, { title, duration } = {}) => {
      const key = `${tone}|${title ?? ''}|${message}`
      const now = Date.now()
      if (lastRef.current.key === key && now - lastRef.current.at < DEDUPE_MS) return lastRef.current.id
      idRef.current += 1
      const id = idRef.current
      lastRef.current = { key, at: now, id }
      setToasts((list) => [...list.slice(-3), { id, tone, message, title }])
      setTimeout(() => dismiss(id), duration ?? DURATION[tone])
      return id
    },
    [dismiss],
  )

  // <dialog> mở bằng showModal() nằm ở top layer, che mọi phần tử thường. Vùng thông báo là popover và được
  // mở lại mỗi khi có thông báo mới để luôn nằm trên cùng (trình duyệt cũ không có popover: vẫn hiện, chỉ không đè hộp thoại).
  const latestId = toasts.at(-1)?.id
  useEffect(() => {
    const region = regionRef.current
    if (!region?.showPopover) return
    try {
      if (region.matches(':popover-open')) region.hidePopover()
      if (latestId !== undefined) region.showPopover()
    } catch {
      // Không mở được popover thì vùng thông báo vẫn hiển thị theo CSS thường.
    }
  }, [latestId])

  const api = useMemo(
    () => ({
      success: (m, o) => show('success', m, o),
      error: (m, o) => show('error', m, o),
      warning: (m, o) => show('warning', m, o),
      info: (m, o) => show('info', m, o),
      dismiss,
    }),
    [show, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div ref={regionRef} popover="manual" className={styles.region} aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => {
          const Icon = ICONS[t.tone]
          return (
            <div key={t.id} className={cx(styles.toast, styles[t.tone])} role={t.tone === 'error' ? 'alert' : 'status'}>
              <Icon size={18} className={styles.icon} aria-hidden />
              <div className={styles.content}>
                {t.title && <p className={styles.title}>{t.title}</p>}
                <p>{t.message}</p>
              </div>
              <button type="button" className={styles.close} onClick={() => dismiss(t.id)} aria-label="Đóng thông báo">
                <X size={16} aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
