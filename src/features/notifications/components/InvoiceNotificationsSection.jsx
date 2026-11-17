import { useQuery } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { useState } from 'react'
import { notificationsApi, queryKeys } from '@/api'
import { Alert, Badge, Button, CheckboxGroup, DataTable, EmptyState, FormDialog, QueryView, Section, useToast } from '@/components/ui'
import { NOTIFICATION_CHANNEL_LABELS, NOTIFICATION_KIND_LABELS, NOTIFICATION_STATUS, toOptions } from '@/constants/enums'
import { useInvalidate } from '@/hooks/useAction'
import { formatDateTime } from '@/lib/format'

const COLUMNS = [
  { key: 'when', header: 'Tạo lúc', primary: true, cell: (n) => formatDateTime(n.createdAt) },
  { key: 'channel', header: 'Kênh', cell: (n) => NOTIFICATION_CHANNEL_LABELS[n.channel] ?? n.channel },
  {
    key: 'kind',
    header: 'Loại',
    cell: (n) => (n.kind === 'OverdueReminder' ? `Nhắc nợ (sau hạn ${n.step} ngày)` : (NOTIFICATION_KIND_LABELS[n.kind] ?? n.kind)),
  },
  {
    key: 'status',
    header: 'Trạng thái',
    cell: (n) => {
      const status = NOTIFICATION_STATUS[n.status] ?? { label: n.status, tone: 'neutral' }
      return <Badge tone={status.tone}>{status.label}</Badge>
    },
  },
  { key: 'attempts', header: 'Lần thử', align: 'right', hideOnMobile: true, cell: (n) => n.attempts },
  { key: 'sent', header: 'Gửi lúc', hideOnMobile: true, cell: (n) => (n.sentAt ? formatDateTime(n.sentAt) : '—') },
  { key: 'error', header: 'Lỗi', hideOnMobile: true, cell: (n) => n.lastError ?? '—' },
]

/**
 * Lịch sử gửi của phiếu đã chốt + "Gửi lại" (notifications.md). Gửi lại không bị giới hạn khung giờ 08:00–20:00; chọn kênh hoặc để trống = mọi kênh người đứng tên có.
 * Người đứng tên chưa có kênh nào → 422 NO_NOTIFICATION_CHANNEL: hiện lỗi trong hộp thoại để chủ trọ liên kết Zalo / thêm email.
 */
export function InvoiceNotificationsSection({ invoice, canResend }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const [resending, setResending] = useState(false)
  const invoiceId = invoice.summary.id
  const finalized = invoice.summary.status === 'Finalized'
  const query = useQuery({
    queryKey: queryKeys.notifications.byInvoice(invoiceId),
    queryFn: ({ signal }) => notificationsApi.listForInvoice(invoiceId, { signal }),
    enabled: finalized,
  })
  if (!finalized) return null

  return (
    <Section
      title="Gửi cho người thuê"
      description="Phiếu tự gửi khi chốt nếu khu bật “Tự gửi”. Tin tự động chỉ đi trong 08:00–20:00; gửi lại thì đi ngay."
      actions={
        canResend && (
          <Button size="sm" variant="secondary" icon={Send} onClick={() => setResending(true)}>
            Gửi lại
          </Button>
        )
      }
    >
      <QueryView query={query} isEmpty={(d) => d.length === 0} empty={<EmptyState title="Chưa gửi tin nào cho phiếu này" />} errorTitle="Không tải được lịch sử gửi">
        {(rows) => <DataTable columns={COLUMNS} rows={rows} caption="Lịch sử gửi phiếu" />}
      </QueryView>

      {resending && (
        <FormDialog
          title="Gửi lại phiếu cho người đứng tên?"
          description="Gửi nội dung mới nhất của phiếu (số còn nợ cập nhật). Bỏ trống kênh = mọi kênh người đứng tên có."
          initial={{ channels: [] }}
          codeFields={{ NO_NOTIFICATION_CHANNEL: 'channels', INVALID_CHANNEL: 'channels' }}
          submitLabel="Gửi lại"
          onClose={() => setResending(false)}
          onSubmit={async (v) => {
            await notificationsApi.resend(invoiceId, v.channels)
            await invalidate(queryKeys.notifications.byInvoice(invoiceId))
            toast.success('Đã đưa vào hàng đợi gửi.')
          }}
        >
          {(form) => (
            <>
              <CheckboxGroup label="Kênh" options={toOptions(NOTIFICATION_CHANNEL_LABELS)} {...form.field('channels', { type: 'value' })} />
              <Alert tone="info">Người đứng tên chưa liên kết Zalo và chưa có email thì không gửi được — liên kết ở hồ sơ người thuê.</Alert>
            </>
          )}
        </FormDialog>
      )}
    </Section>
  )
}
