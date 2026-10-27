import { Archive, ArchiveRestore, Copy, ListChecks, Pencil, Plus, Receipt, Tags } from 'lucide-react'
import { useState } from 'react'
import { feesApi, queryKeys } from '@/api'
import { Alert, Badge, Button, CheckboxField, ConfirmDialog, DataTable, EmptyState, QueryView, Toolbar } from '@/components/ui'
import { CHARGE_BASIS_LABELS, VEHICLE_TYPE_LABELS } from '@/constants/enums'
import { formatFeePrice } from '@/features/contracts/feeRules'
import { usePropertyFees } from '@/features/shared/queries'
import { useAction } from '@/hooks/useAction'
import { CopyFeesDialog } from './CopyFeesDialog'
import { FeeFormDialog } from './FeeFormDialog'
import { FeePricesDialog } from './FeePricesDialog'
import { FeeUsageDialog } from './FeeUsageDialog'

const describeBasis = (fee) =>
  fee.group === 'Metered' ? 'Theo công tơ của phòng' : `${CHARGE_BASIS_LABELS[fee.chargeBasis] ?? fee.chargeBasis}${fee.vehicleType ? ` · giữ ${VEHICLE_TYPE_LABELS[fee.vehicleType]?.toLowerCase()}` : ''}`

/**
 * Tab Khoản thu của khu (docs/api/fees.md): điện nước theo công tơ + dịch vụ theo phòng / đầu người / số gói, kèm bảng giá.
 * Khu ngừng sử dụng → chỉ xem.
 */
export function FeesTab({ property }) {
  const [includeArchived, setIncludeArchived] = useState(false)
  const [dialog, setDialog] = useState(null) // { type: 'create' | 'copy' } | { type: 'edit' | 'prices' | 'usage' | 'archive' | 'restore', fee }
  const query = usePropertyFees(property.id, { includeArchived })
  const readOnly = property.isArchived

  const invalidate = [queryKeys.fees.all]
  const archive = useAction({ mutationFn: (id) => feesApi.archive(id), invalidate, success: 'Đã ngừng dùng khoản thu.', toastErrors: false })
  const restore = useAction({ mutationFn: (id) => feesApi.restore(id), invalidate, success: 'Đã khôi phục khoản thu.', toastErrors: false })
  const close = () => setDialog(null)
  const fee = dialog?.fee

  const columns = [
    {
      key: 'name',
      header: 'Khoản thu',
      primary: true,
      cell: (f) => (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <strong>{f.name}</strong>
          {f.isArchived && <Badge>Ngừng dùng</Badge>}
        </span>
      ),
    },
    { key: 'basis', header: 'Cách tính', cell: describeBasis },
    {
      key: 'price',
      header: 'Giá hiện tại',
      cell: (f) => formatFeePrice(f.currentPrice, f.unit) ?? (f.isArchived ? '—' : <Badge tone="danger">Chưa có giá</Badge>),
    },
    { key: 'attach', header: 'Tự gắn HĐ mới', hideOnMobile: true, cell: (f) => (f.group === 'Metered' ? '—' : f.autoAttach ? 'Có' : 'Không') },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'right',
      cell: (f) => (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
          <Button size="sm" variant="secondary" icon={Tags} onClick={() => setDialog({ type: 'prices', fee: f })}>
            Bảng giá
          </Button>
          {!readOnly && !f.isArchived && (
            <>
              {f.group === 'Service' && (
                <Button size="sm" variant="secondary" icon={ListChecks} onClick={() => setDialog({ type: 'usage', fee: f })}>
                  Phòng đang dùng
                </Button>
              )}
              <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setDialog({ type: 'edit', fee: f })}>
                Sửa
              </Button>
              <Button size="sm" variant="ghost" icon={Archive} onClick={() => setDialog({ type: 'archive', fee: f })}>
                Ngừng dùng
              </Button>
            </>
          )}
          {!readOnly && f.isArchived && (
            <Button size="sm" variant="secondary" icon={ArchiveRestore} onClick={() => setDialog({ type: 'restore', fee: f })}>
              Khôi phục
            </Button>
          )}
        </span>
      ),
    },
  ]

  return (
    <>
      <Toolbar>
        <CheckboxField label="Hiện cả khoản ngừng dùng" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
        {!readOnly && (
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginLeft: 'auto' }}>
            <Button variant="secondary" icon={Copy} onClick={() => setDialog({ type: 'copy' })}>
              Sao chép từ khu khác
            </Button>
            <Button icon={Plus} onClick={() => setDialog({ type: 'create' })}>
              Thêm khoản thu
            </Button>
          </span>
        )}
      </Toolbar>

      <QueryView
        query={query}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState icon={Receipt} title="Chưa có khoản thu" description="Thêm điện, nước, mạng, giữ xe… để tính vào phiếu tiền phòng." />}
        errorTitle="Không tải được khoản thu"
      >
        {(fees) => (
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {fees.some((f) => !f.isArchived && !f.currentPrice) && (
              <Alert tone="warning">Có khoản chưa có giá — vào Bảng giá để nhập, nếu không sẽ không chốt được phiếu tiền phòng.</Alert>
            )}
            <DataTable columns={columns} rows={fees} caption="Khoản thu của khu" />
          </div>
        )}
      </QueryView>

      {dialog?.type === 'create' && <FeeFormDialog propertyId={property.id} onClose={close} />}
      {dialog?.type === 'edit' && <FeeFormDialog propertyId={property.id} fee={fee} onClose={close} />}
      {dialog?.type === 'prices' && <FeePricesDialog feeId={fee.id} onClose={close} />}
      {dialog?.type === 'usage' && <FeeUsageDialog fee={fee} onClose={close} />}
      {dialog?.type === 'copy' && <CopyFeesDialog property={property} onClose={close} />}
      <ConfirmDialog
        open={dialog?.type === 'archive'}
        onClose={close}
        title={`Ngừng dùng "${fee?.name ?? ''}"?`}
        message={
          fee?.group === 'Metered'
            ? 'Chỉ ngừng được khi không còn phòng nào có công tơ đang hoạt động của khoản này — tháo hoặc thay công tơ trước.'
            : 'Chỉ ngừng được khi không còn hợp đồng nháp / hiệu lực / đang thanh lý nào gắn khoản này — gỡ khỏi các hợp đồng trước (màn Phòng đang dùng).'
        }
        confirmLabel="Ngừng dùng"
        tone="danger"
        onConfirm={() => archive.mutateAsync(fee.id)}
      />
      <ConfirmDialog
        open={dialog?.type === 'restore'}
        onClose={close}
        title={`Khôi phục "${fee?.name ?? ''}"?`}
        message="Không khôi phục được nếu khu đã có khoản khác cùng tên đang dùng."
        confirmLabel="Khôi phục"
        onConfirm={() => restore.mutateAsync(fee.id)}
      />
    </>
  )
}
