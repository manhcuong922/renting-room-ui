import { queryKeys } from '@/api'

// Các nhóm dữ liệu phải tải lại sau một thao tác tiền nong (dùng với useInvalidate / useAction).

// Đổi khoản phát sinh ⇒ dòng trên phiếu nháp và tổng nháp đổi theo ngay.
export const CHARGE_AFFECTED = [queryKeys.roomCharges.all, queryKeys.invoices.all]

// Ghi / đảo phiếu thu, bỏ nợ ⇒ phiếu tiền phòng, số nợ hợp đồng, nhãn "Còn nợ" của phòng đổi theo.
export const PAYMENT_AFFECTED = [queryKeys.payments.all, queryKeys.invoices.all, queryKeys.rooms.all, queryKeys.contracts.all]
