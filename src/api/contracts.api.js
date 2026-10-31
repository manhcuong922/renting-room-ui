import { http } from '@/lib/http/client'

// docs/api/contracts.md
export const contractsApi = {
  list: (query, options) => http.get('/contracts', { ...options, query }),
  get: (id, options) => http.get(`/contracts/${id}`, options),
  create: (body, { idempotencyKey }) => http.post('/contracts', body, { idempotencyKey }),
  update: (id, body) => http.put(`/contracts/${id}`, body),
  updateNote: (id, note) => http.put(`/contracts/${id}/note`, { note }),
  setSignedDocument: (id, body) => http.put(`/contracts/${id}/signed-document`, body),
  // → 200 { warnings } — nháp ký lại bị hủy: xe của HĐ cũ không mở lại được ⇒ VEHICLE_NOT_RESTORED.
  cancel: (id, body) => http.post(`/contracts/${id}/cancel`, body),
  // body: { handoverReadings: [{ meterId, value | null, correctPreviousFinal? }] } — chỉ số nhận phòng, null = dùng số mới nhất.
  // Số nhỏ hơn số cuối HĐ trước ⇒ 422 HANDOVER_BELOW_PREVIOUS_FINAL; số cuối người cũ gõ nhầm ⇒ gửi lại kèm correctPreviousFinal: true.
  activate: (id, body, { idempotencyKey } = {}) => http.post(`/contracts/${id}/activate`, body, { idempotencyKey }),
  billingPeriods: (id, query, options) => http.get(`/contracts/${id}/billing-periods`, { ...options, query }),
  // Khoảng ngắt tính tiền (kỳ đã thu ngoài hệ thống) → [{ id, fromDate, toDate, periodCount, resumedInvoiceId, note }]
  billingGaps: (id, options) => http.get(`/contracts/${id}/billing-gaps`, options),
  // Văn bản .docx để in / ký — nháp có dòng "BẢN NHÁP"; có số giấy tờ đầy đủ (server ghi log).
  document: (id) => http.get(`/contracts/${id}/document`, { responseType: 'blob' }),
  dataReview: (query, options) => http.get('/contracts/data-review', { ...options, query }),

  // Khoản thu của HĐ đang hiệu lực — đổi từ đầu một kỳ thu (effectiveFrom null = kỳ chưa lập phiếu đầu tiên).
  changeFee: (id, feeTypeId, body) => http.put(`/contracts/${id}/fees/${feeTypeId}`, body),
  removeFee: (id, feeTypeId, effectiveFrom) => http.delete(`/contracts/${id}/fees/${feeTypeId}`, { query: { effectiveFrom } }),

  // Tiền cọc chỉ để theo dõi: đánh dấu đã hoàn trả (amount null = đủ cọc; ít hơn cọc thì note bắt buộc) / bỏ đánh dấu → 204
  refundDeposit: (id, body) => http.post(`/contracts/${id}/deposit/refund`, body),
  // Không trả cọc: { date, note } (note bắt buộc) → 204. Bỏ đánh dấu cũng bằng DELETE …/deposit/refund.
  forfeitDeposit: (id, body) => http.post(`/contracts/${id}/deposit/forfeit`, body),
  cancelDepositRefund: (id) => http.delete(`/contracts/${id}/deposit/refund`),

  // Màn thanh lý gom tất cả: kỳ cuối + số tiền 3 cách, kỳ chưa chốt, hóa đơn từ ngày trả phòng, nợ, cần trả lại, khoản chưa xử lý, cọc, blockers.
  // HĐ còn hiệu lực: query { actualEndDate } để xem trước (bỏ trống = ngày dự kiến trả / hôm nay).
  liquidationPreview: (id, query, options) => http.get(`/contracts/${id}/liquidation/preview`, { ...options, query }),

  // Chuyển phòng trong cùng khu, luôn từ hôm nay — hợp đồng đi theo người thuê → 200 { warnings }.
  // Chuyển nhầm: trong ngày chuyển gửi lại với toRoomId = phòng vừa rời ⇒ hoàn lại như chưa chuyển (thay lệnh hủy chuyển phòng đã bỏ).
  transferRoom: (id, body, { idempotencyKey }) => http.post(`/contracts/${id}/transfer-room`, body, { idempotencyKey }),

  // Đổi người đứng tên trên cùng hợp đồng → 204
  changeRepresentative: (id, body) => http.post(`/contracts/${id}/representative`, body),
  // Vai trò người ở: Resident | CoTenant (đồng thuê — có tên trên hợp đồng, phải có giấy tờ) → 204
  setOccupantRole: (id, occupantId, role) => http.put(`/contracts/${id}/occupants/${occupantId}/role`, { role }),
  // Chuyển một người sang hợp đồng đang hiệu lực khác (phòng khác) → 204
  moveOccupant: (id, occupantId, body) => http.post(`/contracts/${id}/occupants/${occupantId}/move`, body),

  addOccupant: (id, body) => http.post(`/contracts/${id}/occupants`, body),
  endOccupancy: (id, occupantId, body) => http.post(`/contracts/${id}/occupants/${occupantId}/end`, body),
  changeRent: (id, body) => http.post(`/contracts/${id}/rent-terms`, body),
  extend: (id, body) => http.post(`/contracts/${id}/extend`, body),
  holdover: (id, body) => http.post(`/contracts/${id}/holdover`, body),
  // → 201 { id: HĐ nháp mới, warnings }
  reSign: (id, body, { idempotencyKey }) => http.post(`/contracts/${id}/re-sign`, body, { idempotencyKey }),
  giveNotice: (id, body) => http.post(`/contracts/${id}/notice`, body),
  // Rút báo trả phòng (người thuê ở tiếp) → 204 · chưa báo → 422 NOTICE_NOT_GIVEN
  withdrawNotice: (id) => http.delete(`/contracts/${id}/notice`),

  // body: { actualEndDate, reason, ground, note, finalPeriodCharge: null (= FullPeriod) | 'FullPeriod' | 'Daily' | 'None' }
  startLiquidation: (id, body) => http.post(`/contracts/${id}/liquidation/start`, body),
  // Đổi kỳ cuối khi hóa đơn trả phòng chưa chốt → 204, nháp hóa đơn trả phòng tự tính lại.
  setFinalPeriodCharge: (id, finalPeriodCharge) => http.put(`/contracts/${id}/liquidation/final-period-charge`, { finalPeriodCharge }),
  // → 200 { warnings } (VEHICLE_NOT_RESTORED); xóa luôn ngày báo trả phòng.
  cancelLiquidation: (id) => http.post(`/contracts/${id}/liquidation/cancel`),
  // body: { finalReadings: [{ meterId, value | null }] } → 201 chi tiết hóa đơn trả phòng nháp.
  createFinalInvoice: (id, body, { idempotencyKey } = {}) => http.post(`/contracts/${id}/final-invoice`, body, { idempotencyKey }),
  // Một lần bấm: { settlement, method, paidAt, reason, refund: { refundedOn, method }, pendingCharges: { method },
  //   deposit: { action: 'Refund' | 'Forfeit' | 'Later', amount, date, note } } — thiếu mục cần quyết ⇒ 422 REFUND_PENDING / PENDING_CHARGES / CONTRACT_HAS_DEBT.
  completeLiquidation: (id, body) => http.post(`/contracts/${id}/liquidation/complete`, body ?? {}),

  addAsset: (id, body) => http.post(`/contracts/${id}/assets`, body),
  updateAsset: (id, assetId, body) => http.put(`/contracts/${id}/assets/${assetId}`, body),
  deleteAsset: (id, assetId) => http.delete(`/contracts/${id}/assets/${assetId}`),
  returnAsset: (id, assetId, body) => http.post(`/contracts/${id}/assets/${assetId}/return`, body),

  registerVehicle: (id, body) => http.post(`/contracts/${id}/vehicles`, body),
  endVehicle: (id, vehicleId, body) => http.post(`/contracts/${id}/vehicles/${vehicleId}/end`, body),
}
