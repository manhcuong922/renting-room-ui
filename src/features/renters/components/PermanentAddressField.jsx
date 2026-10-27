import { MapPin } from 'lucide-react'
import { useState } from 'react'
import { Button, FormGrid, TextField } from '@/components/ui'
import { AdminUnitFields } from '@/features/shared/AdminUnitFields'

const MAX_LENGTH = 500
const EMPTY_UNIT = { provinceName: '', provinceCode: null, communeName: '', communeCode: null }

/**
 * "Nơi thường trú" của người thuê. Backend lưu một chuỗi tự do ≤ 500 ký tự (docs/api/renters.md#tạo-hồ-sơ, không có mã tỉnh / xã),
 * nên khối "Chọn tỉnh / xã" chỉ giúp ghép chuỗi đúng tên chính thức: "<số nhà, thôn>, <xã / phường>, <tỉnh / thành phố>".
 * Ô chữ vẫn sửa tay được.
 */
export function PermanentAddressField({ value, onChange, error }) {
  const [picking, setPicking] = useState(false)
  const [detail, setDetail] = useState('')
  const [unit, setUnit] = useState(EMPTY_UNIT)

  const compose = (nextDetail, nextUnit) => {
    const text = [nextDetail.trim(), nextUnit.communeName.trim(), nextUnit.provinceName.trim()].filter(Boolean).join(', ')
    onChange(text.slice(0, MAX_LENGTH))
  }

  return (
    <div className="span-full" style={{ display: 'grid', gap: 'var(--space-3)' }}>
      <TextField
        label="Nơi thường trú"
        maxLength={MAX_LENGTH}
        hint="In vào hợp đồng"
        error={error}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {picking ? (
        <FormGrid cols={3}>
          <TextField
            label="Số nhà, thôn / tổ, đường"
            maxLength={300}
            value={detail}
            onChange={(event) => {
              setDetail(event.target.value)
              compose(event.target.value, unit)
            }}
          />
          <AdminUnitFields
            value={unit}
            onChange={(next) => {
              setUnit(next)
              compose(detail, next)
            }}
          />
        </FormGrid>
      ) : (
        <div>
          <Button size="sm" variant="ghost" icon={MapPin} onClick={() => setPicking(true)}>
            Chọn tỉnh / xã từ danh mục
          </Button>
        </div>
      )}
    </div>
  )
}
