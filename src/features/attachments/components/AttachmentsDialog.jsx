import { Button, Modal } from '@/components/ui'
import { AttachmentsSection } from './AttachmentsSection'

/**
 * Hộp thoại ảnh / tài liệu của một dòng trong danh sách (chỉ số công tơ, phiếu thu…) — nơi không có chỗ cho cả một khu "Ảnh và tài liệu".
 */
export function AttachmentsDialog({ ownerType, ownerId, title, description, canManage, onClose }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      <AttachmentsSection ownerType={ownerType} ownerId={ownerId} title="Tệp đính kèm" description={description} canManage={canManage} />
    </Modal>
  )
}
