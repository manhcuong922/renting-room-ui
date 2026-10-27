import { http } from '@/lib/http/client'

// docs/api/payments.md — ghi nhận tiền người thuê đã trả vào phiếu đã chốt. Không sửa / xóa phiếu thu: nhập sai thì đảo rồi ghi lại.
export const paymentsApi = {
  // Số nợ của hợp đồng: { outstanding, overdueAmount, refundDue, unpaidInvoices, draftInvoices, pendingRoomCharges }
  balance: (contractId, options) => http.get(`/contracts/${contractId}/balance`, options),
  // Có invoiceId = thu cho đúng phiếu đó; không có = tự trừ phiếu cũ nhất trước → 201 phiếu thu
  record: (contractId, body, { idempotencyKey }) => http.post(`/contracts/${contractId}/payments`, body, { idempotencyKey }),
  // ?contractId= | roomId= | invoiceId= → MẢNG, mới nhất trước
  list: (query, options) => http.get('/payments', { ...options, query }),
  // → 200 phiếu thu (status Reversed)
  reverse: (id, reason) => http.post(`/payments/${id}/reverse`, { reason }),
  // Bỏ nợ — chủ trọ hoặc phó quản lý được cấp quyền (403 WRITE_OFF_NOT_ALLOWED)
  // → 200 { payment, writeOff }
  payAndWriteOff: (invoiceId, body, { idempotencyKey }) => http.post(`/invoices/${invoiceId}/pay-and-write-off`, body, { idempotencyKey }),
  // amount null = toàn bộ số còn nợ → 200 phiếu thu kind WriteOff
  writeOff: (invoiceId, body, { idempotencyKey }) => http.post(`/invoices/${invoiceId}/write-off`, body, { idempotencyKey }),
}
