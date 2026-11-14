import { Role } from '@/constants/enums'

// Bản sao phía FE của policy BE (renting_room/renting_room/Security/AuthorizationSetup.cs).
// FE chỉ dùng để ẨN/CHẶN giao diện — server vẫn là nơi quyết định cuối cùng (401/403).
export const Policy = Object.freeze({
  AnyUser: 'AnyUser', // đã đăng nhập (kể cả đang phải đổi mật khẩu)
  SystemAdmin: 'SystemAdmin',
  OrgMember: 'OrgMember', // OrgOwner | OrgManager + có tổ chức
  OrgOwner: 'OrgOwner',
})

const POLICY_RULES = {
  [Policy.AnyUser]: { roles: null, requiresOrg: false, allowsPasswordChange: true },
  [Policy.SystemAdmin]: { roles: [Role.SystemAdmin], requiresOrg: false },
  [Policy.OrgMember]: { roles: [Role.OrgOwner, Role.OrgManager], requiresOrg: true },
  [Policy.OrgOwner]: { roles: [Role.OrgOwner], requiresOrg: true },
}

// Quyền theo chức năng → policy. Màn hình/nút chỉ tham chiếu Permission, không so role trực tiếp.
export const Permission = Object.freeze({
  Session: 'session', // trang chung cho mọi người đã đăng nhập (hồ sơ, 404…)
  DashboardView: 'dashboard.view',
  PropertiesView: 'properties.view',
  PropertiesManage: 'properties.manage',
  // Tạo khu, ngừng / khôi phục khu, bên cho thuê của khu (người ký thay + giấy ủy quyền) — chỉ chủ trọ (M01 ID-BR-28, 08/11/2026)
  PropertiesAdminister: 'properties.administer',
  PropertiesBankManage: 'properties.bank.manage', // tài khoản ngân hàng nhận tiền của khu — chỉ chủ trọ (H-06), đổi / xóa phải nhập mật khẩu
  RoomsView: 'rooms.view',
  RoomsManage: 'rooms.manage',
  RentersView: 'renters.view',
  RentersManage: 'renters.manage',
  RentersAnonymize: 'renters.anonymize', // ẩn danh hồ sơ ngay (không đảo ngược) — chỉ chủ trọ
  ContractsView: 'contracts.view',
  ContractsManage: 'contracts.manage',
  BillingView: 'billing.view', // ghi chỉ số, phiếu tiền phòng, khoản phát sinh, thu tiền — chủ trọ + quản lý khu
  ContractTemplatesView: 'contract-templates.view',
  ContractTemplatesManage: 'contract-templates.manage',
  AuditView: 'audit.view', // nhật ký thao tác — chỉ chủ trọ
  ImportsManage: 'imports.manage', // nhập Excel — chủ trọ + quản lý khu (khu được giao)
  MembersView: 'members.view',
  MembersManage: 'members.manage', // thêm/sửa/khóa/gỡ/cấp lại mật khẩu quản lý khu — chỉ chủ trọ
  OrganizationSettingsView: 'organization-settings.view', // thông tin chủ trọ, thời gian giữ dữ liệu — quản lý khu chỉ xem
  OrganizationSettingsManage: 'organization-settings.manage',
  OrganizationsManage: 'organizations.manage',
})

const PERMISSION_POLICY = {
  [Permission.Session]: Policy.AnyUser,
  [Permission.DashboardView]: Policy.OrgMember,
  [Permission.PropertiesView]: Policy.OrgMember,
  [Permission.PropertiesManage]: Policy.OrgMember,
  [Permission.PropertiesAdminister]: Policy.OrgOwner,
  [Permission.PropertiesBankManage]: Policy.OrgOwner,
  [Permission.RoomsView]: Policy.OrgMember,
  [Permission.RoomsManage]: Policy.OrgMember,
  [Permission.RentersView]: Policy.OrgMember,
  [Permission.RentersManage]: Policy.OrgMember,
  [Permission.RentersAnonymize]: Policy.OrgOwner,
  [Permission.ContractsView]: Policy.OrgMember,
  [Permission.ContractsManage]: Policy.OrgMember,
  [Permission.BillingView]: Policy.OrgMember,
  [Permission.ContractTemplatesView]: Policy.OrgMember,
  [Permission.ContractTemplatesManage]: Policy.OrgOwner, // mẫu dùng chung mọi khu — chỉ chủ trọ tạo / sửa / ngừng (08/11/2026)
  [Permission.AuditView]: Policy.OrgOwner,
  [Permission.ImportsManage]: Policy.OrgMember, // quản lý khu nhập được vào khu mình (08/11/2026)
  [Permission.MembersView]: Policy.OrgMember,
  [Permission.MembersManage]: Policy.OrgOwner,
  [Permission.OrganizationSettingsView]: Policy.OrgMember,
  [Permission.OrganizationSettingsManage]: Policy.OrgOwner,
  [Permission.OrganizationsManage]: Policy.SystemAdmin,
}

export function satisfiesPolicy(user, policy) {
  const rule = POLICY_RULES[policy]
  if (!user || !rule) return false // không biết policy → chặn (secure by default, như fallback policy của BE)
  if (user.mustChangePassword && !rule.allowsPasswordChange) return false
  if (rule.roles && !rule.roles.includes(user.role)) return false
  if (rule.requiresOrg && !user.organization) return false
  return true
}

export function hasPermission(user, permission) {
  return satisfiesPolicy(user, PERMISSION_POLICY[permission])
}

/**
 * Xem / xuất số giấy tờ đầy đủ (conventions.md#dữ-liệu-cá-nhân): chủ trọ và quản lý khu luôn có từ 08/11/2026 (quản lý: khu được giao —
 * server đã lọc). Giữ đọc `canViewSensitiveData` của GET /me cho tài khoản bị khóa giữa phiên.
 */
export function canViewSensitiveData(user) {
  if (!satisfiesPolicy(user, Policy.OrgMember)) return false
  return user.role === Role.OrgOwner || user.canViewSensitiveData === true
}

/**
 * Bỏ nợ (riêng, "Thanh toán + bỏ phần còn lại", "Bỏ nợ" khi hoàn tất thanh lý): chủ trọ và quản lý khu luôn có từ 08/11/2026
 * (bỏ quyền cấp riêng) — vẫn đọc `canWriteOff` của GET /me.
 */
export function canWriteOff(user) {
  if (!satisfiesPolicy(user, Policy.OrgMember)) return false
  return user.role === Role.OrgOwner || user.canWriteOff === true
}

/** Tự sửa hồ sơ (PUT /me): chủ trọ và SystemAdmin; quản lý khu do chủ trọ sửa hộ (403 PROFILE_MANAGED_BY_OWNER). */
export function canEditOwnProfile(user) {
  return Boolean(user) && !user.mustChangePassword && user.role !== Role.OrgManager
}
