import { useId, useState } from 'react'
import { cx } from '@/lib/cx'
import styles from './Fields.module.css'

/** Khung chung: nhãn + ô + lỗi/gợi ý. Lỗi lấy từ useForm (client) hoặc ApiError.fieldErrors() (server). */
export function Field({ label, required, error, hint, htmlFor, messageId, className, children }) {
  const message = error || hint
  return (
    <div className={cx(styles.field, className)}>
      {label && (
        <label htmlFor={htmlFor} className={styles.label}>
          {label}
          {required && (
            <span className={styles.required} aria-hidden>
              {' '}
              *
            </span>
          )}
        </label>
      )}
      {children}
      {message && (
        <p id={messageId} className={error ? styles.error : styles.hint}>
          {message}
        </p>
      )}
    </div>
  )
}

function useFieldIds(id) {
  const autoId = useId()
  const inputId = id ?? autoId
  return { inputId, messageId: `${inputId}-msg` }
}

function a11y(error, hint, messageId, required) {
  return {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error || hint ? messageId : undefined,
    'aria-required': required || undefined,
  }
}

export function TextField({ label, error, hint, icon: Icon, suffix, required, className, id, ...inputProps }) {
  const { inputId, messageId } = useFieldIds(id)
  return (
    <Field label={label} required={required} error={error} hint={hint} htmlFor={inputId} messageId={messageId} className={className}>
      <div className={cx(styles.control, error && styles.invalid, Icon && styles.withIcon, suffix && styles.withSuffix)}>
        {Icon && <Icon size={16} className={styles.icon} aria-hidden />}
        <input id={inputId} className={styles.input} {...a11y(error, hint, messageId, required)} {...inputProps} />
        {suffix && <span className={styles.suffix}>{suffix}</span>}
      </div>
    </Field>
  )
}

export function TextAreaField({ label, error, hint, required, className, id, rows = 4, ...props }) {
  const { inputId, messageId } = useFieldIds(id)
  return (
    <Field label={label} required={required} error={error} hint={hint} htmlFor={inputId} messageId={messageId} className={className}>
      <div className={cx(styles.control, error && styles.invalid)}>
        <textarea id={inputId} rows={rows} className={cx(styles.input, styles.textarea)} {...a11y(error, hint, messageId, required)} {...props} />
      </div>
    </Field>
  )
}

/**
 * options: [{ value, label, disabled }] hoặc nhóm [{ label, options: [...] }].
 * placeholder → thêm lựa chọn rỗng (giá trị '').
 */
export function SelectField({ label, error, hint, required, className, id, options = [], placeholder, ...props }) {
  const { inputId, messageId } = useFieldIds(id)
  const renderOption = (o) => (
    <option key={o.value} value={o.value} disabled={o.disabled}>
      {o.label}
    </option>
  )
  return (
    <Field label={label} required={required} error={error} hint={hint} htmlFor={inputId} messageId={messageId} className={className}>
      <div className={cx(styles.control, error && styles.invalid)}>
        <select id={inputId} className={cx(styles.input, styles.select)} {...a11y(error, hint, messageId, required)} {...props}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) =>
            o.options ? (
              <optgroup key={o.label} label={o.label}>
                {o.options.map(renderOption)}
              </optgroup>
            ) : (
              renderOption(o)
            ),
          )}
        </select>
      </div>
    </Field>
  )
}

const moneyFormatter = new Intl.NumberFormat('vi-VN')

/** Ô tiền VND: hiển thị 3.500.000, trả về số nguyên (hoặc null khi trống). */
export function MoneyField({ value, onChange, suffix = 'đ', ...props }) {
  const display = value === null || value === undefined || value === '' ? '' : moneyFormatter.format(value)
  return (
    <TextField
      inputMode="numeric"
      autoComplete="off"
      suffix={suffix}
      value={display}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 13)
        onChange(digits === '' ? null : Number(digits))
      }}
      {...props}
    />
  )
}

/** Ô số (cho phép thập phân nếu decimals > 0). Giữ chuỗi khi đang gõ, trả về number|null. */
export function NumberField({ value, onChange, decimals = 0, onBlur, ...props }) {
  const [draft, setDraft] = useState(null)
  const shown = draft ?? (value === null || value === undefined ? '' : String(value).replace('.', ','))
  return (
    <TextField
      inputMode={decimals ? 'decimal' : 'numeric'}
      autoComplete="off"
      value={shown}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.,]/g, '')
        const pattern = decimals ? new RegExp(`^\\d*([.,]\\d{0,${decimals}})?$`) : /^\d*$/
        if (!pattern.test(raw)) return
        setDraft(raw)
        const normalized = raw.replace(',', '.')
        onChange(normalized === '' || normalized === '.' ? null : Number(normalized))
      }}
      onBlur={(e) => {
        setDraft(null)
        onBlur?.(e)
      }}
      {...props}
    />
  )
}

export function DateField(props) {
  return <TextField type="date" {...props} value={props.value ?? ''} />
}

export function CheckboxField({ label, description, error, className, id, ...props }) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className={cx(styles.checkboxField, className)}>
      <label htmlFor={inputId} className={styles.checkbox}>
        <input id={inputId} type="checkbox" {...props} />
        <span>
          <span className={styles.checkboxLabel}>{label}</span>
          {description && <span className={styles.checkboxDescription}>{description}</span>}
        </span>
      </label>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}

/** Nhóm radio dạng nút (segmented) — VD Cá nhân / Tổ chức. */
export function RadioGroup({ label, name, value, onChange, options, error, required, className }) {
  const autoName = useId()
  return (
    <Field label={label} required={required} error={error} className={className}>
      <div className={styles.segmented} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <label key={o.value} className={cx(styles.segment, value === o.value && styles.segmentActive)}>
            <input
              type="radio"
              name={name ?? autoName}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="visually-hidden"
            />
            {o.label}
          </label>
        ))}
      </div>
    </Field>
  )
}

/** Nhóm checkbox chọn nhiều → mảng giá trị. */
export function CheckboxGroup({ label, value = [], onChange, options, error, required, className }) {
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  return (
    <Field label={label} required={required} error={error} className={className}>
      <div className={styles.chips} role="group" aria-label={label}>
        {options.map((o) => (
          <label key={o.value} className={cx(styles.chip, value.includes(o.value) && styles.chipActive)}>
            <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} className="visually-hidden" />
            {o.label}
          </label>
        ))}
      </div>
    </Field>
  )
}

/** Lưới form: 1 cột mobile, 2 cột (hoặc `cols`) từ tablet. Con có className `span-full` chiếm cả hàng. */
export function FormGrid({ cols = 2, className, children }) {
  return <div className={cx(styles.grid, styles[`cols${cols}`], className)}>{children}</div>
}

export function FormSection({ title, description, children }) {
  return (
    <fieldset className={styles.section}>
      {title && <legend className={styles.sectionTitle}>{title}</legend>}
      {description && <p className={styles.sectionDescription}>{description}</p>}
      {children}
    </fieldset>
  )
}

