import { Link2, Link2Off } from 'lucide-react'
import { useState } from 'react'
import { notificationsApi, queryKeys } from '@/api'
import { Alert, Badge, Button, ConfirmDialog, CopyButton, Modal, Section } from '@/components/ui'
import { useAction } from '@/hooks/useAction'
import { formatDateTime } from '@/lib/format'
import { useNotificationChannels } from '../hooks'

/**
 * Liên kết Zalo của người thuê (notifications.md): chủ trọ tạo mã 8 ký tự → đưa cho người thuê → người thuê nhắn mã cho bot.
 * Mã thô chỉ trả MỘT lần (server chỉ lưu hash) nên hiện ngay trong hộp thoại; mất thì tạo lại. Hồ sơ đã ẩn danh: không liên kết.
 */
export function ZaloLinkSection({ renter, canManage }) {
  const channels = useNotificationChannels()
  const [created, setCreated] = useState(null) // { code, expiresAt, botName }
  const [unlinking, setUnlinking] = useState(false)
  const invalidate = [queryKeys.renters.all]
  const createCode = useAction({ mutationFn: () => notificationsApi.createLinkCode(renter.id), onSuccess: setCreated })
  const unlink = useAction({ mutationFn: () => notificationsApi.unlinkZalo(renter.id), invalidate, success: 'Đã hủy liên kết Zalo.' })
  if (renter.anonymizedAt) return null

  const configured = channels.data?.zalo?.configured === true
  return (
    <Section
      title="Nhận phiếu qua Zalo"
      description="Liên kết để hệ thống gửi phiếu tiền phòng và nhắc nợ qua bot Zalo (khu phải bật “Tự gửi” ở tab Thông báo)."
      actions={
        canManage && (
          <>
            {renter.zaloLinked && (
              <Button size="sm" variant="ghost" icon={Link2Off} onClick={() => setUnlinking(true)}>
                Hủy liên kết
              </Button>
            )}
            <Button size="sm" variant="secondary" icon={Link2} disabled={!configured} loading={createCode.isPending} onClick={() => createCode.mutate()}>
              {renter.zaloLinked ? 'Tạo mã liên kết lại' : 'Tạo mã liên kết'}
            </Button>
          </>
        )
      }
    >
      <p>
        {renter.zaloLinked ? (
          <>
            <Badge tone="success">Đã liên kết</Badge> {renter.zaloLinkedAt && <>từ {formatDateTime(renter.zaloLinkedAt)}</>}
          </>
        ) : (
          <Badge>Chưa liên kết</Badge>
        )}
      </p>
      {channels.isSuccess && !configured && <Alert tone="warning">Máy chủ chưa cấu hình Zalo Bot — liên hệ người vận hành. Trong lúc đó vẫn gửi tay được.</Alert>}

      <Modal
        open={Boolean(created)}
        onClose={() => setCreated(null)}
        title="Mã liên kết Zalo"
        description="Mã chỉ hiện một lần. Đưa cho người thuê để nhắn cho bot."
        footer={<Button onClick={() => setCreated(null)}>Đóng</Button>}
      >
        {created && (
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <p style={{ fontSize: '1.75rem', letterSpacing: '0.2em', fontWeight: 700, fontFamily: 'monospace' }}>{created.code}</p>
            <div>
              <CopyButton value={created.code} label="Sao chép mã" />
            </div>
            <p>
              Người thuê mở Zalo, tìm bot <strong>{created.botName ?? '(tên bot do chủ trọ đặt)'}</strong>, nhắn mã trên. Mã dùng một lần, hết hạn lúc {formatDateTime(created.expiresAt)}.
              Muốn ngừng nhận tin thì nhắn <strong>HUY</strong>.
            </p>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={unlinking}
        onClose={() => setUnlinking(false)}
        title="Hủy liên kết Zalo?"
        message="Tin Zalo đang chờ gửi của người này sẽ bị hủy. Người thuê muốn nhận lại thì tạo mã mới."
        confirmLabel="Hủy liên kết"
        tone="danger"
        onConfirm={() => unlink.mutateAsync()}
      />
    </Section>
  )
}
