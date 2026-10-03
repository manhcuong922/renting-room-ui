import { useQuery } from '@tanstack/react-query'
import { FileStack, Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { contractTemplatesApi, queryKeys } from '@/api'
import { Badge, Button, Card, CheckboxField, EmptyState, Modal, PageHeader, QueryView, SelectField, Spinner, Toolbar } from '@/components/ui'
import { CONTRACT_TYPE_LABELS, toOptions } from '@/constants/enums'
import { useListParams } from '@/hooks/useListParams'
import styles from './ContractTemplatesPage.module.css'

const DEFAULTS = { type: '', archived: false }

// docs/api/contract-templates.md — danh sách trả MẢNG, nhóm theo loại hợp đồng.
export default function ContractTemplatesPage() {
  const { params, set } = useListParams(DEFAULTS)
  const [choosing, setChoosing] = useState(false)
  const filter = { type: params.type || undefined, includeArchived: params.archived || undefined }
  const query = useQuery({
    queryKey: queryKeys.contractTemplates.list(filter),
    queryFn: ({ signal }) => contractTemplatesApi.list(filter, { signal }),
  })

  return (
    <>
      <PageHeader
        title="Mẫu hợp đồng"
        description="Tiêu đề, điều khoản và trường tùy biến theo loại hợp đồng. Sửa mẫu không đổi hợp đồng đã kích hoạt."
        actions={
          <Button icon={Plus} onClick={() => setChoosing(true)}>
            Tạo mẫu
          </Button>
        }
      />

      <Toolbar>
        <SelectField aria-label="Loại hợp đồng" placeholder="Mọi loại" options={toOptions(CONTRACT_TYPE_LABELS)} value={params.type} onChange={(e) => set({ type: e.target.value })} />
        <CheckboxField label="Hiện mẫu ngừng dùng" checked={params.archived} onChange={(e) => set({ archived: e.target.checked })} />
      </Toolbar>

      <QueryView
        query={query}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState icon={FileStack} title="Chưa có mẫu hợp đồng" description="Bắt đầu nhanh từ mẫu gợi ý (thuê phòng, không cọc, thuê nhà)." />}
      >
        {(templates) =>
          Object.keys(CONTRACT_TYPE_LABELS)
            .map((type) => [type, templates.filter((t) => t.contractType === type)])
            .filter(([, list]) => list.length)
            .map(([type, list]) => (
              <section key={type} className={styles.group}>
                <h2 className={styles.groupTitle}>{CONTRACT_TYPE_LABELS[type]}</h2>
                <ul className={styles.grid}>
                  {list.map((t) => (
                    <li key={t.id}>
                      <Card as="article" className={styles.card}>
                        <Link to={`/contract-templates/${t.id}`} className={styles.cardLink}>
                          <h3 className={styles.name}>{t.name}</h3>
                        </Link>
                        <p className={styles.title}>{t.title}</p>
                        <div className={styles.badges}>
                          <Badge>{t.clauses.length} điều khoản</Badge>
                          <Badge>{t.fields.length} trường</Badge>
                          {t.noDeposit && <Badge tone="warning">Không cọc</Badge>}
                          {t.isArchived && <Badge tone="neutral">Ngừng dùng</Badge>}
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            ))
        }
      </QueryView>

      {choosing && <PresetChooser onClose={() => setChoosing(false)} />}
    </>
  )
}

/** Chọn điểm xuất phát: mẫu gợi ý (GET /contract-templates/presets) hoặc mẫu trống. */
function PresetChooser({ onClose }) {
  const navigate = useNavigate()
  const presets = useQuery({
    queryKey: queryKeys.contractTemplates.presets,
    queryFn: ({ signal }) => contractTemplatesApi.presets({ signal }),
    staleTime: Infinity,
  })

  return (
    <Modal open onClose={onClose} title="Tạo mẫu hợp đồng" description="Chọn mẫu gợi ý để điền sẵn điều khoản và trường, sau đó sửa tùy ý.">
      {presets.isPending ? (
        <Spinner />
      ) : (
        <ul className={styles.presets}>
          {(presets.data ?? []).map((p, i) => (
            <li key={p.name}>
              <button type="button" className={styles.preset} onClick={() => void navigate(`/contract-templates/new?preset=${i}`)}>
                <Sparkles size={18} aria-hidden className={styles.presetIcon} />
                <span>
                  <strong>{p.name}</strong>
                  <span className={styles.presetMeta}>
                    {CONTRACT_TYPE_LABELS[p.contractType]} · {p.clauses.length} điều khoản · {p.fields.length} trường
                    {p.noDeposit ? ' · Không cọc' : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" className={styles.preset} onClick={() => void navigate('/contract-templates/new')}>
              <Plus size={18} aria-hidden className={styles.presetIcon} />
              <span>
                <strong>Mẫu trống</strong>
                <span className={styles.presetMeta}>Tự soạn từ đầu</span>
              </span>
            </button>
          </li>
        </ul>
      )}
    </Modal>
  )
}
