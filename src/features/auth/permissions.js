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
  RoomsView: 'rooms.view',
  RoomsManage: 'rooms.manage',
  RentersView: 'renters.view',
  RentersManage: 'renters.manage',
  ContractsView: 'contracts.view',
  ContractsManage: 'contracts.manage',
  ContractTemplatesView: 'contract-templates.view',
  ContractTemplatesManage: 'contract-templates.manage',
  MembersView: 'members.view',
  MembersManage: 'members.manage', // thêm/sửa/khóa/gỡ/cấp lại mật khẩu phó quản lý — chỉ chủ trọ
  OrganizationsManage: 'organizations.manage',
})

const PERMISSION_POLICY = {
  [Permission.Session]: Policy.AnyUser,
  [Permission.DashboardView]: Policy.OrgMember,
  [Permission.PropertiesView]: Policy.OrgMember,
  [Permission.PropertiesManage]: Policy.OrgMember,
  [Permission.RoomsView]: Policy.OrgMember,
  [Permission.RoomsManage]: Policy.OrgMember,
  [Permission.RentersView]: Policy.OrgMember,
  [Permission.RentersManage]: Policy.OrgMember,
  [Permission.ContractsView]: Policy.OrgMember,
  [Permission.ContractsManage]: Policy.OrgMember,
  [Permission.ContractTemplatesView]: Policy.OrgMember,
  [Permission.ContractTemplatesManage]: Policy.OrgMember,
  [Permission.MembersView]: Policy.OrgMember,
  [Permission.MembersManage]: Policy.OrgOwner,
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
