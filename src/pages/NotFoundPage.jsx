import { SearchX } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button, EmptyState } from '@/components/ui'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <EmptyState
      icon={SearchX}
      title="Không tìm thấy trang"
      description="Đường dẫn không tồn tại hoặc đã bị thay đổi."
      action={
        <Button variant="secondary" onClick={() => navigate('/')}>
          Về trang chủ
        </Button>
      }
    />
  )
}
