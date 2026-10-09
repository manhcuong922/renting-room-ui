// Wizard hợp đồng: form ⇄ ContractInput (docs/api/contracts.md#post-contracts--idempotency-key).
import { PARENTAL_RELATIONSHIPS, RELATIONSHIP_REQUIRED_GENDER } from '@/constants/enums'
import { ageAt } from '@/features/renters/renterForm'
import { addDays, addMonths, todayVN } from '@/lib/format'

export const WIZARD_STEPS = [
  { id: 'template', label: 'Mẫu' },
  { id: 'room', label: 'Phòng' },
  { id: 'people', label: 'Người thuê' },
  { id: 'terms', label: 'Điều khoản' },
  { id: 'fees', label: 'Khoản thu' },
  { id: 'document', label: 'Thông tin theo mẫu' },
  { id: 'review', label: 'Xem lại' },
]

export const emptyOccupant = (renter) => ({
  renter,
  moveInDate: '',
  expectedEndDate: '',
  relationshipType: '',
  relationship: '',
  guardianConsent: false,
  note: '',
})

export function emptyContractForm() {
  const start = todayVN()
  return {
    templateId: '',
    contractType: 'RoomRental',
    propertyId: '',
    roomId: '',
    contractNo: '',
    representative: null,
    representativeIsOccupant: true,
    representativeMoveInDate: '',
    occupants: [],
    householdHeadRenterId: '',
    startDate: start,
    indefinite: false,
    endDate: addDays(addMonths(start, 12), -1),
    signedDate: '',
    signedPlace: '',
    effectiveDate: '',
    monthlyRent: null,
    depositAmount: null,
    depositTerms: '',
    // "Tính tiền từ ngày" (K5) — trống = ngày bắt đầu. Ngày chốt / thu trước–thu sau là của khu, HĐ không chọn riêng.
    billingStartDate: '',
    noticeDays: 30,
    // Khoản thu cố định / theo số lượng gắn vào HĐ: [{ feeTypeId, quantity, unitPriceOverride }].
    // null = chưa nạp danh mục của khu → server tự gắn các khoản "tự gắn".
    fees: null,
    paymentMethods: ['Cash', 'BankTransfer'],
    copiesCount: 2,
    termsText: '',
    note: '',
    title: '',
    overrideClauses: false,
    clauses: [],
    customFields: {},
  }
}

/** Bản nháp → form (sửa nháp). renters: Map renterId → RenterDto (để có giới tính / ngày sinh). */
export function draftToForm(c, renters, template) {
  const doc = c.document ?? {}
  const repOccupant = c.occupants.find((o) => o.renterId === c.representativeRenterId)
  const others = c.occupants.filter((o) => o.renterId !== c.representativeRenterId)
  const templateClauses = JSON.stringify((template?.clauses ?? []).map((x) => ({ heading: x.heading, body: x.body })))
  const docClauses = (doc.clauses ?? []).map((x) => ({ heading: x.heading, body: x.body }))
  const clausesDiffer = doc.templateId ? JSON.stringify(docClauses) !== templateClauses : docClauses.length > 0
  return {
    ...emptyContractForm(),
    templateId: doc.templateId ?? '',
    contractType: doc.contractType ?? 'RoomRental',
    propertyId: c.propertyId,
    roomId: c.roomId,
    contractNo: c.contractNo,
    representative: renters.get(c.representativeRenterId) ?? { id: c.representativeRenterId, fullName: c.representativeName },
    representativeIsOccupant: Boolean(repOccupant),
    representativeMoveInDate: repOccupant && repOccupant.moveInDate !== c.startDate ? repOccupant.moveInDate : '',
    occupants: others.map((o) => ({
      renter: renters.get(o.renterId) ?? { id: o.renterId, fullName: o.fullName },
      moveInDate: o.moveInDate === c.startDate ? '' : o.moveInDate,
      expectedEndDate: o.expectedEndDate ?? '',
      relationshipType: o.relationshipType ?? '',
      relationship: o.relationship ?? '',
      guardianConsent: o.guardianConsent ?? false,
      note: o.note ?? '',
    })),
    householdHeadRenterId: c.householdHeadRenterId ?? '',
    startDate: c.startDate,
    indefinite: !c.endDate,
    endDate: c.endDate ?? '',
    signedDate: c.signedDate ?? '',
    signedPlace: c.signedPlace ?? '',
    effectiveDate: c.effectiveDate ?? '',
    monthlyRent: c.currentRent ?? c.rentTerms?.[0]?.monthlyRent ?? null,
    depositAmount: c.depositAmount,
    depositTerms: c.depositTerms ?? '',
    billingStartDate: c.billingStartDate && c.billingStartDate !== c.startDate ? c.billingStartDate : '',
    noticeDays: c.noticeDays,
    fees: (c.fees ?? [])
      .filter((f) => !f.effectiveTo)
      .map((f) => ({ feeTypeId: f.feeTypeId, quantity: f.chargeBasis === 'PerUnit' ? f.quantity : null, unitPriceOverride: f.unitPriceOverride })),
    paymentMethods: c.paymentMethods,
    copiesCount: c.copiesCount,
    termsText: c.termsText ?? '',
    note: c.note ?? '',
    title: doc.templateId && template && doc.title === template.title ? '' : (doc.title ?? ''),
    overrideClauses: clausesDiffer,
    clauses: clausesDiffer ? docClauses : [],
    customFields: { ...doc.customFields },
  }
}

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** Người ở gửi lên server: [người đứng tên (nếu ở cùng), ...người khác]. */
export function buildOccupants(v) {
  const list = []
  if (v.representativeIsOccupant && v.representative) {
    list.push({ renterId: v.representative.id, moveInDate: v.representativeMoveInDate || null, expectedEndDate: null, relationship: null, note: null })
  }
  for (const o of v.occupants) {
    list.push({
      renterId: o.renter.id,
      moveInDate: o.moveInDate || null,
      expectedEndDate: o.expectedEndDate || null,
      relationshipType: o.relationshipType || null,
      relationship: str(o.relationship),
      guardianConsent: o.guardianConsent,
      note: str(o.note),
    })
  }
  return list
}

export function buildContractInput(v, template) {
  const customFields = {}
  for (const f of template?.fields ?? []) {
    const value = v.customFields[f.key]
    if (value !== undefined && value !== null && value !== '') customFields[f.key] = typeof value === 'string' ? value.trim() : value
  }
  return {
    representativeRenterId: v.representative?.id,
    startDate: v.startDate,
    endDate: v.indefinite ? null : v.endDate || null,
    signedDate: v.signedDate || null,
    signedPlace: str(v.signedPlace),
    effectiveDate: v.effectiveDate || null,
    monthlyRent: v.monthlyRent,
    depositAmount: template?.noDeposit ? 0 : v.depositAmount,
    depositTerms: str(v.depositTerms),
    billingStartDate: v.billingStartDate || null,
    noticeDays: v.noticeDays,
    paymentMethods: v.paymentMethods,
    copiesCount: v.copiesCount,
    termsText: str(v.termsText),
    note: str(v.note),
    occupants: buildOccupants(v),
    householdHeadRenterId: v.householdHeadRenterId || null,
    fees: v.fees,
    templateId: v.templateId || null,
    contractType: v.templateId ? null : v.contractType,
    title: str(v.title),
    clauses: v.overrideClauses ? v.clauses.map((c) => ({ heading: c.heading.trim(), body: c.body.trim() })) : null,
    customFields: v.templateId ? customFields : null,
  }
}

/** Người ở này có cần tích "đã có đồng ý của cha mẹ/giám hộ" không (Luật Cư trú 2020 Điều 28). */
export function needsGuardianConsent(o, startDate) {
  const age = ageAt(o.renter?.dateOfBirth, o.moveInDate || startDate)
  return age !== null && age < 18 && !PARENTAL_RELATIONSHIPS.has(o.relationshipType)
}

/** Quan hệ hợp lệ theo giới tính người ở (vợ/mẹ… phải là nữ; giới tính "Khác" không bị chặn). */
export function relationshipAllowed(type, gender) {
  const required = RELATIONSHIP_REQUIRED_GENDER[type]
  return !required || !gender || gender === 'Other' || gender === required
}

const inRange = (n, min, max) => Number.isInteger(n) && n >= min && n <= max

/**
 * Cảnh báo mềm về quan hệ người ở (contracts.md#kiểm-tra-của-server-cảnh-báo-không-chặn--09102026) — KHÔNG chặn lưu / kích hoạt.
 * Trả { 'occupants.{i}.relationshipType': 'câu cảnh báo' }.
 */
export function occupantWarnings(v) {
  const w = {}
  const headId = v.householdHeadRenterId || v.representative?.id
  v.occupants.forEach((o, i) => {
    if (o.renter.id === headId) return
    if (!o.relationshipType) w[`occupants.${i}.relationshipType`] = 'Chưa khai quan hệ với chủ hộ.'
    else if (o.relationshipType === 'Other' && !o.relationship.trim()) w[`occupants.${i}.relationship`] = 'Nên ghi rõ quan hệ.'
    else if (!relationshipAllowed(o.relationshipType, o.renter.gender)) w[`occupants.${i}.relationshipType`] = 'Quan hệ không khớp giới tính.'
    if (needsGuardianConsent(o, v.startDate) && !o.guardianConsent) w[`occupants.${i}.guardianConsent`] = 'Người chưa đủ 18 tuổi — nên có ý kiến đồng ý của cha mẹ / người giám hộ.'
  })
  return w
}

export function validateStep(step, v, { template, room } = {}) {
  const e = {}
  if (step === 'room' && !v.roomId) e.roomId = 'Chọn phòng.'
  if (step === 'people') {
    if (!v.representative) e.representative = 'Chọn người đại diện ký hợp đồng.'
    // Người chưa có giấy tờ (trẻ < 14 tuổi) không đứng tên được (REPRESENTATIVE_ID_REQUIRED).
    else if (v.representative.idType === null) e.representative = 'Người chưa có giấy tờ không đứng tên hợp đồng được — bổ sung giấy tờ ở hồ sơ.'
    v.occupants.forEach((o, i) => {
      if (o.moveInDate && o.moveInDate < v.startDate) e[`occupants.${i}.moveInDate`] = 'Không trước ngày bắt đầu hợp đồng.'
    })
  }
  if (step === 'terms') {
    const today = todayVN()
    if (!v.startDate) e.startDate = 'Nhập ngày bắt đầu.'
    else if (!v.billingStartDate && v.startDate < addMonths(today, -12))
      e.startDate = 'Không trước hôm nay quá 1 năm — HĐ nhập từ sổ cũ thì điền "Tính tiền từ ngày".'
    if (!v.indefinite && (!v.endDate || v.endDate <= v.startDate)) e.endDate = 'Ngày kết thúc phải sau ngày bắt đầu (hoặc chọn không thời hạn).'
    if (v.billingStartDate) {
      if (v.billingStartDate < v.startDate || (!v.indefinite && v.endDate && v.billingStartDate > v.endDate))
        e.billingStartDate = 'Phải nằm trong thời gian hợp đồng.'
      else if (v.billingStartDate < addMonths(today, -12)) e.billingStartDate = 'Không trước hôm nay quá 1 năm.'
    }
    if (v.signedDate && v.signedDate > todayVN()) e.signedDate = 'Ngày ký không ở tương lai.'
    if (v.effectiveDate && v.signedDate && v.effectiveDate < v.signedDate) e.effectiveDate = 'Ngày hiệu lực không trước ngày ký.'
    if (v.monthlyRent === null && !room?.listedRent) e.monthlyRent = 'Phòng chưa có giá niêm yết — nhập giá thuê.'
    if (v.monthlyRent !== null && v.monthlyRent <= 0) e.monthlyRent = 'Giá thuê phải lớn hơn 0.'
    if (!template?.noDeposit && v.depositAmount && v.monthlyRent && v.depositAmount > v.monthlyRent * 12) e.depositAmount = 'Tối đa 12 tháng tiền thuê.'
    if (!inRange(v.noticeDays, 0, 180)) e.noticeDays = 'Từ 0 đến 180.'
    if (!v.paymentMethods.length) e.paymentMethods = 'Chọn ít nhất một phương thức.'
    if (!inRange(v.copiesCount, 1, 10)) e.copiesCount = 'Từ 1 đến 10 bản.'
  }
  if (step === 'fees') {
    for (const f of v.fees ?? []) {
      if (f.quantity !== null && (f.quantity < 0 || f.quantity > 100)) e[`fee.${f.feeTypeId}.quantity`] = 'Từ 0 đến 100.'
    }
  }
  if (step === 'document') {
    for (const f of template?.fields ?? []) {
      const value = v.customFields[f.key]
      if (f.required && (value === undefined || value === null || value === '')) e[`customFields.${f.key}`] = `Nhập ${f.label.toLowerCase()}.`
    }
    if (v.overrideClauses) {
      v.clauses.forEach((c, i) => {
        if (!c.heading.trim()) e[`clauses.${i}.heading`] = 'Nhập tiêu đề.'
        if (!c.body.trim()) e[`clauses.${i}.body`] = 'Nhập nội dung.'
      })
    }
  }
  return Object.fromEntries(Object.entries(e).filter(([, msg]) => msg))
}

// Key lỗi server (đã bỏ tiền tố "contract.") → bước wizard để nhảy tới.
export function stepOfField(key) {
  if (/^(roomId)/.test(key)) return 'room'
  if (/^(representative|occupants|householdHead)/.test(key)) return 'people'
  if (/^(customFields|title|clauses|termsText)/.test(key)) return 'document'
  if (/^fees?(\.|$)/.test(key)) return 'fees'
  if (/^(templateId|contractType)/.test(key)) return 'template'
  return 'terms'
}

/**
 * Index người ở của server khác index trên form khi người đứng tên ở cùng (đứng đầu danh sách gửi lên).
 * 'contract.occupants[2].relationshipType' → 'occupants.1.relationshipType'.
 */
export function remapServerErrors(errors, representativeIncluded) {
  if (!errors) return errors
  const out = {}
  for (const [rawKey, messages] of Object.entries(errors)) {
    let key = rawKey.replace(/\[(\d+)\]/g, '.$1').replace(/^contract\./, '')
    const match = /^occupants\.(\d+)\.(.+)$/.exec(key)
    if (match && representativeIncluded) {
      const index = Number(match[1])
      key = index === 0 ? (match[2] === 'moveInDate' ? 'representativeMoveInDate' : 'representative') : `occupants.${index - 1}.${match[2]}`
    }
    if (key === 'representativeRenterId') key = 'representative'
    out[key] = messages
  }
  return out
}

/** Giá trị trường tùy biến để hiển thị (tab Văn bản). */
export function formatCustomValue(field, value) {
  if (value === undefined || value === null || value === '') return null
  if (field.type === 'Boolean') return value ? 'Có' : 'Không'
  if (field.type === 'Money') return `${new Intl.NumberFormat('vi-VN').format(value)} ${field.unit ?? 'đ'}`
  if (field.type === 'Date') return value.split('-').reverse().join('/')
  return field.unit ? `${value} ${field.unit}` : String(value)
}
