import { env } from '@/config/env'
import { http } from '@/lib/http/client'

// Xuất tới 20.000 dòng — lâu hơn timeout mặc định (L-23).
const FILE = { responseType: 'blob', timeoutMs: env.bulkRequestTimeoutMs }

// docs/api/exports.md — trả { blob, filename }
export const exportsApi = {
  renters: (filter) => http.post('/exports/renters', filter, FILE),
  // Thu tiền theo kỳ (exports.md#thu-tiền-theo-kỳ): { propertyIds, fromMonth, toMonth, includeDrafts }
  monthlyInvoices: (filter) => http.post('/exports/monthly-invoices', filter, FILE),
}
