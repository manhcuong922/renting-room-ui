import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { contractsApi, queryKeys, roomChargesApi } from '@/api'
import {
  Alert,
  Badge,
  Button,
  CheckboxField,
  ConfirmDialog,
  DateField,
  DescriptionList,
  FormDialog,
  FormGrid,
  FormSection,
  Modal,
  MoneyField,
  RadioGroup,
  Section,
  SelectField,
  Spinner,
  TextAreaField,
  useToast,
} from '@/components/ui'
import {
  DEPOSIT_STATUS,
  FINAL_PERIOD_CHARGE_LABELS,
  LIQUIDATION_BLOCKER_LABELS,
  PAYMENT_METHOD_LABELS,
  TERMINATION_GROUND_LABELS,
  TERMINATION_REASON_LABELS,
  toOptions,
} from '@/constants/enums'
import { useCanWriteOff } from '@/features/auth/AuthContext'
import { GenerateInvoicesDialog } from '@/features/invoices/components/GenerateInvoicesDialog'
import { useRoomMeters } from '@/features/shared/queries'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { getErrorMessage } from '@/lib/http/ApiError'
import { describeUnbilled } from '@/features/invoices/invoiceRules'
import { addDays, formatDate, formatMoney, todayVN } from '@/lib/format'
import { useLiquidationPreview } from '../hooks'
import { MeterReadingsFields } from './MeterReadingsFields'
import { initialReadings, readingErrorsFromApi, toReadingInputs, validateReadings } from './meterReadings'

const INVOICE_STATUS_LABELS = { Draft: 'Nháp', Finalized: 'Đã chốt', Void: 'Đã hủy' }
const METHOD_OPTIONS = toOptions(PAYMENT_METHOD_LABELS)
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const listStyle = { margin: 'var(--space-1) 0 0', paddingLeft: 'var(--space-5)', display: 'grid', gap: 4 }
const rowStyle = { display: 'inline-flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }

/** Lý do chấm dứt hợp lệ: "Hết hạn" chỉ khi HĐ có thời hạn và ngày trả phòng ≥ ngày hết hạn. */
function reasonOptions(c, actualEndDate) {
  const expiredAllowed = Boolean(c.endDate) && Boolean(actualEndDate) && actualEndDate >= c.endDate
  return toOptions(TERMINATION_REASON_LABELS).filter((o) => o.value !== 'Expired' || expiredAllowed)
}

/** Căn cứ khi bên cho thuê đơn phương: "Thông báo chấm dứt HĐ không thời hạn" chỉ cho HĐ không thời hạn. */
function groundOptions(c) {
  return toOptions(TERMINATION_GROUND_LABELS).filter((o) => o.value !== 'IndefiniteTermNotice' || !c.endDate)
}

function validateStart(c) {
  return (v) => {
    const maxDays = v.ground === 'IndefiniteTermNotice' ? 90 : 60
    let actualEndDate = null
    if (!v.actualEndDate) actualEndDate = 'Chọn ngày trả phòng.'
    else if (v.actualEndDate < c.startDate) actualEndDate = 'Không trước ngày bắt đầu.'
    else if (c.roomSince && v.actualEndDate < c.roomSince) actualEndDate = `Không trước ngày chuyển sang phòng hiện tại (${formatDate(c.roomSince)}).`
    else if (v.actualEndDate > addDays(todayVN(), maxDays)) actualEndDate = `Tối đa ${maxDays} ngày tới.`
    const noteRequired = v.ground === 'Other' || v.reason === 'Abandoned'
    return {
      actualEndDate,
      reason: v.reason === 'Expired' && !reasonOptions(c, v.actualEndDate).some((o) => o.value === 'Expired') ? 'Chỉ chọn “Hết hạn” khi trả phòng từ ngày hết hạn.' : null,
      note: noteRequired && !v.note.trim() ? 'Nhập ghi chú.' : null,
    }
  }
}

/** "Kỳ cuối 01/02–15/02 (15/28 ngày)" */
function finalPeriodText(fp) {
  if (!fp) return null
  return `${formatDate(fp.start)} – ${formatDate(fp.end)} (${fp.days}/${fp.periodDays} ngày)`
}

/** 3 lựa chọn kỳ cuối kèm số tiền phòng + dịch vụ của từng cách (finalPeriodOptions của xem trước). */
function FinalPeriodChoice({ preview, value, onChange, disabled }) {
  const amounts = Object.fromEntries((preview?.finalPeriodOptions ?? []).map((o) => [o.charge, o.rent + o.services]))
  const options = Object.entries(FINAL_PERIOD_CHARGE_LABELS).map(([charge, label]) => ({
    value: charge,
    label: amounts[charge] !== undefined ? `${label} · ${formatMoney(amounts[charge])}` : label,
  }))
  if (disabled) return <span>{options.find((o) => o.value === value)?.label ?? value}</span>
  return <RadioGroup label="Tiền phòng + dịch vụ kỳ cuối" options={options} value={value} onChange={onChange} />
}

/** Kỳ đã qua chưa chốt hóa đơn + hóa đơn tháng lập cho kỳ có / sau ngày trả phòng — cảnh báo kèm cách xử lý. */
function BillingWarnings({ preview: p, onTreatAsEndedAt, onGenerate }) {
  if (!p) return null
  return (
    <>
      {p.unbilledPeriods?.length > 0 && (
        <Alert tone="warning">
          <strong>Kỳ đã qua chưa chốt hóa đơn:</strong>
          <ul style={listStyle}>
            {p.unbilledPeriods.map((period) => (
              <li key={period.start}>
                <span style={rowStyle}>
                  {formatDate(period.start)} – {formatDate(period.end)}
                  {onGenerate && (
                    <Button size="sm" variant="secondary" onClick={() => onGenerate(period)}>
                      Tạo hóa đơn
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <span style={{ ...rowStyle, marginTop: 'var(--space-2)' }}>
            Người thuê có ở thì tạo hóa đơn lần lượt từng kỳ. Thực ra đã đi từ trước
            {p.lastBilledEnd && onTreatAsEndedAt && (
              <Button size="sm" variant="secondary" onClick={() => onTreatAsEndedAt(p.lastBilledEnd)}>
                Coi như trả phòng từ {formatDate(p.lastBilledEnd)}
              </Button>
            )}
          </span>
        </Alert>
      )}
      {p.invoicesFromEndDate?.length > 0 && (
        <Alert tone={p.invoicesFromEndDate.some((i) => i.mustCancel) ? 'danger' : 'warning'}>
          <strong>Hóa đơn tháng đã lập cho kỳ có / sau ngày trả phòng:</strong>
          <ul style={listStyle}>
            {p.invoicesFromEndDate.map((i) => (
              <li key={i.invoiceId}>
                <span style={rowStyle}>
                  <Link to={`/invoices/${i.invoiceId}`}>{i.invoiceNo ?? 'Nháp'}</Link>
                  {formatDate(i.periodStart)} – {formatDate(i.periodEnd)} · {formatMoney(i.totalAmount)}
                  {i.paidAmount > 0 ? ` · đã thu ${formatMoney(i.paidAmount)}` : ''}
                  {i.mustCancel && <Badge tone="danger">Phải {i.status === 'Draft' ? 'xóa' : 'hủy'} trước</Badge>}
                </span>
              </li>
            ))}
          </ul>
          Chưa thu thì mở hóa đơn để {p.invoicesFromEndDate.every((i) => i.status === 'Draft') ? 'xóa' : 'hủy'} — hóa đơn trả phòng sẽ tính lại theo lựa chọn kỳ cuối. Nháp kỳ sau ngày trả
          phòng tự xóa khi bắt đầu thanh lý. Đã thu mà không bắt buộc hủy (khu thu trước) ⇒ hóa đơn trả phòng gợi ý hoàn trả phần thừa.
        </Alert>
      )}
    </>
  )
}

/** Xem trước khi bắt đầu thanh lý theo ngày đang chọn: kỳ cuối + số tiền 3 cách, cảnh báo hóa đơn. */
function StartPreview({ contract: c, form }) {
  const date = form.values.actualEndDate
  const preview = useLiquidationPreview(c.id, { enabled: ISO_DATE.test(date ?? ''), actualEndDate: date })
  const p = preview.data
  if (preview.isPending) return <Spinner />
  if (preview.isError) return <Alert tone="warning">Không xem trước được số tiền kỳ cuối — vẫn bắt đầu thanh lý được.</Alert>
  return (
    <>
      {p.finalPeriod && (
        <FormSection title={`Kỳ cuối ${finalPeriodText(p.finalPeriod)}`} description="Tiền phòng + dịch vụ của kỳ chứa ngày trả phòng. Điện nước luôn theo công tơ.">
          <FinalPeriodChoice preview={p} value={form.values.finalPeriodCharge} onChange={(value) => form.setValue('finalPeriodCharge', value)} />
        </FormSection>
      )}
      <BillingWarnings preview={p} onTreatAsEndedAt={(end) => form.setValue('actualEndDate', end)} />
    </>
  )
}

/**
 * Bắt đầu thanh lý (contracts.md#thanh-lý): ngày cuối người thuê còn ở — chọn được ngày đã qua (người thuê đã đi), tới +60 ngày
 * (+90 với căn cứ HĐ không thời hạn), không trước ngày chuyển sang phòng hiện tại. Kỳ cuối mặc định "Thu trọn kỳ".
 */
export function StartLiquidationDialog({ contract: c, onClose, onDone }) {
  const defaultEnd = c.plannedMoveOutDate ?? todayVN()
  return (
    <FormDialog
      title="Thanh lý — trả phòng"
      description="Chốt ngày trả phòng và cách thu kỳ cuối → ghi tình trạng tài sản → lập hóa đơn trả phòng (chỉ số cuối) nếu cần → hoàn tất."
      size="md"
      initial={{
        actualEndDate: defaultEnd,
        reason: c.endDate && defaultEnd >= c.endDate ? 'Expired' : 'LesseeUnilateral',
        ground: '',
        note: '',
        finalPeriodCharge: 'FullPeriod',
      }}
      validate={validateStart(c)}
      codeFields={{
        EXPIRED_REASON_INVALID: 'reason',
        INDEFINITE_GROUND_ONLY: 'ground',
        ABANDONED_NOTE_REQUIRED: 'note',
        INVALID_END_DATE: 'actualEndDate',
        INVOICE_AFTER_END_DATE: 'actualEndDate',
        END_DATE_BEFORE_ROOM_TRANSFER: 'actualEndDate',
      }}
      submitLabel="Bắt đầu thanh lý"
      onSubmit={async (v) => {
        await contractsApi.startLiquidation(c.id, {
          actualEndDate: v.actualEndDate,
          reason: v.reason,
          ground: v.reason === 'LessorUnilateral' ? v.ground || null : null,
          note: v.note.trim() || null,
          finalPeriodCharge: v.finalPeriodCharge,
        })
        await onDone('Đã chuyển sang thanh lý.')
      }}
      onClose={onClose}
    >
      {(form) => {
        const v = form.values
        const abandoned = v.reason === 'Abandoned'
        return (
          <FormGrid>
            <DateField label="Ở đến hết ngày" required hint="Ngày cuối người thuê còn ở — được chọn ngày đã qua" {...form.field('actualEndDate')} />
            <SelectField label="Lý do chấm dứt" options={reasonOptions(c, v.actualEndDate)} {...form.field('reason')} />
            {v.reason === 'LessorUnilateral' && (
              <SelectField
                label={c.endDate ? 'Căn cứ (Luật Nhà ở 2023, Điều 172)' : 'Căn cứ (Luật Nhà ở 2023, Điều 171–172)'}
                placeholder="Nên chọn…"
                className="span-full"
                options={groundOptions(c)}
                {...form.field('ground')}
              />
            )}
            <TextAreaField
              label="Ghi chú"
              rows={abandoned ? 4 : 2}
              maxLength={1000}
              className="span-full"
              required={v.ground === 'Other' || abandoned}
              placeholder={abandoned ? 'Ngày phát hiện, đồ để lại, người chứng kiến…' : undefined}
              {...form.field('note')}
            />
            <div className="span-full" style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <StartPreview contract={c} form={form} />
            </div>
          </FormGrid>
        )
      }}
    </FormDialog>
  )
}

/**
 * Lập hóa đơn trả phòng (contracts.md#lập-hóa-đơn-trả-phòng): nhập chỉ số cuối từng công tơ tại ngày trả phòng → hóa đơn trả phòng NHÁP
 * (sửa tay / phụ thu / chốt như phiếu thường). Không bắt buộc (`required = false`) ⇒ điền sẵn chỉ số cuối = số chốt kỳ.
 */
export function FinalInvoiceDialog({ contract: c, required = true, onClose, onDone }) {
  const toast = useToast()
  const idem = useIdempotencyKey()
  const meters = useRoomMeters(c.roomId)
  const meterList = meters.data ?? []
  const [readings, setReadings] = useState(null)
  const [readingErrors, setReadingErrors] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  // Kỳ trước kỳ cuối chưa lập (thu tay ngoài hệ thống?) — server trả PREVIOUS_PERIOD_NOT_BILLED kèm unbilledPeriods; chủ trọ xác nhận bỏ qua.
  const [unbilled, setUnbilled] = useState(null)
  const [skip, setSkip] = useState(false)
  const current = readings ?? initialReadings(meterList, 'final', { prefillLatest: !required })

  const submit = async () => {
    const clientErrors = validateReadings(meterList, current)
    setReadingErrors(clientErrors)
    if (Object.keys(clientErrors).length) return
    setBusy(true)
    setError(null)
    const body = { finalReadings: toReadingInputs(meterList, current), skipUnbilledPeriods: skip }
    try {
      const invoice = await contractsApi.createFinalInvoice(c.id, body, { idempotencyKey: idem.keyFor(body) })
      await onDone()
      toast.success(`Đã lập hóa đơn trả phòng nháp — ${formatMoney(invoice?.summary?.totalAmount)}.`)
      onClose()
    } catch (err) {
      if (err.code === 'PREVIOUS_PERIOD_NOT_BILLED' && Array.isArray(err.extensions?.unbilledPeriods) && err.extensions.unbilledPeriods.length) {
        setUnbilled(err.extensions.unbilledPeriods)
        setError(null)
      } else {
        setError(err)
        toast.error(getErrorMessage(err))
        setReadingErrors(readingErrorsFromApi(err))
        if (err.code === 'METER_NOT_IN_ROOM') void meters.refetch()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Lập hóa đơn trả phòng"
      description={
        required
          ? `Chỉ số cuối tại ngày trả phòng ${formatDate(c.actualEndDate)}. Hóa đơn chỉ thu phần còn thiếu (tiền phòng + dịch vụ kỳ cuối theo lựa chọn, điện nước tới chỉ số cuối).`
          : `Không bắt buộc — tiền phòng, dịch vụ, điện nước đã tính hết. Lập để ghi bồi thường / phụ thu thành hóa đơn; chỉ số cuối điền sẵn bằng số chốt kỳ.`
      }
      size="md"
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button onClick={submit} loading={busy} disabled={meters.isPending}>
            Lập hóa đơn
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <MeterReadingsFields query={meters} kind="final" readings={current} onChange={setReadings} errors={readingErrors} />
        {unbilled && (
          <Alert tone="warning">
            <strong>Chưa lập phiếu các kỳ trước kỳ cuối:</strong> {describeUnbilled(unbilled)}. Nếu đã thu tay ngoài hệ thống thì bỏ qua các kỳ này; chỉ số đầu của đoạn cuối là chỉ số
            chốt kỳ liền trước (nhập ở Ghi chỉ số trước khi lập).
            <CheckboxField label="Các kỳ trên đã thu ngoài hệ thống — bỏ qua" checked={skip} onChange={(e) => setSkip(e.target.checked)} />
          </Alert>
        )}
        {error && <Alert>{getErrorMessage(error)}</Alert>}
      </div>
    </Modal>
  )
}

/** Hủy một khoản phát sinh sau ngày trả phòng (thường từ nháp kỳ ảo bị xóa) — hệ thống không tự hủy. */
function PendingChargesList({ preview: p, onCancel }) {
  const afterEnd = new Set(p.pendingChargeIdsAfterEndDate ?? [])
  return (
    <ul style={listStyle}>
      {p.pendingCharges.map((charge) => (
        <li key={charge.id}>
          <span style={rowStyle}>
            {charge.description} {charge.kind === 'Credit' ? '−' : ''}
            {formatMoney(charge.amount)}
            {afterEnd.has(charge.id) && (
              <>
                <Badge tone="warning">Phát sinh sau ngày trả phòng</Badge>
                {!charge.isSystem && (
                  <Button size="sm" variant="ghost" onClick={() => onCancel(charge)}>
                    Hủy
                  </Button>
                )}
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Màn thanh lý khi đang thanh lý (contracts.md#xem-trước): một lần gọi dựng cả màn — kỳ cuối (đổi được khi hóa đơn trả phòng chưa chốt),
 * kỳ chưa chốt hóa đơn, hóa đơn từ ngày trả phòng, hóa đơn trả phòng, nợ, cần trả lại, khoản chưa xử lý, cọc, việc còn chặn Hoàn tất.
 */
export function LiquidationPanel({ contract: c, preview, onCreateFinalInvoice, onCompleteExternally }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [changing, setChanging] = useState(null)
  const [generateFor, setGenerateFor] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const p = preview.data
  const refreshPreview = () => queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all })

  const changeFinalPeriod = async (charge) => {
    setChanging(charge)
    try {
      await contractsApi.setFinalPeriodCharge(c.id, charge)
      await Promise.all([refreshPreview(), queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })])
      toast.success(`Kỳ cuối: ${FINAL_PERIOD_CHARGE_LABELS[charge]}${p.finalInvoiceId ? ' — hóa đơn trả phòng nháp đã tính lại.' : '.'}`)
    } catch (error) {
      toast.error(getErrorMessage(error))
      void refreshPreview()
    } finally {
      setChanging(null)
    }
  }

  let invoiceValue = 'Đang tải…'
  if (preview.isError) invoiceValue = 'Không tải được.'
  else if (p && !p.finalInvoiceId) invoiceValue = p.finalInvoiceRequired ? 'Chưa lập' : 'Không cần — tiền phòng, dịch vụ, điện nước đã tính hết'
  else if (p)
    invoiceValue = (
      <span style={rowStyle}>
        <Badge tone={p.finalInvoiceStatus === 'Finalized' ? 'success' : 'neutral'}>{INVOICE_STATUS_LABELS[p.finalInvoiceStatus] ?? p.finalInvoiceStatus}</Badge>
        <Link to={`/invoices/${p.finalInvoiceId}`}>Mở hóa đơn trả phòng</Link>
      </span>
    )
  const finalLocked = p?.finalInvoiceStatus === 'Finalized'

  return (
    <Section
      title="Trả phòng"
      description={`Ở đến hết ngày ${formatDate(c.actualEndDate)}.`}
      actions={
        p &&
        !p.finalInvoiceId && (
          <span style={rowStyle}>
            <Button size="sm" variant={p.finalInvoiceRequired ? 'primary' : 'secondary'} onClick={() => onCreateFinalInvoice(p.finalInvoiceRequired)}>
              Lập hóa đơn trả phòng
            </Button>
            {onCompleteExternally && !p.blockers.includes('LIQUIDATION_BEFORE_END_DATE') && (
              <Button size="sm" variant="secondary" onClick={onCompleteExternally} title="Đã thu tay đến ngày đi — không lập hóa đơn trả phòng">
                Đã xử lý ngoài hệ thống…
              </Button>
            )}
          </span>
        )
      }
    >
      <DescriptionList
        items={[
          {
            label: p?.finalPeriod ? `Kỳ cuối ${finalPeriodText(p.finalPeriod)}` : 'Kỳ cuối',
            hidden: !p?.finalPeriod,
            full: true,
            value: p && (
              <span style={{ display: 'grid', gap: 4 }}>
                <FinalPeriodChoice preview={p} value={p.finalPeriodCharge ?? 'FullPeriod'} onChange={changeFinalPeriod} disabled={finalLocked || Boolean(changing)} />
                {finalLocked && <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Hóa đơn trả phòng đã chốt — muốn đổi thì hủy hóa đơn đó trước.</span>}
              </span>
            ),
          },
          { label: '1. Tình trạng tài sản', value: 'Ghi ở tab “Tài sản” (bồi thường: thêm phụ thu trên hóa đơn trả phòng)' },
          { label: '2. Hóa đơn trả phòng', value: invoiceValue },
          { label: 'Còn nợ', hidden: !p?.needsDebtDecision, value: p ? `${formatMoney(p.outstanding)} — khi hoàn tất chọn “Thu toàn bộ” hoặc “Bỏ nợ”` : null },
          { label: 'Cần trả lại người thuê', hidden: !p?.needsRefundDecision, value: p ? `${formatMoney(p.refundDue)} — khi hoàn tất tích “Đã trả”` : null },
          {
            label: `Khoản chưa xử lý (${p?.pendingCharges?.length ?? 0})`,
            hidden: !p?.needsChargesDecision,
            full: true,
            value: p?.needsChargesDecision && <PendingChargesList preview={p} onCancel={setCancelling} />,
          },
          {
            label: 'Tiền cọc',
            hidden: !p?.deposit?.status,
            value: p?.deposit?.status ? `${formatMoney(p.deposit.amount)} — ${DEPOSIT_STATUS[p.deposit.status]?.label ?? p.deposit.status} (không chặn hoàn tất)` : null,
          },
        ]}
      />
      {p && (
        <div style={{ marginTop: 'var(--space-3)', display: 'grid', gap: 'var(--space-3)' }}>
          <BillingWarnings preview={p} onGenerate={(period) => setGenerateFor(period)} />
          {p.canComplete ? (
            <Alert tone="info">Đã đủ điều kiện — bấm “Hoàn tất thanh lý” và chọn cách xử lý nợ, tiền trả lại, khoản chưa xử lý, cọc trong một lần.</Alert>
          ) : (
            <Alert tone="warning">
              <strong>Còn phải làm trước khi hoàn tất:</strong>
              <ul style={listStyle}>
                {p.blockers.map((code) => (
                  <li key={code}>{code === 'LIQUIDATION_BEFORE_END_DATE' ? `Chưa tới ngày trả phòng (${formatDate(c.actualEndDate)})` : (LIQUIDATION_BLOCKER_LABELS[code] ?? code)}</li>
                ))}
              </ul>
            </Alert>
          )}
        </div>
      )}
      {generateFor && (
        <GenerateInvoicesDialog
          contract={c}
          defaultMonth={generateFor.start.slice(0, 7)}
          onClose={() => {
            setGenerateFor(null)
            void refreshPreview()
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title="Hủy khoản phát sinh?"
        message={cancelling ? `"${cancelling.description}" ${formatMoney(cancelling.amount)} phát sinh sau ngày trả phòng sẽ bị hủy.` : ''}
        reasonLabel="Lý do hủy"
        reasonMaxLength={300}
        confirmLabel="Hủy khoản"
        tone="danger"
        onConfirm={async (reason) => {
          await roomChargesApi.cancel(cancelling.id, reason)
          await Promise.all([refreshPreview(), queryClient.invalidateQueries({ queryKey: queryKeys.roomCharges.all })])
          toast.success('Đã hủy khoản phát sinh.')
        }}
      />
    </Section>
  )
}

function initialDecisions(c, p) {
  const today = todayVN()
  return {
    settlement: 'CollectAll',
    method: 'Cash',
    paidAt: today,
    reason: '',
    refundConfirmed: false,
    refundedOn: today,
    refundMethod: 'Cash',
    chargesConfirmed: false,
    chargesMethod: 'Cash',
    depositAction: 'Later',
    depositAmount: p?.deposit?.amount ?? c.deposit?.amount ?? 0,
    depositDate: today,
    depositNote: '',
    externalNote: '',
  }
}

function validateDecisions(p, depositAmount, external) {
  return (v) => ({
    externalNote: external && !v.externalNote.trim() ? 'Ghi đã thu bằng cách nào, đến ngày nào.' : null,
    reason: p?.needsDebtDecision && v.settlement === 'WriteOff' && !v.reason.trim() ? 'Nhập lý do bỏ nợ.' : null,
    refundConfirmed: p?.needsRefundDecision && !v.refundConfirmed ? 'Trả lại người thuê rồi tích “Đã trả” để hoàn tất.' : null,
    refundedOn: p?.needsRefundDecision && v.refundedOn > todayVN() ? 'Ngày không ở tương lai.' : null,
    chargesConfirmed: p?.needsChargesDecision && !v.chargesConfirmed ? 'Xác nhận đã trả / thu tay các khoản này (hoặc hủy khoản phát sinh sau ngày trả phòng).' : null,
    depositAmount:
      v.depositAction === 'Refund' && v.depositAmount !== null && (v.depositAmount < 0 || v.depositAmount > depositAmount) ? `Từ 0 đến ${formatMoney(depositAmount)}.` : null,
    depositNote:
      (v.depositAction === 'Forfeit' && !v.depositNote.trim()) || (v.depositAction === 'Refund' && v.depositAmount !== null && v.depositAmount < depositAmount && !v.depositNote.trim())
        ? 'Ghi lý do.'
        : null,
    depositDate: v.depositAction !== 'Later' && v.depositDate > todayVN() ? 'Ngày không ở tương lai.' : null,
  })
}

/** Body hoàn tất: chỉ gửi mục đang cần quyết (contracts.md#hoàn-tất). */
function completeBody(p, v, depositAmount, external) {
  const body = { settlement: null, method: null, paidAt: null, reason: null, refund: null, pendingCharges: null, deposit: null, externalSettlement: null }
  if (external) body.externalSettlement = { note: v.externalNote.trim() }
  if (p?.needsDebtDecision) {
    if (v.settlement === 'CollectAll') Object.assign(body, { settlement: 'CollectAll', method: v.method, paidAt: v.paidAt || null })
    else Object.assign(body, { settlement: 'WriteOff', reason: v.reason.trim() })
  }
  if (p?.needsRefundDecision) body.refund = { refundedOn: v.refundedOn || null, method: v.refundMethod }
  if (p?.needsChargesDecision) body.pendingCharges = { method: v.chargesMethod }
  if (v.depositAction === 'Refund')
    body.deposit = { action: 'Refund', amount: v.depositAmount === depositAmount ? null : v.depositAmount, date: v.depositDate || null, note: v.depositNote.trim() || null }
  else if (v.depositAction === 'Forfeit') body.deposit = { action: 'Forfeit', amount: null, date: v.depositDate || null, note: v.depositNote.trim() }
  return body
}

/**
 * Hoàn tất thanh lý — một lần bấm (contracts.md#hoàn-tất): gửi kèm mọi quyết định của màn thanh lý.
 * Còn nợ ⇒ Thu toàn bộ / Bỏ nợ · Cần trả lại ⇒ "Đã trả" · Khoản chưa xử lý ⇒ đã trả / thu tay · Cọc ⇒ Trả / Không trả / Để sau.
 * Lỗi ở bất kỳ mục nào ⇒ server không lưu gì; xem trước đã cũ (REFUND_PENDING, PENDING_CHARGES, CONTRACT_HAS_DEBT) ⇒ tải lại.
 */
export function CompleteLiquidationDialog({ contract: c, preview: p, external = false, onClose, onDone }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const canWriteOff = useCanWriteOff()
  const depositAmount = p?.deposit?.amount ?? c.deposit?.amount ?? 0
  const depositOpen = (p?.deposit?.status ?? c.deposit?.status) === 'Holding' && depositAmount > 0

  return (
    <FormDialog
      title={external ? 'Hoàn tất thanh lý — đã xử lý ngoài hệ thống' : 'Hoàn tất thanh lý'}
      description={`Hợp đồng kết thúc; người ở và xe còn lại tự kết thúc tại ngày trả phòng ${formatDate(c.actualEndDate)}. Phòng thành “Trống” từ hôm sau.`}
      size="md"
      initial={initialDecisions(c, p)}
      validate={validateDecisions(p, depositAmount, external)}
      codeFields={{ EXTERNAL_NOTE_REQUIRED: 'externalNote', INVALID_REFUND_AMOUNT: 'depositAmount', REQUIRED: 'depositNote', INVALID_REFUND_DATE: 'refundedOn', INVALID_PAID_AT: 'paidAt' }}
      submitLabel="Hoàn tất"
      onClose={onClose}
      onSubmit={async (v, form) => {
        try {
          await contractsApi.completeLiquidation(c.id, completeBody(p, v, depositAmount, external))
        } catch (error) {
          // Xem trước đã cũ: có thêm mục cần quyết ⇒ tải lại để hiện đúng lựa chọn.
          if (['REFUND_PENDING', 'PENDING_CHARGES', 'CONTRACT_HAS_DEBT'].includes(error.code)) {
            await queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all })
            toast.error(`${getErrorMessage(error)} Đã tải lại màn thanh lý — mở lại “Hoàn tất” để chọn.`)
            form.setFormError(null)
            onClose()
            return false
          }
          throw error
        }
        await onDone()
        toast.success('Đã hoàn tất thanh lý — hợp đồng kết thúc.')
      }}
    >
      {(form) => {
        const v = form.values
        return (
          <>
            {external && (
              <FormSection
                title="Kỳ trả phòng đã xử lý ngoài hệ thống"
                description="Không lập hóa đơn trả phòng, không cần chỉ số cuối. Các phiếu nháp còn sót bị xóa; các kỳ chưa có phiếu đến hết ngày trả phòng ghi là đã thu ngoài. Nợ phiếu đã chốt, cọc, khoản chưa xử lý vẫn chọn bên dưới."
              >
                <TextAreaField label="Ghi chú" required rows={2} maxLength={500} placeholder="VD Đã thu tay đến ngày đi, sổ giấy khu A" {...form.field('externalNote')} />
              </FormSection>
            )}
            {p?.needsDebtDecision && (
              <FormSection title={`Còn nợ ${formatMoney(p.outstanding)}`} description="Trên các hóa đơn đã chốt chưa thu đủ.">
                {canWriteOff ? (
                  <RadioGroup
                    options={[
                      { value: 'CollectAll', label: 'Thu toàn bộ' },
                      { value: 'WriteOff', label: 'Bỏ nợ' },
                    ]}
                    value={v.settlement}
                    onChange={(settlement) => form.setValue('settlement', settlement)}
                  />
                ) : (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Bạn chưa được cấp quyền bỏ nợ — chỉ chọn được “Thu toàn bộ”.</p>
                )}
                {v.settlement === 'CollectAll' ? (
                  <FormGrid>
                    <SelectField label="Hình thức" options={METHOD_OPTIONS} {...form.field('method')} />
                    <DateField label="Ngày thu" {...form.field('paidAt')} />
                  </FormGrid>
                ) : (
                  <TextAreaField label="Lý do bỏ nợ" required rows={2} hint="Người thuê trốn / không đòi được — không tính doanh thu." {...form.field('reason')} />
                )}
              </FormSection>
            )}
            {p?.needsRefundDecision && (
              <FormSection title={`Cần trả lại người thuê ${formatMoney(p.refundDue)}`} description="Mọi hóa đơn Chờ hoàn của hợp đồng được xác nhận đã hoàn.">
                <CheckboxField label="Đã trả" {...form.field('refundConfirmed', { type: 'checkbox' })} />
                {v.refundConfirmed && (
                  <FormGrid>
                    <DateField label="Ngày trả" {...form.field('refundedOn')} />
                    <SelectField label="Cách trả" options={METHOD_OPTIONS} {...form.field('refundMethod')} />
                  </FormGrid>
                )}
              </FormSection>
            )}
            {p?.needsChargesDecision && (
              <FormSection title={`Khoản chưa xử lý (${p.pendingCharges.length})`} description="Chưa vào hóa đơn nào — VD phát sinh sau khi chốt hóa đơn trả phòng.">
                <ul style={listStyle}>
                  {p.pendingCharges.map((charge) => (
                    <li key={charge.id}>
                      {charge.description}: {charge.kind === 'Credit' ? 'trả người thuê' : 'thu'} {formatMoney(charge.amount)}
                    </li>
                  ))}
                </ul>
                <CheckboxField label="Coi như đã trả / thu tay vào ngày hoàn tất" {...form.field('chargesConfirmed', { type: 'checkbox' })} />
                {v.chargesConfirmed && <SelectField label="Hình thức" options={METHOD_OPTIONS} {...form.field('chargesMethod')} />}
              </FormSection>
            )}
            {depositOpen && (
              <FormSection title={`Cọc ${formatMoney(depositAmount)}`} description="Không chặn hoàn tất — “Để sau” thì hợp đồng hiện nhắc “Chưa hoàn cọc”.">
                <RadioGroup
                  options={[
                    { value: 'Refund', label: 'Trả cọc' },
                    { value: 'Forfeit', label: 'Không trả cọc' },
                    { value: 'Later', label: 'Để sau' },
                  ]}
                  value={v.depositAction}
                  onChange={(action) => form.setValue('depositAction', action)}
                />
                {v.depositAction !== 'Later' && (
                  <FormGrid>
                    {v.depositAction === 'Refund' && <MoneyField label="Số tiền trả lại" hint="Ít hơn cọc thì ghi lý do" {...form.field('depositAmount', { type: 'value' })} />}
                    <DateField label="Ngày" {...form.field('depositDate')} />
                    <TextAreaField
                      label="Lý do"
                      className="span-full"
                      rows={2}
                      maxLength={500}
                      required={v.depositAction === 'Forfeit'}
                      placeholder={v.depositAction === 'Forfeit' ? 'VD Trả phòng trước hạn, mất cọc theo HĐ' : 'VD Giữ lại 500.000đ sửa tường'}
                      {...form.field('depositNote')}
                    />
                  </FormGrid>
                )}
              </FormSection>
            )}
            {!p?.needsDebtDecision && !p?.needsRefundDecision && !p?.needsChargesDecision && !depositOpen && (
              <p style={{ color: 'var(--color-text-muted)' }}>Không còn nợ, tiền phải trả lại hay khoản chưa xử lý.</p>
            )}
          </>
        )
      }}
    </FormDialog>
  )
}
