import { http } from '@/lib/http/client'

// docs/api/payments.md — ghi nhận tiền người thuê đã trả vào phiếu đã chốt. Nhập sai: sửa thẳng ô "Đã thu" (editCollected) — app tự đảo / ghi lại phiếu thu.
export const paymentsApi = {
  // Số nợ của hợp đồng: { outstanding, overdueAmount, refundDue, unpaidInvoices, draftInvoices, pendingRoomCharges }
  balance: (contractId, options) => http.get(`/contracts/${contractId}/balance`, options),
  // Có invoiceId = thu cho đúng phiếu đó; không có = tự trừ phiếu cũ nhất trước → 201 phiếu thu
  record: (contractId, body, { idempotencyKey }) => http.post(`/contracts/${contractId}/payments`, body, { idempotencyKey }),
  // ?contractId= | roomId= | invoiceId= → MẢNG, mới nhất trước
  list: (query, options) => http.get('/payments', { ...options, query }),
  // Sửa số "Đã thu" của hóa đơn (payments.md#sửa-số-đã-thu-09112026): { amount, expectedAmount, reason?, paidAt?, method? } → 200 { summary, payments }
  editCollected: (invoiceId, body, { idempotencyKey }) => http.put(`/invoices/${invoiceId}/collected`, body, { idempotencyKey }),
  // → 200 phiếu thu (status Reversed); phiếu thu có phiếu hoàn không còn được che thì đảo kèm phiếu hoàn
  reverse: (id, reason) => http.post(`/payments/${id}/reverse`, { reason }),
  // Bỏ nợ — chủ trọ và quản lý khu (khu được giao)
  // → 200 { payment, writeOff }
  payAndWriteOff: (invoiceId, body, { idempotencyKey }) => http.post(`/invoices/${invoiceId}/pay-and-write-off`, body, { idempotencyKey }),
  // amount null = toàn bộ số còn nợ → 200 phiếu thu kind WriteOff
  writeOff: (invoiceId, body, { idempotencyKey }) => http.post(`/invoices/${invoiceId}/write-off`, body, { idempotencyKey }),
}
