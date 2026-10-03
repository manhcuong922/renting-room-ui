import { useCallback, useState } from 'react'
import { ApiError, getErrorMessage } from '@/lib/http/ApiError'

// Đường dẫn field dạng 'address.streetAddress' hoặc 'occupants.0.renterId'.
export function getIn(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj)
}

export function setIn(obj, path, value) {
  const [head, ...rest] = path.split('.')
  const isIndex = /^\d+$/.test(head)
  const copy = Array.isArray(obj) ? [...obj] : { ...obj }
  if (rest.length === 0) {
    copy[isIndex ? Number(head) : head] = value
    return copy
  }
  const child = obj?.[head] ?? (/^\d+$/.test(rest[0]) ? [] : {})
  copy[isIndex ? Number(head) : head] = setIn(child, rest.join('.'), value)
  return copy
}

// Key lỗi của server: 'contract.occupants[1].renterId' → bỏ tiền tố → 'occupants.1.renterId'.
function normalizeServerKey(key, prefix) {
  let k = key.replace(/\[(\d+)\]/g, '.$1')
  if (prefix && k.startsWith(`${prefix}.`)) k = k.slice(prefix.length + 1)
  // Server trả camelCase; đảm bảo chữ đầu viết thường (một số validator trả PascalCase).
  return k
    .split('.')
    .map((part) => part.charAt(0).toLowerCase() + part.slice(1))
    .join('.')
}

/**
 * Trạng thái form + gắn lỗi từ ApiError vào đúng ô.
 *
 *   const form = useForm(initial, { validate, serverPrefix: 'renter', codeFields: { PHONE_TAKEN: 'phone' } })
 *   <TextField {...form.field('fullName')} />
 *   <form onSubmit={form.handleSubmit(async (values) => api.create(values))}>
 *
 * - validate(values) → { field: 'thông báo' } (lỗi phía client, chặn submit)
 * - serverPrefix: tiền tố key lỗi server cần bỏ (VD body bọc trong `renter`)
 * - codeFields: mã lỗi nghiệp vụ → ô hiển thị `detail` (VD ORG_CODE_TAKEN → 'code')
 */
export function useForm(initialValues, { validate, serverPrefix, codeFields = {} } = {}) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const setValue = useCallback((name, value) => {
    setValues((v) => setIn(v, name, value))
    setErrors((e) => {
      if (!e[name]) return e
      const next = { ...e }
      delete next[name]
      return next
    })
  }, [])

  const field = (name, { type } = {}) => {
    const raw = getIn(values, name)
    if (type === 'checkbox') {
      return { name, checked: Boolean(raw), onChange: (e) => setValue(name, e.target.checked), error: errors[name] }
    }
    // Ô số / tiền / ngày tự xử lý onChange(value)
    if (type === 'value') return { name, value: raw ?? null, onChange: (v) => setValue(name, v), error: errors[name] }
    return { name, value: raw ?? '', onChange: (e) => setValue(name, e.target.value), error: errors[name] }
  }

  /** Gắn lỗi server vào ô; không gắn được thì hiện ở đầu form. Trả về true nếu là lỗi theo field. */
  const applyServerError = (error) => {
    if (!(error instanceof ApiError)) {
      setFormError(getErrorMessage(error))
      return false
    }
    const fieldErrors = {}
    for (const [key, message] of Object.entries(error.fieldErrors())) {
      fieldErrors[normalizeServerKey(key, serverPrefix)] = message
    }
    if (codeFields[error.code]) fieldErrors[codeFields[error.code]] = error.detail ?? getErrorMessage(error)
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors)
      setFormError(error.isValidation ? 'Vui lòng kiểm tra các ô được đánh dấu.' : null)
      return true
    }
    setFormError(getErrorMessage(error))
    return false
  }

  const handleSubmit = (onSubmit) => async (event) => {
    event?.preventDefault?.()
    // Form trong hộp thoại có thể nằm trong form khác (cây React) → không để submit lan ra ngoài.
    event?.stopPropagation?.()
    const clientErrors = validate?.(values) ?? {}
    const hasErrors = Object.values(clientErrors).some(Boolean)
    setErrors(hasErrors ? clientErrors : {})
    setFormError(hasErrors ? 'Vui lòng kiểm tra các ô được đánh dấu.' : null)
    if (hasErrors) return
    setSubmitting(true)
    try {
      await onSubmit(values)
    } catch (error) {
      applyServerError(error)
    } finally {
      setSubmitting(false)
    }
  }

  const reset = useCallback((next) => {
    setValues(next)
    setErrors({})
    setFormError(null)
  }, [])

  return { values, setValues, setValue, errors, setErrors, formError, setFormError, submitting, field, handleSubmit, applyServerError, reset }
}

/** Chuỗi rỗng → null (server phân biệt "không có" và ""). */
export function blankToNull(value) {
  if (typeof value !== 'string') return value ?? null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function cleanStrings(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' ? blankToNull(v) : v]))
}
