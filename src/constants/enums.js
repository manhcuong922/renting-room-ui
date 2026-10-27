// Enum dùng chung — nhãn theo renting_room/docs/api/conventions.md#enum-dùng-chung và contracts.md.
// Gửi/nhận dạng CHUỖI đúng chữ hoa như server.

export const Role = Object.freeze({
  SystemAdmin: 'SystemAdmin',
  OrgOwner: 'OrgOwner',
  OrgManager: 'OrgManager',
})

export const ROLE_LABELS = {
  SystemAdmin: 'Quản trị viên',
  OrgOwner: 'Chủ trọ',
  OrgManager: 'Phó quản lý',
}

export const USER_STATUS = {
  Active: { label: 'Hoạt động', tone: 'success' },
  Locked: { label: 'Đã khóa', tone: 'danger' },
  Removed: { label: 'Đã gỡ', tone: 'neutral' },
}

export const ORGANIZATION_STATUS = {
  Active: { label: 'Hoạt động', tone: 'success' },
  Suspended: { label: 'Tạm ngưng', tone: 'neutral' },
}

export const ROOM_STATUS = {
  Vacant: { label: 'Trống', tone: 'success' },
  Reserved: { label: 'Giữ chỗ', tone: 'warning' },
  Occupied: { label: 'Đang thuê', tone: 'info' },
  Maintenance: { label: 'Bảo trì', tone: 'orange' },
  Archived: { label: 'Ngừng dùng', tone: 'neutral' },
}

export const CONTRACT_STATUS = {
  Draft: { label: 'Nháp', tone: 'neutral' },
  Active: { label: 'Đang hiệu lực', tone: 'success' },
  Liquidating: { label: 'Đang thanh lý', tone: 'orange' },
  Ended: { label: 'Đã kết thúc', tone: 'dark' },
  Cancelled: { label: 'Đã hủy', tone: 'neutral' },
}

export const CONTRACT_TYPE_LABELS = { RoomRental: 'Thuê phòng trọ', WholeHouseRental: 'Thuê nhà nguyên căn' }

export const ID_DOCUMENT_TYPE_LABELS = { CitizenId: 'CCCD / Căn cước', LegacyId: 'CMND cũ', Passport: 'Hộ chiếu' }
export const ID_NUMBER_HINTS = {
  CitizenId: 'Số CCCD / định danh (12 số)',
  LegacyId: 'Số CMND (9 số)',
  Passport: 'Số hộ chiếu (6–20 chữ/số)',
}

export const GENDER_LABELS = { Male: 'Nam', Female: 'Nữ', Other: 'Khác' }
export const LESSOR_TYPE_LABELS = { Individual: 'Cá nhân', Organization: 'Tổ chức' }
export const CHARGE_MODE_LABELS = { Prepaid: 'Thu trước (đầu kỳ)', Postpaid: 'Thu sau (cuối kỳ)' }
export const PRORATION_MODE_LABELS = { Daily: 'Tính theo ngày ở', FullPeriod: 'Tính tròn tháng' }
// Kỳ cuối khi trả phòng — chọn riêng mỗi lần trả phòng, không theo "Tính kỳ lẻ" của khu (contracts.md#bắt-đầu).
export const FINAL_PERIOD_CHARGE_LABELS = { FullPeriod: 'Thu trọn kỳ', Daily: 'Tính theo ngày ở', None: 'Không thu' }
export const PAYMENT_METHOD_LABELS = { Cash: 'Tiền mặt', BankTransfer: 'Chuyển khoản', EWallet: 'Ví điện tử' }
export const VEHICLE_TYPE_LABELS = { Motorbike: 'Xe máy', Bicycle: 'Xe đạp', ElectricBike: 'Xe điện', Car: 'Ô tô' }
export const PLATE_REQUIRED_VEHICLES = new Set(['Motorbike', 'Car'])

export const TERMINATION_REASON_LABELS = {
  Expired: 'Hết hạn',
  MutualAgreement: 'Hai bên thỏa thuận',
  LesseeUnilateral: 'Bên thuê đơn phương',
  LessorUnilateral: 'Bên cho thuê đơn phương',
  RoomTransfer: 'Chuyển phòng',
  Abandoned: 'Bỏ đi không báo',
}
export const TERMINATION_GROUND_LABELS = {
  RentArrears3Months: 'Nợ tiền thuê từ 3 tháng',
  WrongPurpose: 'Sử dụng sai mục đích',
  UnauthorizedRenovation: 'Tự ý đục phá, cải tạo',
  IndefiniteTermNotice: 'Thông báo chấm dứt HĐ không thời hạn (90 ngày)',
  Other: 'Khác',
}

// Quan hệ với người đứng tên / chủ hộ — Thông tư 55/2021/TT-BCA (sửa bởi TT 66/2023).
export const RELATIONSHIP_GROUPS = [
  { label: 'Vợ chồng', options: { Wife: 'Vợ', Husband: 'Chồng' } },
  {
    label: 'Cha mẹ',
    options: {
      Father: 'Cha đẻ',
      Mother: 'Mẹ đẻ',
      FatherInLaw: 'Cha vợ/chồng',
      MotherInLaw: 'Mẹ vợ/chồng',
      AdoptiveFather: 'Cha nuôi',
      AdoptiveMother: 'Mẹ nuôi',
      Stepfather: 'Cha dượng',
      Stepmother: 'Mẹ kế',
    },
  },
  {
    label: 'Con',
    options: { Child: 'Con đẻ', AdoptedChild: 'Con nuôi', StepChild: 'Con riêng của vợ/chồng', SonInLaw: 'Con rể', DaughterInLaw: 'Con dâu' },
  },
  { label: 'Ông bà, cháu', options: { Grandparent: 'Ông/bà', GreatGrandparent: 'Cụ', Grandchild: 'Cháu nội/ngoại', GreatGrandchild: 'Chắt' } },
  {
    label: 'Anh chị em, họ hàng',
    options: {
      Sibling: 'Anh/chị/em ruột',
      HalfSibling: 'Cùng cha khác mẹ / cùng mẹ khác cha',
      SiblingInLaw: 'Anh rể/em rể/chị dâu/em dâu',
      NephewNiece: 'Cháu ruột',
      UncleAunt: 'Bác/chú/cậu/cô/dì',
    },
  },
  { label: 'Giám hộ', options: { Guardian: 'Người giám hộ', Ward: 'Người được giám hộ' } },
  { label: 'Không phải người thân', options: { CoTenant: 'Cùng ở thuê', Other: 'Khác (ghi rõ)' } },
]
export const RELATIONSHIP_LABELS = Object.assign({}, ...RELATIONSHIP_GROUPS.map((g) => g.options))
// Khớp renting_room.Domain/Contracts/OccupantRelationship.cs — giới tính "Khác" không bị chặn.
export const RELATIONSHIP_REQUIRED_GENDER = {
  Wife: 'Female',
  Husband: 'Male',
  Father: 'Male',
  Mother: 'Female',
  FatherInLaw: 'Male',
  MotherInLaw: 'Female',
  AdoptiveFather: 'Male',
  AdoptiveMother: 'Female',
  Stepfather: 'Male',
  Stepmother: 'Female',
  SonInLaw: 'Male',
  DaughterInLaw: 'Female',
}
// Người đứng tên là cha/mẹ/giám hộ của trẻ → không cần guardianConsent.
export const PARENTAL_RELATIONSHIPS = new Set(['Child', 'AdoptedChild', 'Ward'])

// Tiện ích phòng: server chỉ lưu mã a-z0-9_, UI tự map nhãn.
export const AMENITY_LABELS = {
  air_con: 'Điều hòa',
  wc_private: 'WC riêng',
  water_heater: 'Nóng lạnh',
  balcony: 'Ban công',
  window: 'Cửa sổ',
  kitchen: 'Bếp',
  fridge: 'Tủ lạnh',
  washing_machine: 'Máy giặt',
  bed: 'Giường',
  wardrobe: 'Tủ quần áo',
  wifi: 'Wifi',
  parking: 'Chỗ để xe',
}

export const TEMPLATE_FIELD_TYPE_LABELS = {
  Text: 'Chữ (1 dòng)',
  LongText: 'Đoạn văn',
  Number: 'Số',
  Money: 'Tiền',
  Date: 'Ngày',
  Boolean: 'Có / không',
  Select: 'Danh sách chọn',
}

export const EXPORT_LAYOUT_LABELS = {
  SheetPerProperty: 'Mỗi khu 1 sheet',
  SheetPerFloor: 'Mỗi tầng 1 sheet',
  SingleSheet: 'Gộp 1 sheet',
}

// Cảnh báo mềm của HĐ: server luôn trả kèm `message` — nhãn này chỉ dự phòng khi thiếu message.
export const CONTRACT_WARNING_LABELS = {
  DEPOSIT_ABOVE_THREE_MONTHS: 'Tiền cọc lớn hơn 3 tháng tiền thuê',
  PLATE_FORMAT_UNUSUAL: 'Biển số không giống biển số Việt Nam',
  LESSOR_INFO_INCOMPLETE: 'Chưa đủ thông tin bên cho thuê — chưa in được hợp đồng đầy đủ',
  REPRESENTATIVE_PHONE_MISSING: 'Người đứng tên chưa có số điện thoại',
  REPRESENTATIVE_UNDERAGE: 'Người đứng tên chưa đủ 18 tuổi tại ngày ký',
  OCCUPANT_ID_MISSING: 'Người ở từ 14 tuổi chưa có số giấy tờ',
  SIGNED_DOCUMENT_MISSING: 'Chưa có bản hợp đồng đã ký',
  ROOM_WITHOUT_METER: 'Phòng chưa có công tơ điện',
  PARKING_QUANTITY_MISMATCH: 'Số xe đăng ký khác số lượng phí giữ xe',
  REPRESENTATIVE_MOVED_OUT: 'Người ký đã rời đi',
  NO_OCCUPANT_LEFT: 'Không còn người ở',
  CONTRACT_EXPIRED_DECISION_NEEDED: 'Hợp đồng đã quá hạn — chờ quyết định',
  LESSOR_TERMINATION_SHORT_NOTICE: 'Bên cho thuê báo trước chưa đủ số ngày luật định',
  LESSEE_TERMINATION_SHORT_NOTICE: 'Bên thuê báo trước chưa đủ số ngày theo hợp đồng',
  LESSEE_ABANDONED: 'Người thuê bỏ đi không báo',
  REPRESENTATIVE_IS_RESIDENT_ELSEWHERE: 'Người đứng tên đang là người ở thường của hợp đồng khác',
  ROOM_HAS_OPEN_CONTRACT: 'Phòng đang có người thuê',
  VEHICLE_NOT_RESTORED: 'Xe không mở lại được — biển số đã đăng ký ở hợp đồng khác',
  MOVE_OUT_OVERDUE: 'Quá ngày trả phòng mà chưa thanh lý',
}

// Việc chủ trọ cần xử lý trên HĐ đang hiệu lực (contracts.md#cần-xử-lý-flags). Phòng vẫn "Đang thuê".
export const CONTRACT_FLAGS = {
  RepresentativeMovedOut: { label: 'Người ký đã rời đi', tone: 'warning' },
  NoOccupantLeft: { label: 'Không còn người ở', tone: 'danger' },
  ExpiredAwaitingDecision: { label: 'Quá hạn — chờ quyết định', tone: 'danger' },
  MissingSignedDocument: { label: 'Thiếu tài liệu', tone: 'neutral' },
  MoveOutOverdue: { label: 'Quá ngày trả phòng', tone: 'danger' },
}

// Khoản thu (fees.md)
export const FEE_GROUP_LABELS = { Metered: 'Điện nước (theo công tơ)', Service: 'Dịch vụ' }
export const CHARGE_BASIS_LABELS = { PerRoom: 'Theo phòng', PerOccupant: 'Theo đầu người', PerUnit: 'Theo số gói' }

export const READING_KIND_LABELS = {
  Initial: 'Lắp công tơ',
  Handover: 'Nhận phòng',
  Periodic: 'Cuối kỳ',
  Adhoc: 'Kiểm tra',
  Final: 'Cuối hợp đồng',
  Removal: 'Tháo công tơ',
}

export const DEBT_SETTLEMENT_LABELS = { CollectAll: 'Đã thu toàn bộ', WriteOff: 'Bỏ nợ' }

export function toOptions(labels) {
  return Object.entries(labels).map(([value, label]) => ({ value, label }))
}

// Kết quả một lần đăng nhập (members.md#nhật-ký-đăng-nhập). Giá trị lạ → hiện nguyên mã.
export const LOGIN_OUTCOME_LABELS = {
  Success: 'Đăng nhập thành công',
  WrongPassword: 'Sai mật khẩu',
  LockedOut: 'Tài khoản đang bị khóa / tạm khóa',
  TemporaryPasswordExpired: 'Mật khẩu tạm đã hết hạn',
  OrganizationSuspended: 'Tổ chức đang tạm ngưng',
}

// Phiếu tiền phòng (invoices.md, conventions.md#enum-dùng-chung)
export const INVOICE_STATUS = {
  Draft: { label: 'Nháp', tone: 'neutral' },
  Finalized: { label: 'Đã chốt', tone: 'success' },
  Void: { label: 'Đã hủy', tone: 'dark' },
}
export const INVOICE_TYPE_LABELS = { Regular: 'Phiếu tháng', Final: 'Hóa đơn trả phòng' }
export const INVOICE_PAYMENT_STATUS = {
  Unpaid: { label: 'Chưa thu', tone: 'warning' },
  PartiallyPaid: { label: 'Thu một phần', tone: 'orange' },
  Paid: { label: 'Đã thu đủ', tone: 'success' },
  Overdue: { label: 'Quá hạn', tone: 'danger' },
  WrittenOff: { label: 'Đã bỏ nợ', tone: 'dark' },
  RefundPending: { label: 'Chờ hoàn tiền', tone: 'info' },
  Refunded: { label: 'Đã hoàn', tone: 'success' },
  RefundWaived: { label: 'Không hoàn', tone: 'dark' },
  // Nợ đã chuyển vào hóa đơn trả phòng (BL-BR-41) — đi theo hóa đơn trả phòng (27/10/2026).
  CarriedOver: { label: 'Chờ thu ở hóa đơn trả phòng', tone: 'info' },
  CarriedSettled: { label: 'Hoàn thành (qua hóa đơn trả phòng)', tone: 'success' },
  CarriedWrittenOff: { label: 'Đã bỏ nợ (qua hóa đơn trả phòng)', tone: 'dark' },
}
// Dòng kết toán của hóa đơn trả phòng (BL-BR-41) — hệ thống tính, không thuộc phần thu.
export const SETTLEMENT_LINE_TYPES = new Set(['PreviousDebt', 'Deposit'])
// Nhóm dòng trên phiếu, theo thứ tự hiển thị.
export const INVOICE_LINE_TYPE_LABELS = {
  Rent: 'Tiền phòng',
  Metered: 'Điện nước',
  Service: 'Dịch vụ',
  Surcharge: 'Phụ thu',
  ManualDiscount: 'Giảm trừ',
  Refund: 'Hoàn trả',
}
// Lý do một hợp đồng bị bỏ qua khi tạo phiếu (invoices.md#tạo-phiếu-nháp).
export const INVOICE_SKIP_REASON_LABELS = {
  EXISTS: 'Kỳ này đã có phiếu',
  PREVIOUS_PERIOD_NOT_BILLED: 'Chưa lập phiếu kỳ trước — lập lần lượt từ kỳ đầu',
  LATER_PERIOD_BILLED: 'Đã có phiếu kỳ sau',
  NO_PERIOD_IN_MONTH: 'Hợp đồng không có kỳ thuộc tháng thu này',
  USE_FINAL_INVOICE: 'Kỳ chứa ngày trả phòng — lập hóa đơn trả phòng ở hợp đồng',
  MOVE_OUT_NOTICED: 'Đã báo trả phòng trong kỳ — thanh lý và lập hóa đơn trả phòng; người thuê ở tiếp thì rút báo trả phòng rồi tạo lại',
  MISSING_READING: 'Thiếu chỉ số cuối kỳ — nhập ở Ghi chỉ số rồi tạo lại',
  PREVIOUS_PERIOD_INCOMPLETE: 'Nháp kỳ trước còn thiếu chỉ số — nhập lại chỉ số, tính lại nháp kỳ trước rồi tạo kỳ này',
}

// Khoản phát sinh theo phòng (room-charges.md)
export const ROOM_CHARGE_KIND_LABELS = { Surcharge: 'Phụ thu', Credit: 'Bù cho người thuê' }
export const ROOM_CHARGE_STATUS = {
  Pending: { label: 'Chờ lên phiếu', tone: 'warning' },
  OnDraft: { label: 'Trên phiếu nháp', tone: 'info' },
  Billed: { label: 'Đã vào phiếu đã chốt', tone: 'success' },
  Cancelled: { label: 'Đã hủy', tone: 'dark' },
}

// Phiếu thu (payments.md)
export const PAYMENT_STATUS = { Recorded: { label: 'Đã ghi', tone: 'success' }, Reversed: { label: 'Đã đảo', tone: 'dark' } }
export const PAYMENT_KIND_LABELS = { Receipt: 'Tiền thu', WriteOff: 'Bỏ nợ', Refund: 'Hoàn tiền' }
// Điều chỉnh chỉ số đã chốt (meters.md#điều-chỉnh-chỉ-số-đã-chốt): cách xử lý phần chênh.
export const ADJUSTMENT_HANDLING_LABELS = {
  Recalculated: 'Tính lại trên hóa đơn',
  Immediate: 'Xử lý ngay',
  NextInvoice: 'Đẩy sang hóa đơn sau',
  AfterEnd: 'Chênh lệch sau thanh lý',
}

// Hợp đồng — bổ sung (contracts.md#tiền-cọc, #đồng-thuê-đổi-người-đứng-tên-chuyển-người)
export const DEPOSIT_STATUS = {
  Holding: { label: 'Đang giữ cọc', tone: 'warning' },
  Refunded: { label: 'Đã hoàn trả cọc', tone: 'success' },
  Forfeited: { label: 'Không trả cọc', tone: 'dark' },
  Transferred: { label: 'Đã chuyển sang HĐ ký lại', tone: 'info' },
}
export const OCCUPANT_ROLE_LABELS = { Resident: 'Người ở', CoTenant: 'Đồng thuê' }
// Vai trò trong lịch sử thuê của phòng (rooms.md#lịch-sử-thuê-của-phòng)
export const TENANCY_ROLE_LABELS = { Representative: 'Đứng tên', CoTenant: 'Đồng thuê', Resident: 'Người ở' }
// Mã chặn cứng Hoàn tất thanh lý trong GET /contracts/{id}/liquidation/preview → việc cần làm.
// Nợ, tiền cần trả lại, khoản chưa xử lý, cọc không chặn — quyết ngay trên màn hoàn tất.
export const LIQUIDATION_BLOCKER_LABELS = {
  CONTRACT_NOT_LIQUIDATING: 'Hợp đồng chưa bắt đầu thanh lý',
  LIQUIDATION_BEFORE_END_DATE: 'Chưa tới ngày trả phòng',
  FINAL_READING_REQUIRED: 'Thiếu chỉ số cuối của công tơ — nhập khi lập hóa đơn trả phòng',
  INVOICE_DRAFT_EXISTS: 'Còn hóa đơn nháp — chốt hoặc xóa',
  FINAL_INVOICE_REQUIRED: 'Chưa lập và chốt hóa đơn trả phòng',
}

// Ghi nhận đồng ý xử lý dữ liệu cá nhân (renters.md)
export const CONSENT_METHOD_LABELS = { PaperSigned: 'Ký giấy', ContractClause: 'Điều khoản hợp đồng', Verbal: 'Xác nhận miệng' }

// Nhật ký thao tác (audit.md)
export const AUDIT_ACTION_LABELS = {
  Created: 'Tạo',
  Updated: 'Sửa',
  Deleted: 'Xóa',
  RevealIdNumber: 'Xem số giấy tờ đầy đủ',
  PrintWithIdNumbers: 'In có số giấy tờ',
  ExportWithIdNumbers: 'Xuất Excel có số giấy tờ',
  Anonymized: 'Ẩn danh',
  Import: 'Nhập Excel',
}
// Tên đối tượng hay gặp; loại khác hiện nguyên tên server trả.
export const AUDIT_ENTITY_LABELS = {
  Invoice: 'Phiếu tiền phòng',
  InvoiceLine: 'Dòng phiếu',
  Contract: 'Hợp đồng',
  Renter: 'Người thuê',
  Payment: 'Phiếu thu',
  FeePrice: 'Bảng giá',
  FeeType: 'Khoản thu',
  Room: 'Phòng',
  Property: 'Khu trọ',
  User: 'Tài khoản',
  Meter: 'Công tơ',
  MeterReading: 'Chỉ số công tơ',
  RoomCharge: 'Khoản phát sinh',
  Organization: 'Tổ chức',
}

// Nhập Excel (imports.md)
export const IMPORT_ROLE_LABELS = { Representative: 'Đứng tên', RepresentativeNotLiving: 'Đứng tên (không ở)', Occupant: 'Ở cùng' }
export const IMPORT_OUTCOME = {
  Saved: { label: 'Đã lưu', tone: 'success' },
  Invalid: { label: 'Không hợp lệ — chưa lưu', tone: 'danger' },
  Failed: { label: 'Lỗi lúc lưu — chưa lưu', tone: 'warning' },
}
