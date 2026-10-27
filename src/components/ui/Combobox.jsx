import { ChevronDown } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import { cx } from '@/lib/cx'
import { foldText } from '@/lib/text'
import { Field } from './Fields'
import fieldStyles from './Fields.module.css'
import styles from './Combobox.module.css'

const MAX_VISIBLE = 80

/**
 * Ô nhập có gợi ý (WAI-ARIA combobox): gõ để lọc — không cần dấu, không phân biệt hoa thường — rồi chọn bằng chuột hoặc ↑ ↓ Enter.
 * Vẫn là ô chữ tự do: gõ giá trị ngoài danh sách cũng được giữ (dữ liệu cũ, danh mục chưa tải được).
 *
 *   options: [{ value, label }]
 *   value: chuỗi đang hiển thị · onChange(text): người dùng gõ · onSelect(option): người dùng chọn một gợi ý
 */
export function Combobox({
  label,
  value,
  onChange,
  onSelect,
  options = [],
  error,
  hint,
  required,
  disabled,
  placeholder,
  emptyText = 'Không có gợi ý phù hợp',
  className,
  id,
  name,
}) {
  const autoId = useId()
  const inputId = id ?? autoId
  const listId = `${inputId}-list`
  const messageId = `${inputId}-msg`
  const listRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  // Chỉ lọc sau khi người dùng gõ: mở ô đã có giá trị thì vẫn thấy cả danh sách để đổi.
  const [typed, setTyped] = useState(false)

  const indexed = useMemo(() => options.map((option) => ({ option, key: foldText(option.label) })), [options])
  const matches = useMemo(() => {
    const query = typed ? foldText(value ?? '') : ''
    const found = query ? indexed.filter((item) => item.key.includes(query)) : indexed
    return found.slice(0, MAX_VISIBLE).map((item) => item.option)
  }, [indexed, value, typed])

  const choose = (option) => {
    onSelect?.(option)
    setOpen(false)
    setTyped(false)
    setActive(-1)
  }

  const move = (delta) => {
    if (!matches.length) return
    const next = (active + delta + matches.length) % matches.length
    setActive(next)
    listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
  }

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) setOpen(true)
      else move(event.key === 'ArrowDown' ? 1 : -1)
    } else if (event.key === 'Enter' && open && active >= 0 && matches[active]) {
      event.preventDefault()
      choose(matches[active])
    } else if (event.key === 'Escape' && open) {
      // Esc lần đầu chỉ đóng danh sách gợi ý, không đóng hộp thoại đang chứa ô này.
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }
  }

  // Rời ô: gõ đúng tên một gợi ý (không cần dấu) thì coi như đã chọn gợi ý đó.
  const onBlur = () => {
    setOpen(false)
    setActive(-1)
    if (!typed) return
    setTyped(false)
    const query = foldText(value ?? '')
    const exact = query ? indexed.find((item) => item.key === query) : null
    if (exact) onSelect?.(exact.option)
  }

  return (
    <Field label={label} required={required} error={error} hint={hint} htmlFor={inputId} messageId={messageId} className={className}>
      <div className={cx(fieldStyles.control, error && fieldStyles.invalid, styles.control)}>
        <input
          id={inputId}
          name={name}
          className={cx(fieldStyles.input, styles.input)}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          aria-required={required || undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={value ?? ''}
          onChange={(event) => {
            onChange(event.target.value)
            setTyped(true)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
        />
        <ChevronDown size={16} className={styles.chevron} aria-hidden />
        {open && !disabled && (
          <ul ref={listRef} id={listId} role="listbox" className={styles.list}>
            {matches.length === 0 ? (
              <li className={styles.empty} role="presentation">
                {emptyText}
              </li>
            ) : (
              matches.map((option, index) => (
                <li
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className={cx(styles.option, index === active && styles.active)}
                  // mousedown thay vì click: chọn trước khi ô mất focus (blur đóng danh sách).
                  onMouseDown={(event) => {
                    event.preventDefault()
                    choose(option)
                  }}
                  onMouseEnter={() => setActive(index)}
                >
                  {option.label}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </Field>
  )
}
