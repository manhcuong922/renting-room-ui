import { Card, PageHeader, TabPanel, Tabs } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
import { useTabParam } from '@/hooks/useTabParam'
import { DataRetentionTab } from '../components/DataRetentionTab'
import { OrganizationLessorTab } from '../components/OrganizationLessorTab'

const TAB_PREFIX = 'organization'

// Cài đặt của tổ chức chủ trọ: Thông tin chủ trọ (bên cho thuê mặc định) · Giữ dữ liệu người thuê.
export default function OrganizationSettingsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useTabParam('lessor')
  const tabs = [
    { id: 'lessor', label: 'Thông tin chủ trọ' },
    { id: 'retention', label: 'Giữ dữ liệu người thuê' },
  ]

  return (
    <>
      <PageHeader title="Cài đặt tổ chức" description={user?.organization?.name} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Cài đặt tổ chức" idPrefix={TAB_PREFIX} />
      <TabPanel idPrefix={TAB_PREFIX} id={tab}>
        <Card>
          {tab === 'lessor' && <OrganizationLessorTab />}
          {tab === 'retention' && <DataRetentionTab />}
        </Card>
      </TabPanel>
    </>
  )
}
