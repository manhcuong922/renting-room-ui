import { Badge, Button, DataTable, Modal } from '@/components/ui'

/**
 * Kết quả của một lệnh hàng loạt lưu từng phần (tạo phiếu, chốt nhiều phiếu, thêm dòng cho nhiều phòng):
 * phòng nào được, phòng nào không và vì sao. rows: [{ key, label, ok, message }]
 */
export function BulkResultDialog({ title, summary, rows, onClose }) {
  const columns = [
    { key: 'label', header: 'Phòng / hợp đồng', primary: true, cell: (r) => <strong>{r.label}</strong> },
    { key: 'ok', header: 'Kết quả', cell: (r) => <Badge tone={r.ok ? 'success' : 'danger'}>{r.ok ? 'Được' : 'Không được'}</Badge> },
    { key: 'message', header: 'Chi tiết', cell: (r) => r.message ?? '—' },
  ]
  return (
    <Modal open onClose={onClose} title={title} size="lg" footer={<Button onClick={onClose}>Đóng</Button>}>
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        {summary}
        {rows.length > 0 && <DataTable columns={columns} rows={rows} rowKey={(r) => r.key} caption={title} />}
      </div>
    </Modal>
  )
}
