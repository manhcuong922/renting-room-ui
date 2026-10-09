import { useQuery } from '@tanstack/react-query'
import { Archive, ArchiveRestore, FilePlus, Pencil, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { contractsApi, queryKeys, roomsApi } from '@/api'
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  EmptyState,
  PageHeader,
  QueryView,
  Section,
  StatusBadge,
} from '@/components/ui'
import { AMENITY_LABELS, CONTRACT_STATUS, ROOM_STATUS } from '@/constants/enums'
import { useAction } from '@/hooks/useAction'
import { ContractFlagBadges } from '@/features/contracts/components/ContractBadges'
import { formatContractTerm } from '@/features/contracts/contractRules'
import { formatMoney } from '@/lib/format'
import { RoomFormDialog } from '../components/RoomFormDialog'
import { RoomDebt } from '../components/RoomGrid'
import { useRoom } from '../hooks'
import { formatOccupants } from '../roomForm'

const CONTRACT_COLUMNS = [
  { key: 'no', header: 'Số HĐ', primary: true, cell: (c) => <Link to={`/contracts/${c.id}`}>{c.contractNo}</Link> },
  { key: 'rep', header: 'Người đại diện', cell: (c) => c.representativeName },
  { key: 'term', header: 'Thời hạn', cell: formatContractTerm },
  { key: 'rent', header: 'Giá', align: 'right', cell: (c) => formatMoney(c.currentRent) },
  { key: 'status', header: 'Trạng thái', cell: (c) => <StatusBadge map={CONTRACT_STATUS} value={c.status} /> },
]

// docs/api/rooms.md — trạng thái phòng do server tính; UI chỉ hiện nút theo bảng "Thao tác trạng thái".
export default function RoomDetailPage() {
  const { id } = useParams()
  const query = useRoom(id)
  const [dialog, setDialog] = useState(null) // 'edit' | 'maintenance' | 'endMaintenance' | 'archive' | 'restore'
  const contracts = useQuery({
    queryKey: queryKeys.contracts.list({ roomId: id, pageSize: 50 }),
    queryFn: ({ signal }) => contractsApi.list({ roomId: id, page: 1, pageSize: 50 }, { signal }),
  })

  const invalidate = [queryKeys.rooms.all, queryKeys.properties.all]
  const startMaintenance = useAction({ mutationFn: (note) => roomsApi.startMaintenance(id, { note: note || null }), invalidate, success: 'Đã chuyển phòng sang bảo trì.', toastErrors: false })
  const endMaintenance = useAction({ mutationFn: () => roomsApi.endMaintenance(id), invalidate, success: 'Đã kết thúc bảo trì.', toastErrors: false })
  const archive = useAction({ mutationFn: () => roomsApi.archive(id), invalidate, success: 'Đã ngừng sử dụng phòng.', toastErrors: false })
  const restore = useAction({ mutationFn: () => roomsApi.restore(id), invalidate, success: 'Đã khôi phục phòng.', toastErrors: false })

  return (
    <QueryView query={query} loading="page" errorTitle="Không tải được phòng">
      {(room) => {
        const canContract = room.status === 'Vacant' || room.status === 'Reserved'
        const current = room.currentContract
        return (
          <>
            <PageHeader
              backTo={`/properties/${room.propertyId}`}
              backLabel={`Khu ${room.propertyCode}`}
              title={`Phòng ${room.code}`}
              meta={
                <>
                  <Badge tone="primary">{room.propertyCode}</Badge>
                  <StatusBadge map={ROOM_STATUS} value={room.status} />
                  <RoomDebt room={room} />
                </>
              }
              actions={
                <>
                  {canContract && (
                    <ButtonLink to={`/contracts/new?roomId=${room.id}`} icon={FilePlus}>
                      Tạo hợp đồng
                    </ButtonLink>
                  )}
                  {room.status !== 'Archived' && (
                    <Button variant="secondary" icon={Pencil} onClick={() => setDialog('edit')}>
                      Sửa
                    </Button>
                  )}
                  {canContract && (
                    <Button variant="secondary" icon={Wrench} onClick={() => setDialog('maintenance')}>
                      Bảo trì
                    </Button>
                  )}
                  {room.status === 'Maintenance' && (
                    <Button variant="secondary" icon={Wrench} onClick={() => setDialog('endMaintenance')}>
                      Kết thúc bảo trì
                    </Button>
                  )}
                  {room.status === 'Archived' ? (
                    <Button variant="secondary" icon={ArchiveRestore} onClick={() => setDialog('restore')}>
                      Khôi phục
                    </Button>
                  ) : (
                    room.status !== 'Occupied' && (
                      <Button variant="ghost" icon={Archive} onClick={() => setDialog('archive')}>
                        Ngừng dùng
                      </Button>
                    )
                  )}
                </>
              }
            />

            {room.status === 'Maintenance' && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <Alert tone="warning">
                  Phòng đang bảo trì{room.maintenanceNote ? `: ${room.maintenanceNote}` : ''}. Vẫn tạo được hợp đồng nháp nhưng chưa kích hoạt được.
                </Alert>
              </div>
            )}

            {current && (
              <Section
                title="Hợp đồng hiện hành"
                actions={
                  <ButtonLink to={`/contracts/${current.id}`} variant="secondary" size="sm">
                    Xem hợp đồng
                  </ButtonLink>
                }
              >
                <DescriptionList
                  items={[
                    { label: 'Số hợp đồng', value: current.contractNo },
                    { label: 'Người đại diện', value: current.representativeName },
                    { label: 'Thời hạn', value: formatContractTerm(current) },
                    { label: 'Số người đang ở', value: formatOccupants(current.occupantCount, room.maxOccupants) },
                    { label: 'Cần xử lý', hidden: !current.flags?.length, value: <ContractFlagBadges flags={current.flags} /> },
                    { label: 'Còn nợ', hidden: !room.outstandingAmount, value: formatMoney(room.outstandingAmount) },
                    { label: 'Quá hạn thanh toán', hidden: !room.overdueAmount, value: formatMoney(room.overdueAmount) },
                    { label: 'Đang giữ cọc', hidden: !room.depositHeld, value: formatMoney(room.depositHeld) },
                  ]}
                />
              </Section>
            )}

            <Section title="Thông số">
              <DescriptionList
                items={[
                  { label: 'Tầng', value: room.floor },
                  { label: 'Diện tích', value: room.areaM2 ? `${room.areaM2} m²` : null },
                  { label: 'Số người (loại phòng)', value: room.maxOccupants ? `${room.maxOccupants} người` : null },
                  { label: 'Giá niêm yết', value: room.listedRent ? formatMoney(room.listedRent) : null },
                  { label: 'Tiền cọc gợi ý', value: room.defaultDeposit ? formatMoney(room.defaultDeposit) : null },
                  {
                    label: 'Tiện ích',
                    value: room.amenities.length ? (
                      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
                        {room.amenities.map((a) => (
                          <Badge key={a}>{AMENITY_LABELS[a] ?? a}</Badge>
                        ))}
                      </span>
                    ) : null,
                  },
                  { label: 'Mô tả', value: room.description, full: true },
                ]}
              />
            </Section>

            <Section title="Lịch sử hợp đồng" padded={false}>
              <div style={{ padding: '0 var(--space-4) var(--space-4)' }}>
                <QueryView query={contracts} isEmpty={(d) => d.items.length === 0} empty={<EmptyState title="Phòng chưa có hợp đồng" />}>
                  {(data) => <DataTable columns={CONTRACT_COLUMNS} rows={data.items} rowHref={(c) => `/contracts/${c.id}`} caption="Hợp đồng của phòng" />}
                </QueryView>
              </div>
            </Section>

            {dialog === 'edit' && <RoomFormDialog open room={room} onClose={() => setDialog(null)} />}
            <ConfirmDialog
              open={dialog === 'maintenance'}
              onClose={() => setDialog(null)}
              title="Bắt đầu bảo trì?"
              message="Phòng bảo trì vẫn tạo được hợp đồng nháp nhưng không kích hoạt được cho tới khi kết thúc bảo trì."
              reasonLabel="Ghi chú (VD Sửa điện)"
              reasonRequired={false}
              confirmLabel="Bắt đầu bảo trì"
              onConfirm={(note) => startMaintenance.mutateAsync(note)}
            />
            <ConfirmDialog
              open={dialog === 'endMaintenance'}
              onClose={() => setDialog(null)}
              title="Kết thúc bảo trì?"
              confirmLabel="Kết thúc bảo trì"
              onConfirm={() => endMaintenance.mutateAsync()}
            />
            <ConfirmDialog
              open={dialog === 'archive'}
              onClose={() => setDialog(null)}
              title={`Ngừng sử dụng phòng ${room.code}?`}
              message="Chỉ thực hiện được khi phòng không còn hợp đồng nháp / hiệu lực / đang thanh lý. Phòng ngừng dùng không tạo được hợp đồng."
              confirmLabel="Ngừng sử dụng"
              tone="danger"
              onConfirm={() => archive.mutateAsync()}
            />
            <ConfirmDialog
              open={dialog === 'restore'}
              onClose={() => setDialog(null)}
              title={`Khôi phục phòng ${room.code}?`}
              message="Nếu khu đang ngừng sử dụng, cần khôi phục khu trước."
              confirmLabel="Khôi phục"
              onConfirm={() => restore.mutateAsync()}
            />
          </>
        )
      }}
    </QueryView>
  )
}
