import { useEffect } from 'react'

const APP_NAME = 'Quản lý nhà trọ'

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME
  }, [title])
}
