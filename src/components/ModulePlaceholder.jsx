import { Construction } from 'lucide-react'
import { Card, EmptyState, PageHeader } from '@/components/ui'
import { env } from '@/config/env'
import styles from './ModulePlaceholder.module.css'

// Khung tạm cho màn hình chưa dựng. Dev mode hiện gợi ý module API + endpoint cần dùng.
export function ModulePlaceholder({ title, description, apiModule, doc, endpoints = [] }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card>
        <EmptyState icon={Construction} title="Màn hình đang được phát triển" description="Chức năng sẽ sớm có mặt." />
        {env.isDev && apiModule && (
          <div className={styles.devHint}>
            <p>
              <strong>Dev:</strong> dùng <code>{apiModule}</code> trong <code>src/api</code> — tài liệu{' '}
              <code>renting_room/docs/api/{doc}</code>
            </p>
            <ul>
              {endpoints.map((endpoint) => (
                <li key={endpoint}>
                  <code>{endpoint}</code>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </>
  )
}
