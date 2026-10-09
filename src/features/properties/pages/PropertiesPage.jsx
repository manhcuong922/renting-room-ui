import { Building, FileSpreadsheet, MapPin, Plus, Search, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Badge, Button, ButtonLink, Card, CheckboxField, EmptyState, PageHeader, Pagination, QueryView, TextField, Toolbar } from '@/components/ui'
import { ExportRentersDialog } from '@/features/exports/ExportRentersDialog'
import { useListParams } from '@/hooks/useListParams'
import { cx } from '@/lib/cx'
import { usePropertyList } from '../hooks'
import styles from './PropertiesPage.module.css'

const PAGE_SIZE = 12
const DEFAULTS = { search: '', archived: false, page: 1 }

function GridSkeleton() {
  return (
    <div className={styles.grid} aria-busy="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={styles.skeleton} />
      ))}
    </div>
  )
}

// Danh sách khu trọ — GET /properties (docs/api/properties.md#danh-sách). Bộ lọc nằm trên URL.
export default function PropertiesPage() {
  const { params, set, searchInput } = useListParams(DEFAULTS)
  const [exporting, setExporting] = useState(false)
  const query = usePropertyList({
    search: params.search || undefined,
    includeArchived: params.archived || undefined,
    page: params.page,
    pageSize: PAGE_SIZE,
  })

  return (
    <>
      <PageHeader
        title="Khu trọ"
        description="Các khu trọ của tổ chức, tỉ lệ lấp đầy và tình trạng hồ sơ bên cho thuê."
        actions={
          <>
            <Button variant="secondary" icon={FileSpreadsheet} onClick={() => setExporting(true)}>
              Xuất người thuê
            </Button>
            <ButtonLink to="/properties/new" icon={Plus}>
              Tạo khu
            </ButtonLink>
          </>
        }
      />

      <Toolbar>
        <TextField icon={Search} type="search" placeholder="Tìm theo mã hoặc tên khu…" aria-label="Tìm khu trọ" {...searchInput} />
        <CheckboxField label="Hiện khu ngừng sử dụng" checked={params.archived} onChange={(e) => set({ archived: e.target.checked })} />
      </Toolbar>

      <QueryView
        query={query}
        loading={<GridSkeleton />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <Card>
            <EmptyState
              icon={Building}
              title={params.search ? 'Không tìm thấy khu trọ phù hợp' : 'Chưa có khu trọ nào'}
              description={params.search ? 'Thử từ khóa khác.' : 'Tạo khu trọ đầu tiên để bắt đầu quản lý phòng.'}
            />
          </Card>
        }
      >
        {(data) => (
          <>
            <ul className={cx(styles.grid, query.isPlaceholderData && styles.stale)}>
              {data.items.map((property) => (
                <li key={property.id}>
                  <PropertyCard property={property} />
                </li>
              ))}
            </ul>
            <Pagination {...data} disabled={query.isPlaceholderData} onPageChange={(page) => set({ page })} />
          </>
        )}
      </QueryView>

      {exporting && <ExportRentersDialog open onClose={() => setExporting(false)} />}
    </>
  )
}

function PropertyCard({ property }) {
  const { id, code, name, addressText, roomCount, occupiedRoomCount, lessorComplete, isArchived } = property
  const occupancy = roomCount ? Math.round((occupiedRoomCount / roomCount) * 100) : 0

  return (
    <Card as="article" className={cx(styles.card, isArchived && styles.archived)}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>
          <Link to={`/properties/${id}`} className={styles.cardLink}>
            {name}
          </Link>
        </h2>
        <Badge tone={isArchived ? 'neutral' : 'primary'}>{isArchived ? 'Ngừng sử dụng' : code}</Badge>
      </div>
      <p className={styles.address}>
        <MapPin size={14} aria-hidden /> {addressText}
      </p>

      <div className={styles.occupancy}>
        <div className={styles.occupancyText}>
          <span>Lấp đầy</span>
          <strong>
            {occupiedRoomCount}/{roomCount} phòng · {occupancy}%
          </strong>
        </div>
        <div className={styles.bar} role="progressbar" aria-label={`Tỉ lệ lấp đầy ${name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={occupancy}>
          <span style={{ width: `${occupancy}%` }} />
        </div>
      </div>

      {/* Xét bên cho thuê hiệu lực (riêng của khu hoặc thông tin chủ trọ) — chỉ cảnh báo, không chặn kích hoạt / thu tiền. */}
      {!lessorComplete && !isArchived && (
        <Link to={`/properties/${id}?tab=lessor`} className={styles.warning}>
          <TriangleAlert size={14} aria-hidden /> Chưa đủ thông tin bên cho thuê — chưa in được hợp đồng đầy đủ
        </Link>
      )}
    </Card>
  )
}
