import { Building, DoorOpen, FileStack, FileText, LayoutDashboard, ShieldCheck, UserCog, Users } from 'lucide-react'
import { Role } from '@/constants/enums'
import { hasPermission, Permission } from '@/features/auth/permissions'

// Menu sidebar — nguồn duy nhất. Thêm màn hình mới: thêm item ở đây + route trong app/router.jsx.
// `permission` dùng chung với route (handle.permission) → menu và quyền vào trang không bao giờ lệch nhau.
//   SystemAdmin KHÔNG thấy dữ liệu trọ; OrgManager thấy như chủ trọ (nút thao tác thành viên ẩn bằng <Can>).
export const NAVIGATION = [
  {
    id: 'overview',
    label: null,
    items: [{ to: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard, permission: Permission.DashboardView }],
  },
  {
    id: 'property',
    label: 'Nhà trọ',
    items: [
      { to: '/properties', label: 'Khu trọ', icon: Building, permission: Permission.PropertiesView },
      { to: '/rooms', label: 'Phòng', icon: DoorOpen, permission: Permission.RoomsView },
      { to: '/renters', label: 'Người thuê', icon: Users, permission: Permission.RentersView },
    ],
  },
  {
    id: 'contract',
    label: 'Hợp đồng',
    items: [
      { to: '/contracts', label: 'Hợp đồng', icon: FileText, permission: Permission.ContractsView },
      { to: '/contract-templates', label: 'Mẫu hợp đồng', icon: FileStack, permission: Permission.ContractTemplatesView },
    ],
  },
  {
    id: 'organization',
    label: 'Tổ chức',
    items: [{ to: '/members', label: 'Thành viên', icon: UserCog, permission: Permission.MembersView }],
  },
  {
    id: 'admin',
    label: 'Quản trị nền tảng',
    items: [{ to: '/admin/organizations', label: 'Tổ chức chủ trọ', icon: ShieldCheck, permission: Permission.OrganizationsManage }],
  },
]

export function getNavigationForUser(user) {
  return NAVIGATION.map((section) => ({
    ...section,
    items: section.items.filter((item) => hasPermission(user, item.permission)),
  })).filter((section) => section.items.length > 0)
}

// Nhóm menu chứa đường dẫn hiện tại — dùng cho breadcrumb trên topbar.
export function findNavSection(pathname) {
  return NAVIGATION.find((section) =>
    section.items.some((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)),
  )
}

export function getHomePath(user) {
  if (user?.mustChangePassword) return '/change-password'
  return user?.role === Role.SystemAdmin ? '/admin/organizations' : '/dashboard'
}
