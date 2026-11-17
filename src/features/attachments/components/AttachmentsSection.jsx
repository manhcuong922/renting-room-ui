import { useQuery } from '@tanstack/react-query'
import { Download, Eye, FileText, Lock, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { attachmentsApi, queryKeys } from '@/api'
import { Badge, Button, ConfirmDialog, EmptyState, QueryView, SelectField, Section, useToast } from '@/components/ui'
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_CATEGORIES_BY_OWNER,
  ATTACHMENT_CATEGORY_LABELS,
  ATTACHMENT_LOCKED_CATEGORIES,
  ATTACHMENT_MAX_FILES,
  ATTACHMENT_MAX_FILE_BYTES,
  ATTACHMENT_SINGLE_CATEGORIES,
} from '@/constants/enums'
import { useAction } from '@/hooks/useAction'
import { saveBlob } from '@/lib/download'
import { formatDateTime } from '@/lib/format'
import { getErrorMessage } from '@/lib/http/ApiError'
import { useAttachmentBlobUrl } from '../useAttachmentBlobUrl'
import { AttachmentPreviewDialog } from './AttachmentPreviewDialog'
import styles from './AttachmentsSection.module.css'

const ALLOWED_TYPES = new Set(ATTACHMENT_ACCEPT.split(','))
const ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp|heic|pdf)$/i

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Kiểm trước khi gửi để báo lỗi ngay; server vẫn kiểm lại theo nội dung thật (docs/api/attachments.md). */
function validateFiles(files, single) {
  if (files.length === 0) return 'Chưa chọn tệp nào.'
  if (single && files.length > 1) return 'Loại tài liệu này chỉ giữ 1 tệp — chọn một tệp.'
  if (files.length > ATTACHMENT_MAX_FILES) return `Mỗi lần tải tối đa ${ATTACHMENT_MAX_FILES} tệp.`
  const tooBig = files.find((f) => f.size > ATTACHMENT_MAX_FILE_BYTES)
  if (tooBig) return `"${tooBig.name}" lớn hơn 10 MB.`
  const wrongType = files.find((f) => !ALLOWED_TYPES.has(f.type) && !ALLOWED_EXTENSIONS.test(f.name))
  if (wrongType) return `"${wrongType.name}" không phải ảnh JPEG / PNG / WEBP / HEIC hoặc PDF.`
  return null
}

function Thumbnail({ attachment }) {
  const isImage = attachment.contentType.startsWith('image/')
  // Chỉ tự tải ảnh không nhạy cảm; ảnh giấy tờ chỉ tải khi người dùng bấm Xem (mỗi lần tải được ghi nhật ký).
  const showImage = isImage && !attachment.isSensitive
  const { url, error } = useAttachmentBlobUrl(attachment.id, { inline: true, enabled: showImage })
  if (showImage && url) return <img src={url} alt={attachment.fileName} className={styles.image} loading="lazy" />
  const Icon = attachment.isSensitive ? Lock : FileText
  return (
    <span className={styles.placeholder} aria-hidden>
      <Icon size={28} />
      {showImage && error && <small>Không tải được ảnh</small>}
    </span>
  )
}

function AttachmentTile({ attachment, canManage, onPreview, onDelete }) {
  const toast = useToast()
  const [downloading, setDownloading] = useState(false)
  const download = async () => {
    setDownloading(true)
    try {
      const { blob, filename } = await attachmentsApi.content(attachment.id)
      saveBlob(blob, filename ?? attachment.fileName)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setDownloading(false)
    }
  }
  return (
    <li className={styles.tile}>
      <button type="button" className={styles.thumb} onClick={() => onPreview(attachment)} aria-label={`Xem ${attachment.fileName}`}>
        <Thumbnail attachment={attachment} />
      </button>
      <div className={styles.meta}>
        <strong className={styles.name} title={attachment.fileName}>
          {attachment.fileName}
        </strong>
        <span className={styles.badges}>
          <Badge tone="primary">{ATTACHMENT_CATEGORY_LABELS[attachment.category] ?? attachment.category}</Badge>
          {attachment.isSensitive && <Badge tone="warning">Nhạy cảm</Badge>}
        </span>
        <small className={styles.sub}>
          {formatBytes(attachment.sizeBytes)} · {formatDateTime(attachment.uploadedAt)}
        </small>
        {attachment.description && <small className={styles.sub}>{attachment.description}</small>}
      </div>
      <div className={styles.actions}>
        <Button size="sm" variant="secondary" icon={Eye} iconOnly onClick={() => onPreview(attachment)}>
          Xem
        </Button>
        <Button size="sm" variant="secondary" icon={Download} iconOnly loading={downloading} onClick={download}>
          Tải về
        </Button>
        {canManage && !ATTACHMENT_LOCKED_CATEGORIES.has(attachment.category) && (
          <Button size="sm" variant="ghost" icon={Trash2} iconOnly onClick={() => onDelete(attachment)}>
            Xóa
          </Button>
        )}
      </div>
    </li>
  )
}

/**
 * Khu "Ảnh và tài liệu" của một đối tượng (người thuê, phòng, khu…) — docs/api/attachments.md.
 * Loại tài liệu cho phép theo ownerType (ATTACHMENT_CATEGORIES_BY_OWNER); loại chỉ giữ 1 tệp thì tải lại sẽ thay tệp cũ.
 */
export function AttachmentsSection({ ownerType, ownerId, title = 'Ảnh và tài liệu', description, categories, canManage = false }) {
  const allowed = categories ?? ATTACHMENT_CATEGORIES_BY_OWNER[ownerType] ?? []
  const toast = useToast()
  const fileInput = useRef(null)
  const [category, setCategory] = useState(allowed[0])
  const [preview, setPreview] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const query = useQuery({
    queryKey: queryKeys.attachments.byOwner(ownerType, ownerId),
    queryFn: ({ signal }) => attachmentsApi.list({ ownerType, ownerId }, { signal }),
  })
  const invalidate = [queryKeys.attachments.all]
  const upload = useAction({
    mutationFn: (files) => attachmentsApi.upload({ ownerType, ownerId, category, files }),
    invalidate,
    success: (data) => `Đã tải lên ${data.items.length} tệp.`,
  })
  const remove = useAction({ mutationFn: (id) => attachmentsApi.remove(id), invalidate, success: 'Đã xóa tệp.', toastErrors: false })

  const onPick = (event) => {
    const files = [...event.target.files]
    event.target.value = '' // cho phép chọn lại đúng tệp đó lần sau
    const problem = validateFiles(files, ATTACHMENT_SINGLE_CATEGORIES.has(category))
    if (problem) toast.error(problem)
    else upload.mutate(files)
  }

  const uploader = canManage && (
    <>
      {allowed.length > 1 && (
        <SelectField
          label="Loại tài liệu"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={allowed.map((value) => ({ value, label: ATTACHMENT_CATEGORY_LABELS[value] ?? value }))}
        />
      )}
      <input
        ref={fileInput}
        type="file"
        hidden
        accept={ATTACHMENT_ACCEPT}
        multiple={!ATTACHMENT_SINGLE_CATEGORIES.has(category)}
        onChange={onPick}
        data-testid="attachment-file-input"
      />
      <Button icon={Upload} loading={upload.isPending} onClick={() => fileInput.current?.click()}>
        {ATTACHMENT_SINGLE_CATEGORIES.has(category) ? 'Tải lên / thay tệp' : 'Tải lên'}
      </Button>
    </>
  )

  return (
    <Section
      title={title}
      description={description ?? 'Ảnh JPEG, PNG, WEBP, HEIC hoặc PDF, tối đa 10 MB mỗi tệp. Ảnh giấy tờ chỉ xem được khi đăng nhập và mỗi lần xem đều được ghi nhật ký.'}
      actions={<div className={styles.uploader}>{uploader}</div>}
    >
      <QueryView
        query={query}
        loading="page"
        errorTitle="Không tải được danh sách tệp"
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState icon={FileText} title="Chưa có tệp nào" description={canManage ? 'Bấm "Tải lên" để thêm ảnh hoặc tài liệu.' : undefined} />}
      >
        {(data) => (
          <ul className={styles.grid}>
            {data.items.map((attachment) => (
              <AttachmentTile key={attachment.id} attachment={attachment} canManage={canManage} onPreview={setPreview} onDelete={setDeleting} />
            ))}
          </ul>
        )}
      </QueryView>

      {preview && <AttachmentPreviewDialog attachment={preview} onClose={() => setPreview(null)} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Xóa tệp?"
        message={deleting ? `"${deleting.fileName}" sẽ không còn hiện trong danh sách.` : undefined}
        confirmLabel="Xóa"
        tone="danger"
        onConfirm={() => remove.mutateAsync(deleting.id)}
      />
    </Section>
  )
}
