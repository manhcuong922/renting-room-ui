import { useId, useRef } from 'react'
import { cx } from '@/lib/cx'
import styles from './Tabs.module.css'

/**
 * Thanh tab (WAI-ARIA tabs, phím ←/→). Cuộn ngang trên mobile.
 * tabs: [{ id, label, badge?, hidden? }]
 */
export function Tabs({ tabs, value, onChange, label, idPrefix }) {
  const autoId = useId()
  const prefix = idPrefix ?? autoId
  const listRef = useRef(null)
  const visible = tabs.filter((t) => !t.hidden)

  const onKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const index = visible.findIndex((t) => t.id === value)
    const next =
      event.key === 'Home' ? 0
      : event.key === 'End' ? visible.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + visible.length) % visible.length
    onChange(visible[next].id)
    listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus()
  }

  return (
    <div className={styles.wrap}>
      <div ref={listRef} className={styles.list} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {visible.map((tab) => {
          const selected = tab.id === value
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${prefix}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${prefix}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={cx(styles.tab, selected && styles.active)}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge !== null && <span className={styles.badge}>{tab.badge}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function TabPanel({ idPrefix, id, children }) {
  return (
    <div role="tabpanel" id={`${idPrefix}-panel-${id}`} aria-labelledby={`${idPrefix}-tab-${id}`} className={styles.panel}>
      {children}
    </div>
  )
}
