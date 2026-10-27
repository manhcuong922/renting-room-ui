import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { feesApi, queryKeys } from '@/api'
import { Alert, Badge, Button, ConfirmDialog, DataTable, EmptyState, FormGrid, Modal, QueryView, useToast } from '@/components/ui'
import { useAction, useInvalidate } from '@/hooks/useAction'
import { useForm } from '@/hooks/useForm'
import { formatDate, formatMoney } from '@/lib/format'
import { describeTiers, emptyPrice, toPriceBody, validatePrice } from '../feeForm'
import { PriceFields } from './PriceFields'

const FORM_ID = 'fee-price-form'

function AddPriceForm({ fee, onDone }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const form = useForm(emptyPrice(), {
    validate: (v) => validatePrice(v, fee.group),
    codeFields: { FEE_PRICE_DATE_EXISTS: 'effectiveFrom', FEE_PRICE_LOCKED: 'effectiveFrom', FEE_TIERS_METERED_ONLY: 'tiers' },
  })

  const submit = form.handleSubmit(async (v) => {
    const result = await feesApi.addPrice(fee.id, toPriceBody({ ...v, kind: fee.group === 'Metered' ? v.kind : 'single' }))
    // Đổi giá ⇒ phiếu nháp của khu chuyển "Cần tính lại" (FE-BR-09).
    await invalidate(queryKeys.fees.all, queryKeys.invoices.all)
    toast.success('Đã thêm bản giá.')
    // Cảnh báo không chặn: giá đã lưu (VD giá điện cao hơn mức tham chiếu).
    result.warnings?.forEach((w) => toast.warning(w.message, { duration: 10_000 }))
    onDone()
  })

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate style={{ display: 'grid', gap: 'var(--space-4)' }}>
      {form.formError && <Alert>{form.formError}</Alert>}
      <FormGrid>
        <PriceFields form={form} group={fee.group} unit={fee.unit} />
      </FormGrid>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
        <Button variant="secondary" onClick={onDone} disabled={form.submitting}>
          Thôi
        </Button>
        <Button type="submit" loading={form.submitting}>
          Thêm bản giá
        </Button>
      </div>
    </form>
  )
}

/**
 * Bảng giá của một khoản thu (fees.md#bảng-giá): lịch sử theo ngày hiệu lực, thêm giá mới, xóa bản giá.
 * Giá không sửa — xóa rồi thêm lại. Bản giá thuộc kỳ đã chốt phiếu thì không thêm / xóa được (422 FEE_PRICE_LOCKED).
 */
export function FeePricesDialog({ feeId, onClose }) {
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const query = useQuery({
    queryKey: [...queryKeys.fees.all, 'detail', feeId],
    queryFn: ({ signal }) => feesApi.get(feeId, { signal }),
  })
  const remove = useAction({
    mutationFn: (priceId) => feesApi.deletePrice(feeId, priceId),
    invalidate: [queryKeys.fees.all, queryKeys.invoices.all],
    success: 'Đã xóa bản giá.',
    toastErrors: false,
  })
  const fee = query.data

  const columns = fee && [
    {
      key: 'from',
      header: 'Hiệu lực từ',
      primary: true,
      cell: (p) => (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {formatDate(p.effectiveFrom)}
          {p.id === fee.currentPrice?.id && <Badge tone="success">Đang áp dụng</Badge>}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Giá',
      cell: (p) =>
        p.tiers?.length ? (
          <ul style={{ margin: 0, paddingLeft: 'var(--space-4)' }}>
            {describeTiers(p.tiers, fee.unit).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          `${formatMoney(p.unitPrice)}/${fee.unit}`
        ),
    },
    { key: 'note', header: 'Ghi chú', hideOnMobile: true, cell: (p) => p.note ?? '—' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (p) =>
        fee.isArchived ? null : (
          <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDeleting(p)}>
            Xóa
          </Button>
        ),
    },
  ]

  return (
    <Modal open onClose={onClose} title={fee ? `Bảng giá — ${fee.name}` : 'Bảng giá'} size="lg" footer={<Button variant="secondary" onClick={onClose}>Đóng</Button>}>
      <QueryView query={query} loading="page" errorTitle="Không tải được bảng giá">
        {() => (
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <Alert tone="info">
              Giá áp cho một kỳ là bản giá mới nhất có ngày hiệu lực không sau <strong>ngày cuối kỳ</strong>, áp cho cả kỳ — không chia nửa kỳ giá cũ, nửa
              kỳ giá mới. Tăng giá thì báo người thuê trước và đặt ngày hiệu lực từ kỳ muốn áp.
            </Alert>
            {fee.prices.length === 0 ? (
              <EmptyState title="Chưa có giá" description="Khoản chưa có giá thì chưa lập được phiếu tiền phòng." />
            ) : (
              <DataTable columns={columns} rows={fee.prices} caption="Bảng giá" />
            )}
            {!fee.isArchived &&
              (adding ? (
                <AddPriceForm fee={fee} onDone={() => setAdding(false)} />
              ) : (
                <div>
                  <Button icon={Plus} onClick={() => setAdding(true)}>
                    Thêm giá mới
                  </Button>
                </div>
              ))}
          </div>
        )}
      </QueryView>
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Xóa bản giá?"
        message={deleting ? `Bản giá hiệu lực từ ${formatDate(deleting.effectiveFrom)} sẽ bị xóa. Phiếu nháp dùng giá này chuyển "Cần tính lại"; bản giá thuộc kỳ đã chốt phiếu thì không xóa được.` : ''}
        confirmLabel="Xóa bản giá"
        tone="danger"
        onConfirm={() => remove.mutateAsync(deleting.id)}
      />
    </Modal>
  )
}
