import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CheckCheck, ListPlus, Plus, ReceiptText, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { invoicesApi, queryKeys } from '@/api'
import { Alert, Button, Card, CheckboxField, ConfirmDialog, DataTable, EmptyState, FormDialog, PageHeader, Pagination, QueryView, SelectField, TextField, Toolbar, useToast } from '@/components/ui'
import { INVOICE_STATUS, toOptions } from '@/constants/enums'
import { usePropertyOptions, usePropertyRooms } from '@/features/shared/queries'
import { useAction, useInvalidate } from '@/hooks/useAction'
import { useListParams } from '@/hooks/useListParams'
import { currentBillingMonth, formatBillingMonth, formatDate, formatMoney } from '@/lib/format'
import { BulkResultDialog } from '../components/BulkResultDialog'
import { GenerateInvoicesDialog } from '../components/GenerateInvoicesDialog'
import { InvoiceAmountCell } from '../components/InvoiceAmountCell'
import { InvoiceBadges } from '../components/InvoiceBadges'
import { BulkLineDialog } from '../components/LineDialogs'
import styles from './InvoicesPage.module.css'

const PAGE_SIZE = 20
const DEFAULTS = { propertyId: '', billingMonth: '', allMonths: false, status: '', floor: '', unpaidOnly: false, stale: false, adjusted: false, needsResend: false, page: 1 }
const STATUS_OPTIONS = toOptions(Object.fromEntries(Object.entries(INVOICE_STATUS).map(([value, meta]) => [value, meta.label])))

function Totals({ filter }) {
  const query = useQuery({
    queryKey: queryKeys.invoices.totals(filter),
    queryFn: ({ signal }) => invoicesApi.totals(filter, { signal }),
    placeholderData: keepPreviousData,
  })
  const t = query.data
  const cards = [
    { label: 'Phải thu', value: t?.totalAmount, sub: t ? `${t.finalizedCount} phiếu đã chốt` : null },
    // "Đã thu" = thực thu; paidAmount gồm cả phần bỏ nợ (invoices.md#số-tổng-hợp).
    { label: 'Đã thu', value: t?.collectedAmount ?? t?.paidAmount },
    ...(t?.writtenOffAmount > 0 ? [{ label: 'Đã bỏ nợ', value: t.writtenOffAmount, sub: 'không tính doanh thu' }] : []),
    { label: 'Còn nợ', value: t?.outstandingAmount, tone: t?.outstandingAmount > 0 ? 'warning' : null },
    { label: 'Quá hạn', value: t?.overdueAmount, tone: t?.overdueAmount > 0 ? 'danger' : null },
    { label: 'Nháp (tạm tính)', value: t?.draftAmount, sub: t ? `${t.draftCount} phiếu nháp — chưa tính vào phải thu` : null },
  ]
  return (
    <div className={styles.totals} aria-busy={query.isPending}>
      {cards.map((card) => (
        <div key={card.label} className={styles.total}>
          <span className={styles.totalLabel}>{card.label}</span>
          <strong className={card.tone ? styles[card.tone] : undefined}>{query.isError ? '—' : t ? formatMoney(card.value) : '…'}</strong>
          {card.sub && <span className={styles.totalSub}>{card.sub}</span>}
        </div>
      ))}
    </div>
  )
}

/**
 * Phiếu tiền phòng theo khu + tháng thu (docs/api/invoices.md): tạo nháp, tính lại, chốt, thêm dòng cho nhiều phòng.
 * Bộ lọc nằm trên URL; dải số tổng hợp tính trên toàn bộ kết quả lọc.
 */
export default function InvoicesPage() {
  const toast = useToast()
  const invalidate = useInvalidate()
  const { params, set } = useListParams(DEFAULTS)
  const properties = usePropertyOptions()
  const rooms = usePropertyRooms(params.propertyId)
  const floors = useMemo(() => [...new Set((rooms.data ?? []).map((r) => r.floor).filter(Boolean))].sort(), [rooms.data])
  const billingMonth = params.allMonths ? undefined : params.billingMonth || currentBillingMonth()
  const [selected, setSelected] = useState(() => new Set())
  const [dialog, setDialog] = useState(null) // { type: 'generate' | 'finalize' | 'bulkLine' | 'result', … }

  const filter = {
    propertyId: params.propertyId || undefined,
    billingMonth,
    status: params.status || undefined,
    floor: (params.propertyId && params.floor) || undefined,
    unpaidOnly: params.unpaidOnly || undefined,
    stale: params.stale || undefined,
  }
  // "Đã điều chỉnh" / "Cần gửi lại" chỉ lọc danh sách — số tổng hợp không nhận 2 lọc này.
  const listParams = { ...filter, adjusted: params.adjusted || undefined, needsResend: params.needsResend || undefined, page: params.page, pageSize: PAGE_SIZE }
  const query = useQuery({
    queryKey: queryKeys.invoices.list(listParams),
    queryFn: ({ signal }) => invoicesApi.list(listParams, { signal }),
    placeholderData: keepPreviousData,
  })

  const items = useMemo(() => query.data?.items ?? [], [query.data])
  // Chọn theo trang đang xem; chỉ phiếu nháp mới tính lại / chốt / thêm dòng được.
  const selectedDrafts = items.filter((i) => selected.has(i.id) && i.status === 'Draft')
  const draftsOnPage = items.filter((i) => i.status === 'Draft')
  const allSelected = draftsOnPage.length > 0 && draftsOnPage.every((i) => selected.has(i.id))
  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const changeFilter = (changes) => {
    setSelected(new Set())
    set(changes)
  }

  const recalculate = useAction({
    mutationFn: (body) => invoicesApi.recalculate({ keepManualEdits: true, ...body }),
    invalidate: [queryKeys.invoices.all],
    success: (r) => `Đã tính lại ${r.recalculated} phiếu nháp${r.withIssues ? ` — ${r.withIssues} phiếu còn vấn đề` : ''}${r.notDraft?.length ? `, bỏ qua ${r.notDraft.length} phiếu không còn là nháp` : ''}.`,
  })

  const finalizeSelected = async () => {
    const ids = selectedDrafts.map((i) => i.id)
    const results = await invoicesApi.finalizeBatch(ids)
    await invalidate(queryKeys.invoices.all, queryKeys.rooms.all, queryKeys.meters.all)
    setSelected(new Set())
    const failed = results.filter((r) => !r.success)
    const done = results.length - failed.length
    if (done > 0) toast.success(`Đã chốt ${done} phiếu.`)
    if (failed.length === 0) return
    toast.error(`${failed.length} phiếu chưa chốt được — xem lý do từng phiếu.`)
    const byId = Object.fromEntries(items.map((i) => [i.id, i]))
    setDialog({
      type: 'result',
      title: 'Kết quả chốt phiếu',
      summary: <Alert tone="warning">Chốt được {done} phiếu, {failed.length} phiếu chưa chốt được. Thiếu chỉ số / giá thì xử lý rồi Tính lại; “dữ liệu đã đổi” thì Tính lại rồi chốt.</Alert>,
      rows: results.map((r) => ({ key: r.invoiceId, label: `Phòng ${byId[r.invoiceId]?.roomCode ?? '?'}`, ok: r.success, message: r.success ? r.invoiceNo : (r.message ?? r.errorCode) })),
    })
  }

  const columns = [
    {
      key: 'room',
      header: <CheckboxField label="Phòng" checked={allSelected} disabled={draftsOnPage.length === 0} onChange={(e) => setSelected(e.target.checked ? new Set(draftsOnPage.map((i) => i.id)) : new Set())} />,
      primary: true,
      cell: (i) => (
        <span className={styles.roomCell}>
          {i.status === 'Draft' && <input type="checkbox" aria-label={`Chọn phiếu phòng ${i.roomCode}`} checked={selected.has(i.id)} onChange={() => toggle(i.id)} />}
          <span>
            <Link to={`/invoices/${i.id}`}>
              <strong>{i.roomCode}</strong>
            </Link>
            <span className={styles.sub}> · {i.representativeName}</span>
            <span className={styles.subBlock}>{i.invoiceNo ?? 'Chưa cấp số'}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'period',
      header: 'Kỳ',
      cell: (i) => (
        <span>
          {formatBillingMonth(i.billingMonth)}
          <span className={styles.subBlock}>
            {formatDate(i.periodStart)} – {formatDate(i.periodEnd)}
          </span>
        </span>
      ),
    },
    { key: 'total', header: 'Tổng hóa đơn', align: 'right', cell: (i) => <InvoiceAmountCell summary={i} /> },
    {
      key: 'outstanding',
      header: 'Còn nợ',
      align: 'right',
      cell: (i) => (i.status !== 'Finalized' ? '—' : i.refundDue > 0 ? `Phải hoàn ${formatMoney(i.refundDue)}` : formatMoney(i.outstanding)),
    },
    { key: 'due', header: 'Hạn', hideOnMobile: true, cell: (i) => (i.dueDate ? formatDate(i.dueDate) : '—') },
    { key: 'status', header: 'Trạng thái', cell: (i) => <InvoiceBadges summary={i} /> },
  ]

  const propertyName = properties.data?.find((p) => p.id === params.propertyId)?.code
  const bulkScope =
    selectedDrafts.length > 0
      ? { scope: { invoiceIds: selectedDrafts.map((i) => i.id) }, label: `${selectedDrafts.length} phiếu nháp đã chọn` }
      : params.propertyId && billingMonth
        ? {
            scope: { propertyId: params.propertyId, billingMonth, floor: params.floor },
            label: `mọi phiếu nháp ${formatBillingMonth(billingMonth).toLowerCase()} của khu ${propertyName ?? ''}${params.floor ? `, tầng ${params.floor}` : ''}`,
          }
        : null

  return (
    <>
      <PageHeader
        title="Phiếu tiền phòng"
        description="Tạo phiếu nháp theo tháng, kiểm tra, chốt rồi thu tiền. Sai sau khi chốt thì hủy phiếu và lập lại."
        actions={
          <Button icon={Plus} onClick={() => setDialog({ type: 'generate' })}>
            Tạo phiếu
          </Button>
        }
      />

      <Toolbar>
        <SelectField
          aria-label="Khu trọ"
          placeholder="Mọi khu"
          options={(properties.data ?? []).map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
          value={params.propertyId}
          onChange={(e) => changeFilter({ propertyId: e.target.value, floor: '' })}
        />
        <TextField aria-label="Tháng thu" type="month" disabled={params.allMonths} value={billingMonth ?? ''} onChange={(e) => changeFilter({ billingMonth: e.target.value })} />
        <SelectField aria-label="Trạng thái" placeholder="Mọi trạng thái" options={STATUS_OPTIONS} value={params.status} onChange={(e) => changeFilter({ status: e.target.value })} />
        {params.propertyId && (
          <SelectField aria-label="Tầng" placeholder="Mọi tầng" options={floors.map((f) => ({ value: f, label: `Tầng ${f}` }))} value={params.floor} onChange={(e) => changeFilter({ floor: e.target.value })} />
        )}
        <CheckboxField label="Mọi tháng" checked={params.allMonths} onChange={(e) => changeFilter({ allMonths: e.target.checked })} />
        <CheckboxField label="Còn nợ" checked={params.unpaidOnly} onChange={(e) => changeFilter({ unpaidOnly: e.target.checked })} />
        <CheckboxField label="Cần tính lại" checked={params.stale} onChange={(e) => changeFilter({ stale: e.target.checked })} />
        <CheckboxField label="Đã điều chỉnh" checked={params.adjusted} onChange={(e) => changeFilter({ adjusted: e.target.checked })} />
        <CheckboxField label="Cần gửi lại" checked={params.needsResend} onChange={(e) => changeFilter({ needsResend: e.target.checked })} />
      </Toolbar>

      <Totals filter={filter} />

      <div className={styles.actions}>
        <span className={styles.muted}>{selectedDrafts.length > 0 ? `Đã chọn ${selectedDrafts.length} phiếu nháp` : 'Chọn phiếu nháp để tính lại hoặc chốt nhiều phiếu.'}</span>
        <span className={styles.buttons}>
          {params.propertyId && (
            <Button size="sm" variant="secondary" icon={RefreshCw} loading={recalculate.isPending && recalculate.variables?.staleOnly} onClick={() => recalculate.mutate({ propertyId: params.propertyId, billingMonth: billingMonth ?? null, staleOnly: true })}>
              Tính lại các nháp cần tính lại
            </Button>
          )}
          {params.propertyId && billingMonth && (
            <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => setDialog({ type: 'recalculateMonth' })}>
              Tính lại cả {params.floor ? `tầng ${params.floor}` : 'tháng'}
            </Button>
          )}
          <Button size="sm" variant="secondary" icon={RefreshCw} disabled={selectedDrafts.length === 0} loading={recalculate.isPending && Boolean(recalculate.variables?.invoiceIds)} onClick={() => recalculate.mutate({ invoiceIds: selectedDrafts.map((i) => i.id) })}>
            Tính lại đã chọn
          </Button>
          <Button size="sm" variant="secondary" icon={ListPlus} disabled={!bulkScope} onClick={() => setDialog({ type: 'bulkLine' })}>
            Thêm phụ thu / giảm trừ
          </Button>
          <Button size="sm" icon={CheckCheck} disabled={selectedDrafts.length === 0} onClick={() => setDialog({ type: 'finalize' })}>
            Chốt đã chọn
          </Button>
        </span>
      </div>

      <QueryView
        query={query}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <Card>
            <EmptyState
              icon={ReceiptText}
              title="Không có phiếu nào"
              description={billingMonth ? `Chưa có phiếu ${formatBillingMonth(billingMonth).toLowerCase()} khớp bộ lọc. Ghi chỉ số điện nước rồi bấm Tạo phiếu.` : 'Không có phiếu khớp bộ lọc.'}
              action={
                <Button icon={Plus} onClick={() => setDialog({ type: 'generate' })}>
                  Tạo phiếu
                </Button>
              }
            />
          </Card>
        }
        errorTitle="Không tải được danh sách phiếu"
      >
        {(data) => (
          <>
            <DataTable columns={columns} rows={data.items} rowHref={(i) => `/invoices/${i.id}`} caption="Phiếu tiền phòng" stale={query.isPlaceholderData} />
            <Pagination {...data} disabled={query.isPlaceholderData} onPageChange={(page) => changeFilter({ page })} />
          </>
        )}
      </QueryView>

      {dialog?.type === 'generate' && <GenerateInvoicesDialog defaultPropertyId={params.propertyId} defaultMonth={billingMonth ?? currentBillingMonth()} onClose={() => setDialog(null)} />}
      {dialog?.type === 'bulkLine' && bulkScope && (
        <BulkLineDialog
          propertyId={params.propertyId || selectedDrafts[0]?.propertyId}
          scope={bulkScope.scope}
          scopeLabel={bulkScope.label}
          onClose={() => {
            setDialog(null)
            setSelected(new Set())
          }}
        />
      )}
      {dialog?.type === 'recalculateMonth' && (
        <FormDialog
          title={`Tính lại phiếu nháp ${formatBillingMonth(billingMonth).toLowerCase()}?`}
          description={`Tính lại mọi phiếu nháp của khu ${propertyName ?? ''}${params.floor ? `, tầng ${params.floor}` : ''} theo dữ liệu hiện tại. Phụ thu, giảm trừ, hoàn trả luôn được giữ.`}
          initial={{ discardEdits: false }}
          submitLabel="Tính lại"
          onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            const result = await invoicesApi.recalculate({ propertyId: params.propertyId, billingMonth, roomIds: null, floor: params.floor || null, keepManualEdits: !v.discardEdits })
            await invalidate(queryKeys.invoices.all)
            toast.success(`Đã tính lại ${result.recalculated} phiếu nháp${result.withIssues ? ` — ${result.withIssues} phiếu còn vấn đề` : ''}.`)
          }}
        >
          {(form) => <CheckboxField label="Bỏ các ô sửa tay" description="Tính lại từ đầu: mọi ô đã sửa tay trở về số hệ thống tính." {...form.field('discardEdits', { type: 'checkbox' })} />}
        </FormDialog>
      )}
      {dialog?.type === 'result' && <BulkResultDialog title={dialog.title} summary={dialog.summary} rows={dialog.rows} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog?.type === 'finalize'}
        onClose={() => setDialog(null)}
        title={`Chốt ${selectedDrafts.length} phiếu?`}
        message="Chốt xong phiếu được cấp số và không sửa được nữa; chỉ số cuối kỳ và bảng giá của kỳ bị khóa. Sai sót sau khi chốt phải hủy phiếu rồi lập lại."
        confirmLabel="Chốt phiếu"
        onConfirm={finalizeSelected}
      />
    </>
  )
}
