import { useEffect } from 'react'
import { Alert, Badge, Button, CheckboxField, EmptyState, MoneyField, NumberField, Spinner } from '@/components/ui'
import { CHARGE_BASIS_LABELS } from '@/constants/enums'
import { usePropertyFees } from '@/features/shared/queries'
import { autoAttachedFees, formatFeePrice } from '../feeRules'
import styles from './Wizard.module.css'

function FeeRow({ fee, selected, error, onToggle, onChange }) {
  const perUnit = fee.chargeBasis === 'PerUnit'
  const price = formatFeePrice(fee.currentPrice, fee.unit)
  return (
    <li className={styles.occupant}>
      <div className={styles.occupantHead}>
        <CheckboxField
          label={fee.name}
          description={`${CHARGE_BASIS_LABELS[fee.chargeBasis] ?? ''}${price ? ` · ${price}` : ''}`}
          checked={Boolean(selected)}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span className={styles.badges}>
          {!fee.currentPrice && <Badge tone="danger">Chưa có giá</Badge>}
          {fee.vehicleType && <Badge>Phí giữ xe</Badge>}
        </span>
      </div>
      {selected && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
          {perUnit && (
            <NumberField
              label="Số gói"
              decimals={2}
              suffix={fee.unit}
              value={selected.quantity}
              onChange={(n) => onChange({ quantity: n })}
              error={error}
            />
          )}
          {selected.unitPriceOverride === null ? (
            <Button variant="ghost" size="sm" onClick={() => onChange({ unitPriceOverride: fee.currentPrice?.unitPrice ?? 0 })}>
              Giá riêng cho phòng này
            </Button>
          ) : (
            <>
              <MoneyField
                label="Giá riêng"
                suffix={`đ/${fee.unit}`}
                hint="Thay bảng giá của khu cho riêng hợp đồng này"
                value={selected.unitPriceOverride}
                onChange={(n) => onChange({ unitPriceOverride: n ?? 0 })}
              />
              <Button variant="ghost" size="sm" onClick={() => onChange({ unitPriceOverride: null })}>
                Theo bảng giá
              </Button>
            </>
          )}
        </div>
      )}
    </li>
  )
}

/**
 * Bước Khoản thu (contracts.md#khoản-thu-của-hợp-đồng): checkbox các khoản cố định / theo số lượng của khu (bỏ điện nước
 * theo công tơ), tích sẵn khoản "tự gắn"; dịch vụ theo số gói có ô số gói; nút giá riêng.
 * Điện, nước theo công tơ đi theo phòng — chỉ hiện dòng đọc.
 */
export function FeesStep({ form, propertyId }) {
  const v = form.values
  const { setValue } = form
  const query = usePropertyFees(propertyId)
  const feeTypes = query.data ?? []
  const metered = feeTypes.filter((f) => f.group === 'Metered')
  const services = feeTypes.filter((f) => f.group === 'Service')

  // Lần đầu vào bước (HĐ mới): tích sẵn các khoản "tự gắn" của khu.
  useEffect(() => {
    if (v.fees === null && query.data) setValue('fees', autoAttachedFees(query.data))
  }, [v.fees, query.data, setValue])

  if (!propertyId) return <Alert tone="info">Chọn phòng trước.</Alert>
  if (query.isPending) return <Spinner />
  if (query.isError) return <Alert>Không tải được danh mục khoản thu của khu.</Alert>

  const selected = new Map((v.fees ?? []).map((f) => [f.feeTypeId, f]))
  const setFees = (next) => form.setValue('fees', next)
  const toggle = (fee, checked) =>
    setFees(
      checked
        ? [...(v.fees ?? []), { feeTypeId: fee.id, quantity: fee.chargeBasis === 'PerUnit' ? (fee.defaultQuantity ?? 1) : null, unitPriceOverride: null }]
        : (v.fees ?? []).filter((f) => f.feeTypeId !== fee.id),
    )
  const update = (fee, changes) => setFees((v.fees ?? []).map((f) => (f.feeTypeId === fee.id ? { ...f, ...changes } : f)))

  const meteredText = metered.length
    ? metered.map((f) => `${f.name} ${formatFeePrice(f.currentPrice, f.unit) ?? '(chưa có giá)'}`).join(' · ')
    : 'khu chưa có khoản điện nước theo công tơ'

  return (
    <div className={styles.stack} style={{ marginTop: 0 }}>
      <Alert tone="info">Điện, nước theo công tơ của phòng — giá hiện tại: {meteredText}. Không cần gắn vào hợp đồng.</Alert>
      {services.length === 0 ? (
        <EmptyState title="Khu chưa có dịch vụ nào" description="Thêm dịch vụ (rác, mạng, giữ xe…) ở danh mục khoản thu của khu." />
      ) : (
        <ul className={styles.occupants}>
          {services.map((fee) => (
            <FeeRow
              key={fee.id}
              fee={fee}
              selected={selected.get(fee.id)}
              error={form.errors[`fee.${fee.id}.quantity`]}
              onToggle={(checked) => toggle(fee, checked)}
              onChange={(changes) => update(fee, changes)}
            />
          ))}
        </ul>
      )}
      {form.errors.fees && <Alert>{form.errors.fees}</Alert>}
      <p className={styles.muted}>
        Giá dịch vụ theo bảng giá của khu tại từng kỳ (trừ khi đặt giá riêng). Sau khi kích hoạt, đổi khoản thu ở tab “Khoản thu” của hợp đồng.
      </p>
    </div>
  )
}
