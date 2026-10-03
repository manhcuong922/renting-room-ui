import { http } from '@/lib/http/client'

// docs/api/exports.md — trả { blob, filename }
export const exportsApi = {
  renters: (filter) => http.post('/exports/renters', filter, { responseType: 'blob' }),
}
