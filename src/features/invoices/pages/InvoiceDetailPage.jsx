import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, CheckCheck, HandCoins, Pencil, Plus, RefreshCw, RotateCcw, Send, Trash2, Undo2 } from 'lucide-react'
import { Fragment, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { invoicesApi, queryKeys } from '@/api'
import { Alert, Badge, Button, CheckboxField, ConfirmDialog, DataTable, DescriptionList, EmptyState, FormDialog, PageHeader, QueryView, Section, TextAreaField, useToast } from '@/components/ui'
import { ADJUSTMENT_HANDLING_LABELS, FINAL_PERIOD_CHARGE_LABELS, INVOICE_TYPE_LABELS, PAYMENT_METHOD_LABELS } from '@/constants/enums'
import { formatBillingMonth, formatDate, formatDateTime, formatDayMonth, formatMoney } from '@/lib/format'
import { getErrorMessage } from '@/lib/http/ApiError'
import { AuditLogList } from '@/features/audit/components/AuditLogList'
import { Can } from '@/features/auth/access'
import { useCanWriteOff } from '@/features/auth/AuthContext'
import { Permission } from '@/features/auth/permissions'
import { formatReading } from '@/features/meters/meterRules'
import { ContractBalanceDialog } from '@/features/payments/components/ContractBalanceDialog'
import { PayAndWriteOffDialog, RecordPaymentDialog, WriteOffDialog } from '@/features/payments/components/PaymentDialogs'
import { PaymentHistory } from '@/features/payments/components/PaymentHistory'
import { InvoiceBadges } from '../components/InvoiceBadges'
import { AddLineDialog, ConfirmRefundDialog, EditLineDialog } from '../components/LineDialogs'
import { canFinalize, canVoid, groupLines, hasSettlement, invoiceAmount, invoiceTitle, isCarried, isDraft, isFinalized, settlementLines } from '../invoiceRules'
import styles from './InvoiceDetailPage.module.css'

const numberFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })

/**
 * Đoạn đo của dòng điện nước (invoices.md — segments): từ 2 đoạn (chuyển phòng / thay công tơ) ⇒ mỗi đoạn một hàng
 * "Phòng 203 (E-101): 01/10 1.200 → 20/10 1.260 = 60"; 1 đoạn ⇒ chỉ "chỉ số cũ → mới".
 */
function SegmentRows({ segments, unit }) {
  if (!segments?.length) return null
  const suffix = unit ? ` ${unit}` : ''
  if (segments.length === 1) {
    const s = segments[0]
    return (
      <div className={styles.sub}>
        Chỉ số {formatReading(s.startValue)} → {formatReading(s.endValue)} = {formatReading(s.consumption)}
        {suffix}
      </div>
    )
  }
  return segments.map((s) => {
    const where = `${s.roomCode ? `Phòng ${s.roomCode}` : 'Công tơ'}${s.meterSerial ? ` (${s.meterSerial})` : ''}`
    const from = `${s.startDate ? `${formatDayMonth(s.startDate)} ` : ''}${formatReading(s.startValue)}`
    const to = `${s.endDate ? `${formatDayMonth(s.endDate)} ` : ''}${formatReading(s.endValue)}`
    return (
      <div key={s.endReadingId} className={styles.sub}>
        {`${where}: ${from} → ${to} = ${formatReading(s.consumption)}${suffix}`}
      </div>
    )
  })
}

/** "Bảng giá áp dụng" của dòng do hệ thống tính (lines[].price, 20/10/2026): bản giá của khu / giá riêng HĐ, giá bậc chia theo sản lượng. */
function PriceApplied({ price, unit }) {
  if (!price) return null
  const source = price.source === 'ContractOverride' ? 'Giá riêng của hợp đồng' : `Bảng giá${price.effectiveFrom ? ` từ ${formatDate(price.effectiveFrom)}` : ''}`
  if (!price.tiers?.length) return <div className={styles.sub}>{`${source}: ${formatMoney(price.unitPrice)}${unit ? `/${unit}` : ''}`}</div>
  const tiers = price.tiers.map(
    (t) => `${formatReading(t.from)}–${t.upTo === null ? '…' : formatReading(t.upTo)}${unit ? ` ${unit}` : ''}: ${formatReading(t.quantity)} × ${formatMoney(t.unitPrice)} = ${formatMoney(t.amount)}`,
  )
  return <div className={styles.sub}>{`${source}: ${tiers.join('; ')}`}</div>
}

/** Lịch sử điều chỉnh chỉ số đã chốt của hóa đơn (GET /invoices/{id}/adjustments) — mới nhất trước. */
function AdjustmentHistory({ invoice }) {
  const id = invoice.summary.id
  const query = useQuery({ queryKey: queryKeys.invoices.adjustments(id), queryFn: ({ signal }) => invoicesApi.adjustments(id, { signal }) })
  const feeNames = Object.fromEntries(invoice.lines.filter((l) => l.feeTypeId).map((l) => [l.feeTypeId, l.description]))
  const columns = [
    { key: 'at', header: 'Lúc', primary: true, cell: (a) => formatDateTime(a.createdAt) },
    { key: 'fee', header: 'Khoản', cell: (a) => feeNames[a.feeTypeId] ?? '—' },
    { key: 'value', header: 'Chỉ số', cell: (a) => `${formatReading(a.oldValue)} → ${formatReading(a.newValue)}` },
    { key: 'amount', header: 'Thành tiền', align: 'right', cell: (a) => `${formatMoney(a.oldAmount)} → ${formatMoney(a.newAmount)}` },
    { key: 'difference', header: 'Chênh', align: 'right', cell: (a) => <strong>{formatMoney(a.difference)}</strong> },
    { key: 'handling', header: 'Xử lý', cell: (a) => ADJUSTMENT_HANDLING_LABELS[a.handling] ?? a.handling },
    { key: 'reason', header: 'Lý do', hideOnMobile: true, cell: (a) => `${a.reason ?? '—'}${a.createdBy ? ` · ${a.createdBy}` : ''}` },
  ]
  return (
    <Section title="Điều chỉnh chỉ số" description="Các lần sửa chỉ số đã chốt của hóa đơn này — phần chênh xử lý theo cột “Xử lý”.">
      <QueryView query={query} isEmpty={(d) => d.length === 0} empty={<EmptyState title="Chưa có lần điều chỉnh nào" />} errorTitle="Không tải được lịch sử điều chỉnh">
        {(rows) => <DataTable columns={columns} rows={rows} caption="Điều chỉnh chỉ số" />}
      </QueryView>
    </Section>
  )
}

/** "Ở đến 15/02 · Kỳ 01/02–28/02 (15/28 ngày) · Tính: trọn kỳ · Tiền phòng kỳ này: thu ở hóa đơn này" — chỉ hóa đơn trả phòng. */
function finalPeriodText(fp) {
  const charge = FINAL_PERIOD_CHARGE_LABELS[fp.charge]?.toLowerCase() ?? fp.charge
  const rent = fp.rentBilledInvoiceNo ? `đã thu ở hóa đơn ${fp.rentBilledInvoiceNo}` : 'thu ở hóa đơn này'
  return `Ở đến ${formatDate(fp.stayedUntil)} · Kỳ ${formatDate(fp.periodStart)} – ${formatDate(fp.periodEnd)} (${fp.days}/${fp.periodDays} ngày) · Tính: ${charge} · Tiền phòng kỳ này: ${rent}`
}

function LineRow({ line, draft, onEdit, onReset, onDelete }) {
  const manual = !line.isSystem
  // Dòng nhập tay chỉ có số tiền (không nhập số lượng × đơn giá, không gắn khoản thu) → không hiện 2 cột đó.
  const amountOnly = manual && !line.feeTypeId && (line.quantity === 1 || !line.unitPrice)
  return (
    <tr className={line.isSettled ? styles.settled : undefined}>
      <td>
        <div className={styles.lineName}>
          {line.description}
          {line.isManuallyEdited && <Badge tone="warning">Sửa tay</Badge>}
          {line.isSettled && <Badge tone="info">{line.type === 'Surcharge' ? 'Đã thu ngay' : 'Đã trả ngay'}</Badge>}
        </div>
        <SegmentRows segments={line.segments} unit={line.unit} />
        <PriceApplied price={line.price} unit={line.unit} />
        {line.prorationFactor !== null && line.prorationFactor !== undefined && line.prorationFactor !== 1 && <div className={styles.sub}>Hệ số kỳ lẻ: {numberFormatter.format(line.prorationFactor)}</div>}
        {line.isManuallyEdited && line.systemAmount !== null && <div className={styles.sub}>Hệ thống tính: {formatMoney(line.systemAmount)}</div>}
        {line.note && <div className={styles.sub}>{line.note}</div>}
      </td>
      <td className={styles.num}>{amountOnly ? '—' : `${numberFormatter.format(line.quantity)}${line.unit ? ` ${line.unit}` : ''}`}</td>
      <td className={styles.num}>{amountOnly ? '—' : formatMoney(line.unitPrice)}</td>
      <td className={styles.num}>
        <strong>{formatMoney(line.amount)}</strong>
        {line.isSettled && <div className={styles.sub}>không tính vào tổng</div>}
      </td>
      {draft && (
        <td className={styles.rowActions}>
          <Button size="sm" variant="ghost" iconOnly icon={Pencil} onClick={() => onEdit(line)}>
            Sửa dòng {line.description}
          </Button>
          {manual ? (
            <Button size="sm" variant="ghost" iconOnly icon={Trash2} onClick={() => onDelete(line)}>
              Xóa dòng {line.description}
            </Button>
          ) : (
            line.isManuallyEdited && (
              <Button size="sm" variant="ghost" iconOnly icon={Undo2} onClick={() => onReset(line)}>
                Bỏ sửa tay dòng {line.description}
              </Button>
            )
          )}
        </td>
      )}
    </tr>
  )
}

/** Hóa đơn đã chuyển nợ vào hóa đơn trả phòng (BL-BR-41): khoản đó thu / trả lại ở hóa đơn trả phòng, trạng thái đi theo nó. */
function CarriedAlert({ invoice }) {
  const s = invoice.summary
  const target = <Link to={`/invoices/${invoice.carriedToInvoiceId}`}>{s.carriedToInvoiceNo ?? 'hóa đơn trả phòng'}</Link>
  const amount = formatMoney(invoice.carriedOverAmount)
  if (s.paymentStatus === 'CarriedSettled')
    return (
      <Alert tone="info">
        Hoàn thành qua hóa đơn trả phòng {target}: {amount} còn nợ đã được kết toán ở đó. “Đã thu” của phiếu này không gồm khoản đó.
      </Alert>
    )
  if (s.paymentStatus === 'CarriedWrittenOff')
    return (
      <Alert tone="warning">
        {amount} còn nợ đã chuyển vào hóa đơn trả phòng {target}, hóa đơn đó kết thúc bằng bỏ nợ — khoản này không thu được.
      </Alert>
    )
  return (
    <Alert tone="info">
      {amount} còn nợ đã chuyển vào hóa đơn trả phòng {target} — thu / trả lại tính ở đó, phiếu này không thu riêng. Muốn sửa phiếu này thì hủy hóa đơn trả phòng trước.
    </Alert>
  )
}

/** Kết toán của hóa đơn trả phòng: Tổng hóa đơn + nợ chuyển vào − cọc = Tổng thu (BL-BR-41). */
function SettlementSums({ invoice }) {
  const s = invoice.summary
  return (
    <>
      <div>
        <dt>Tổng hóa đơn</dt>
        <dd>{formatMoney(invoiceAmount(s))}</dd>
      </div>
      {settlementLines(invoice.lines).map((line) => (
        <div key={line.id}>
          <dt>{line.sourceInvoiceId ? <Link to={`/invoices/${line.sourceInvoiceId}`}>{line.description}</Link> : line.description}</dt>
          <dd>{formatMoney(line.amount)}</dd>
        </div>
      ))}
      <div className={styles.grand}>
        <dt>
          Tổng thu
          <div className={styles.sub}>{s.totalAmount < 0 ? 'Âm: chủ trọ trả lại người thuê' : 'Người thuê phải trả'}</div>
        </dt>
        <dd>{formatMoney(s.totalAmount)}</dd>
      </div>
    </>
  )
}

// Nút "Thêm hoàn trả" của cảnh báo RENT_OVERPAID → dòng Hoàn trả điền sẵn số gợi ý và hóa đơn nguồn.
const refundPreset = (issue) => ({
  type: 'Refund',
  amount: issue.amount,
  sourceInvoiceId: issue.ref,
  description: 'Hoàn tiền phòng kỳ cuối',
  note: 'Trả phòng — tiền phòng kỳ cuối đã thu dư',
})

/**
 * Chi tiết phiếu tiền phòng (docs/api/invoices.md#chi-tiết-phiếu). Nháp: sửa tay, thêm phụ thu / giảm trừ / hoàn trả, tính lại, chốt, xóa.
 * Đã chốt: chỉ đọc — hủy phiếu (chưa thu tiền) hoặc xác nhận hoàn tiền (tổng âm). Mọi lệnh sửa trả lại chi tiết phiếu → cập nhật ngay.
 */
export default function InvoiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState(null) // { type, line? }
  const [busy, setBusy] = useState(null)
  const canWriteOff = useCanWriteOff()
  const query = useQuery({ queryKey: queryKeys.invoices.detail(id), queryFn: ({ signal }) => invoicesApi.get(id, { signal }) })

  const close = () => setDialog(null)
  // Thay luôn dữ liệu đang hiện bằng chi tiết server trả về; danh sách / số tổng hợp / thẻ phòng tải lại sau.
  // previousDebts / totalDue chỉ có ở GET chi tiết → giữ lại từ lần đọc trước nếu lệnh sửa không trả.
  const apply = (detail) => {
    queryClient.setQueryData(queryKeys.invoices.detail(id), (old) => ({ ...old, ...detail, previousDebts: detail.previousDebts ?? old?.previousDebts, previousContractDebts: detail.previousContractDebts ?? old?.previousContractDebts }))
    for (const queryKey of [queryKeys.invoices.all, queryKeys.rooms.all, queryKeys.meters.all]) void queryClient.invalidateQueries({ queryKey, refetchType: 'active' })
  }

  /** Chạy một lệnh trên phiếu: báo kết quả bằng thông báo nổi; dữ liệu cũ (đã chốt / hủy ở nơi khác) thì tải lại. */
  const run = async (name, action, success) => {
    setBusy(name)
    try {
      const detail = await action()
      if (detail?.summary) apply(detail)
      else await queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      if (success) toast.success(success)
      return true
    } catch (error) {
      if (['INVOICE_NOT_DRAFT', 'INVOICE_NOT_FINALIZED', 'INVOICE_HAS_ISSUES', 'DRAFT_STALE', 'CONCURRENCY_CONFLICT'].includes(error.code)) void query.refetch()
      toast.error(error.code === 'DRAFT_STALE' ? 'Dữ liệu nguồn (giá, chỉ số, người ở, dịch vụ) đã đổi sau lần tính — bấm Tính lại rồi chốt.' : getErrorMessage(error))
      return false
    } finally {
      setBusy(null)
    }
  }
  // ConfirmDialog tự báo lỗi và giữ hộp thoại khi thất bại → ném lỗi ra cho nó, chỉ xử lý phần thành công ở đây.
  const confirmAction = async (action, success, after) => {
    const detail = await action()
    if (detail?.summary) apply(detail)
    toast.success(success)
    after?.()
  }

  return (
    <QueryView query={query} loading="page" errorTitle="Không tải được phiếu">
      {(invoice) => {
        const s = invoice.summary
        const draft = isDraft(s)
        const errors = invoice.issues.filter((i) => i.severity === 'Error')
        const warnings = invoice.issues.filter((i) => i.severity !== 'Error')
        // Thu tiền: phiếu đã chốt còn nợ. Bỏ nợ: thêm điều kiện có quyền (canWriteOff của GET /me).
        const collectable = isFinalized(s) && s.outstanding > 0
        return (
          <>
            <PageHeader
              backTo="/invoices"
              backLabel="Phiếu tiền phòng"
              title={`${invoiceTitle(s)} — phòng ${s.roomCode}`}
              meta={<InvoiceBadges summary={s} />}
              description={`${INVOICE_TYPE_LABELS[s.type] ?? s.type} · ${formatBillingMonth(s.billingMonth)} · ${formatDate(s.periodStart)} – ${formatDate(s.periodEnd)}`}
              actions={
                <>
                  {draft && (
                    <>
                      <Button variant="secondary" icon={Plus} onClick={() => setDialog({ type: 'addLine' })}>
                        Thêm dòng
                      </Button>
                      <Button variant="secondary" icon={RefreshCw} onClick={() => setDialog({ type: 'recalculate' })}>
                        Tính lại
                      </Button>
                      <Button icon={CheckCheck} disabled={!canFinalize(s)} onClick={() => setDialog({ type: 'finalize' })}>
                        Chốt phiếu
                      </Button>
                      <Button variant="ghost" icon={Trash2} onClick={() => setDialog({ type: 'delete' })}>
                        Xóa nháp
                      </Button>
                    </>
                  )}
                  {collectable && (
                    <>
                      <Button icon={HandCoins} onClick={() => setDialog({ type: 'pay' })}>
                        Đã thu
                      </Button>
                      {canWriteOff && (
                        <>
                          <Button variant="secondary" onClick={() => setDialog({ type: 'payAndWriteOff' })}>
                            Thanh toán + bỏ phần còn lại
                          </Button>
                          <Button variant="ghost" onClick={() => setDialog({ type: 'writeOff' })}>
                            Bỏ nợ
                          </Button>
                        </>
                      )}
                    </>
                  )}
                  {isFinalized(s) && (
                    <Button variant="secondary" onClick={() => setDialog({ type: 'balance' })}>
                      Nợ của hợp đồng
                    </Button>
                  )}
                  {s.paymentStatus === 'RefundPending' && <Button onClick={() => setDialog({ type: 'refund' })}>Đã hoàn tiền</Button>}
                  {s.paymentStatus === 'Refunded' && (
                    <Button variant="secondary" icon={RotateCcw} onClick={() => setDialog({ type: 'cancelRefund' })}>
                      Bỏ xác nhận hoàn
                    </Button>
                  )}
                  {s.needsResend && (
                    <Button variant="secondary" icon={Send} loading={busy === 'resent'} onClick={() => run('resent', () => invoicesApi.markResent(s.id), 'Đã ghi nhận gửi lại cho người thuê.')}>
                      Đã gửi lại
                    </Button>
                  )}
                  {canVoid(s) && (
                    <Button variant="ghost" icon={Ban} onClick={() => setDialog({ type: 'void' })}>
                      Hủy phiếu
                    </Button>
                  )}
                </>
              }
            />

            <div className={styles.alerts}>
              {s.status === 'Void' && (
                <Alert tone="warning">
                  Phiếu đã hủy{invoice.voidedAt ? ` lúc ${formatDateTime(invoice.voidedAt)}` : ''}
                  {invoice.voidReason ? `: ${invoice.voidReason}` : ''}. Có thể lập lại phiếu cho kỳ này.
                </Alert>
              )}
              {invoice.finalPeriod && <Alert tone="info">{finalPeriodText(invoice.finalPeriod)}</Alert>}
              {s.needsResend && <Alert tone="warning">Hóa đơn đã chốt vừa được tính lại do điều chỉnh chỉ số — gửi lại cho người thuê rồi bấm “Đã gửi lại”.</Alert>}
              {draft && s.isStale && <Alert tone="warning">Dữ liệu nguồn (chỉ số, giá, hợp đồng) đã đổi sau khi lập nháp — bấm Tính lại trước khi chốt.</Alert>}
              {errors.length > 0 && (
                <Alert>
                  <strong>Chưa chốt được — cần xử lý:</strong>
                  <ul className={styles.issueList}>
                    {errors.map((issue) => (
                      <li key={`${issue.code}-${issue.ref ?? issue.message}`}>{issue.message}</li>
                    ))}
                  </ul>
                  Thiếu chỉ số thì vào <Link to={`/meter-readings?propertyId=${s.propertyId}&billingMonth=${s.billingMonth}`}>Ghi chỉ số</Link>, xong bấm Tính lại.
                </Alert>
              )}
              {warnings.map((issue) => (
                <Alert key={`${issue.code}-${issue.ref ?? issue.message}`} tone="warning">
                  <span className={styles.issueRow}>
                    {issue.message}
                    {/* Hóa đơn trả phòng khu thu trước: tiền phòng kỳ cuối đã thu dư — amount = số gợi ý hoàn, ref = hóa đơn đã thu. */}
                    {draft && issue.code === 'RENT_OVERPAID' && issue.amount > 0 && issue.ref && (
                      <Button size="sm" variant="secondary" onClick={() => setDialog({ type: 'addLine', preset: refundPreset(issue) })}>
                        Thêm hoàn trả {formatMoney(issue.amount)}
                      </Button>
                    )}
                  </span>
                </Alert>
              ))}
              {isCarried(s) && <CarriedAlert invoice={invoice} />}
              {s.paymentStatus === 'RefundPending' && <Alert tone="info">Tổng thu âm: cần trả lại người thuê {formatMoney(s.refundDue)}. Trả xong bấm “Đã hoàn tiền”.</Alert>}
              {s.paymentStatus === 'RefundWaived' && (
                <Alert tone="info">
                  Chủ trọ quyết định không hoàn{invoice.refundedOn ? ` (ngày ${formatDate(invoice.refundedOn)})` : ''}
                  {invoice.refundNote ? ` — ${invoice.refundNote}` : ''}.
                </Alert>
              )}
              {s.paymentStatus === 'Refunded' && (
                <Alert tone="info">
                  Đã hoàn tiền ngày {formatDate(invoice.refundedOn)}
                  {invoice.refundMethod ? ` (${PAYMENT_METHOD_LABELS[invoice.refundMethod] ?? invoice.refundMethod})` : ''}
                  {invoice.refundNote ? ` — ${invoice.refundNote}` : ''}.
                </Alert>
              )}
            </div>

            <Section title="Thông tin phiếu">
              <DescriptionList
                items={[
                  { label: 'Hợp đồng', value: <Link to={`/contracts/${s.contractId}`}>{s.contractNo}</Link> },
                  { label: 'Người đứng tên', value: s.representativeName },
                  { label: 'Phòng', value: <Link to={`/rooms/${s.roomId}`}>{s.roomCode}</Link> },
                  { label: 'Ngày lập', value: invoice.issueDate ? formatDate(invoice.issueDate) : 'Chưa chốt' },
                  { label: 'Hạn thanh toán', hidden: !s.dueDate, value: formatDate(s.dueDate) },
                  // "Đã thu" = thực thu (collectedAmount); paidAmount = thực thu + bỏ nợ, chỉ dùng tính còn nợ.
                  { label: 'Đã thu', hidden: !isFinalized(s), value: formatMoney(s.collectedAmount ?? s.paidAmount) },
                  { label: 'Đã bỏ nợ', hidden: !isFinalized(s) || !(s.writtenOffAmount > 0), value: formatMoney(s.writtenOffAmount) },
                  // BL-BR-41: phần nợ chuyển vào hóa đơn trả phòng — nằm trong paidAmount nhưng không phải tiền đã thu.
                  {
                    label: 'Chuyển sang hóa đơn trả phòng',
                    hidden: !(invoice.carriedOverAmount > 0),
                    value: (
                      <>
                        {formatMoney(invoice.carriedOverAmount)} → <Link to={`/invoices/${invoice.carriedToInvoiceId}`}>{s.carriedToInvoiceNo ?? 'hóa đơn trả phòng'}</Link>
                      </>
                    ),
                  },
                  { label: 'Còn nợ', hidden: !isFinalized(s) || s.refundDue > 0, value: formatMoney(s.outstanding) },
                ]}
              />
            </Section>

            <Section title="Các khoản trên phiếu">
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Nội dung</th>
                      <th scope="col" className={styles.num}>
                        Số lượng
                      </th>
                      <th scope="col" className={styles.num}>
                        Đơn giá
                      </th>
                      <th scope="col" className={styles.num}>
                        Thành tiền
                      </th>
                      {draft && <th scope="col" aria-label="Thao tác" />}
                    </tr>
                  </thead>
                  <tbody>
                    {groupLines(invoice.lines).map((group) => (
                      <Fragment key={group.type}>
                        <tr className={styles.groupRow}>
                          <th scope="colgroup" colSpan={draft ? 5 : 4}>
                            {group.label}
                          </th>
                        </tr>
                        {group.lines.map((line) => (
                          <LineRow
                            key={line.id}
                            line={line}
                            draft={draft}
                            onEdit={(l) => setDialog({ type: 'editLine', line: l })}
                            onDelete={(l) => setDialog({ type: 'deleteLine', line: l })}
                            onReset={(l) => run(`reset-${l.id}`, () => invoicesApi.resetLine(s.id, l.id), 'Đã bỏ sửa tay — dòng về số hệ thống tính.')}
                          />
                        ))}
                      </Fragment>
                    ))}
                    {invoice.lines.length === 0 && (
                      <tr>
                        <td colSpan={draft ? 5 : 4} className={styles.empty}>
                          Phiếu chưa có dòng nào.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <dl className={styles.sums}>
                <div>
                  <dt>Cộng các khoản</dt>
                  <dd>{formatMoney(invoice.subtotal)}</dd>
                </div>
                {invoice.discountTotal !== 0 && (
                  <div>
                    <dt>Giảm trừ</dt>
                    <dd>{formatMoney(invoice.discountTotal)}</dd>
                  </div>
                )}
                {invoice.refundTotal !== 0 && (
                  <div>
                    <dt>Hoàn trả</dt>
                    <dd>{formatMoney(invoice.refundTotal)}</dd>
                  </div>
                )}
                {s.roundingAmount !== 0 && (
                  <div>
                    <dt>Làm tròn</dt>
                    <dd>{formatMoney(s.roundingAmount)}</dd>
                  </div>
                )}
                {hasSettlement(s) ? (
                  <SettlementSums invoice={invoice} />
                ) : (
                  <div className={styles.grand}>
                    <dt>Tổng hóa đơn</dt>
                    <dd>{formatMoney(s.totalAmount)}</dd>
                  </div>
                )}
              </dl>
            </Section>

            {invoice.previousDebts?.length > 0 && (
              <Section title="Nợ các kỳ trước" description="Chỉ để hiển thị — không cộng vào phiếu này. Thu theo tổng sẽ trừ phiếu cũ nhất trước.">
                <ul className={styles.debts}>
                  {invoice.previousDebts.map((d) => (
                    <li key={d.invoiceId}>
                      <Link to={`/invoices/${d.invoiceId}`}>{d.invoiceNo}</Link> · {formatBillingMonth(d.billingMonth)}
                      {d.dueDate ? ` · hạn ${formatDate(d.dueDate)}` : ''}
                      <strong>{formatMoney(d.outstanding)}</strong>
                    </li>
                  ))}
                  <li className={styles.grand}>
                    Tổng cần thanh toán
                    <strong>{formatMoney(invoice.totalDue)}</strong>
                  </li>
                </ul>
              </Section>
            )}

            {invoice.previousContractDebts?.length > 0 && (
              <Section title="Nợ của hợp đồng trước (trước khi ký lại)" description="Không cộng vào tổng cần thanh toán — thu tiền vẫn ghi trên hợp đồng cũ.">
                <ul className={styles.debts}>
                  {invoice.previousContractDebts.map((d) => (
                    <li key={d.invoiceId}>
                      <span>
                        <Link to={`/contracts/${d.contractId}`}>{d.contractNo}</Link> · <Link to={`/invoices/${d.invoiceId}`}>{d.invoiceNo}</Link> · {formatBillingMonth(d.billingMonth)}
                      </span>
                      <strong>{formatMoney(d.outstanding)}</strong>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {s.isAdjusted && <AdjustmentHistory invoice={invoice} />}

            {isFinalized(s) && (
              <Section title="Lịch sử thu" description="Nhập sai thì đảo phiếu thu rồi ghi lại — không sửa, không xóa.">
                <PaymentHistory filter={{ invoiceId: s.id }} emptyTitle="Phiếu chưa có lần thu nào" />
              </Section>
            )}

            <Section
              title="Ghi chú in trên phiếu"
              actions={
                draft && (
                  <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setDialog({ type: 'note' })}>
                    Sửa ghi chú
                  </Button>
                )
              }
            >
              <p className={invoice.note ? styles.note : styles.muted}>{invoice.note || 'Chưa có ghi chú.'}</p>
            </Section>

            <Can permission={Permission.AuditView}>
              <Section title="Lịch sử thay đổi" description="Ai đã tạo, sửa, chốt, hủy phiếu này — chỉ chủ trọ xem được.">
                <AuditLogList filter={{ entityType: 'Invoice', entityId: s.id }} showEntity={false} emptyTitle="Chưa có thay đổi nào được ghi" />
              </Section>
            </Can>

            {dialog?.type === 'addLine' && <AddLineDialog invoice={invoice} preset={dialog.preset} onSaved={apply} onClose={close} />}
            {dialog?.type === 'editLine' && <EditLineDialog invoice={invoice} line={dialog.line} onSaved={apply} onClose={close} />}
            {dialog?.type === 'pay' && <RecordPaymentDialog contractId={s.contractId} invoice={s} maxAmount={s.outstanding} onClose={close} />}
            {dialog?.type === 'payAndWriteOff' && <PayAndWriteOffDialog invoice={s} onClose={close} />}
            {dialog?.type === 'writeOff' && <WriteOffDialog invoice={s} onClose={close} />}
            {dialog?.type === 'balance' && <ContractBalanceDialog contractId={s.contractId} onClose={close} />}
            {dialog?.type === 'refund' && <ConfirmRefundDialog invoice={invoice} onSaved={apply} onClose={close} />}
            {dialog?.type === 'note' && (
              <FormDialog
                title="Ghi chú in trên phiếu"
                initial={{ note: invoice.note ?? '' }}
                onClose={close}
                onSubmit={async (v) => {
                  apply(await invoicesApi.updateNote(s.id, v.note.trim() || null))
                  toast.success('Đã lưu ghi chú.')
                }}
              >
                {(form) => <TextAreaField label="Ghi chú" rows={4} maxLength={1000} {...form.field('note')} />}
              </FormDialog>
            )}
            {dialog?.type === 'recalculate' && (
              <FormDialog
                title="Tính lại phiếu nháp?"
                description="Tính lại tiền phòng, điện nước, dịch vụ theo dữ liệu hiện tại. Phụ thu, giảm trừ, hoàn trả luôn được giữ."
                initial={{ discardEdits: false }}
                submitLabel="Tính lại"
                onClose={close}
                onSubmit={async (v) => {
                  const result = await invoicesApi.recalculate({ invoiceIds: [s.id], keepManualEdits: !v.discardEdits })
                  await queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
                  if (result.notDraft?.length) toast.error('Phiếu không còn là nháp — đã tải lại.')
                  else if (result.withIssues) toast.warning('Đã tính lại — phiếu vẫn còn vấn đề chặn chốt.')
                  else toast.success('Đã tính lại phiếu.')
                }}
              >
                {(form) => <CheckboxField label="Bỏ các ô sửa tay" description="Tính lại từ đầu: mọi ô đã sửa tay trở về số hệ thống tính." {...form.field('discardEdits', { type: 'checkbox' })} />}
              </FormDialog>
            )}
            <ConfirmDialog
              open={dialog?.type === 'deleteLine'}
              onClose={close}
              title="Xóa dòng này?"
              message={dialog?.line ? `"${dialog.line.description}" ${formatMoney(dialog.line.amount)} sẽ bị xóa khỏi phiếu${dialog.line.roomChargeId ? ' và khoản phát sinh tương ứng của phòng bị hủy' : ''}.` : ''}
              confirmLabel="Xóa dòng"
              tone="danger"
              onConfirm={() => confirmAction(() => invoicesApi.resetLine(s.id, dialog.line.id), 'Đã xóa dòng.')}
            />
            <ConfirmDialog
              open={dialog?.type === 'finalize'}
              onClose={close}
              title="Chốt phiếu?"
              message={`${hasSettlement(s) ? `Tổng hóa đơn ${formatMoney(invoiceAmount(s))}, tổng thu sau kết toán ${formatMoney(s.totalAmount)}` : `Tổng hóa đơn ${formatMoney(s.totalAmount)}`}. Chốt xong phiếu được cấp số và không sửa được nữa; chỉ số cuối kỳ và bảng giá của kỳ bị khóa. Sai sót sau khi chốt phải hủy phiếu rồi lập lại.`}
              confirmLabel="Chốt phiếu"
              onConfirm={async () => {
                // Lỗi chốt (DRAFT_STALE, INVOICE_HAS_ISSUES) báo bằng thông báo nổi và đóng hộp thoại để người dùng xử lý trên phiếu.
                await run('finalize', () => invoicesApi.finalize(s.id), 'Đã chốt phiếu.')
              }}
            />
            <ConfirmDialog
              open={dialog?.type === 'delete'}
              onClose={close}
              title="Xóa phiếu nháp?"
              message="Phiếu nháp bị xóa hẳn; khoản phát sinh trên phiếu quay về chờ. Chỉ xóa được phiếu mới nhất của hợp đồng."
              confirmLabel="Xóa nháp"
              tone="danger"
              onConfirm={async () => {
                await invoicesApi.remove(s.id)
                queryClient.removeQueries({ queryKey: queryKeys.invoices.detail(id) })
                await queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
                toast.success('Đã xóa phiếu nháp.')
                navigate('/invoices', { replace: true })
              }}
            />
            <ConfirmDialog
              open={dialog?.type === 'void'}
              onClose={close}
              title={`Hủy phiếu ${s.invoiceNo ?? ''}?`}
              message="Chỉ hủy được phiếu chưa thu tiền, là phiếu mới nhất của hợp đồng (hóa đơn trả phòng chưa hủy luôn là mới nhất) và hợp đồng chưa kết thúc. Hủy xong lập lại được; chỉ số của kỳ được mở khóa."
              reasonLabel="Lý do hủy"
              reasonMaxLength={300}
              confirmLabel="Hủy phiếu"
              tone="danger"
              onConfirm={(reason) => confirmAction(() => invoicesApi.void(s.id, reason), 'Đã hủy phiếu.')}
            />
            <ConfirmDialog
              open={dialog?.type === 'cancelRefund'}
              onClose={close}
              title="Bỏ xác nhận đã hoàn tiền?"
              message="Phiếu trở lại trạng thái Chờ hoàn tiền."
              confirmLabel="Bỏ xác nhận"
              onConfirm={() => confirmAction(() => invoicesApi.cancelRefund(s.id), 'Đã bỏ xác nhận hoàn tiền.')}
            />
            {busy && <span className="visually-hidden" role="status">Đang xử lý…</span>}
          </>
        )
      }}
    </QueryView>
  )
}
