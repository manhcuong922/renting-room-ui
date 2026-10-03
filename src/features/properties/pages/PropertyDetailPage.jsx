import { Archive, ArchiveRestore, FileSpreadsheet, MapPin } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { propertiesApi, queryKeys } from '@/api'
import { Alert, Badge, Button, Card, ConfirmDialog, PageHeader, QueryView, TabPanel, Tabs } from '@/components/ui'
import { ExportRentersDialog } from '@/features/exports/ExportRentersDialog'
import { useAction } from '@/hooks/useAction'
import { useTabParam } from '@/hooks/useTabParam'
import { LessorTab } from '../components/LessorTab'
import { PropertyRoomsTab } from '../components/PropertyRoomsTab'
import { RoomGroupsTab } from '../components/RoomGroupsTab'
import { BankTab, HouseRulesTab, PropertyInfoTab } from '../components/SimpleTabs'
import { useProperty } from '../hooks'

const TAB_PREFIX = 'property'

// docs/api/properties.md#chi-tiết — tab: Thông tin · Bên cho thuê · Ngân hàng · Nội quy · Phòng · Nhóm phòng.
export default function PropertyDetailPage() {
  const { id } = useParams()
  const query = useProperty(id)
  const [tab, setTab] = useTabParam('rooms')
  const [dialog, setDialog] = useState(null) // 'archive' | 'restore' | 'export'

  const invalidate = [queryKeys.properties.all, queryKeys.rooms.all]
  const archive = useAction({ mutationFn: () => propertiesApi.archive(id), invalidate, success: 'Đã ngừng sử dụng khu.', toastErrors: false })
  const restore = useAction({ mutationFn: () => propertiesApi.restore(id), invalidate, success: 'Đã khôi phục khu.', toastErrors: false })

  return (
    <QueryView query={query} loading="page" errorTitle="Không tải được khu trọ">
      {(property) => {
        const tabs = [
          { id: 'rooms', label: 'Phòng' },
          { id: 'info', label: 'Thông tin & cài đặt thu' },
          { id: 'lessor', label: 'Bên cho thuê', badge: property.lessor?.isComplete ? '✓' : '!' },
          { id: 'bank', label: 'Ngân hàng' },
          { id: 'rules', label: 'Nội quy' },
          { id: 'groups', label: 'Nhóm phòng' },
        ]
        return (
          <>
            <PageHeader
              backTo="/properties"
              backLabel="Khu trọ"
              title={property.name}
              meta={
                <>
                  <Badge tone="primary">{property.code}</Badge>
                  {property.isArchived && <Badge>Ngừng sử dụng</Badge>}
                </>
              }
              description={
                <span style={{ display: 'inline-flex', gap: 4, alignItems: 'flex-start' }}>
                  <MapPin size={14} aria-hidden style={{ marginTop: 3, flexShrink: 0 }} /> {property.addressText}
                </span>
              }
              actions={
                <>
                  <Button variant="secondary" icon={FileSpreadsheet} onClick={() => setDialog('export')}>
                    Xuất người thuê
                  </Button>
                  {property.isArchived ? (
                    <Button variant="secondary" icon={ArchiveRestore} onClick={() => setDialog('restore')}>
                      Khôi phục
                    </Button>
                  ) : (
                    <Button variant="ghost" icon={Archive} onClick={() => setDialog('archive')}>
                      Ngừng sử dụng
                    </Button>
                  )}
                </>
              }
            />

            {property.isArchived && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <Alert tone="warning">Khu đã ngừng sử dụng — không tạo được phòng hay hợp đồng mới.</Alert>
              </div>
            )}

            <Tabs tabs={tabs} value={tab} onChange={setTab} label="Thông tin khu trọ" idPrefix={TAB_PREFIX} />
            <TabPanel idPrefix={TAB_PREFIX} id={tab}>
              {tab === 'rooms' && <PropertyRoomsTab property={property} />}
              {tab === 'groups' && <RoomGroupsTab property={property} />}
              {tab !== 'rooms' && tab !== 'groups' && (
                <Card>
                  {tab === 'info' && <PropertyInfoTab key={property.version} property={property} />}
                  {tab === 'lessor' && <LessorTab key={property.version} property={property} />}
                  {tab === 'bank' && <BankTab key={property.version} property={property} />}
                  {tab === 'rules' && <HouseRulesTab key={property.version} property={property} />}
                </Card>
              )}
            </TabPanel>

            <ConfirmDialog
              open={dialog === 'archive'}
              onClose={() => setDialog(null)}
              title="Ngừng sử dụng khu?"
              message="Khu và mọi phòng chuyển sang “Ngừng sử dụng”. Chỉ thực hiện được khi không còn hợp đồng nháp / hiệu lực / đang thanh lý."
              confirmLabel="Ngừng sử dụng"
              tone="danger"
              onConfirm={() => archive.mutateAsync()}
            />
            <ConfirmDialog
              open={dialog === 'restore'}
              onClose={() => setDialog(null)}
              title="Khôi phục khu?"
              message="Chỉ khôi phục khu; các phòng cần khôi phục riêng từng phòng."
              confirmLabel="Khôi phục"
              onConfirm={() => restore.mutateAsync()}
            />
            {dialog === 'export' && <ExportRentersDialog open presetPropertyIds={[property.id]} onClose={() => setDialog(null)} />}
          </>
        )
      }}
    </QueryView>
  )
}
