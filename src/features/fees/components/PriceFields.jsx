import { Plus, Trash2 } from 'lucide-react'
import { Button, DateField, Field, MoneyField, NumberField, RadioGroup, TextField } from '@/components/ui'
import { MAX_TIERS } from '../feeForm'
import styles from './PriceFields.module.css'

const KIND_OPTIONS = [
  { value: 'single', label: 'Một giá' },
  { value: 'tiers', label: 'Theo bậc' },
]

/**
 * Các ô của một bản giá (fees.md#bảng-giá). `form` = useForm(), `path` = tiền tố trong form ('' hoặc 'initialPrice.').
 * Giá theo bậc chỉ cho điện nước theo công tơ; dịch vụ luôn một giá.
 */
export function PriceFields({ form, path = '', group, unit }) {
  const price = path ? form.values[path.slice(0, -1)] : form.values
  const metered = group === 'Metered'
  const kind = metered ? price.kind : 'single'
  const setTiers = (tiers) => form.setValue(`${path}tiers`, tiers)
  const PriceInput = metered ? NumberField : MoneyField

  return (
    <>
      <DateField label="Hiệu lực từ ngày" required hint="Áp cho cả kỳ có ngày cuối kỳ từ ngày này" {...form.field(`${path}effectiveFrom`)} />
      {metered && <RadioGroup label="Kiểu giá" options={KIND_OPTIONS} value={kind} onChange={(value) => form.setValue(`${path}kind`, value)} />}

      {kind === 'single' ? (
        <PriceInput
          label="Đơn giá"
          required
          suffix={`đ/${unit || 'đơn vị'}`}
          {...(metered ? { decimals: 2 } : {})}
          {...form.field(`${path}unitPrice`, { type: 'value' })}
        />
      ) : (
        <Field label="Giá theo bậc" required error={form.errors[`${path}tiers`]} hint="Mốc lũy kế theo sản lượng của kỳ; bậc cuối áp cho phần còn lại." className="span-full">
          <div className={styles.tiers}>
            {price.tiers.map((tier, index) => {
              const last = index === price.tiers.length - 1
              const update = (changes) => setTiers(price.tiers.map((t, i) => (i === index ? { ...t, ...changes } : t)))
              return (
                <div key={index} className={styles.tier}>
                  <span className={styles.tierLabel}>Bậc {index + 1}</span>
                  {last ? (
                    <TextField aria-label={`Bậc ${index + 1} đến`} value="Phần còn lại" disabled readOnly />
                  ) : (
                    <NumberField aria-label={`Bậc ${index + 1} đến`} placeholder="Đến" suffix={unit} decimals={2} value={tier.upTo} onChange={(upTo) => update({ upTo })} />
                  )}
                  <NumberField aria-label={`Bậc ${index + 1} giá`} placeholder="Giá" suffix="đ" decimals={2} value={tier.price} onChange={(value) => update({ price: value })} />
                  <Button
                    variant="ghost"
                    iconOnly
                    icon={Trash2}
                    disabled={price.tiers.length <= 1}
                    onClick={() => setTiers(price.tiers.filter((_, i) => i !== index))}
                  >
                    Xóa bậc {index + 1}
                  </Button>
                </div>
              )
            })}
            {price.tiers.length < MAX_TIERS && (
              <div>
                <Button size="sm" variant="secondary" icon={Plus} onClick={() => setTiers([...price.tiers.slice(0, -1), { upTo: null, price: null }, price.tiers.at(-1)])}>
                  Thêm bậc
                </Button>
              </div>
            )}
          </div>
        </Field>
      )}
      <TextField label="Ghi chú" maxLength={300} className="span-full" placeholder="VD Tăng theo giá điện lực" {...form.field(`${path}note`)} />
    </>
  )
}
