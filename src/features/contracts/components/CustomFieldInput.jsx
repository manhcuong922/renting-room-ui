import { CheckboxField, DateField, MoneyField, NumberField, SelectField, TextAreaField, TextField } from '@/components/ui'

/** Ô nhập sinh từ định nghĩa trường tùy biến của mẫu (docs/api/contract-templates.md#kiểu-trường-tùy-biến-type). */
export function CustomFieldInput({ field, value, onChange, error }) {
  const common = { label: field.label, required: field.required, hint: field.hint ?? undefined, error }
  switch (field.type) {
    case 'LongText':
      return <TextAreaField {...common} rows={3} maxLength={5000} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="span-full" />
    case 'Number':
      return <NumberField {...common} decimals={4} suffix={field.unit ?? undefined} value={value ?? null} onChange={onChange} />
    case 'Money':
      return <MoneyField {...common} suffix={field.unit ?? 'đ'} value={value ?? null} onChange={onChange} />
    case 'Date':
      return <DateField {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />
    case 'Boolean':
      return <CheckboxField label={field.label} description={field.hint ?? undefined} error={error} checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
    case 'Select':
      return (
        <SelectField
          {...common}
          placeholder="Chọn…"
          options={(field.options ?? []).map((o) => ({ value: o, label: o }))}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      )
    default:
      return <TextField {...common} maxLength={500} suffix={field.unit ?? undefined} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
  }
}
