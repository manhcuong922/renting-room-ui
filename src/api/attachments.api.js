import { env } from '@/config/env'
import { http } from '@/lib/http/client'

const FILE = { responseType: 'blob', timeoutMs: env.bulkRequestTimeoutMs }

// docs/api/attachments.md — ảnh / tài liệu đính kèm. Không có URL công khai: xem / tải đều qua API có token.
export const attachmentsApi = {
  // { items: [{ id, ownerType, ownerId, category, fileName, contentType, sizeBytes, isSensitive, description, uploadedAt }] }
  list: (query, options) => http.get('/attachments', { ...options, query }),

  // multipart/form-data. KHÔNG gửi Idempotency-Key (upload không idempotent); không tự đặt Content-Type để trình duyệt thêm boundary.
  upload: ({ ownerType, ownerId, category, description, files }, options) => {
    const form = new FormData()
    form.append('ownerType', ownerType)
    form.append('ownerId', ownerId)
    form.append('category', category)
    if (description) form.append('description', description)
    for (const file of files) form.append('files', file, file.name)
    return http.post('/attachments', form, { ...options, timeoutMs: env.bulkRequestTimeoutMs })
  },

  // → { blob, filename }. inline=true: ảnh không nhạy cảm để hiển thị (tệp nhạy cảm luôn trả về dạng tải về).
  content: (id, { inline = false } = {}, options) =>
    http.get(`/attachments/${id}/content`, { ...options, ...FILE, query: inline ? { inline: true } : undefined }),

  remove: (id) => http.delete(`/attachments/${id}`),
}
