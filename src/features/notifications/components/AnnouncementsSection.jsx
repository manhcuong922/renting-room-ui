import { useQuery } from '@tanstack/react-query'
import { Megaphone } from 'lucide-react'
import { useState } from 'react'
import { notificationsApi, queryKeys } from '@/api'
import {
  Alert,
  Button,
  CheckboxGroup,
  DataTable,
  EmptyState,
  FormDialog,
  Pagination,
  QueryView,
  RadioGroup,
  Section,
  TextAreaField,
  TextField,
  useToast,
} from '@/components/ui'
import { usePropertyRooms } from '@/features/shared/queries'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { useInvalidate } from '@/hooks/useAction'
import { formatDateTime } from '@/lib/format'
import { useNotificationChannels } from '../hooks'

const TITLE_MAX = 100
const BODY_MAX = 1500
const PAGE_SIZE = 10
const WINDOW_START = 8
const WINDOW_END = 20
/** Phòng có thể có HĐ hiệu lực — server chỉ gửi người đứng tên HĐ Hiệu lực / Đang thanh lý (NT-BR-20). */
const SELECTABLE_STATUSES = new Set(['Occupied', 'Reserved'])

const SCOPE_OPTIONS = [
  { value: 'all', label: 'Tất cả phòng đang thuê' },
  { value: 'selected', label: 'Chọn phòng' },
]

const COLUMNS = [
  { key: 'when', header: 'Gửi lúc', primary: true, cell: (a) => formatDateTime(a.createdAt) },
  {
    key: 'title',
    header: 'Tiêu đề',
    cell: (a) => (
      <span title={a.body} style={{ whiteSpace: 'normal' }}>
        {a.title}
      </span>
    ),
  },
  { key: 'scope', header: 'Phạm vi', hideOnMobile: true, cell: (a) => (a.allRooms ? 'Tất cả phòng' : `${a.roomCount} phòng chọn`) },
  { key: 'recipients', header: 'Người nhận', align: 'right', cell: (a) => a.recipientCount },
  { key: 'sent', header: 'Đã gửi', align: 'right', cell: (a) => a.sent },
  { key: 'pending', header: 'Đang chờ', align: 'right', hideOnMobile: true, cell: (a) => a.pending },
  { key: 'failed', header: 'Lỗi', align: 'right', cell: (a) => (a.failed ? <strong style={{ color: 'var(--color-danger)' }}>{a.failed}</strong> : 0) },
]

function validate(v) {
  const title = v.title.trim()
  const body = v.body.trim()
  return {
    title: !title ? 'Nhập tiêu đề.' : title.length > TITLE_MAX ? `Tối đa ${TITLE_MAX} ký tự.` : null,
    body: !body ? 'Nhập nội dung.' : body.length > BODY_MAX ? `Tối đa ${BODY_MAX} ký tự.` : null,
    roomIds: v.scope === 'selected' && v.roomIds.length === 0 ? 'Chọn ít nhất một phòng.' : null,
  }
}

function isOutsideSendWindow(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Ho_Chi_Minh' }).format(now))
  return hour < WINDOW_START || hour >= WINDOW_END
}

/**
 * Thông báo chung của khu (notifications.md — M11 §17): chủ trọ soạn tiêu đề + nội dung (tăng giá điện, cắt nước…) rồi gửi qua Zalo cho người đứng tên
 * mọi phòng đang thuê hoặc các phòng chọn. Gửi ngay, kể cả ngoài 08:00–20:00 (chỉ cảnh báo). Đã gửi thì không thu hồi được.
 */
export function AnnouncementsSection({ property }) {
  const toast = useToast()
  const invalidate = useInvalidate()
  const idem = useIdempotencyKey()
  const channels = useNotificationChannels()
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const params = { page, pageSize: PAGE_SIZE }
  const query = useQuery({
    queryKey: queryKeys.notifications.announcements(property.id, params),
    queryFn: ({ signal }) => notificationsApi.listAnnouncements(property.id, params, { signal }),
  })
  const zaloConfigured = channels.isSuccess && channels.data.zalo.configured

  return (
    <Section
      title="Thông báo chung"
      description="Gửi tin qua Zalo cho người đứng tên hợp đồng — VD tăng giá điện, cắt nước, bảo trì. Chỉ người đã liên kết Zalo nhận được."
      actions={
        <Button size="sm" variant="secondary" icon={Megaphone} disabled={!zaloConfigured || property.isArchived} onClick={() => setOpen(true)}>
          Gửi thông báo
        </Button>
      }
    >
      {channels.isSuccess && !zaloConfigured && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert tone="warning">Máy chủ chưa cấu hình Zalo Bot — chưa gửi thông báo được. Liên hệ người vận hành.</Alert>
        </div>
      )}
      <QueryView
        query={query}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState title="Chưa gửi thông báo nào" description="Bấm “Gửi thông báo” để nhắn cho người thuê của khu." />}
        errorTitle="Không tải được danh sách thông báo"
      >
        {(data) => (
          <>
            <DataTable columns={COLUMNS} rows={data.items} caption="Thông báo chung đã gửi" />
            <Pagination page={data.page} pageSize={data.pageSize} totalCount={data.totalCount} totalPages={data.totalPages} onPageChange={setPage} />
          </>
        )}
      </QueryView>

      {open && (
        <SendAnnouncementDialog
          property={property}
          onClose={() => setOpen(false)}
          onSubmit={async (v) => {
            const body = { title: v.title.trim(), body: v.body.trim(), roomIds: v.scope === 'selected' ? v.roomIds : null }
            const result = await notificationsApi.sendAnnouncement(property.id, body, idem.keyFor(body))
            idem.reset()
            setPage(1)
            await invalidate(queryKeys.notifications.announcements(property.id))
            toast.success(`Đã xếp ${result.queued} tin Zalo cho ${result.roomCount} phòng.`)
            if (result.noChannelRooms.length > 0) {
              const codes = result.noChannelRooms.map((r) => r.roomCode).join(', ')
              toast.warning(`Chưa liên kết Zalo, cần nhắn tay: ${codes}.`, { title: `${result.noChannelRooms.length} phòng không nhận được` })
            }
          }}
        />
      )}
    </Section>
  )
}

function SendAnnouncementDialog({ property, onClose, onSubmit }) {
  const rooms = usePropertyRooms(property.id)
  const selectable = (rooms.data ?? []).filter((r) => SELECTABLE_STATUSES.has(r.status))
  const roomOptions = selectable.map((r) => ({ value: r.id, label: r.code }))
  const occupiedCount = (rooms.data ?? []).filter((r) => r.status === 'Occupied').length
  const night = isOutsideSendWindow()

  return (
    <FormDialog
      title="Gửi thông báo cho người thuê"
      description={`Khu ${property.name}. Gửi qua Zalo cho người đứng tên hợp đồng — người ở cùng không nhận.`}
      initial={{ title: '', body: '', scope: 'all', roomIds: [] }}
      validate={validate}
      codeFields={{ ROOM_NOT_FOUND: 'roomIds' }}
      submitLabel="Gửi thông báo"
      size="md"
      onClose={onClose}
      onSubmit={onSubmit}
    >
      {(form) => (
        <>
          <TextField label="Tiêu đề" required maxLength={TITLE_MAX} placeholder="VD: Tăng giá điện từ 01/12/2026" {...form.field('title')} />
          <TextAreaField
            label="Nội dung"
            required
            rows={6}
            maxLength={BODY_MAX}
            hint={`${form.values.body.length}/${BODY_MAX} ký tự`}
            placeholder="VD: Từ kỳ thu tháng 12/2026 giá điện tăng lên 3.800đ/kWh. Mọi thắc mắc liên hệ chủ trọ."
            {...form.field('body')}
          />
          <RadioGroup label="Gửi tới" options={SCOPE_OPTIONS} value={form.values.scope} onChange={(scope) => form.setValue('scope', scope)} />
          {form.values.scope === 'all' ? (
            <Alert tone="info">
              {rooms.isSuccess
                ? `Khu đang có ${occupiedCount} phòng đang thuê. Phòng chưa liên kết Zalo sẽ được liệt kê sau khi gửi để bạn nhắn tay.`
                : 'Gửi cho người đứng tên mọi phòng đang thuê của khu.'}
            </Alert>
          ) : rooms.isPending ? (
            <p style={{ color: 'var(--color-text-muted)' }}>Đang tải danh sách phòng…</p>
          ) : roomOptions.length === 0 ? (
            <Alert tone="warning">Khu chưa có phòng đang thuê.</Alert>
          ) : (
            <CheckboxGroup label={`Phòng (${form.values.roomIds.length} đã chọn)`} options={roomOptions} {...form.field('roomIds', { type: 'value' })} />
          )}
          {night && <Alert tone="warning">Đang ngoài 08:00–20:00 — thông báo vẫn gửi ngay, người thuê sẽ nhận tin lúc này.</Alert>}
          <Alert tone="warning">Gửi rồi không thu hồi được — kiểm tra kỹ nội dung trước khi bấm gửi.</Alert>
        </>
      )}
    </FormDialog>
  )
}
