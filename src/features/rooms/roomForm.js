// Phòng ⇄ form + kiểm tra phía client (docs/api/rooms.md#tạo-một-phòng).
export const ROOM_CODE_PATTERN = /^[A-Za-z0-9._/-]{1,20}$/

export function toRoomForm(room) {
  return {
    code: room?.code ?? '',
    spec: {
      floor: room?.floor ?? '',
      areaM2: room?.areaM2 ?? null,
      maxOccupants: room?.maxOccupants ?? null,
      listedRent: room?.listedRent ?? null,
      defaultDeposit: room?.defaultDeposit ?? null,
      amenities: room?.amenities ?? [],
      description: room?.description ?? '',
    },
  }
}

export function toRoomBody(v) {
  return {
    code: v.code.trim().toUpperCase(),
    spec: {
      ...v.spec,
      floor: v.spec.floor.trim() || null,
      description: v.spec.description.trim() || null,
    },
  }
}

export function validateRoomSpec(spec, prefix = 'spec.') {
  return {
    [`${prefix}floor`]: spec.floor && spec.floor.trim().length > 10 ? 'Tầng ≤ 10 ký tự.' : null,
    [`${prefix}areaM2`]: spec.areaM2 !== null && (spec.areaM2 <= 0 || spec.areaM2 > 1000) ? 'Diện tích từ 0 đến 1000 m².' : null,
    // Số người theo loại phòng — chỉ để mô tả, không giới hạn số người ở (PR-BR-06). Bỏ trống được.
    [`${prefix}maxOccupants`]:
      spec.maxOccupants !== null && (!Number.isInteger(spec.maxOccupants) || spec.maxOccupants < 1 || spec.maxOccupants > 20)
        ? 'Từ 1 đến 20 người, hoặc bỏ trống.'
        : null,
  }
}

export function validateRoom(v) {
  return {
    code: !ROOM_CODE_PATTERN.test(v.code.trim()) ? 'Mã ≤ 20 ký tự: chữ, số, . _ / -' : null,
    ...validateRoomSpec(v.spec),
  }
}

/** "2 người" / "2/3 người" — số người khai của phòng chỉ mô tả loại phòng, không phải giới hạn. */
export function formatOccupants(count, maxOccupants) {
  if (count == null) return maxOccupants ? `Loại ${maxOccupants} người` : '—'
  return maxOccupants ? `${count}/${maxOccupants} người` : `${count} người`
}

// Gom phòng theo tầng cho sơ đồ — tầng sắp theo số nếu được ("Tầng trệt" đứng trước).
export function groupByFloor(rooms) {
  const groups = new Map()
  for (const room of rooms) {
    const key = room.floor ?? ''
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(room)
  }
  return [...groups.entries()].sort(([a], [b]) => {
    const na = Number(a)
    const nb = Number(b)
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
    return a.localeCompare(b, 'vi', { numeric: true })
  })
}
