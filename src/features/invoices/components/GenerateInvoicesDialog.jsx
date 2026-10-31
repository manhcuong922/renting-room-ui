import { useState } from 'react'
import { Link } from 'react-router'
import { invoicesApi, queryKeys } from '@/api'
import { Alert, Button, CheckboxField, CheckboxGroup, FormDialog, SelectField, TextField, useToast } from '@/components/ui'
import { INVOICE_SKIP_REASON_LABELS } from '@/constants/enums'
import { usePropertyOptions, usePropertyRooms } from '@/features/shared/queries'
import { useInvalidate } from '@/hooks/useAction'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { formatBillingMonth } from '@/lib/format'
import { BulkResultDialog } from './BulkResultDialog'
import { SkipUnbilledDialog } from './SkipUnbilledDialog'

const ALL = '__all__'
// errorCode của từng khu trong kết quả tạo phiếu nhiều khu (errors.md).
const PROPERTY_ERROR_LABELS = { PROPERTY_NOT_FOUND: 'Không tìm thấy khu', PROPERTY_ARCHIVED: 'Khu đã ngừng sử dụng' }

const skippedRows = (result, prefix = '', property = {}) =>
  result.skipped.map((s) => ({
    key: `${prefix}${s.contractId}`,
    label: `${prefix}${s.roomCode} — ${s.contractNo}`,
    ok: false,
    message: INVOICE_SKIP_REASON_LABELS[s.reason] ?? s.reason,
    reason: s.reason,
    // Hợp đồng thiếu phiếu kỳ trước (thu tay ngoài hệ thống?) — dùng cho hộp thoại "Bỏ qua các kỳ chưa lập".
    unbilled: s.reason === 'PREVIOUS_PERIOD_NOT_BILLED' && s.unbilledPeriods?.length
      ? { propertyId: property.id, propertyLabel: property.code, contractId: s.contractId, label: `${s.roomCode} — ${s.contractNo}`, periods: s.unbilledPeriods }
      : null,
  }))

/** Phạm vi trong một khu: cả khu, một tầng, hoặc vài phòng chọn (chỉ phòng đang có hợp đồng mới có phiếu). */
function ScopeFields({ propertyId, form }) {
  const rooms = usePropertyRooms(propertyId)
  const all = rooms.data ?? []
  const floors = [...new Set(all.map((r) => r.floor).filter(Boolean))].sort()
  const candidates = all.filter((r) => r.currentContract && (!form.values.floor || r.floor === form.values.floor))
  return (
    <>
      <SelectField
        label="Tầng"
        placeholder="Cả khu"
        options={floors.map((f) => ({ value: f, label: `Tầng ${f}` }))}
        {...form.field('floor')}
        onChange={(e) => {
          form.setValue('floor', e.target.value)
          form.setValue('roomIds', [])
        }}
      />
      {candidates.length > 0 && (
        <CheckboxGroup
          label={`Chỉ các phòng (bỏ trống = ${form.values.floor ? 'cả tầng' : 'cả khu'})`}
          options={candidates.map((r) => ({ value: r.id, label: r.code }))}
          value={form.values.roomIds}
          onChange={(roomIds) => form.setValue('roomIds', roomIds)}
        />
      )}
    </>
  )
}

/**
 * Tạo phiếu nháp theo tháng thu — một khu (lọc tầng) hoặc mọi khu đang dùng (invoices.md#tạo-phiếu-nháp).
 * Hợp đồng bị bỏ qua (đã có phiếu, chưa lập kỳ trước…) hiện lý do từng phòng.
 * `contract` ({ id, propertyId, contractNo, roomCode }): chỉ lập cho đúng hợp đồng đó (VD phòng vừa bổ sung chỉ số) — các hợp đồng khác không bị đụng tới.
 */
export function GenerateInvoicesDialog({ defaultPropertyId, defaultMonth, contract, onClose }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  const properties = usePropertyOptions()
  const [result, setResult] = useState(null)
  const [skipFor, setSkipFor] = useState(null) // { values, items } — đang hỏi "Bỏ qua các kỳ chưa lập"

  /** Gọi API tạo phiếu theo giá trị form; `skip` ⇒ bỏ qua các kỳ chưa lập (khoảng ngắt tính tiền). */
  const execute = async (v, skip) => {
    let created = 0
    let withIssues = 0
    let recalculated = 0
    let gapsCreated = 0
    let rows = []
    if (v.propertyId === ALL) {
      const body = { billingMonth: v.billingMonth, propertyIds: null, recalculateExistingDrafts: v.recalculateExistingDrafts, skipUnbilledPeriods: skip }
      const perProperty = await invoicesApi.generateBulk(body, { idempotencyKey: idem.keyFor(body) })
      for (const item of perProperty) {
        const code = item.propertyCode ?? '?'
        // Khu này lỗi không làm hỏng khu khác.
        if (!item.result) rows.push({ key: item.propertyId, label: `Khu ${code}`, ok: false, message: PROPERTY_ERROR_LABELS[item.errorCode] ?? `Không lập được (${item.errorCode})` })
        else {
          created += item.result.created
          withIssues += item.result.withIssues
          recalculated += item.result.recalculated
          gapsCreated += item.result.gapsCreated ?? 0
          rows = rows.concat(skippedRows(item.result, `${code} · `, { id: item.propertyId, code }))
        }
      }
    } else {
      const body = {
        propertyId: v.propertyId,
        billingMonth: v.billingMonth,
        roomIds: !contract && v.roomIds.length ? v.roomIds : null,
        floor: contract ? null : v.floor || null,
        contractId: contract?.id ?? null,
        recalculateExistingDrafts: v.recalculateExistingDrafts,
        skipUnbilledPeriods: skip,
      }
      const single = await invoicesApi.generate(body, { idempotencyKey: idem.keyFor(body) })
      created = single.created
      withIssues = single.withIssues
      recalculated = single.recalculated
      gapsCreated = single.gapsCreated ?? 0
      const property = (properties.data ?? []).find((p) => p.id === v.propertyId)
      rows = skippedRows(single, '', { id: v.propertyId, code: property?.code ?? '' })
    }
    idem.reset()
    await invalidate(queryKeys.invoices.all, queryKeys.rooms.all, queryKeys.contracts.all)
    return { created, withIssues, recalculated, gapsCreated, rows }
  }

  /** Hiện kết quả; trả true khi không có gì để báo (đóng hộp thoại). */
  const present = (v, o) => {
    const month = formatBillingMonth(v.billingMonth).toLowerCase()
    const { created, withIssues, recalculated, gapsCreated, rows } = o
    toast.success(`Đã tạo ${created} phiếu nháp ${month}${recalculated ? `, tính lại ${recalculated} nháp` : ''}${gapsCreated ? `, bỏ qua kỳ chưa lập của ${gapsCreated} hợp đồng` : ''}.`)
    if (withIssues > 0) toast.warning(`${withIssues} phiếu còn vấn đề chặn chốt (thiếu chỉ số, thiếu giá…).`, { duration: 10_000 })
    if (rows.length === 0 && withIssues === 0) return true
    const missingReadings = rows.filter((r) => r.reason === 'MISSING_READING').length
    const unbilled = rows.map((r) => r.unbilled).filter(Boolean)
    setResult({
      title: `Kết quả tạo phiếu ${month}`,
      summary: (
        <>
          <Alert tone={created > 0 ? 'info' : 'warning'}>
            Tạo được <strong>{created}</strong> phiếu nháp{recalculated ? `, tính lại ${recalculated} nháp đã có` : ''}
            {gapsCreated ? `, bỏ qua kỳ chưa lập của ${gapsCreated} hợp đồng` : ''}. {rows.length > 0 && `${rows.length} hợp đồng / khu bị bỏ qua.`}
          </Alert>
          {unbilled.length > 0 && (
            <Alert tone="warning">
              <strong>{unbilled.length}</strong> hợp đồng chưa có phiếu các kỳ trước. Nếu các kỳ đó đã thu ngoài hệ thống (thu tay) thì có thể bỏ qua để tạo phiếu {month}.{' '}
              <Button size="sm" variant="secondary" onClick={() => setSkipFor({ values: v, items: unbilled })}>
                Bỏ qua các kỳ chưa lập…
              </Button>
            </Alert>
          )}
          {missingReadings > 0 && (
            <Alert tone="warning">
              <strong>{missingReadings}</strong> phòng thiếu chỉ số nên chưa tạo nháp — nhập ở{' '}
              <Link to={`/meter-readings?${new URLSearchParams({ ...(v.propertyId !== ALL && { propertyId: v.propertyId }), billingMonth: v.billingMonth })}`} onClick={onClose}>
                Ghi chỉ số
              </Link>{' '}
              (lọc “Chưa nhập”) rồi tạo lại. Hợp đồng vừa bỏ qua kỳ chưa lập cần thêm chỉ số chốt tháng liền trước.
            </Alert>
          )}
          {withIssues > 0 && (
            <Alert tone="warning">
              <strong>{withIssues}</strong> phiếu còn vấn đề chặn chốt — lọc “Nháp” để xem nhãn “Cần sửa”; thiếu chỉ số thì vào Ghi chỉ số rồi Tính lại.
            </Alert>
          )}
        </>
      ),
      rows,
    })
    return false
  }

  if (skipFor)
    return (
      <SkipUnbilledDialog
        billingMonth={skipFor.values.billingMonth}
        items={skipFor.items}
        onClose={() => setSkipFor(null)}
        onConfirm={async () => {
          const outcome = await execute(skipFor.values, true)
          const values = skipFor.values
          setSkipFor(null)
          if (present(values, outcome)) onClose()
        }}
      />
    )
  if (result) return <BulkResultDialog {...result} onClose={onClose} />

  return (
    <FormDialog
      title={contract ? `Tạo phiếu cho hợp đồng ${contract.contractNo}` : 'Tạo phiếu tiền phòng'}
      description={contract ? `Chỉ lập phiếu nháp của phòng ${contract.roomCode}; các hợp đồng khác không bị đụng tới.` : 'Phiếu được tạo ở dạng nháp — xem lại, sửa nếu cần rồi mới chốt.'}
      initial={{ propertyId: contract?.propertyId ?? (defaultPropertyId || ALL), billingMonth: defaultMonth, floor: '', roomIds: [], recalculateExistingDrafts: false }}
      validate={(v) => ({ billingMonth: !/^\d{4}-\d{2}$/.test(v.billingMonth) ? 'Chọn tháng thu.' : null })}
      codeFields={{ INVALID_BILLING_MONTH: 'billingMonth', PROPERTY_NOT_FOUND: 'propertyId', PROPERTY_ARCHIVED: 'propertyId' }}
      submitLabel="Tạo phiếu nháp"
      onClose={onClose}
      onSubmit={async (v) => present(v, await execute(v, false))}
    >
      {(form) => (
        <>
          {!contract && (
            <SelectField
              label="Khu trọ"
              required
              options={[{ value: ALL, label: 'Mọi khu đang dùng' }, ...(properties.data ?? []).map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))]}
              {...form.field('propertyId')}
              onChange={(e) => {
                form.setValue('propertyId', e.target.value)
                form.setValue('floor', '')
                form.setValue('roomIds', [])
              }}
            />
          )}
          <TextField label="Tháng thu" type="month" required hint="Tối đa tháng sau" {...form.field('billingMonth')} />
          {!contract && form.values.propertyId !== ALL && <ScopeFields propertyId={form.values.propertyId} form={form} />}
          <CheckboxField
            label="Tính lại phiếu nháp đã có"
            description="Kỳ đã có phiếu nháp thì tính lại (giữ ô sửa tay) thay vì bỏ qua."
            {...form.field('recalculateExistingDrafts', { type: 'checkbox' })}
          />
        </>
      )}
    </FormDialog>
  )
}
