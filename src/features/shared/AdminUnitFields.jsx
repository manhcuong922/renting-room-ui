import { Combobox } from '@/components/ui'
import { useAdminUnits } from '@/hooks/useAdminUnits'
import { findUnit, toUnitOptions } from '@/lib/adminUnits'

/**
 * Hai ô "Tỉnh / thành phố" + "Xã / phường" chọn từ danh mục 2 cấp (gõ không dấu để tìm).
 * value: { provinceName, provinceCode, communeName, communeCode } · onChange(next) trả đủ 4 trường.
 * Vẫn gõ tay được: tên ngoài danh mục giữ nguyên chữ, mã = null (dữ liệu cũ, danh mục chưa tải được).
 */
export function AdminUnitFields({ value, onChange, errors = {}, required, disabled }) {
  const query = useAdminUnits()
  const provinces = query.data?.provinces
  const province = findUnit(provinces, value.provinceCode, value.provinceName)
  const loadHint = query.isError ? 'Không tải được danh mục — nhập tay.' : query.isPending ? 'Đang tải danh mục…' : undefined

  return (
    <>
      <Combobox
        label="Tỉnh / thành phố"
        required={required}
        disabled={disabled}
        placeholder="Gõ để tìm, VD ha noi"
        hint={loadHint}
        error={errors.provinceName}
        options={toUnitOptions(provinces)}
        value={value.provinceName}
        // Gõ tay: bỏ mã tỉnh; xã đã chọn không còn chắc thuộc tỉnh mới → bỏ mã xã.
        onChange={(text) => onChange({ ...value, provinceName: text, provinceCode: null, communeCode: null })}
        onSelect={(option) =>
          option.value === value.provinceCode
            ? onChange({ ...value, provinceName: option.label })
            : onChange({ provinceName: option.label, provinceCode: option.value, communeName: '', communeCode: null })
        }
      />
      <Combobox
        label="Xã / phường"
        required={required}
        disabled={disabled}
        placeholder={province ? 'Gõ để tìm, VD cau giay' : 'Chọn tỉnh / thành phố trước'}
        emptyText={province ? 'Không có xã / phường phù hợp' : 'Chọn tỉnh / thành phố để có gợi ý'}
        error={errors.communeName}
        options={toUnitOptions(province?.communes)}
        value={value.communeName}
        onChange={(text) => onChange({ ...value, communeName: text, communeCode: null })}
        onSelect={(option) =>
          onChange({
            ...value,
            // Tỉnh đang là chữ nhập tay nhưng khớp danh mục → gắn luôn tên và mã chính thức.
            provinceName: province?.name ?? value.provinceName,
            provinceCode: province?.code ?? value.provinceCode,
            communeName: option.label,
            communeCode: option.value,
          })
        }
      />
    </>
  )
}
