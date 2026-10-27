import { Alert } from '@/components/ui'
import { GENDER_LABELS, ID_DOCUMENT_TYPE_LABELS, IMPORT_ROLE_LABELS, RELATIONSHIP_LABELS, toOptions } from '@/constants/enums'
import { ImportPanel } from './ImportPanel'

// Cột khớp file mẫu của server (imports.md#phòng).
const ROOM_COLUMNS = [
  { key: 'code', label: 'Mã phòng', width: 110 },
  { key: 'floor', label: 'Tầng', width: 90 },
  { key: 'areaM2', label: 'Diện tích (m²)', type: 'number', decimals: 2, width: 120 },
  { key: 'maxOccupants', label: 'Số người (loại phòng)', type: 'number', width: 130 },
  { key: 'listedRent', label: 'Giá niêm yết', type: 'money', width: 140 },
  { key: 'defaultDeposit', label: 'Tiền cọc mặc định', type: 'money', width: 140 },
  { key: 'amenities', label: 'Tiện nghi', type: 'list', width: 200 },
  { key: 'description', label: 'Ghi chú', width: 200 },
  { key: 'electricitySerial', label: 'Số seri công tơ điện', width: 150 },
  { key: 'electricityReading', label: 'Chỉ số điện đầu kỳ', type: 'number', decimals: 2, width: 140 },
  { key: 'waterSerial', label: 'Số seri công tơ nước', width: 150 },
  { key: 'waterReading', label: 'Chỉ số nước đầu kỳ', type: 'number', decimals: 2, width: 140 },
]

// imports.md#người-thuê-đang-ở — 1 sheet, mỗi dòng 1 người; các dòng cùng mã phòng = 1 hợp đồng.
const TENANCY_COLUMNS = [
  { key: 'roomCode', label: 'Mã phòng', width: 110 },
  { key: 'role', label: 'Vai trò', type: 'select', options: toOptions(IMPORT_ROLE_LABELS), width: 170 },
  { key: 'fullName', label: 'Họ tên', width: 200 },
  { key: 'dateOfBirth', label: 'Ngày sinh', type: 'date', width: 150 },
  { key: 'gender', label: 'Giới tính', type: 'select', options: toOptions(GENDER_LABELS), width: 110 },
  { key: 'phone', label: 'SĐT', width: 130 },
  { key: 'idType', label: 'Loại giấy tờ', type: 'select', options: toOptions(ID_DOCUMENT_TYPE_LABELS), width: 160 },
  { key: 'idNumber', label: 'Số giấy tờ', width: 150 },
  { key: 'nationality', label: 'Quốc tịch', width: 100 },
  { key: 'permanentAddress', label: 'Quê quán / thường trú', width: 240 },
  { key: 'occupation', label: 'Nghề nghiệp', width: 150 },
  { key: 'relationship', label: 'Quan hệ với người đứng tên', type: 'select', options: toOptions(RELATIONSHIP_LABELS), width: 200 },
  { key: 'moveInDate', label: 'Ngày vào ở', type: 'date', width: 150 },
  { key: 'monthlyRent', label: 'Giá thuê', type: 'money', width: 140 },
  { key: 'depositAmount', label: 'Tiền cọc', type: 'money', width: 140 },
]

/**
 * Tab Nhập Excel của khu (docs/api/imports.md) — chỉ chủ trọ. Dùng một lần khi chuyển khu đang chạy từ sổ ghi chép sang phần mềm:
 * chỉ TẠO MỚI phòng và người thuê đang ở, không sửa / ghi đè dữ liệu đã có. Nhập phòng trước, rồi người thuê.
 */
export function ImportTab({ property }) {
  if (property.isArchived) return <Alert tone="warning">Khu đã ngừng sử dụng — không nhập thêm dữ liệu.</Alert>
  return (
    <>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Alert tone="info">
          Nhập <strong>phòng trước</strong>, rồi đến người thuê. File .xlsx theo mẫu, tối đa 2 MB và 500 dòng; ô có công thức không được nhận. Nhập chỉ tạo mới — sửa
          dữ liệu đã có thì làm ở màn Phòng / Người thuê / Hợp đồng.
        </Alert>
      </div>
      <ImportPanel
        property={property}
        kind="rooms"
        title="1. Nhập phòng"
        description="Có chỉ số đầu kỳ thì hệ thống lắp luôn công tơ, tính từ ngày chốt kỳ hiện tại của khu."
        columns={ROOM_COLUMNS}
        unitKeyOf={(row) => String(row.code ?? '').trim().toUpperCase()}
        unitLabel="phòng"
      />
      <ImportPanel
        property={property}
        kind="tenancies"
        title="2. Nhập người thuê đang ở"
        description="Mỗi dòng một người; các dòng cùng mã phòng thành một hợp đồng và được kích hoạt ngay. Một người lỗi thì cả phòng chưa lưu."
        columns={TENANCY_COLUMNS}
        unitKeyOf={(row) => String(row.roomCode ?? '').trim().toUpperCase()}
        unitLabel="phòng"
      />
    </>
  )
}
