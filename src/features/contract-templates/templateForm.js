// Mẫu hợp đồng ⇄ form + kiểm tra phía client (docs/api/contract-templates.md).
export const MAX_CLAUSES = 30
export const MAX_FIELDS = 50
export const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/
export const DEFAULT_TITLES = { RoomRental: 'HỢP ĐỒNG THUÊ PHÒNG TRỌ', WholeHouseRental: 'HỢP ĐỒNG THUÊ NHÀ' }

export const emptyClause = () => ({ heading: '', body: '' })
export const emptyField = () => ({ key: '', label: '', type: 'Text', required: false, optionsText: '', unit: '', hint: '' })

export function toTemplateForm(t) {
  return {
    name: t?.name ?? '',
    contractType: t?.contractType ?? 'RoomRental',
    title: t?.title ?? DEFAULT_TITLES.RoomRental,
    noDeposit: t?.noDeposit ?? false,
    clauses: (t?.clauses ?? []).map((c) => ({ heading: c.heading ?? '', body: c.body ?? '' })),
    fields: (t?.fields ?? []).map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      optionsText: (f.options ?? []).join('\n'),
      unit: f.unit ?? '',
      hint: f.hint ?? '',
    })),
  }
}

const parseOptions = (text) =>
  text
    .split('\n')
    .map((o) => o.trim())
    .filter(Boolean)

export function toTemplateBody(v) {
  return {
    name: v.name.trim(),
    contractType: v.contractType,
    title: v.title.trim() || null,
    noDeposit: v.noDeposit,
    clauses: v.clauses.map((c) => ({ heading: c.heading.trim(), body: c.body.trim() })),
    fields: v.fields.map((f) => ({
      key: f.key.trim(),
      label: f.label.trim(),
      type: f.type,
      required: f.required,
      options: f.type === 'Select' ? parseOptions(f.optionsText) : null,
      unit: f.unit.trim() || null,
      hint: f.hint.trim() || null,
    })),
  }
}

export function validateTemplate(v) {
  const errors = {
    name: !v.name.trim() ? 'Nhập tên mẫu.' : null,
    title: v.title.length > 200 ? 'Tiêu đề ≤ 200 ký tự.' : null,
  }
  v.clauses.forEach((c, i) => {
    if (!c.heading.trim()) errors[`clauses.${i}.heading`] = 'Nhập tiêu đề điều khoản.'
    if (!c.body.trim()) errors[`clauses.${i}.body`] = 'Nhập nội dung điều khoản.'
  })
  const keys = v.fields.map((f) => f.key.trim())
  v.fields.forEach((f, i) => {
    const key = f.key.trim()
    if (!FIELD_KEY_PATTERN.test(key)) errors[`fields.${i}.key`] = 'Chữ thường không dấu, số, _; bắt đầu bằng chữ (≤ 40).'
    else if (keys.indexOf(key) !== i) errors[`fields.${i}.key`] = 'Key bị trùng.'
    if (!f.label.trim()) errors[`fields.${i}.label`] = 'Nhập nhãn.'
    if (f.type === 'Select') {
      const options = parseOptions(f.optionsText)
      if (options.length < 1 || options.length > 30) errors[`fields.${i}.options`] = 'Cần 1–30 lựa chọn (mỗi dòng một lựa chọn).'
      else if (new Set(options).size !== options.length) errors[`fields.${i}.options`] = 'Lựa chọn bị trùng.'
    }
  })
  return errors
}
