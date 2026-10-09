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
  HOLDOVER_SIGN_ADDENDUM: 'Đang ở tiếp chưa ký lại — nên ký phụ lục gia hạn',
  LESSOR_TERMINATION_SHORT_NOTICE: 'Bên cho thuê báo trước chưa đủ số ngày luật định',
  LESSEE_TERMINATION_SHORT_NOTICE: 'Bên thuê báo trước chưa đủ số ngày theo hợp đồng',
  LESSEE_ABANDONED: 'Người thuê bỏ đi không báo',
}

// Việc chủ trọ cần xử lý trên HĐ đang hiệu lực (contracts.md#cần-xử-lý-flags). Phòng vẫn "Đang thuê".
export const CONTRACT_FLAGS = {
  RepresentativeMovedOut: { label: 'Người ký đã rời đi', tone: 'warning' },
  NoOccupantLeft: { label: 'Không còn người ở', tone: 'danger' },
  ExpiredAwaitingDecision: { label: 'Quá hạn — chờ quyết định', tone: 'danger' },
  Holdover: { label: 'Ở tiếp chưa ký lại', tone: 'orange' },
  MissingSignedDocument: { label: 'Thiếu tài liệu', tone: 'neutral' },
  DepositShort: { label: 'Cọc thực nhận thiếu', tone: 'warning' },
  DepositDueForReturn: { label: 'Tới hạn trả cọc', tone: 'orange' },
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
