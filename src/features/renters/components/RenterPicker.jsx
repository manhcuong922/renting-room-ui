import { Search, UserPlus, X } from 'lucide-react'
import { useId, useState } from 'react'
import { Button, Field, Spinner } from '@/components/ui'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cx } from '@/lib/cx'
import { formatDate } from '@/lib/format'
import { useRenterList } from '../hooks'
import { RenterFormDialog } from './RenterFormDialog'
import styles from './RenterPicker.module.css'

/**
 * Ô chọn người thuê có tìm kiếm (docs/api/renters.md — "Ô chọn người thuê trong wizard hợp đồng"):
 * gõ ≥ 2 ký tự → debounce 300ms → GET /renters?q=&pageSize=10; không thấy → "Thêm người thuê mới".
 * value / onChange: object người thuê (RenterDto) hoặc null.
 */
export function RenterPicker({ label, value, onChange, excludeIds = [], error, required, hint }) {
  const inputId = useId()
  const listId = useId()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [creating, setCreating] = useState(false)
  const term = useDebouncedValue(text.trim(), 300)
  const digits = term.replace(/\s+/g, '')
  const byIdNumber = /^\d{9}$|^\d{12}$/.test(digits)
  const query = useRenterList(byIdNumber ? { idNumber: digits, pageSize: 10 } : { q: term, pageSize: 10 }, { enabled: open && term.length >= 2 })
  const results = (query.data?.items ?? []).filter((r) => !excludeIds.includes(r.id))

  const choose = (renter) => {
    onChange(renter)
    setText('')
    setOpen(false)
  }

  if (value) {
    return (
      <Field label={label} required={required} error={error} hint={hint}>
        <div className={styles.selected}>
          <div>
            <strong>{value.fullName}</strong>
            <div className={styles.meta}>
              {formatDate(value.dateOfBirth)} · {value.phone ?? 'chưa có SĐT'} · {value.idNumberMasked}
            </div>
          </div>
          <Button variant="ghost" size="sm" iconOnly icon={X} onClick={() => onChange(null)}>
            Bỏ chọn
          </Button>
        </div>
      </Field>
    )
  }

  const onKeyDown = (event) => {
    if (!open || results.length === 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => (i + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(results[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <Field label={label} required={required} error={error} hint={hint ?? 'Gõ họ tên, SĐT hoặc đủ số giấy tờ'} htmlFor={inputId}>
      <div className={styles.combo}>
        <div className={cx(styles.inputWrap, error && styles.invalid)}>
          <Search size={16} className={styles.icon} aria-hidden />
          <input
            id={inputId}
            className={styles.input}
            role="combobox"
            aria-expanded={open && term.length >= 2}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
            autoComplete="off"
            value={text}
            placeholder="Tìm người thuê…"
            onChange={(e) => {
              setText(e.target.value)
              setOpen(true)
              setActive(0)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKeyDown}
          />
        </div>
        {open && term.length >= 2 && (
          <ul id={listId} role="listbox" className={styles.list}>
            {query.isFetching && results.length === 0 && (
              <li className={styles.status}>
                <Spinner size={16} /> Đang tìm…
              </li>
            )}
            {!query.isFetching && results.length === 0 && <li className={styles.status}>Không tìm thấy “{term}”.</li>}
            {results.map((r, i) => (
              <li
                key={r.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={cx(styles.option, i === active && styles.optionActive)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(r)}
              >
                <strong>{r.fullName}</strong>
                <span className={styles.meta}>
                  {formatDate(r.dateOfBirth)} · {r.phone ?? 'chưa có SĐT'} · {r.idNumberMasked}
                </span>
              </li>
            ))}
            <li className={styles.createRow}>
              <Button variant="ghost" size="sm" icon={UserPlus} onMouseDown={(e) => e.preventDefault()} onClick={() => setCreating(true)}>
                Thêm người thuê mới
              </Button>
            </li>
          </ul>
        )}
      </div>
      {creating && (
        <RenterFormDialog
          onClose={() => setCreating(false)}
          onSaved={(r) => choose(r)}
          onUseExisting={(r) => {
            setCreating(false)
            choose(r)
          }}
        />
      )}
    </Field>
  )
}
