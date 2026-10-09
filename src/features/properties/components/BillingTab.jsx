import { useQuery } from '@tanstack/react-query'
import { propertiesApi, queryKeys } from '@/api'
import { Alert, Button, DataTable, DescriptionList, FormSection, NumberField, Section, Spinner, useToast } from '@/components/ui'
import { CHARGE_MODE_LABELS, PRORATION_MODE_LABELS } from '@/constants/enums'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useInvalidate } from '@/hooks/useAction'
import { useForm } from '@/hooks/useForm'
import { getErrorMessage } from '@/lib/http/ApiError'
import { addDays, addMonths, formatDate, formatMoney, todayVN } from '@/lib/format'
import { ANCHOR_DAY_MAX, inRange, validateBilling } from '../propertyForm'
import { BillingFields } from './BillingFields'

const MUTED = { color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }

// Kỳ chuẩn của tháng thu chứa hôm nay — để minh họa "tháng 11 = 05/11–04/12".
function samplePeriod(anchorDay) {
  if (!inRange(anchorDay, 1, ANCHOR_DAY_MAX)) return null
  const [y, m, d] = todayVN().split('-').map(Number)
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
  const start = addDays(d >= anchorDay ? monthStart : addMonths(monthStart, -1), anchorDay - 1)
  const [sy, sm] = start.split('-').map(Number)
  return { month: `${sm}/${sy}`, start, end: addDays(addMonths(start, 1), -1) }
}

function signedDays(n) {
  if (!n) return '± 0 ngày'
  return `${n > 0 ? '+' : '−'} ${Math.abs(n)} ngày`
}

function anchorLabel(anchorDay) {
  const sample = samplePeriod(anchorDay)
  if (!sample) return `Ngày ${anchorDay}`
  return `Ngày ${anchorDay} (VD tháng ${sample.month}: ${formatDate(sample.start)} – ${formatDate(sample.end)})`
}

const CHANGE_COLUMNS = [
  { key: 'from', header: 'Áp dụng từ', primary: true, cell: (c) => formatDate(c.effectiveFrom) },
  { key: 'transition', header: 'Kỳ chuyển tiếp', cell: (c) => `${formatDate(c.effectiveFrom)} – ${formatDate(c.transitionEnd)}` },
  { key: 'anchor', header: 'Ngày chốt mới', cell: (c) => `Ngày ${c.anchorDay}` },
  { key: 'mode', header: 'Thu tiền phòng', cell: (c) => CHARGE_MODE_LABELS[c.chargeMode] },
  { key: 'deviation', header: 'Lệch so với 1 tháng', align: 'right', cell: (c) => signedDays(c.deviationDays) },
  { key: 'adjust', header: 'Tiền phòng kỳ đó', align: 'right', cell: (c) => `1 tháng ${signedDays(c.adjustDays)}` },
]

function currentForm(billing) {
  const { anchorDay, chargeMode, paymentDueDays, prorationMode, noticeDays } = billing
  return { anchorDay, chargeMode, paymentDueDays, prorationMode, noticeDays, adjustDays: null }
}

/** Số ngày điều chỉnh có dấu: kỳ ngắn hơn (deviation < 0) thì ô nhập là số ngày TRỪ. */
function adjustment(preview, adjustDays) {
  const deviation = preview?.deviationDays ?? 0
  const abs = adjustDays ?? Math.abs(preview?.suggestedAdjustDays ?? 0)
  return { deviation, abs, signed: deviation < 0 ? -abs : abs }
}

function TransitionDetails({ preview, adjust, onAdjust, error }) {
  const { deviation } = adjust
  const direction = deviation > 0 ? 'dư' : 'thiếu'
  const lengthText = deviation === 0 ? 'bằng đúng 1 kỳ cũ.' : `${direction} ${Math.abs(deviation)} ngày so với 1 kỳ cũ (${preview.baseDays} ngày).`
  return (
    <>
      <Alert tone="info">
        Kỳ chuyển tiếp{' '}
        <strong>
          {formatDate(preview.effectiveFrom)} – {formatDate(preview.transitionEnd)}
        </strong>{' '}
        ({preview.transitionDays} ngày) {lengthText} Kỳ này vẫn là tháng thu của ngày {formatDate(preview.effectiveFrom)}.
      </Alert>
      {deviation !== 0 && (
        <NumberField
          label={`Tiền phòng kỳ chuyển tiếp: 1 tháng ${deviation > 0 ? '+' : '−'} số ngày`}
          suffix="ngày"
          hint={`Gợi ý ${Math.abs(preview.suggestedAdjustDays)} ngày (lệch ≤ 3 ngày thì 0). Cho phép 0 – ${Math.abs(deviation)}.`}
          value={adjust.abs}
          onChange={(n) => onAdjust(n ?? 0)}
          error={error}
        />
      )}
      {deviation !== 0 && preview.rooms.length > 0 && (
        <DataTable
          rowKey={(r) => r.contractId}
          rows={preview.rooms}
          columns={[
            { key: 'room', header: 'Phòng', primary: true, cell: (r) => r.roomCode },
            { key: 'rent', header: 'Giá thuê', align: 'right', cell: (r) => formatMoney(r.monthlyRent) },
            { key: 'day', header: '1 ngày', align: 'right', cell: (r) => formatMoney(r.perDay) },
            { key: 'amount', header: 'Điều chỉnh', align: 'right', cell: (r) => formatMoney(Math.round(r.perDay * adjust.signed)) },
          ]}
        />
      )}
      <p style={MUTED}>
        Chỉ tiền phòng điều chỉnh; điện nước theo chỉ số thật; dịch vụ tính trọn tháng. Đổi lại khi kỳ chuyển tiếp chưa lập phiếu sẽ ghi đè lần
        đổi trước.
      </p>
    </>
  )
}

/** Xem trước khi đổi ngày chốt / thu trước–thu sau (GET /properties/{id}/billing/preview). */
function TransitionPreview({ query, adjust, onAdjust, error, toPrepaid }) {
  if (query.isError) return <Alert>{getErrorMessage(query.error)}</Alert>
  const preview = query.data
  if (!preview) return <Spinner />
  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
      {preview.hasDraftInvoices && <Alert>Khu còn phiếu nháp — chốt hoặc xóa phiếu nháp của khu trước khi đổi ngày chốt / cách thu.</Alert>}
      {preview.effectiveFrom ? (
        <TransitionDetails preview={preview} adjust={adjust} onAdjust={onAdjust} error={error} />
      ) : (
        <Alert tone="info">Khu chưa có phiếu — cài đặt mới áp dụng lại từ đầu, không có kỳ chuyển tiếp.</Alert>
      )}
      {toPrepaid && (
        <Alert tone="warning">
          Đổi thu sau → thu trước: phiếu thu trước đầu tiên khiến người thuê trả 2 tháng tiền phòng gần nhau — nên báo trước cho người thuê.
        </Alert>
      )}
    </div>
  )
}

/**
 * Tab Kỳ thu (docs/api/properties.md#cài-đặt-kỳ-thu--đổi-ngày-chốt): mọi HĐ của khu dùng chung.
 * Đổi ngày chốt / thu trước–thu sau khi khu đã có phiếu ⇒ có kỳ chuyển tiếp dài / ngắn hơn 1 tháng — xem trước rồi
 * chọn số ngày tiền phòng cộng / trừ.
 */
export function BillingTab({ property }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const billing = property.billing
  const form = useForm(currentForm(billing), {
    validate: validateBilling,
    codeFields: { TRANSITION_ADJUST_OUT_OF_RANGE: 'adjustDays' },
  })
  const v = form.values
  const scheduleChanged = v.anchorDay !== billing.anchorDay || v.chargeMode !== billing.chargeMode
  const changed = scheduleChanged || ['paymentDueDays', 'prorationMode', 'noticeDays'].some((k) => v[k] !== billing[k])

  const previewArgs = useDebouncedValue({ anchorDay: v.anchorDay, chargeMode: v.chargeMode }, 400)
  const preview = useQuery({
    queryKey: queryKeys.properties.billingPreview(property.id, previewArgs.anchorDay, previewArgs.chargeMode),
    queryFn: ({ signal }) => propertiesApi.billingPreview(property.id, previewArgs, { signal }),
    enabled: scheduleChanged && inRange(previewArgs.anchorDay, 1, ANCHOR_DAY_MAX),
  })
  const p = scheduleChanged ? preview.data : null
  const hasTransition = Boolean(p?.effectiveFrom)
  const adjust = adjustment(p, v.adjustDays)

  const submit = form.handleSubmit(async (values) => {
    if (hasTransition && adjust.abs > Math.abs(adjust.deviation)) {
      form.setErrors({ adjustDays: `Từ 0 đến ${Math.abs(adjust.deviation)} ngày.` })
      return
    }
    const { anchorDay, chargeMode, paymentDueDays, prorationMode, noticeDays } = values
    await propertiesApi.updateBilling(property.id, {
      anchorDay,
      chargeMode,
      paymentDueDays,
      prorationMode,
      noticeDays,
      transitionAdjustDays: hasTransition ? adjust.signed : null,
    })
    await invalidate(queryKeys.properties.detail(property.id), queryKeys.contracts.all)
    toast.success('Đã lưu cài đặt kỳ thu.')
  })

  const cannotSave = !changed || property.isArchived || Boolean(p?.hasDraftInvoices) || (scheduleChanged && !p)

  return (
    <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
      <Section title="Cài đặt hiện tại" description="Mọi phòng / hợp đồng của khu dùng chung — hợp đồng không chọn riêng.">
        <DescriptionList
          items={[
            { label: 'Ngày chốt kỳ thu', value: anchorLabel(billing.anchorDay) },
            { label: 'Thu tiền phòng', value: CHARGE_MODE_LABELS[billing.chargeMode] },
            { label: 'Hạn đóng sau ngày chốt', value: `${billing.paymentDueDays} ngày` },
            { label: 'Kỳ lẻ', value: PRORATION_MODE_LABELS[billing.prorationMode] },
            { label: 'Báo trước khi trả phòng (gợi ý)', value: `${billing.noticeDays} ngày` },
          ]}
        />
      </Section>

      {billing.changes?.length > 0 && (
        <Section
          title="Các lần đổi ngày chốt"
          description="Mỗi lần đổi khi khu đã có phiếu tạo một kỳ chuyển tiếp (vẫn là tháng thu của ngày áp dụng)."
          padded={false}
        >
          <DataTable columns={CHANGE_COLUMNS} rows={billing.changes} rowKey={(c) => c.effectiveFrom} />
        </Section>
      )}

      <Section title="Đổi cài đặt">
        <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {form.formError && <Alert>{form.formError}</Alert>}
          <BillingFields form={form} disabled={property.isArchived} />
          <p style={MUTED}>
            Hạn thanh toán, kỳ lẻ, số ngày báo trước áp dụng ngay (phiếu đã chốt giữ số tiền cũ). Đổi ngày chốt / thu trước–thu sau: xem trước kỳ
            chuyển tiếp bên dưới.
          </p>

          {scheduleChanged && (
            <FormSection title="Xem trước kỳ chuyển tiếp">
              <TransitionPreview
                query={preview}
                adjust={adjust}
                onAdjust={(n) => form.setValue('adjustDays', n)}
                error={form.errors.adjustDays}
                toPrepaid={billing.chargeMode === 'Postpaid' && v.chargeMode === 'Prepaid'}
              />
            </FormSection>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            {changed && (
              <Button variant="secondary" onClick={() => form.reset(currentForm(billing))} disabled={form.submitting}>
                Hoàn tác
              </Button>
            )}
            <Button type="submit" loading={form.submitting} disabled={cannotSave}>
              Lưu cài đặt kỳ thu
            </Button>
          </div>
        </form>
      </Section>
    </div>
  )
}
