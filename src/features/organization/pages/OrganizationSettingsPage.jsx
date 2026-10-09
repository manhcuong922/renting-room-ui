import { Card, PageHeader, TabPanel, Tabs } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
import { useTabParam } from '@/hooks/useTabParam'
import { OrganizationLessorTab } from '../components/OrganizationLessorTab'

const TAB_PREFIX = 'organization'

// Cài đặt của tổ chức chủ trọ: Thông tin chủ trọ (bên cho thuê mặc định).
export default function OrganizationSettingsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useTabParam('lessor')
  const tabs = [{ id: 'lessor', label: 'Thông tin chủ trọ' }]

  return (
    <>
      <PageHeader title="Cài đặt tổ chức" description={user?.organization?.name} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Cài đặt tổ chức" idPrefix={TAB_PREFIX} />
      <TabPanel idPrefix={TAB_PREFIX} id={tab}>
        <Card>{tab === 'lessor' && <OrganizationLessorTab />}</Card>
      </TabPanel>
    </>
  )
}
