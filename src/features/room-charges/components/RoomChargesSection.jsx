import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { roomChargesApi, queryKeys } from '@/api'
import { Button, EmptyState, QueryView, Section } from '@/components/ui'
import { CreateChargeDialog } from './CreateChargeDialog'
import { RoomChargeList } from './RoomChargeList'

/**
 * Khoản phát sinh của phòng (room-charges.md): phụ thu / bù tạo ngay lúc xảy ra, cuối tháng tự vào phiếu.
 * Chỉ tạo được khi phòng đang có người thuê (phòng trống → 422 ROOM_CHARGE_NO_TENANT) ⇒ chỉ hiện nút khi phòng có hợp đồng hiện hành.
 */
export function RoomChargesSection({ room }) {
  const [creating, setCreating] = useState(null) // 'Surcharge' | 'Credit'
  const query = useQuery({
    queryKey: queryKeys.roomCharges.byRoom(room.id),
    queryFn: ({ signal }) => roomChargesApi.listByRoom(room.id, undefined, { signal }),
  })
  const hasTenant = Boolean(room.currentContract)
  return (
    <Section
      title="Khoản phát sinh"
      description={hasTenant ? 'Phụ thu hoặc khoản bù cho người thuê, tự vào phiếu tiền phòng.' : 'Phòng đang trống — chỉ tạo được khoản phát sinh khi phòng có người thuê.'}
      actions={
        hasTenant && (
          <>
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => setCreating('Credit')}>
              Thêm khoản bù
            </Button>
            <Button size="sm" icon={Plus} onClick={() => setCreating('Surcharge')}>
              Thêm phụ thu
            </Button>
          </>
        )
      }
    >
      <QueryView query={query} isEmpty={(d) => d.length === 0} empty={<EmptyState title="Chưa có khoản phát sinh" />} errorTitle="Không tải được khoản phát sinh">
        {(charges) => <RoomChargeList charges={charges} />}
      </QueryView>
      {creating && <CreateChargeDialog room={room} kind={creating} onClose={() => setCreating(null)} />}
    </Section>
  )
}
