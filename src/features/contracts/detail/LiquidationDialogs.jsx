import { useState } from 'react'
import { contractsApi } from '@/api'
import {
  Alert,
  Badge,
  Button,
  DateField,
  DescriptionList,
  FormDialog,
  FormGrid,
  Modal,
  RadioGroup,
  Section,
  SelectField,
  TextAreaField,
  useToast,
} from '@/components/ui'
import { PAYMENT_METHOD_LABELS, TERMINATION_GROUND_LABELS, TERMINATION_REASON_LABELS, toOptions } from '@/constants/enums'
import { useRoomMeters } from '@/features/shared/queries'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { usePermission } from '@/features/auth/AuthContext'
import { Permission } from '@/features/auth/permissions'
import { getErrorMessage } from '@/lib/http/ApiError'
import { addDays, formatDate, formatMoney, todayVN } from '@/lib/format'
import { MeterReadingsFields } from './MeterReadingsFields'
import { initialReadings, readingErrorsFromApi, toReadingInputs, validateReadings } from './meterReadings'

const INVOICE_STATUS_LABELS = { Draft: 'Nháp', Finalized: 'Đã chốt', Void: 'Đã hủy' }

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
    else if (v.actualEndDate > addDays(todayVN(), maxDays)) actualEndDate = `Tối đa ${maxDays} ngày tới.`
    const noteRequired = v.ground === 'Other' || v.reason === 'Abandoned'
    return {
      actualEndDate,
      reason: v.reason === 'Expired' && !reasonOptions(c, v.actualEndDate).some((o) => o.value === 'Expired') ? 'Chỉ chọn “Hết hạn” khi trả phòng từ ngày hết hạn.' : null,
      note: noteRequired && !v.note.trim() ? 'Nhập ghi chú.' : null,
    }
  }
}

/**
 * Bắt đầu thanh lý (contracts.md#thanh-lý): ngày trả phòng được chọn trong quá khứ (người thuê đã đi), tới +60 ngày
 * (+90 với căn cứ HĐ không thời hạn). Căn cứ tùy chọn — nên chọn khi bên cho thuê đơn phương.
 */
export function StartLiquidationDialog({ contract: c, onClose, onDone }) {
  const defaultEnd = c.plannedMoveOutDate ?? todayVN()
  return (
    <FormDialog
      title="Bắt đầu thanh lý"
      description="Chốt ngày trả phòng → ghi tình trạng tài sản → lập phiếu quyết toán (chỉ số cuối) → hoàn tất từ ngày trả phòng."
      size="md"
      initial={{
        actualEndDate: defaultEnd,
        reason: c.endDate && defaultEnd >= c.endDate ? 'Expired' : 'LesseeUnilateral',
        ground: '',
        note: '',
      }}
      validate={validateStart(c)}
      codeFields={{
        EXPIRED_REASON_INVALID: 'reason',
        INDEFINITE_GROUND_ONLY: 'ground',
        ABANDONED_NOTE_REQUIRED: 'note',
        INVALID_END_DATE: 'actualEndDate',
        INVOICE_AFTER_END_DATE: 'actualEndDate',
      }}
      submitLabel="Bắt đầu thanh lý"
      onSubmit={async (v) => {
        await contractsApi.startLiquidation(c.id, {
          actualEndDate: v.actualEndDate,
          reason: v.reason,
          ground: v.reason === 'LessorUnilateral' ? v.ground || null : null,
          note: v.note.trim() || null,
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
            <DateField label="Ngày trả phòng thực tế" required hint="Được chọn ngày đã qua nếu người thuê đã đi" {...form.field('actualEndDate')} />
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
          </FormGrid>
        )
      }}
    </FormDialog>
  )
}

/**
 * Lập phiếu quyết toán (contracts.md#lập-phiếu-quyết-toán): nhập chỉ số cuối từng công tơ tại ngày trả phòng →
 * phiếu quyết toán NHÁP (sửa tay / phụ thu / chốt như phiếu thường).
 */
export function FinalInvoiceDialog({ contract: c, onClose, onDone }) {
  const toast = useToast()
  const idem = useIdempotencyKey()
  const meters = useRoomMeters(c.roomId)
  const meterList = meters.data ?? []
  const [readings, setReadings] = useState(null)
  const [readingErrors, setReadingErrors] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const current = readings ?? initialReadings(meterList, 'final')

  const submit = async () => {
    const clientErrors = validateReadings(meterList, current)
    setReadingErrors(clientErrors)
    if (Object.keys(clientErrors).length) return
    setBusy(true)
    setError(null)
    const body = { finalReadings: toReadingInputs(meterList, current) }
    try {
      const invoice = await contractsApi.createFinalInvoice(c.id, body, { idempotencyKey: idem.keyFor(body) })
      await onDone()
      toast.success(`Đã lập phiếu quyết toán nháp — ${formatMoney(invoice?.summary?.totalAmount)}.`)
      onClose()
    } catch (err) {
      setError(err)
      setReadingErrors(readingErrorsFromApi(err))
      if (err.code === 'METER_NOT_IN_ROOM') void meters.refetch()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Lập phiếu quyết toán"
      description={`Chỉ số cuối tại ngày trả phòng ${formatDate(c.actualEndDate)}. Phiếu chỉ thu phần còn thiếu (tiền phòng những ngày đã ở, dịch vụ, điện nước tới chỉ số cuối).`}
      size="md"
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button onClick={submit} loading={busy} disabled={meters.isPending}>
            Lập phiếu
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <MeterReadingsFields query={meters} kind="final" readings={current} onChange={setReadings} errors={readingErrors} />
        {error && <Alert>{getErrorMessage(error)}</Alert>}
      </div>
    </Modal>
  )
}

/** Tiến trình trả phòng khi đang thanh lý: tài sản → phiếu quyết toán (đã chốt) → hoàn tất. */
export function LiquidationPanel({ contract: c, finalInvoice, onCreateFinalInvoice }) {
  const invoice = finalInvoice.data
  let invoiceValue = 'Đang tải…'
  if (finalInvoice.isError) invoiceValue = 'Không tải được phiếu.'
  else if (finalInvoice.isSuccess && !invoice) invoiceValue = 'Chưa lập'
  else if (invoice)
    invoiceValue = (
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <Badge tone={invoice.status === 'Finalized' ? 'success' : 'neutral'}>{INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}</Badge>
        {invoice.invoiceNo} · {formatMoney(invoice.totalAmount)}
        {invoice.status === 'Finalized' && invoice.outstanding > 0 && ` · còn nợ ${formatMoney(invoice.outstanding)}`}
      </span>
    )

  return (
    <Section
      title="Trả phòng"
      description={`Ngày trả phòng ${formatDate(c.actualEndDate)}. Hoàn tất cần phiếu quyết toán đã chốt, không còn phiếu nháp.`}
      actions={
        finalInvoice.isSuccess &&
        !invoice && (
          <Button size="sm" onClick={onCreateFinalInvoice}>
            Lập phiếu quyết toán
          </Button>
        )
      }
    >
      <DescriptionList
        items={[
          { label: '1. Tình trạng tài sản', value: 'Ghi ở tab “Tài sản”' },
          { label: '2. Phiếu quyết toán', value: invoiceValue },
          {
            label: '3. Hoàn tất',
            value: todayVN() >= c.actualEndDate ? 'Được hoàn tất khi phiếu quyết toán đã chốt' : `Được hoàn tất từ ${formatDate(c.actualEndDate)}`,
          },
        ]}
      />
      {invoice?.status === 'Draft' && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Alert tone="info">Phiếu quyết toán đang là nháp — rà soát, sửa tay / thêm phụ thu rồi chốt phiếu ở màn Phiếu tiền phòng.</Alert>
        </div>
      )}
    </Section>
  )
}

/**
 * Hoàn tất thanh lý (contracts.md#hoàn-tất). Còn nợ ⇒ 422 CONTRACT_HAS_DEBT (outstanding) → chọn "Đã thu toàn bộ" (ghi 1 phiếu thu đúng số
 * còn nợ) hoặc "Bỏ nợ" (không tính doanh thu, bắt buộc lý do). Còn phiếu Chờ hoàn ⇒ REFUND_PENDING.
 */
export function CompleteLiquidationDialog({ contract: c, onClose, onDone }) {
  const toast = useToast()
  const [step, setStep] = useState('confirm') // 'confirm' | 'debt'
  const [debt, setDebt] = useState(null)
  const [settlement, setSettlement] = useState({ mode: 'CollectAll', method: 'Cash', paidAt: todayVN(), reason: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [reasonError, setReasonError] = useState(null)
  const canWriteOff = usePermission(Permission.DebtWriteOff)

  const complete = async (body) => {
    setBusy(true)
    setError(null)
    try {
      await contractsApi.completeLiquidation(c.id, body)
      await onDone()
      toast.success('Đã hoàn tất thanh lý — hợp đồng kết thúc.')
      onClose()
    } catch (err) {
      if (err.code === 'CONTRACT_HAS_DEBT') {
        setDebt(err.extensions?.outstanding ?? null)
        setStep('debt')
      } else setError(err)
    } finally {
      setBusy(false)
    }
  }

  const submit = () => {
    if (step === 'confirm') return complete(null)
    if (settlement.mode === 'WriteOff' && !settlement.reason.trim()) {
      setReasonError('Nhập lý do bỏ nợ.')
      return undefined
    }
    setReasonError(null)
    return complete(
      settlement.mode === 'CollectAll'
        ? { settlement: 'CollectAll', method: settlement.method, paidAt: settlement.paidAt || null, reason: null }
        : { settlement: 'WriteOff', method: null, paidAt: null, reason: settlement.reason.trim() },
    )
  }
  const set = (changes) => setSettlement((s) => ({ ...s, ...changes }))

  return (
    <Modal
      open
      onClose={onClose}
      title={step === 'debt' ? 'Hợp đồng còn nợ' : 'Hoàn tất thanh lý?'}
      size="sm"
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button onClick={submit} loading={busy} variant={step === 'debt' && settlement.mode === 'WriteOff' ? 'danger' : 'primary'}>
            {step === 'debt' && settlement.mode === 'WriteOff' ? 'Bỏ nợ và hoàn tất' : 'Hoàn tất'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        {step === 'confirm' ? (
          <p style={{ color: 'var(--color-text-muted)' }}>
            Hợp đồng kết thúc; người ở và xe còn lại tự kết thúc tại ngày trả phòng {formatDate(c.actualEndDate)}. Phòng thành “Trống” từ hôm sau.
          </p>
        ) : (
          <>
            <Alert tone="warning">Hợp đồng còn nợ {debt != null ? formatMoney(debt) : ''} trên các phiếu đã chốt.</Alert>
            {canWriteOff ? (
              <RadioGroup
                options={[
                  { value: 'CollectAll', label: 'Đã thu toàn bộ' },
                  { value: 'WriteOff', label: 'Bỏ nợ' },
                ]}
                value={settlement.mode}
                onChange={(mode) => set({ mode })}
              />
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Bỏ nợ chỉ chủ trọ thực hiện được.</p>
            )}
            {settlement.mode === 'CollectAll' ? (
              <FormGrid>
                <SelectField label="Hình thức" options={toOptions(PAYMENT_METHOD_LABELS)} value={settlement.method} onChange={(e) => set({ method: e.target.value })} />
                <DateField label="Ngày thu" value={settlement.paidAt} onChange={(e) => set({ paidAt: e.target.value })} />
              </FormGrid>
            ) : (
              <TextAreaField
                label="Lý do bỏ nợ"
                required
                rows={2}
                hint="Người thuê trốn / không đòi được — không tính doanh thu."
                value={settlement.reason}
                error={reasonError}
                onChange={(e) => set({ reason: e.target.value })}
              />
            )}
          </>
        )}
        {error && (
          <Alert>
            {getErrorMessage(error)}
            {error.code === 'REFUND_PENDING' && ` Còn phải trả lại người thuê ${formatMoney(error.extensions?.refundDue)} — xác nhận đã hoàn trên phiếu trước.`}
          </Alert>
        )}
      </div>
    </Modal>
  )
}
