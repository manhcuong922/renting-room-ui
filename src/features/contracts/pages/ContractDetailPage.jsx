import { useQueryClient } from '@tanstack/react-query'
import { Ban, CalendarClock, CalendarPlus, CircleCheck, Coins, Pencil, Play, Undo2, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { contractsApi, queryKeys } from '@/api'
import { Alert, Badge, Button, ButtonLink, ConfirmDialog, PageHeader, QueryView, TabPanel, Tabs, useToast } from '@/components/ui'
import { CONTRACT_TYPE_LABELS } from '@/constants/enums'
import { useTabParam } from '@/hooks/useTabParam'
import { formatDate } from '@/lib/format'
import { ContractBadges } from '../components/ContractBadges'
import { contractActions, isActiveVehicle, isCurrentOccupant } from '../contractRules'
import { AssetsTab, VehiclesTab } from '../detail/AssetsVehiclesTabs'
import { BillingTab, DocumentTab, OverviewTab, PartiesTab, RentTermsTab, RulesTab } from '../detail/InfoTabs'
import { ActivateDialog, ExtendDialog, NoteDialog, NoticeDialog, RentTermDialog, StartLiquidationDialog } from '../detail/LifecycleDialogs'
import { OccupantsTab } from '../detail/OccupantsTab'
import { useContract } from '../hooks'

const TAB_PREFIX = 'contract'

// docs/api/contracts.md#chi-tiết-hợp-đồng — nút hiện theo "Ma trận nút theo trạng thái".
export default function ContractDetailPage() {
  const { id } = useParams()
  const query = useContract(id)
  const queryClient = useQueryClient()
  const toast = useToast()
  const [tab, setTab] = useTabParam('overview')
  const [dialog, setDialog] = useState(null)

  // Mọi thao tác: tải lại hợp đồng + danh sách + trạng thái phòng + kỳ thu.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all }),
    ])
  const done = async (message) => {
    await refresh()
    if (message) toast.success(message)
  }
  // Lỗi "dữ liệu cũ" (CONTRACT_NOT_DRAFT…) → vẫn tải lại để nút khớp trạng thái mới.
  const runAction = async (fn, message) => {
    try {
      await fn()
      await done(message)
    } catch (error) {
      void refresh()
      throw error
    }
  }

  return (
    <QueryView query={query} loading="page" errorTitle="Không tải được hợp đồng">
      {(c) => {
        const a = contractActions(c)
        const tabs = [
          { id: 'overview', label: 'Tổng quan' },
          { id: 'parties', label: 'Các bên' },
          { id: 'occupants', label: 'Người ở', badge: c.occupants.filter(isCurrentOccupant).length },
          { id: 'rent', label: 'Giá thuê', badge: c.rentTerms.length > 1 ? c.rentTerms.length : undefined },
          { id: 'assets', label: 'Tài sản', badge: c.assets.length || undefined },
          { id: 'vehicles', label: 'Xe', badge: c.vehicles.filter(isActiveVehicle).length || undefined },
          { id: 'billing', label: 'Kỳ thu' },
          { id: 'rules', label: 'Nội quy' },
          { id: 'document', label: 'Văn bản' },
        ]
        const props = { contract: c, actions: a, refresh }

        return (
          <>
            <PageHeader
              backTo="/contracts"
              backLabel="Hợp đồng"
              title={c.contractNo}
              meta={
                <>
                  <ContractBadges contract={c} />
                  {c.document?.contractType && <Badge>{CONTRACT_TYPE_LABELS[c.document.contractType]}</Badge>}
                </>
              }
              description={`${c.propertyCode} · Phòng ${c.roomCode} · ${c.representativeName}`}
              actions={
                <>
                  {a.activate && (
                    <Button icon={Play} onClick={() => setDialog('activate')}>
                      Kích hoạt
                    </Button>
                  )}
                  {a.edit && (
                    <ButtonLink to={`/contracts/${c.id}/edit`} variant="secondary" icon={Pencil}>
                      Sửa nháp
                    </ButtonLink>
                  )}
                  {a.cancel && (
                    <Button variant="ghost" icon={Ban} onClick={() => setDialog('cancel')}>
                      Hủy nháp
                    </Button>
                  )}
                  {a.changeRent && (
                    <Button variant="secondary" icon={Coins} onClick={() => setDialog('rent')}>
                      Đổi giá
                    </Button>
                  )}
                  {a.extend && (
                    <Button variant="secondary" icon={CalendarPlus} onClick={() => setDialog('extend')}>
                      Gia hạn
                    </Button>
                  )}
                  {a.notice && (
                    <Button variant="secondary" icon={CalendarClock} onClick={() => setDialog('notice')}>
                      Báo trả phòng
                    </Button>
                  )}
                  {a.startLiquidation && (
                    <Button variant="secondary" icon={Wallet} onClick={() => setDialog('liquidate')}>
                      Thanh lý
                    </Button>
                  )}
                  {a.completeLiquidation && (
                    <Button icon={CircleCheck} disabled={!a.canCompleteToday} onClick={() => setDialog('complete')} title={a.canCompleteToday ? undefined : `Hoàn tất được từ ${formatDate(c.actualEndDate)}`}>
                      Hoàn tất thanh lý
                    </Button>
                  )}
                  {a.cancelLiquidation && (
                    <Button variant="ghost" icon={Undo2} onClick={() => setDialog('cancelLiquidation')}>
                      Hủy thanh lý
                    </Button>
                  )}
                </>
              }
            />

            <div style={{ display: 'grid', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              {c.isOverdue && <Alert>Hợp đồng đã quá hạn ({formatDate(c.endDate)}) nhưng vẫn hiệu lực và vẫn tính kỳ thu — gia hạn hoặc thanh lý.</Alert>}
              {c.status === 'Active' && c.plannedMoveOutDate && (
                <Alert tone="warning">Đã báo trả phòng ngày {formatDate(c.plannedMoveOutDate)}. Đến ngày trả phòng → bấm “Thanh lý”.</Alert>
              )}
              {c.status === 'Liquidating' && (
                <Alert tone="warning">
                  Đang thanh lý — trả phòng ngày {formatDate(c.actualEndDate)}. Ghi tình trạng tài sản ở tab “Tài sản”.
                  {!a.canCompleteToday && ` Hoàn tất được từ ${formatDate(c.actualEndDate)}.`}
                </Alert>
              )}
              {c.status === 'Draft' && <Alert tone="info">Bản nháp — ghi tài sản bàn giao, đăng ký xe rồi bấm “Kích hoạt” khi bàn giao phòng.</Alert>}
            </div>

            <Tabs tabs={tabs} value={tab} onChange={setTab} label="Thông tin hợp đồng" idPrefix={TAB_PREFIX} />
            <TabPanel idPrefix={TAB_PREFIX} id={tab}>
              {tab === 'overview' && <OverviewTab {...props} onEditNote={() => setDialog('note')} />}
              {tab === 'parties' && <PartiesTab {...props} />}
              {tab === 'occupants' && <OccupantsTab {...props} />}
              {tab === 'rent' && <RentTermsTab {...props} onAdd={() => setDialog('rent')} />}
              {tab === 'assets' && <AssetsTab {...props} />}
              {tab === 'vehicles' && <VehiclesTab {...props} />}
              {tab === 'billing' && <BillingTab {...props} />}
              {tab === 'rules' && <RulesTab {...props} />}
              {tab === 'document' && <DocumentTab {...props} />}
            </TabPanel>

            {dialog === 'activate' && <ActivateDialog contract={c} onClose={() => setDialog(null)} onDone={refresh} />}
            {dialog === 'rent' && <RentTermDialog contract={c} onClose={() => setDialog(null)} onDone={done} />}
            {dialog === 'extend' && <ExtendDialog contract={c} onClose={() => setDialog(null)} onDone={done} />}
            {dialog === 'notice' && <NoticeDialog contract={c} onClose={() => setDialog(null)} onDone={done} />}
            {dialog === 'liquidate' && <StartLiquidationDialog contract={c} onClose={() => setDialog(null)} onDone={done} />}
            {dialog === 'note' && <NoteDialog contract={c} onClose={() => setDialog(null)} onDone={done} />}
            <ConfirmDialog
              open={dialog === 'cancel'}
              onClose={() => setDialog(null)}
              title="Hủy hợp đồng nháp?"
              message="Hợp đồng chuyển sang “Đã hủy”, chỉ xem được. Xe đã đăng ký ở nháp được giải phóng biển số."
              reasonLabel="Lý do hủy"
              confirmLabel="Hủy nháp"
              tone="danger"
              onConfirm={(reason) => runAction(() => contractsApi.cancel(c.id, { reason }), 'Đã hủy hợp đồng nháp.')}
            />
            <ConfirmDialog
              open={dialog === 'cancelLiquidation'}
              onClose={() => setDialog(null)}
              title="Hủy thanh lý?"
              message="Hợp đồng quay lại “Đang hiệu lực”. Bị chặn nếu phòng đã có hợp đồng mới hoặc người ở đã sang phòng khác."
              confirmLabel="Hủy thanh lý"
              onConfirm={() => runAction(() => contractsApi.cancelLiquidation(c.id), 'Đã hủy thanh lý.')}
            />
            <ConfirmDialog
              open={dialog === 'complete'}
              onClose={() => setDialog(null)}
              title="Hoàn tất thanh lý?"
              message={`Hợp đồng kết thúc. Người ở và xe còn lại tự kết thúc tại ngày trả phòng ${formatDate(c.actualEndDate)}. Phòng thành “Trống” từ hôm sau.`}
              confirmLabel="Hoàn tất"
              onConfirm={() => runAction(() => contractsApi.completeLiquidation(c.id), 'Đã hoàn tất thanh lý — hợp đồng kết thúc.')}
            />
          </>
        )
      }}
    </QueryView>
  )
}
