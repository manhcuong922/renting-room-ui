import { http } from '@/lib/http/client'

// docs/api/imports.md — nhập từ Excel (chỉ tạo mới, chỉ chủ trọ): tải mẫu → xem trước (server không giữ gì) → gửi lại các dòng để lưu.
// kind: 'rooms' (phòng) | 'tenancies' (người thuê đang ở).
export const importsApi = {
  // → { blob, filename }
  template: (propertyId, kind) => http.get(`/properties/${propertyId}/${kind}/import-template`, { responseType: 'blob' }),
  // multipart/form-data, field `file` (.xlsx ≤ 2 MB, ≤ 500 dòng) → { rows: [{ row, errors, warnings }], fileErrors, … }
  preview: (propertyId, kind, file) => {
    const body = new FormData()
    body.append('file', file)
    return http.post(`/properties/${propertyId}/${kind}/import/preview`, body)
  },
  // { rows } (đã sửa) — bắt buộc Idempotency-Key → { saved, skipped, units: [{ key, rowNumbers, outcome, errors }] }
  save: (propertyId, kind, rows, { idempotencyKey }) => http.post(`/properties/${propertyId}/${kind}/import`, { rows }, { idempotencyKey }),
}
