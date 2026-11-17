import { Download } from 'lucide-react'
import { Alert, Button, Modal, PageLoader } from '@/components/ui'
import { saveBlob } from '@/lib/download'
import { getErrorMessage } from '@/lib/http/ApiError'
import { attachmentsApi } from '@/api'
import { useAttachmentBlobUrl } from '../useAttachmentBlobUrl'
import styles from './AttachmentsSection.module.css'

/**
 * Xem ảnh / PDF trong hộp thoại. Tệp nhạy cảm chỉ tải khi mở hộp này (BE ghi nhật ký mỗi lần) và không giữ trong bộ nhớ đệm sau khi đóng.
 */
export function AttachmentPreviewDialog({ attachment, onClose }) {
  const isImage = attachment.contentType.startsWith('image/')
  const { url, isPending, error } = useAttachmentBlobUrl(attachment.id, { inline: isImage && !attachment.isSensitive, retain: !attachment.isSensitive })

  const download = async () => {
    const { blob, filename } = await attachmentsApi.content(attachment.id)
    saveBlob(blob, filename ?? attachment.fileName)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={attachment.fileName}
      size="lg"
      footer={
        <>
          <Button variant="secondary" icon={Download} onClick={download}>
            Tải về
          </Button>
          <Button onClick={onClose}>Đóng</Button>
        </>
      }
    >
      {error && <Alert>{getErrorMessage(error)}</Alert>}
      {isPending && <PageLoader />}
      {url && isImage && <img src={url} alt={attachment.fileName} className={styles.previewImage} />}
      {url && !isImage && <iframe src={url} title={attachment.fileName} className={styles.previewFrame} />}
    </Modal>
  )
}
