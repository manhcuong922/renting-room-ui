import { createBrowserRouter } from 'react-router'
import { GuestOnly, HomeRedirect, RequireAuth } from '@/features/auth/guards'
import { Permission } from '@/features/auth/permissions'
import { AppLayout } from '@/layouts/AppLayout/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout/AuthLayout'
import NotFoundPage from '@/pages/NotFoundPage'
import RouteErrorPage from '@/pages/RouteErrorPage'
import {
  ChangePasswordPage,
  ContractDataReviewPage,
  ContractDetailPage,
  ContractsPage,
  ContractWizardPage,
  ContractTemplateEditorPage,
  ContractTemplatesPage,
  DashboardPage,
  LoginPage,
  MembersPage,
  OrganizationDetailPage,
  OrganizationSettingsPage,
  OrganizationsPage,
  ProfilePage,
  PropertiesPage,
  PropertyCreatePage,
  PropertyDetailPage,
  RenterDetailPage,
  RentersPage,
  RoomDetailPage,
  RoomsPage,
} from './lazyPages'

// Bảo vệ 2 lớp:
//   1. RequireAuth  — chưa đăng nhập (kể cả gõ thẳng URL) → /login, đăng nhập xong quay lại đúng trang.
//   2. RouteAccessGate (trong AppLayout) — `handle.permission` của route; THIẾU khai báo = bị chặn.
// `handle.title` → tiêu đề topbar + document.title. Thêm trang: route ở đây + item trong config/navigation.js
// (dùng cùng một Permission).
export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          {
            element: <AuthLayout />,
            children: [{ path: '/login', element: <LoginPage />, handle: { title: 'Đăng nhập' } }],
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AuthLayout />,
            children: [{ path: '/change-password', element: <ChangePasswordPage />, handle: { title: 'Đổi mật khẩu' } }],
          },
          {
            element: <AppLayout />,
            children: [
              {
                // errorElement ở đây → lỗi 1 trang chỉ thay vùng nội dung, sidebar vẫn dùng được.
                errorElement: <RouteErrorPage />,
                children: [
                  { index: true, element: <HomeRedirect />, handle: { permission: Permission.Session } },
                  { path: 'profile', element: <ProfilePage />, handle: { title: 'Hồ sơ của tôi', permission: Permission.Session } },
                  { path: 'dashboard', element: <DashboardPage />, handle: { title: 'Tổng quan', permission: Permission.DashboardView } },
                  { path: 'properties', element: <PropertiesPage />, handle: { title: 'Khu trọ', permission: Permission.PropertiesView } },
                  {
                    path: 'properties/new',
                    element: <PropertyCreatePage />,
                    handle: { title: 'Tạo khu trọ', permission: Permission.PropertiesManage },
                  },
                  {
                    path: 'properties/:id',
                    element: <PropertyDetailPage />,
                    handle: { title: 'Chi tiết khu trọ', permission: Permission.PropertiesView },
                  },
                  { path: 'rooms', element: <RoomsPage />, handle: { title: 'Phòng', permission: Permission.RoomsView } },
                  { path: 'rooms/:id', element: <RoomDetailPage />, handle: { title: 'Chi tiết phòng', permission: Permission.RoomsView } },
                  { path: 'renters', element: <RentersPage />, handle: { title: 'Người thuê', permission: Permission.RentersView } },
                  { path: 'renters/:id', element: <RenterDetailPage />, handle: { title: 'Hồ sơ người thuê', permission: Permission.RentersView } },
                  { path: 'contracts', element: <ContractsPage />, handle: { title: 'Hợp đồng', permission: Permission.ContractsView } },
                  { path: 'contracts/new', element: <ContractWizardPage />, handle: { title: 'Tạo hợp đồng', permission: Permission.ContractsManage } },
                  {
                    path: 'contracts/review',
                    element: <ContractDataReviewPage />,
                    handle: { title: 'Dữ liệu cần xem lại', permission: Permission.ContractsView },
                  },
                  { path: 'contracts/:id', element: <ContractDetailPage />, handle: { title: 'Chi tiết hợp đồng', permission: Permission.ContractsView } },
                  {
                    path: 'contracts/:id/edit',
                    element: <ContractWizardPage />,
                    handle: { title: 'Sửa hợp đồng nháp', permission: Permission.ContractsManage },
                  },
                  {
                    path: 'contract-templates',
                    element: <ContractTemplatesPage />,
                    handle: { title: 'Mẫu hợp đồng', permission: Permission.ContractTemplatesView },
                  },
                  {
                    path: 'contract-templates/new',
                    element: <ContractTemplateEditorPage />,
                    handle: { title: 'Tạo mẫu hợp đồng', permission: Permission.ContractTemplatesManage },
                  },
                  {
                    path: 'contract-templates/:id',
                    element: <ContractTemplateEditorPage />,
                    handle: { title: 'Sửa mẫu hợp đồng', permission: Permission.ContractTemplatesManage },
                  },
                  { path: 'members', element: <MembersPage />, handle: { title: 'Thành viên', permission: Permission.MembersView } },
                  {
                    path: 'organization',
                    element: <OrganizationSettingsPage />,
                    handle: { title: 'Cài đặt tổ chức', permission: Permission.OrganizationSettingsView },
                  },
                  {
                    path: 'admin/organizations',
                    element: <OrganizationsPage />,
                    handle: { title: 'Tổ chức chủ trọ', permission: Permission.OrganizationsManage },
                  },
                  {
                    path: 'admin/organizations/:id',
                    element: <OrganizationDetailPage />,
                    handle: { title: 'Chi tiết tổ chức', permission: Permission.OrganizationsManage },
                  },
                  { path: '*', element: <NotFoundPage />, handle: { title: 'Không tìm thấy trang', permission: Permission.Session } },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
])
