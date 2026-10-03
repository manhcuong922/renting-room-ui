import { DoorOpen, Plus, Rows3 } from 'lucide-react'
import { useState } from 'react'
import { Button, EmptyState, QueryView } from '@/components/ui'
import { BulkRoomsDialog } from '@/features/rooms/components/BulkRoomsDialog'
import { RoomFormDialog } from '@/features/rooms/components/RoomFormDialog'
import { RoomGrid } from '@/features/rooms/components/RoomGrid'
import { usePropertyRooms } from '@/features/shared/queries'

/** Tab Phòng: sơ đồ phòng theo tầng của khu (docs/api/rooms.md#màn-hình). */
export function PropertyRoomsTab({ property }) {
  const rooms = usePropertyRooms(property.id)
  const [dialog, setDialog] = useState(null) // 'single' | 'bulk'

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <Button variant="secondary" icon={Rows3} onClick={() => setDialog('bulk')} disabled={property.isArchived}>
          Tạo hàng loạt
        </Button>
        <Button icon={Plus} onClick={() => setDialog('single')} disabled={property.isArchived}>
          Thêm phòng
        </Button>
      </div>

      <QueryView
        query={rooms}
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            icon={DoorOpen}
            title="Khu chưa có phòng"
            description="Dùng “Tạo hàng loạt” để sinh nhanh phòng theo tầng."
          />
        }
      >
        {(list) => <RoomGrid rooms={list} />}
      </QueryView>

      {dialog === 'single' && <RoomFormDialog open propertyId={property.id} onClose={() => setDialog(null)} />}
      {dialog === 'bulk' && <BulkRoomsDialog open propertyId={property.id} onClose={() => setDialog(null)} />}
    </>
  )
}
