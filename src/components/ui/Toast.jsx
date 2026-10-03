import { CircleCheck, Info, TriangleAlert, X, CircleX } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { cx } from '@/lib/cx'
import styles from './Toast.module.css'
import { ToastContext } from './toastContext'

const ICONS = { success: CircleCheck, error: CircleX, warning: TriangleAlert, info: Info }
const DURATION = { success: 4000, info: 5000, warning: 7000, error: 8000 }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const show = useCallback(
    (tone, message, { title, duration } = {}) => {
      idRef.current += 1
      const id = idRef.current
      setToasts((list) => [...list.slice(-3), { id, tone, message, title }])
      setTimeout(() => dismiss(id), duration ?? DURATION[tone])
      return id
    },
    [dismiss],
  )

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
      <div className={styles.region} aria-live="polite" aria-relevant="additions">
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
