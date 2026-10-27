import { useQuery } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { metersApi, queryKeys } from '@/api'
import { Badge, Button, ConfirmDialog, DataTable, EmptyState, Modal, QueryView } from '@/components/ui'
import { READING_KIND_LABELS } from '@/constants/enums'
import { useAction } from '@/hooks/useAction'
import { formatDate } from '@/lib/format'
import { VOIDABLE_KINDS, formatReading } from '../meterRules'
import { AdjustReadingDialog, CorrectReadingDialog } from './MeterDialogs'

/**
 * Lịch sử chỉ số của một công tơ (meters.md#lịch-sử--sửa-chỉ-số, #hủy-chỉ-số-ghi-nhầm), mới nhất trước.
 * Sửa: mọi chỉ số chưa bị phiếu đã chốt khóa. Hủy: chỉ chỉ số cuối kỳ và kiểm tra.
 */
export function MeterReadingsDialog({ meter, onClose }) {
  const [editing, setEditing] = useState(null)
  const [voiding, setVoiding] = useState(null)
  const [adjusting, setAdjusting] = useState(null) // { reading, value } — chỉ số đã khóa bởi hóa đơn đã chốt
  const query = useQuery({
    queryKey: queryKeys.meters.readings(meter.id),
    queryFn: ({ signal }) => metersApi.readings(meter.id, { signal }),
  })
  const voidReading = useAction({
    mutationFn: ({ id, reason }) => metersApi.voidReading(id, { reason }),
    invalidate: [queryKeys.rooms.all, queryKeys.meters.all, queryKeys.invoices.all],
    success: 'Đã hủy chỉ số.',
    toastErrors: false,
  })

  const columns = [
    { key: 'date', header: 'Ngày ghi', primary: true, cell: (r) => formatDate(r.readingDate) },
    { key: 'kind', header: 'Loại', cell: (r) => <Badge>{READING_KIND_LABELS[r.kind] ?? r.kind}</Badge> },
    { key: 'value', header: `Chỉ số (${meter.unit})`, align: 'right', cell: (r) => formatReading(r.value) },
    { key: 'note', header: 'Ghi chú', hideOnMobile: true, cell: (r) => r.note ?? '—' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) => (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
          <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(r)}>
            Sửa
          </Button>
          {VOIDABLE_KINDS.has(r.kind) && (
            <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setVoiding(r)}>
              Hủy
            </Button>
          )}
        </span>
      ),
    },
  ]

  return (
    <Modal
      open
      onClose={onClose}
      title={`Lịch sử chỉ số — ${meter.feeTypeName}${meter.serialNo ? ` (${meter.serialNo})` : ''}`}
      description="Chỉ số đã dùng cho phiếu đã chốt thì khóa — sửa bằng “Điều chỉnh chỉ số đã chốt” (tự xử lý phần chênh)."
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      <QueryView query={query} isEmpty={(d) => d.length === 0} empty={<EmptyState title="Chưa có chỉ số" />} errorTitle="Không tải được lịch sử chỉ số">
        {(readings) => <DataTable columns={columns} rows={readings} caption="Lịch sử chỉ số" />}
      </QueryView>
      {editing && (
        <CorrectReadingDialog
          meter={meter}
          reading={editing}
          onClose={() => setEditing(null)}
          onLocked={(value) => {
            setAdjusting({ reading: editing, value })
            setEditing(null)
          }}
        />
      )}
      {adjusting && <AdjustReadingDialog meter={meter} reading={adjusting.reading} initialValue={adjusting.value} onClose={() => setAdjusting(null)} />}
      <ConfirmDialog
        open={Boolean(voiding)}
        onClose={() => setVoiding(null)}
        title="Hủy chỉ số?"
        message={
          voiding
            ? `Chỉ số ${formatReading(voiding.value)} ngày ${formatDate(voiding.readingDate)} sẽ không còn trong lịch sử. Phiếu nháp liên quan chuyển "Cần tính lại".`
            : ''
        }
        reasonLabel="Lý do hủy"
        reasonMaxLength={300}
        confirmLabel="Hủy chỉ số"
        tone="danger"
        onConfirm={(reason) => voidReading.mutateAsync({ id: voiding.id, reason })}
      />
    </Modal>
  )
}
