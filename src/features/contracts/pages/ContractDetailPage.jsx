import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightLeft,
  Ban,
  CalendarClock,
  CalendarPlus,
  CircleCheck,
  Coins,
  FileDown,
  FileSignature,
  HandCoins,
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
import { Alert, Badge, Button, ButtonLink, ConfirmDialog, PageHeader, QueryView, Section, TabPanel, Tabs, useToast } from '@/components/ui'
import { CONTRACT_TYPE_LABELS } from '@/constants/enums'
import { AuditLogList } from '@/features/audit/components/AuditLogList'
import { GenerateInvoicesDialog } from '@/features/invoices/components/GenerateInvoicesDialog'
import { usePermission } from '@/features/auth/AuthContext'
import { Permission } from '@/features/auth/permissions'
import { ContractBalanceDialog } from '@/features/payments/components/ContractBalanceDialog'
import { PaymentHistory } from '@/features/payments/components/PaymentHistory'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { useTabParam } from '@/hooks/useTabParam'
import { saveBlob } from '@/lib/download'
import { getErrorMessage } from '@/lib/http/ApiError'
import { currentBillingMonth, formatDate } from '@/lib/format'
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
import { TransferRoomDialog } from '../detail/TransferRoomDialog'
import { useContract, useLiquidationPreview } from '../hooks'

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
  if (flags.includes('MoveOutOverdue'))
    banners.push({
      key: 'moveOutOverdue',
      tone: 'danger',
      text: `Quá ngày trả phòng ${formatDate(c.plannedMoveOutDate)} mà chưa thanh lý — kỳ cuối chưa tính tiền, hóa đơn tháng đang bị bỏ qua.`,
      buttons: [a.startLiquidation && ['Thanh lý', 'liquidate'], a.withdrawNotice && ['Rút báo trả phòng (ở tiếp)', 'withdrawNotice']].filter(Boolean),
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

function StatusBanners({ contract: c, actions: a, open }) {
  const flags = c.flags ?? []
  return (
    <>
      {c.isOverdue && !flags.includes('ExpiredAwaitingDecision') && (
        <Alert>Hợp đồng đã quá hạn ({formatDate(c.endDate)}) nhưng vẫn hiệu lực và vẫn tính kỳ thu — gia hạn hoặc thanh lý.</Alert>
      )}
      {c.status === 'Active' && c.plannedMoveOutDate && !flags.includes('MoveOutOverdue') && (
        <Alert tone="warning">
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            Đã báo trả phòng ngày {formatDate(c.plannedMoveOutDate)} — từ kỳ đó không lập hóa đơn tháng. Đến ngày trả phòng → bấm “Thanh lý”.
            {a.withdrawNotice && (
              <Button size="sm" variant="secondary" onClick={() => open('withdrawNotice')}>
                Rút báo trả phòng
              </Button>
            )}
          </span>
        </Alert>
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
  const transferBackIdem = useIdempotencyKey()
  const canViewAudit = usePermission(Permission.AuditView)
  const contract = query.data
  const preview = useLiquidationPreview(id, { enabled: contract?.status === 'Liquidating' })
  // Hóa đơn trả phòng: bắt buộc khi còn phần chưa thu (finalInvoiceRequired), không thì lập tùy chọn với số cuối = số chốt kỳ.
  const [finalInvoiceRequired, setFinalInvoiceRequired] = useState(true)
  const openFinalInvoice = (required) => {
    setFinalInvoiceRequired(required)
    setDialog('finalInvoice')
  }

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
  // Lệnh trả { warnings } (hủy nháp ký lại, hủy thanh lý: VEHICLE_NOT_RESTORED) → hiện từng cảnh báo.
  const runAction = async (fn, message) => {
    let result
    try {
      result = await fn()
    } catch (error) {
      void refresh()
      throw error
    }
    await done(message)
    result?.warnings?.forEach((w) => toast.warning(w.message, { duration: 12_000 }))
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
          { id: 'payments', label: 'Thu tiền' },
          // Nhật ký thao tác: chỉ chủ trọ (phó quản lý → 403).
          { id: 'history', label: 'Lịch sử', hidden: !canViewAudit },
        ]
        const props = { contract: c, actions: a, refresh }
        // Hoàn tất: bật theo `canComplete` của xem trước thanh lý (blockers rỗng).
        const canComplete = Boolean(preview.data?.canComplete)
        const needsFinalInvoice = Boolean(preview.data?.finalInvoiceRequired) && !preview.data?.finalInvoiceId
        const completeTitle = canComplete ? undefined : 'Xem mục “Trả phòng” để biết còn phải làm gì'

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
                  {a.collect && (
                    <Button variant="secondary" icon={HandCoins} onClick={() => setDialog('balance')}>
                      Thu tiền
                    </Button>
                  )}
                  {a.transferRoom && (
                    <Button variant="secondary" icon={ArrowRightLeft} onClick={() => setDialog('transfer')}>
                      Chuyển phòng
                    </Button>
                  )}
                  {a.transferBack && (
                    <Button variant="secondary" icon={Undo2} onClick={() => setDialog('transferBack')}>
                      Chuyển lại về phòng {c.roomMoves.at(-1).roomCode}
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
                  {a.finalInvoice && preview.isSuccess && needsFinalInvoice && (
                    <Button variant="secondary" icon={Receipt} onClick={() => openFinalInvoice(true)}>
                      Lập hóa đơn trả phòng
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
              <StatusBanners contract={c} actions={a} open={setDialog} />
              {a.transferBack && (
                <Alert tone="info">
                  Hôm nay hợp đồng vừa chuyển từ phòng {c.roomMoves.at(-1).roomCode} sang {c.roomCode}. Chuyển nhầm thì bấm “Chuyển lại về phòng {c.roomMoves.at(-1).roomCode}” — hoàn lại như
                  chưa chuyển; muốn sang phòng khác thì chuyển lại trước rồi mới chuyển tiếp. Từ ngày mai, quay về phòng cũ là một lần chuyển phòng mới.
                </Alert>
              )}
              {c.status === 'Liquidating' && (
                <LiquidationPanel contract={c} preview={preview} onCreateFinalInvoice={openFinalInvoice} />
              )}
            </div>

            <Tabs tabs={tabs} value={tab} onChange={setTab} label="Thông tin hợp đồng" idPrefix={TAB_PREFIX} />
            <TabPanel idPrefix={TAB_PREFIX} id={tab}>
              {tab === 'overview' && <OverviewTab {...props} onDone={done} onEditNote={() => setDialog('note')} onSignedDocument={() => setDialog('signed')} />}
              {tab === 'parties' && <PartiesTab {...props} />}
              {tab === 'occupants' && <OccupantsTab {...props} />}
              {tab === 'rent' && <RentTermsTab {...props} onAdd={() => setDialog('rent')} />}
              {tab === 'fees' && <FeesTab {...props} onDone={done} />}
              {tab === 'assets' && <AssetsTab {...props} />}
              {tab === 'vehicles' && <VehiclesTab {...props} />}
              {tab === 'billing' && <BillingTab {...props} />}
              {tab === 'rules' && <RulesTab {...props} />}
              {tab === 'document' && <DocumentTab {...props} />}
              {tab === 'payments' && (
                <Section
                  title="Lịch sử thu"
                  description="Phiếu thu và bỏ nợ của hợp đồng. Nhập sai thì đảo rồi ghi lại."
                  actions={
                    c.status === 'Active' && (
                      <Button size="sm" variant="secondary" icon={Receipt} onClick={() => setDialog('generate')}>
                        Tạo phiếu tháng cho hợp đồng này
                      </Button>
                    )
                  }
                >
                  <PaymentHistory filter={{ contractId: c.id }} emptyTitle="Hợp đồng chưa có lần thu nào" />
                </Section>
              )}
              {tab === 'history' && canViewAudit && (
                <Section title="Lịch sử thay đổi" description="Ai đã tạo, sửa, kích hoạt, thanh lý hợp đồng này.">
                  <AuditLogList filter={{ entityType: 'Contract', entityId: c.id }} showEntity={false} emptyTitle="Chưa có thay đổi nào được ghi" />
                </Section>
              )}
            </TabPanel>

            {dialog === 'activate' && <ActivateDialog contract={c} onClose={() => setDialog(null)} onDone={refresh} />}
            {dialog === 'rent' && <RentTermDialog contract={c} onClose={() => setDialog(null)} onDone={done} />}
            {dialog === 'extend' && <ExtendDialog contract={c} onClose={() => setDialog(null)} onDone={done} />}
            {dialog === 'holdover' && <HoldoverDialog contract={c} onClose={() => setDialog(null)} onDone={done} />}
            {dialog === 'resign' && <ResignDialog contract={c} onClose={() => setDialog(null)} onDone={refresh} />}
            {dialog === 'signed' && <SignedDocumentDialog contract={c} onClose={() => setDialog(null)} onDone={done} />}
            {dialog === 'notice' && <NoticeDialog contract={c} onClose={() => setDialog(null)} onDone={done} />}
            {dialog === 'liquidate' && <StartLiquidationDialog contract={c} onClose={() => setDialog(null)} onDone={done} />}
            {dialog === 'finalInvoice' && <FinalInvoiceDialog contract={c} required={finalInvoiceRequired} onClose={() => setDialog(null)} onDone={refresh} />}
            {dialog === 'complete' && <CompleteLiquidationDialog contract={c} preview={preview.data} onClose={() => setDialog(null)} onDone={refresh} />}
            {dialog === 'generate' && <GenerateInvoicesDialog contract={c} defaultMonth={currentBillingMonth()} onClose={() => setDialog(null)} />}
            {dialog === 'balance' && <ContractBalanceDialog contractId={c.id} onClose={() => setDialog(null)} />}
            {dialog === 'transfer' && <TransferRoomDialog contract={c} onClose={() => setDialog(null)} onDone={done} />}
            <ConfirmDialog
              open={dialog === 'transferBack'}
              onClose={() => setDialog(null)}
              title={`Chuyển lại về phòng ${c.roomMoves?.at(-1)?.roomCode ?? 'cũ'}?`}
              message={`Hoàn lại lần chuyển hôm nay như chưa từng chuyển: hợp đồng về phòng ${c.roomMoves?.at(-1)?.roomCode ?? 'cũ'}, giá thuê và dịch vụ trở lại như trước, chỉ số lúc chuyển và khoản chênh lệch tiền phòng của lần chuyển bị hủy. Bị chặn nếu phòng cũ đã có hợp đồng khác, phòng ${c.roomCode} đã lập phiếu, hoặc khoản chênh lệch đã đánh dấu đã thu.`}
              confirmLabel="Chuyển lại"
              tone="danger"
              onConfirm={async () => {
                // Chuyển lại trong ngày = gọi lại lệnh chuyển phòng với phòng vừa rời; server bỏ qua các trường khác (contracts.md#chuyển-phòng).
                const body = { toRoomId: c.roomMoves.at(-1).roomId }
                let result
                try {
                  result = await contractsApi.transferRoom(c.id, body, { idempotencyKey: transferBackIdem.keyFor(body) })
                  transferBackIdem.reset()
                } catch (error) {
                  void refresh()
                  throw error
                }
                await done(`Đã chuyển lại về phòng ${c.roomMoves.at(-1).roomCode}.`)
                // Cảnh báo không chặn: phần không hoàn nguyên được → nhắc kiểm tra giá thuê / dịch vụ.
                result?.warnings?.forEach((w) => toast.warning(w.message, { duration: 12_000 }))
              }}
            />
            {dialog === 'note' && <NoteDialog contract={c} onClose={() => setDialog(null)} onDone={done} />}
            <ConfirmDialog
              open={dialog === 'withdrawNotice'}
              onClose={() => setDialog(null)}
              title="Rút báo trả phòng?"
              message={`Người thuê ở tiếp: bỏ ngày dự kiến trả ${formatDate(c.plannedMoveOutDate)}. Sau đó tạo hóa đơn tháng như thường — các kỳ đã bị bỏ qua lập lại lần lượt.`}
              confirmLabel="Rút báo trả phòng"
              onConfirm={() => runAction(() => contractsApi.withdrawNotice(c.id), 'Đã rút báo trả phòng.')}
            />
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
              message="Hợp đồng quay lại “Đang hiệu lực” và bỏ luôn ngày báo trả phòng (người thuê ở lại); hóa đơn trả phòng nháp bị xóa, chỉ số cuối bị hủy. Thanh lý để ký lại ⇒ cọc về Đang giữ, xe mở lại. Bị chặn nếu phòng đã có hợp đồng mới, người ở đã sang phòng khác, hoặc hóa đơn trả phòng đã chốt (hủy hóa đơn đó trước)."
              confirmLabel="Hủy thanh lý"
              onConfirm={() => runAction(() => contractsApi.cancelLiquidation(c.id), 'Đã hủy thanh lý.')}
            />
          </>
        )
      }}
    </QueryView>
  )
}
