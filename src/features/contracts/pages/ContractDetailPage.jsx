import { useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  CalendarClock,
  CalendarPlus,
  CircleCheck,
  Coins,
  FileDown,
  FileSignature,
  Hourglass,
  Pencil,
  Play,
  Receipt,
  Undo2,
  UserRoundPen,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { contractsApi, queryKeys } from '@/api'
import { Alert, Badge, Button, ButtonLink, ConfirmDialog, PageHeader, QueryView, TabPanel, Tabs, useToast } from '@/components/ui'
import { CONTRACT_TYPE_LABELS } from '@/constants/enums'
import { useTabParam } from '@/hooks/useTabParam'
import { saveBlob } from '@/lib/download'
import { getErrorMessage } from '@/lib/http/ApiError'
import { formatDate } from '@/lib/format'
import { ContractBadges } from '../components/ContractBadges'
import { contractActions, isActiveVehicle, isCurrentOccupant } from '../contractRules'
import { AssetsTab, VehiclesTab } from '../detail/AssetsVehiclesTabs'
import { FeesTab } from '../detail/FeesTab'
import { BillingTab, DocumentTab, OverviewTab, PartiesTab, RentTermsTab, RulesTab } from '../detail/InfoTabs'
import {
  ActivateDialog,
  ExtendDialog,
  HoldoverDialog,
  NoteDialog,
  NoticeDialog,
  RentTermDialog,
  ResignDialog,
  SignedDocumentDialog,
} from '../detail/LifecycleDialogs'
import { CompleteLiquidationDialog, FinalInvoiceDialog, LiquidationPanel, StartLiquidationDialog } from '../detail/LiquidationDialogs'
import { OccupantsTab } from '../detail/OccupantsTab'
import { useContract, useFinalInvoice } from '../hooks'

const TAB_PREFIX = 'contract'

/** Banner "cần xử lý" theo cờ của HĐ đang hiệu lực (contracts.md#cần-xử-lý-flags) — mỗi cờ kèm nút gợi ý. */
function FlagBanners({ contract: c, actions: a, open }) {
  const flags = c.flags ?? []
  const banners = []
  if (flags.includes('RepresentativeMovedOut'))
    banners.push({
      key: 'moved',
      tone: 'warning',
      text: 'Người ký đã chuyển đi, vẫn còn người khác ở — nên ký lại cho người còn ở.',
      buttons: a.reSign && [['Ký lại cho người còn ở', 'resign']],
    })
  if (flags.includes('NoOccupantLeft'))
    banners.push({ key: 'empty', tone: 'danger', text: 'Không còn ai ở mà hợp đồng vẫn hiệu lực.', buttons: a.startLiquidation && [['Thanh lý', 'liquidate']] })
  if (flags.includes('ExpiredAwaitingDecision'))
    banners.push({
      key: 'expired',
      tone: 'danger',
      text: `Hợp đồng đã quá hạn (${formatDate(c.endDate)}) nhưng vẫn hiệu lực và vẫn tính kỳ thu — cần quyết định.`,
      buttons: [a.extend && ['Gia hạn', 'extend'], a.holdover && ['Cho ở tiếp, chưa ký', 'holdover'], a.startLiquidation && ['Thu lại phòng', 'liquidate']].filter(Boolean),
    })
  if (flags.includes('Holdover'))
    banners.push({
      key: 'holdover',
      tone: 'warning',
      text: `Đang cho ở tiếp, chưa ký lại${c.holdoverSince ? ` (từ ${formatDate(c.holdoverSince)})` : ''} — nên ký phụ lục gia hạn.`,
      buttons: [a.extend && ['Gia hạn', 'extend'], a.startLiquidation && ['Thu lại phòng', 'liquidate']].filter(Boolean),
    })
  if (banners.length === 0) return null
  return banners.map((b) => (
    <Alert key={b.key} tone={b.tone}>
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {b.text}
        {(b.buttons || []).map(([label, dialog]) => (
          <Button key={dialog} size="sm" variant="secondary" onClick={() => open(dialog)}>
            {label}
          </Button>
        ))}
      </span>
    </Alert>
  ))
}

function StatusBanners({ contract: c, actions: a }) {
  const flags = c.flags ?? []
  return (
    <>
      {c.isOverdue && !flags.includes('ExpiredAwaitingDecision') && !flags.includes('Holdover') && (
        <Alert>Hợp đồng đã quá hạn ({formatDate(c.endDate)}) nhưng vẫn hiệu lực và vẫn tính kỳ thu — gia hạn hoặc thanh lý.</Alert>
      )}
      {c.status === 'Active' && c.plannedMoveOutDate && (
        <Alert tone="warning">Đã báo trả phòng ngày {formatDate(c.plannedMoveOutDate)}. Đến ngày trả phòng → bấm “Thanh lý”.</Alert>
      )}
      {c.status === 'Liquidating' && !a.canCompleteToday && <Alert tone="warning">Đang thanh lý — hoàn tất được từ {formatDate(c.actualEndDate)}.</Alert>}
      {c.status === 'Draft' && (
        <Alert tone="info">Bản nháp — ghi tài sản bàn giao, đăng ký xe rồi bấm “Kích hoạt” khi bàn giao phòng (nhập chỉ số công tơ nhận phòng).</Alert>
      )}
    </>
  )
}

// docs/api/contracts.md#chi-tiết-hợp-đồng — nút hiện theo "Ma trận nút theo trạng thái" + cờ việc cần xử lý.
export default function ContractDetailPage() {
  const { id } = useParams()
  const query = useContract(id)
  const queryClient = useQueryClient()
  const toast = useToast()
  const [tab, setTab] = useTabParam('overview')
  const [dialog, setDialog] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const contract = query.data
  const finalInvoice = useFinalInvoice(contract ?? { id }, { enabled: contract?.status === 'Liquidating' })

  // Mọi thao tác: tải lại hợp đồng + danh sách + trạng thái phòng + kỳ thu + phiếu.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all }),
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

  const download = async (c) => {
    setDownloading(true)
    try {
      const { blob, filename } = await contractsApi.document(c.id)
      saveBlob(blob, filename ?? `hop-dong_${c.contractNo}.docx`)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setDownloading(false)
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
          { id: 'fees', label: 'Khoản thu', badge: (c.fees ?? []).filter((f) => !f.effectiveTo).length || undefined },
          { id: 'assets', label: 'Tài sản', badge: c.assets.length || undefined },
          { id: 'vehicles', label: 'Xe', badge: c.vehicles.filter(isActiveVehicle).length || undefined },
          { id: 'billing', label: 'Kỳ thu' },
          { id: 'rules', label: 'Nội quy' },
          { id: 'document', label: 'Văn bản' },
        ]
        const props = { contract: c, actions: a, refresh }
        const invoice = finalInvoice.data
        const canComplete = a.canCompleteToday && invoice?.status === 'Finalized'
        let completeTitle
        if (!a.canCompleteToday) completeTitle = `Hoàn tất được từ ${formatDate(c.actualEndDate)}`
        else if (invoice?.status !== 'Finalized') completeTitle = 'Cần phiếu quyết toán đã chốt'

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
                      Sửa giá thuê
                    </Button>
                  )}
                  {a.extend && (
                    <Button variant="secondary" icon={CalendarPlus} onClick={() => setDialog('extend')}>
                      Gia hạn
                    </Button>
                  )}
                  {a.holdover && (
                    <Button variant="secondary" icon={Hourglass} onClick={() => setDialog('holdover')}>
                      Cho ở tiếp
                    </Button>
                  )}
                  {a.notice && (
                    <Button variant="secondary" icon={CalendarClock} onClick={() => setDialog('notice')}>
                      Báo trả phòng
                    </Button>
                  )}
                  {a.reSign && (
                    <Button variant="ghost" icon={UserRoundPen} onClick={() => setDialog('resign')}>
                      Ký lại
                    </Button>
                  )}
                  {a.startLiquidation && (
                    <Button variant="secondary" icon={Wallet} onClick={() => setDialog('liquidate')}>
                      Thanh lý
                    </Button>
                  )}
                  {a.finalInvoice && finalInvoice.isSuccess && !invoice && (
                    <Button variant="secondary" icon={Receipt} onClick={() => setDialog('finalInvoice')}>
                      Lập phiếu quyết toán
                    </Button>
                  )}
                  {a.completeLiquidation && (
                    <Button icon={CircleCheck} disabled={!canComplete} onClick={() => setDialog('complete')} title={completeTitle}>
                      Hoàn tất thanh lý
                    </Button>
                  )}
                  {a.cancelLiquidation && (
                    <Button variant="ghost" icon={Undo2} onClick={() => setDialog('cancelLiquidation')}>
                      Hủy thanh lý
                    </Button>
                  )}
                  {a.signedDocument && !c.hasSignedDocument && (
                    <Button variant="ghost" icon={FileSignature} onClick={() => setDialog('signed')}>
                      Đã có bản ký
                    </Button>
                  )}
                  {a.downloadDocument && (
                    <Button variant="ghost" icon={FileDown} loading={downloading} onClick={() => download(c)}>
                      Tải .docx
                    </Button>
                  )}
                </>
              }
            />

            <div style={{ display: 'grid', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <FlagBanners contract={c} actions={a} open={setDialog} />
              <StatusBanners contract={c} actions={a} />
              {c.status === 'Liquidating' && (
                <LiquidationPanel contract={c} finalInvoice={finalInvoice} onCreateFinalInvoice={() => setDialog('finalInvoice')} />
              )}
            </div>

            <Tabs tabs={tabs} value={tab} onChange={setTab} label="Thông tin hợp đồng" idPrefix={TAB_PREFIX} />
            <TabPanel idPrefix={TAB_PREFIX} id={tab}>
              {tab === 'overview' && <OverviewTab {...props} onEditNote={() => setDialog('note')} onSignedDocument={() => setDialog('signed')} />}
              {tab === 'parties' && <PartiesTab {...props} />}
              {tab === 'occupants' && <OccupantsTab {...props} />}
              {tab === 'rent' && <RentTermsTab {...props} onAdd={() => setDialog('rent')} />}
              {tab === 'fees' && <FeesTab {...props} onDone={done} />}
              {tab === 'assets' && <AssetsTab {...props} />}
              {tab === 'vehicles' && <VehiclesTab {...props} />}
              {tab === 'billing' && <BillingTab {...props} />}
              {tab === 'rules' && <RulesTab {...props} />}
              {tab === 'document' && <DocumentTab {...props} />}
            </TabPanel>

            {dialog === 'activate' && <ActivateDialog contract={c} onClose={() => setDialog(null)} onDone={refresh} />}
            {dialog === 'rent' && <RentTermDialog contract={c} onClose={() => setDialog(null)} onDone={done} />}
            {dialog === 'extend' && <ExtendDialog contract={c} onClose={() => setDialog(null)} onDone={done} />}
            {dialog === 'holdover' && <HoldoverDialog contract={c} onClose={() => setDialog(null)} onDone={done} />}
            {dialog === 'resign' && <ResignDialog contract={c} onClose={() => setDialog(null)} onDone={refresh} />}
            {dialog === 'signed' && <SignedDocumentDialog contract={c} onClose={() => setDialog(null)} onDone={done} />}
            {dialog === 'notice' && <NoticeDialog contract={c} onClose={() => setDialog(null)} onDone={done} />}
            {dialog === 'liquidate' && <StartLiquidationDialog contract={c} onClose={() => setDialog(null)} onDone={done} />}
            {dialog === 'finalInvoice' && <FinalInvoiceDialog contract={c} onClose={() => setDialog(null)} onDone={refresh} />}
            {dialog === 'complete' && <CompleteLiquidationDialog contract={c} onClose={() => setDialog(null)} onDone={refresh} />}
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
              message="Hợp đồng quay lại “Đang hiệu lực”; phiếu quyết toán nháp bị xóa, chỉ số cuối bị hủy. Bị chặn nếu phòng đã có hợp đồng mới, người ở đã sang phòng khác, hoặc phiếu quyết toán đã chốt (hủy phiếu đó trước)."
              confirmLabel="Hủy thanh lý"
              onConfirm={() => runAction(() => contractsApi.cancelLiquidation(c.id), 'Đã hủy thanh lý.')}
            />
          </>
        )
      }}
    </QueryView>
  )
}
