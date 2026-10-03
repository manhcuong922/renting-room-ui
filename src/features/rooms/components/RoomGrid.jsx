import { User } from 'lucide-react'
import { Link } from 'react-router'
import { ROOM_STATUS } from '@/constants/enums'
import { cx } from '@/lib/cx'
import { formatMoney } from '@/lib/format'
import { groupByFloor } from '../roomForm'
import styles from './RoomGrid.module.css'

/** Sơ đồ phòng: lưới nhóm theo tầng, ô màu theo trạng thái (docs/api/rooms.md#màn-hình). */
export function RoomGrid({ rooms, showProperty = false }) {
  return (
    <div className={styles.floors}>
      {groupByFloor(rooms).map(([floor, floorRooms]) => (
        <section key={floor || 'none'} className={styles.floor}>
          <h3 className={styles.floorTitle}>{floor ? `Tầng ${floor}` : 'Chưa đặt tầng'}</h3>
          <ul className={styles.grid}>
            {floorRooms.map((room) => (
              <li key={room.id}>
                <RoomTile room={room} showProperty={showProperty} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function RoomTile({ room, showProperty }) {
  const status = ROOM_STATUS[room.status]
  const contract = room.currentContract
  return (
    <Link to={`/rooms/${room.id}`} className={cx(styles.tile, styles[status?.tone ?? 'neutral'])}>
      <span className={styles.tileHead}>
        <strong className={styles.code}>
          {showProperty && <span className={styles.property}>{room.propertyCode}·</span>}
          {room.code}
        </strong>
        <span className={styles.status}>{status?.label ?? room.status}</span>
      </span>
      <span className={styles.rent}>{room.listedRent ? formatMoney(room.listedRent) : 'Chưa có giá'}</span>
      {contract ? (
        <span className={styles.contract}>
          <span className={styles.rep}>{contract.representativeName}</span>
          <span className={styles.occupants}>
            <User size={12} aria-hidden /> {contract.occupantCount}/{room.maxOccupants}
          </span>
        </span>
      ) : (
        <span className={styles.contract}>
          <span className={styles.occupants}>
            <User size={12} aria-hidden /> tối đa {room.maxOccupants}
          </span>
        </span>
      )}
    </Link>
  )
}
