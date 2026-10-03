import { Lock } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button, EmptyState } from '@/components/ui'
import { getHomePath } from '@/config/navigation'
import { useAuth, usePermission } from './AuthContext'

/**
 * Ẩn phần giao diện khi không đủ quyền.
 *   <Can permission={Permission.MembersManage}><Button>Thêm phó quản lý</Button></Can>
 */
export function Can({ permission, fallback = null, children }) {
  return usePermission(permission) ? children : fallback
}

export function ForbiddenState() {
  const { user } = useAuth()
  const navigate = useNavigate()
  return (
    <EmptyState
      icon={Lock}
      title="Bạn không có quyền truy cập"
      description="Chức năng này không dành cho vai trò của bạn. Liên hệ chủ trọ hoặc quản trị viên nếu cần."
      action={
        <Button variant="secondary" onClick={() => navigate(getHomePath(user), { replace: true })}>
          Về trang chủ
        </Button>
      }
    />
  )
}
