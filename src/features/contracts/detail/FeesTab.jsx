import { Pencil, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { contractsApi } from '@/api'
import {
  Alert,
  Badge,
  Button,
  DataTable,
  EmptyState,
  FormDialog,
  FormGrid,
  MoneyField,
  NumberField,
  RadioGroup,
  Section,
  SelectField,
  Spinner,
} from '@/components/ui'
import { CHARGE_BASIS_LABELS, FEE_GROUP_LABELS } from '@/constants/enums'
import { usePropertyFees } from '@/features/shared/queries'
import { formatBillingMonth, formatDate, formatMoney, todayVN } from '@/lib/format'
import { useBillingPeriods } from '../hooks'

const PERIOD_CODE_FIELDS = {
  NOT_PERIOD_START: 'effectiveFrom',
  PERIOD_ALREADY_BILLED: 'effectiveFrom',
  DATE_OUTSIDE_CONTRACT: 'effectiveFrom',
  INVALID_QUANTITY: 'quantity',
}

const basisLabel = (f) => (f.group === 'Metered' ? FEE_GROUP_LABELS.Metered : (CHARGE_BASIS_LABELS[f.chargeBasis] ?? ''))
const unitPrice = (price, unit) => (price === null || price === undefined ? null : `${formatMoney(price)}/${unit}`)

/** "Từ kỳ chưa lập phiếu đầu tiên" (mặc định — sửa trực tiếp) hoặc hẹn từ đầu một kỳ thu. */
function EffectiveFromFields({ form, contractId }) {
  const periods = useBillingPeriods(contractId)
  const today = todayVN()
  const options = (periods.data ?? [])
    .filter((p) => p.end >= today)
    .map((p) => ({ value: p.start, label: `${formatDate(p.start)} (${formatBillingMonth(p.billingMonth)})` }))
  return (
    <>
      <RadioGroup
        label="Áp dụng"
        className="span-full"
        options={[
          { value: 'next', label: 'Từ kỳ chưa lập phiếu' },
          { value: 'scheduled', label: 'Hẹn từ kỳ…' },
        ]}
        value={form.values.timing}
        onChange={(t) => form.setValue('timing', t)}
      />
      {form.values.timing === 'scheduled' &&
        (periods.isPending ? (
          <Spinner />
        ) : (
          <SelectField label="Từ kỳ" required placeholder="Chọn kỳ thu…" className="span-full" options={options} {...form.field('effectiveFrom')} />
        ))}
    </>
  )
}

const validateTiming = (v) => (v.timing === 'scheduled' && !v.effectiveFrom ? 'Chọn kỳ áp dụng.' : null)

/** Gắn thêm / đổi số gói, giá riêng — PUT /contracts/{id}/fees/{feeTypeId}. Bản cũ kết thúc ngày trước kỳ áp dụng. */
function FeeDialog({ contract: c, fee, candidates, onClose, onDone }) {
  const adding = !fee
  return (
    <FormDialog
      title={adding ? 'Gắn thêm khoản thu' : `Đổi “${fee.name}”`}
      description="Đổi từ đầu một kỳ thu — kỳ đã lập phiếu giữ nguyên."
      size="md"
      initial={{
        feeTypeId: fee?.feeTypeId ?? '',
        quantity: fee?.chargeBasis === 'PerUnit' ? fee.quantity : null,
        customPrice: fee?.unitPriceOverride != null,
        unitPriceOverride: fee?.unitPriceOverride ?? null,
        timing: 'next',
        effectiveFrom: '',
      }}
      validate={(v) => ({
        feeTypeId: !v.feeTypeId ? 'Chọn khoản thu.' : null,
        unitPriceOverride: v.customPrice && v.unitPriceOverride === null ? 'Nhập giá riêng.' : null,
        effectiveFrom: validateTiming(v),
      })}
      codeFields={PERIOD_CODE_FIELDS}
      submitLabel={adding ? 'Gắn khoản thu' : 'Lưu thay đổi'}
      onSubmit={async (v) => {
        const target = fee ?? candidates.find((f) => f.id === v.feeTypeId)
        await contractsApi.changeFee(c.id, v.feeTypeId, {
          quantity: target?.chargeBasis === 'PerUnit' ? (v.quantity ?? target.defaultQuantity ?? 1) : null,
          unitPriceOverride: v.customPrice ? v.unitPriceOverride : null,
          effectiveFrom: v.timing === 'scheduled' ? v.effectiveFrom : null,
        })
        await onDone(adding ? 'Đã gắn khoản thu.' : 'Đã đổi khoản thu.')
      }}
      onClose={onClose}
    >
      {(form) => {
        const v = form.values
        const target = fee ?? candidates.find((f) => f.id === v.feeTypeId)
        const perUnit = (target?.chargeBasis ?? fee?.chargeBasis) === 'PerUnit'
        return (
          <FormGrid>
            {adding && (
              <SelectField
                label="Khoản thu"
                required
                placeholder="Chọn…"
                className="span-full"
                options={candidates.map((f) => ({ value: f.id, label: `${f.name} · ${CHARGE_BASIS_LABELS[f.chargeBasis] ?? ''}` }))}
                {...form.field('feeTypeId')}
              />
            )}
            {perUnit && <NumberField label="Số gói" decimals={2} suffix={target?.unit} {...form.field('quantity', { type: 'value' })} />}
            <RadioGroup
              label="Đơn giá"
              options={[
                { value: 'table', label: 'Theo bảng giá của khu' },
                { value: 'custom', label: 'Giá riêng' },
              ]}
              value={v.customPrice ? 'custom' : 'table'}
              onChange={(mode) => form.setValue('customPrice', mode === 'custom')}
            />
            {v.customPrice && <MoneyField label="Giá riêng" suffix={`đ/${target?.unit ?? ''}`} {...form.field('unitPriceOverride', { type: 'value' })} />}
            <EffectiveFromFields form={form} contractId={c.id} />
          </FormGrid>
        )
      }}
    </FormDialog>
  )
}

/** Thôi tính khoản thu — DELETE /contracts/{id}/fees/{feeTypeId}?effectiveFrom= */
function RemoveFeeDialog({ contract: c, fee, onClose, onDone }) {
  return (
    <FormDialog
      title={`Thôi tính “${fee.name}”?`}
      description="Thôi tính từ đầu một kỳ thu — kỳ đã lập phiếu giữ nguyên."
      size="md"
      tone="danger"
      initial={{ timing: 'next', effectiveFrom: '' }}
      validate={(v) => ({ effectiveFrom: validateTiming(v) })}
      codeFields={PERIOD_CODE_FIELDS}
      submitLabel="Thôi tính"
      onSubmit={async (v) => {
        await contractsApi.removeFee(c.id, fee.feeTypeId, v.timing === 'scheduled' ? v.effectiveFrom : undefined)
        await onDone('Đã thôi tính khoản thu.')
      }}
      onClose={onClose}
    >
      {(form) => (
        <FormGrid>
          <EffectiveFromFields form={form} contractId={c.id} />
        </FormGrid>
      )}
    </FormDialog>
  )
}

/**
 * Tab Khoản thu của HĐ (contracts.md#khoản-thu-của-hợp-đồng):
 * - utilityPrices: đơn giá điện nước dịch vụ theo thỏa thuận lúc ký (chụp khi kích hoạt; nháp tính theo hiện tại).
 * - fees: khoản cố định / theo số lượng đang áp (effectiveTo null) + lịch sử. HĐ đang hiệu lực đổi từ đầu một kỳ thu.
 */
export function FeesTab({ contract: c, actions, onDone }) {
  const [dialog, setDialog] = useState(null) // { type: 'add' | 'edit' | 'remove', fee }
  const propertyFees = usePropertyFees(actions.changeFees ? c.propertyId : null)
  const fees = c.fees ?? []
  const current = fees.filter((f) => !f.effectiveTo)
  const history = fees.filter((f) => f.effectiveTo)
  const attached = new Set(current.map((f) => f.feeTypeId))
  const candidates = (propertyFees.data ?? []).filter((f) => f.group === 'Service' && !f.isArchived && !attached.has(f.id))
  const draft = c.status === 'Draft'

  const utilityColumns = [
    { key: 'name', header: 'Khoản', primary: true, cell: (u) => u.name },
    { key: 'basis', header: 'Cách tính', cell: basisLabel },
    { key: 'qty', header: 'Số lượng', cell: (u) => (u.chargeBasis === 'PerUnit' ? `${u.quantity} ${u.unit}` : '—') },
    {
      key: 'price',
      header: 'Đơn giá',
      align: 'right',
      cell: (u) => (
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          {unitPrice(u.unitPrice, u.unit) ?? <Badge tone="danger">Chưa có giá</Badge>}
          {u.isOverride && <Badge>Giá riêng</Badge>}
        </span>
      ),
    },
  ]

  const feeColumns = (withActions) => [
    { key: 'name', header: 'Khoản', primary: true, cell: (f) => f.name },
    { key: 'basis', header: 'Cách tính', cell: basisLabel },
    { key: 'qty', header: 'Số lượng', cell: (f) => (f.chargeBasis === 'PerUnit' ? `${f.quantity} ${f.unit}` : '—') },
    {
      key: 'price',
      header: 'Đơn giá',
      align: 'right',
      cell: (f) => (
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          {unitPrice(f.currentUnitPrice, f.unit) ?? <Badge tone="danger">Chưa có giá</Badge>}
          {f.unitPriceOverride != null && <Badge>Giá riêng</Badge>}
        </span>
      ),
    },
    { key: 'range', header: 'Thời gian', cell: (f) => `${formatDate(f.effectiveFrom)} → ${f.effectiveTo ? formatDate(f.effectiveTo) : 'nay'}` },
    ...(withActions
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right',
            cell: (f) => (
              <span style={{ display: 'inline-flex', gap: 4 }}>
                <Button size="sm" variant="ghost" iconOnly icon={Pencil} onClick={() => setDialog({ type: 'edit', fee: f })}>
                  Đổi
                </Button>
                <Button size="sm" variant="ghost" iconOnly icon={X} onClick={() => setDialog({ type: 'remove', fee: f })}>
                  Thôi tính
                </Button>
              </span>
            ),
          },
        ]
      : []),
  ]

  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      <Section
        title="Điện nước, dịch vụ theo thỏa thuận"
        description={
          draft
            ? 'Bản nháp tính theo giá hiện tại — sẽ chụp lại khi kích hoạt.'
            : 'Chụp lúc ký — đổi giá của khu sau đó không đổi hợp đồng đã ký. Điện, nước theo công tơ của phòng.'
        }
      >
        {c.utilityPrices?.length ? (
          <DataTable columns={utilityColumns} rows={c.utilityPrices} rowKey={(u) => u.feeTypeId} caption="Đơn giá theo thỏa thuận" />
        ) : (
          <EmptyState title="Chưa có khoản nào" />
        )}
      </Section>

      <Section
        title="Khoản thu đang áp dụng"
        description={draft ? 'Sửa ở “Sửa nháp” → bước Khoản thu.' : 'Đổi số gói / giá riêng / thôi tính từ đầu một kỳ thu.'}
        actions={
          actions.changeFees && (
            <Button size="sm" icon={Plus} onClick={() => setDialog({ type: 'add' })} disabled={propertyFees.isPending || candidates.length === 0}>
              Gắn thêm
            </Button>
          )
        }
      >
        {current.length ? (
          <DataTable columns={feeColumns(actions.changeFees)} rows={current} caption="Khoản thu đang áp dụng" />
        ) : (
          <EmptyState title="Không có khoản thu cố định / theo số lượng" />
        )}
      </Section>

      {history.length > 0 && (
        <Section title="Lịch sử khoản thu" description="Các bản đã kết thúc — dùng để tính lại kỳ cũ.">
          <DataTable columns={feeColumns(false)} rows={history} caption="Lịch sử khoản thu" />
        </Section>
      )}

      {c.warnings?.some((w) => w.code === 'PARKING_QUANTITY_MISMATCH') && (
        <Alert tone="warning">{c.warnings.find((w) => w.code === 'PARKING_QUANTITY_MISMATCH').message}</Alert>
      )}

      {(dialog?.type === 'add' || dialog?.type === 'edit') && (
        <FeeDialog contract={c} fee={dialog.fee} candidates={candidates} onClose={() => setDialog(null)} onDone={onDone} />
      )}
      {dialog?.type === 'remove' && <RemoveFeeDialog contract={c} fee={dialog.fee} onClose={() => setDialog(null)} onDone={onDone} />}
    </div>
  )
}
