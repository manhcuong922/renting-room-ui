# renting_room_ui

Giao diện web cho phần mềm quản lý nhà trọ — React 19 + Vite, gọi API của `../renting_room` (.NET).
Tài liệu API: `../renting_room/docs/api/` (đọc `conventions.md` trước).

## Chạy

```bash
npm install
cp .env.example .env.local   # tùy chọn
npm run dev                  # http://localhost:5173 — /api được proxy sang http://localhost:5213
npm run lint && npm run build
```

Backend chạy bằng profile `http` (`dotnet run --launch-profile http` trong `renting_room/renting_room`).

## Cấu trúc

```
src/
├── app/                 App.jsx (providers), router.jsx (routes), lazyPages.js, queryClient.js
├── api/                 1 file / tài nguyên backend (properties.api.js…) + queryKeys.js
├── lib/http/            client.js (fetch + token + refresh + idempotency), ApiError, tokenStore, authEvents
├── config/              env.js, navigation.js (menu sidebar theo role)
├── constants/           enums.js (nhãn enum theo docs)
├── layouts/
│   ├── AppLayout/       Sidebar trái + Topbar + vùng nội dung (responsive)
│   └── AuthLayout/      Đăng nhập / đổi mật khẩu bắt buộc
├── features/<module>/   pages/, components/, hooks.js — mỗi nghiệp vụ một thư mục
├── components/ui/       Button, Badge, Card, TextField, Pagination, Tooltip, Empty/Error state…
├── hooks/               useMediaQuery, useIdempotencyKey, useDebouncedValue…
├── pages/               NotFound, RouteErrorPage
└── styles/              tokens.css (màu, khoảng cách, light/dark), global.css
```

## Màn hình đã có (theo nhóm API của BE)

| Nhóm API | Màn hình |
|----------|----------|
| `auth` | Đăng nhập, đổi mật khẩu bắt buộc, hồ sơ, đăng xuất / đăng xuất mọi thiết bị |
| `admin` (SystemAdmin) | Danh sách tổ chức · tạo tổ chức (mật khẩu tạm 1 lần) · chi tiết: tạm ngưng / kích hoạt lại, cấp lại mật khẩu, khóa / mở khóa |
| `org/members` | Danh sách thành viên · thêm / sửa / khóa / mở khóa / gỡ (gõ tên xác nhận) / cấp lại mật khẩu · bật / tắt quyền xem số giấy tờ của phó quản lý — phó quản lý chỉ xem |
| `org/lessor`, `org/data-retention` | Cài đặt tổ chức: Thông tin chủ trọ (bên cho thuê mặc định cho mọi khu) · thời gian giữ dữ liệu người thuê, ẩn danh tự động |
| `properties` | Danh sách (thẻ, tỉ lệ lấp đầy) · tạo khu (kèm cài đặt kỳ thu) · chi tiết 7 tab: Phòng (sơ đồ), Thông tin chung, Kỳ thu (đổi ngày chốt có xem trước kỳ chuyển tiếp), Bên cho thuê (dùng thông tin chủ trọ / khai riêng), Ngân hàng, Nội quy, Nhóm phòng · ngừng dùng / khôi phục |
| `rooms` | Sơ đồ theo tầng / bảng, lọc khu-trạng thái-tầng-quá hạn · nhãn Còn nợ / Quá hạn / cờ hợp đồng · thêm phòng · tạo hàng loạt · sửa giá niêm yết → hỏi áp cho người đang thuê · chi tiết: bảo trì, ngừng dùng, khôi phục, lịch sử hợp đồng |
| `renters` | Tìm theo tên không dấu / SĐT / đủ số giấy tờ (POST /renters/search, không đặt số lên URL) · thêm / sửa (trẻ < 14 tuổi chưa có giấy tờ; trùng số giấy tờ → mở hồ sơ cũ) · ẩn danh (chủ trọ, xác nhận 2 bước) · chi tiết + lịch sử thuê |
| `contract-templates` | Danh sách theo loại · tạo từ mẫu gợi ý · trình soạn điều khoản + trường tùy biến (7 kiểu, tự sinh key) · ngừng dùng / khôi phục |
| `contracts` | Danh sách (tab trạng thái, sắp hết hạn, quá hạn, không cọc, thiếu tài liệu, cờ cần xử lý) · wizard 7 bước (có "Tính tiền từ ngày", bước Khoản thu) · chi tiết 10 tab: kích hoạt kèm chỉ số nhận phòng, ký lại cho người còn ở, cho ở tiếp, sửa giá thuê, khoản thu theo kỳ, bản ký, tải .docx, báo trả phòng, thanh lý → hóa đơn trả phòng (chỉ số cuối) → hoàn tất · trang Dữ liệu cần xem lại |
| `exports` | Hộp thoại xuất Excel người thuê (khu / tầng / nhóm / phòng, đang ở hoặc khoảng ngày, chia sheet, số giấy tờ đầy đủ) |
| `auth`, `org` (bổ sung) | Tự sửa hồ sơ (`PUT /me`, đổi SĐT / email phải nhập mật khẩu → đăng nhập lại) · thông tin tổ chức · công tắc quyền bỏ nợ từng phó quản lý · nhật ký đăng nhập |
| `fees` | Tab Khoản thu của khu: thêm / sửa, bảng giá một giá hoặc theo bậc, ngừng dùng / khôi phục, sao chép từ khu khác, phòng đang dùng dịch vụ (thêm / bớt hàng loạt) |
| `meters` | Công tơ của phòng (lắp, thay, tháo, lịch sử, sửa / hủy chỉ số) · tab Công tơ của khu (lắp / thay hàng loạt, sản lượng phòng trống) · lưới ghi chỉ số hằng tháng |
| `invoices` | Danh sách theo khu / tháng + số tổng hợp · tạo nháp (1 khu / mọi khu) · tính lại · chốt nhiều phiếu · thêm phụ thu / giảm trừ cho nhiều phòng · chi tiết phiếu (sửa tay, phụ thu, giảm trừ, hoàn trả, chốt, hủy, xác nhận hoàn tiền) |
| `room-charges` | Khoản phát sinh theo phòng và theo khu: tạo phụ thu / bù, đánh dấu đã thanh toán, hủy |
| `payments` | "Đã thu" trên phiếu · thu theo hợp đồng (số nợ hợp đồng) · lịch sử thu, đảo phiếu thu · thanh toán + bỏ phần còn lại, bỏ nợ (theo `canWriteOff`) |
| `contracts` (bổ sung) | Tiền cọc (đã hoàn trả / bỏ đánh dấu, lọc chưa hoàn cọc) · đồng thuê · đổi người đứng tên · chuyển người · chuyển phòng (từ hôm nay; chuyển nhầm thì chuyển lại trong ngày) · xem trước thanh lý |
| `renters`, `rooms` (bổ sung) | Ẩn / hiện lại hồ sơ, lọc theo khu / đang ở · ghi nhận đồng ý xử lý dữ liệu · lịch sử thuê của phòng · tìm "ai đã ở phòng nào" |
| `contracts`, `invoices`, `meters` (20/10/2026) | Thanh lý một màn: kỳ cuối (thu trọn kỳ / theo ngày / không thu, kèm số tiền), kỳ chưa chốt hóa đơn, hóa đơn từ ngày trả phòng, hoàn tất một lần (nợ, tiền trả lại, khoản chưa xử lý, cọc Trả / Không trả / Để sau) · rút báo trả phòng, cờ Quá ngày trả phòng · điều chỉnh chỉ số đã chốt, lịch sử điều chỉnh, "Đã gửi lại" · "Đã thu" = thực thu, "Đã bỏ nợ" riêng · phiếu hoàn tiền |
| `audit` | Trang Nhật ký thao tác + mục Lịch sử trong phiếu / hợp đồng / người thuê (chỉ chủ trọ) |
| `imports` | Tab Nhập Excel của khu: tải mẫu → xem trước → sửa trên lưới → lưu phần hợp lệ (phòng; người thuê đang ở) — chỉ chủ trọ |

## Layout

| Màn hình | Sidebar |
|----------|---------|
| ≥ 1024px | Cố định bên trái, nút **Thu gọn** → thanh icon 72px + tooltip; lựa chọn được nhớ (localStorage) |
| < 1024px | Drawer trượt từ trái: nút ☰ trên topbar, lớp phủ, khóa cuộn, Esc / chạm ngoài để đóng, focus giữ trong drawer, chọn trang tự đóng |

Menu lọc theo `role` từ `GET /me`: `SystemAdmin` chỉ thấy *Quản trị nền tảng*; `OrgOwner` / `OrgManager` thấy khu vực chủ trọ.

## Thêm một màn hình mới

1. **API** — thêm hàm vào `src/api/<resource>.api.js` (nếu chưa có), khóa cache ở `queryKeys.js`.
2. **Hook** — `src/features/<module>/hooks.js`:
   ```js
   export function useRoomList(params) {
     return useQuery({
       queryKey: queryKeys.rooms.list(params),
       queryFn: ({ signal }) => roomsApi.list(params, { signal }),
       placeholderData: keepPreviousData,
     })
   }
   ```
3. **Trang** — `src/features/<module>/pages/XxxPage.jsx` (`export default`), dùng `PageHeader`, `Card`, `ErrorState`, `EmptyState`, `Pagination`.
   Mẫu tham khảo: `features/properties/pages/PropertiesPage.jsx` (lọc trên URL, debounce, skeleton, phân trang).
4. **Route** — khai báo lazy ở `app/lazyPages.js`, thêm route + `handle: { title }` ở `app/router.jsx` (đặt trong `RequireRole` phù hợp).
5. **Menu** — thêm item vào `config/navigation.js` (`to`, `label`, `icon`, `roles`).

## Đăng nhập & phân quyền

Quyền khai báo **một nơi**: `src/features/auth/permissions.js`. File này bản sao 4 policy của BE (`renting_room/Security/AuthorizationSetup.cs`):
`AnyUser`, `SystemAdmin`, `OrgMember` (chủ trọ + phó quản lý, có tổ chức), `OrgOwner`.
Màn hình chỉ tham chiếu `Permission.*`, **không so sánh role trực tiếp**.

| Lớp | Ở đâu | Chặn gì |
|-----|-------|---------|
| `RequireAuth` | `features/auth/guards.jsx` | Chưa đăng nhập, kể cả gõ thẳng URL → `/login`, đăng nhập xong quay lại đúng trang (giữ query/hash). Đang khôi phục phiên chỉ hiện loader. `mustChangePassword` → chỉ ở `/change-password` |
| `RouteAccessGate` | trong `AppLayout` | Đọc `handle.permission` của route. **Route thiếu khai báo bị chặn** (mặc định chặn, giống fallback policy của BE). Bị chặn thì chunk trang không được tải |
| Menu | `config/navigation.js` | Dùng cùng `Permission` với route → menu không bao giờ lệch với quyền |
| `<Can permission>` / `usePermission()` | `features/auth/access.jsx`, `AuthContext.js` | Ẩn nút trong trang, VD `<Can permission={Permission.MembersManage}>` |

FE chỉ ẩn/chặn giao diện. Quyết định cuối cùng vẫn là server (401/403).

Các trường hợp phiên đã xử lý:
- Đăng xuất: xóa token + cache React Query. Người đăng nhập sau **không** bị đưa về trang của người trước.
  Phiên của A hết hạn mà B đăng nhập thì B về trang chủ.
- Nhiều tab dùng chung phiên: tab này đăng xuất thì các tab khác đăng xuất theo. Tab này đăng nhập thì tab đang ở `/login` tự vào.
  Tab khác đăng nhập **tài khoản khác** thì tab này bỏ dữ liệu cũ và khởi động lại theo phiên mới (so `sub` trong JWT / `rr.sessionUser`).
- Đổi mật khẩu ở tab khác: tab này nhận `SESSION_REVOKED` nhưng thấy phiên mới hơn trong storage, nên dùng phiên đó (không đăng xuất oan).
- Claim JWT sau mỗi lần refresh được đối chiếu với user đang hiển thị: khác `sub` thì khởi động lại; `pwd_change` thì sang màn đổi mật khẩu; đổi `role` thì tải lại `/me`.
- Quay lại tab hoặc nhận `403 FORBIDDEN` thì tải lại `/me` (tối đa 1 lần/phút) để cập nhật quyền, khóa hay tạm ngưng.
- Refresh token quá hạn (30 ngày) bị bỏ ngay ở client, không gửi lên server.

## CORS, CSRF, XSS

| Rủi ro | Cách xử lý |
|--------|-----------|
| **CORS** | Mặc định gọi `/api/v1` **cùng origin**: dev/preview qua proxy của Vite, production qua reverse proxy (`deploy/nginx.conf.example`). Không có CORS, không có preflight. Nếu API ở domain khác: đặt `VITE_API_BASE_URL` tuyệt đối (https), và **BE** phải thêm origin của trang vào `Cors:AllowedOrigins`. BE đã expose `Location`, `Retry-After`, `Idempotent-Replayed` |
| **CSRF** | Xác thực bằng header `Authorization: Bearer`, không dùng cookie; `fetch` đặt `credentials: 'omit'` nên **không bao giờ** gửi cookie. Refresh/logout gửi refresh token trong body, trang khác không tự gửi thay được |
| **XSS** | React tự escape; code không dùng `dangerouslySetInnerHTML`/`eval`. Bản build có CSP `script-src 'self'`, `connect-src` chỉ gồm API: script chèn vào không chạy, và không gửi token ra domain lạ được. `frame-ancestors`/HSTS đặt ở web server |

## Quy ước gọi API (đã cài sẵn trong `lib/http/client.js`)

- Access token giữ trong bộ nhớ, refresh token ở localStorage. Token sắp hết hạn (< 1 phút) → refresh chủ động.
- `401 TOKEN_EXPIRED` → refresh **đúng 1 lần** rồi gửi lại; nhiều request song song chỉ sinh **một** lệnh refresh (khóa cả giữa các tab bằng Web Locks).
- `401` phiên hết hiệu lực / `423` / `403 ORGANIZATION_SUSPENDED` → xóa phiên, về `/login`.
- `403 PASSWORD_CHANGE_REQUIRED` → chuyển `/change-password`.
- Lệnh tạo mới truyền `{ idempotencyKey }` — lấy từ `useIdempotencyKey()` (giữ key khi retry, `renew()` khi đổi nội dung form).
  `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` được tự chờ `Retry-After` rồi gửi lại.
- Mọi lỗi là `ApiError` (`status`, `code`, `detail`, `errors`, `traceId`). Lỗi form: `error.fieldErrors()` → `{ 'renter.fullName': '…' }`.
  Câu thông báo chung: `getErrorMessage(error)`.
- Cập nhật có `version`: gửi lại nguyên `version` đã GET; `409 CONCURRENCY_CONFLICT` → báo và tải lại.
- React Query không retry lỗi 4xx/429.

## Thông báo và xác nhận

- Kết quả mọi thao tác (thành công, thất bại, cảnh báo không chặn) hiện bằng **thông báo nổi ở góc trên bên phải** (`useToast`). Lỗi theo ô vẫn hiện dưới ô đó.
  `useForm`, `ConfirmDialog`, `useAction` đã tự báo lỗi — màn hình mới chỉ cần gọi `toast.success` khi xong.
- Câu hỏi cần người dùng quyết định (xóa, hủy, chốt, gỡ, bỏ nợ…) luôn dùng hộp thoại `ConfirmDialog` / `FormDialog`, không dùng `window.confirm`.
- Quyền riêng từng người đọc từ `GET /me`: `canWriteOff` (bỏ nợ), `canViewSensitiveData` (xem số giấy tờ) — xem `features/auth/permissions.js`.

## Danh mục tỉnh / xã

`src/data/vnAdminUnits.json` — 34 tỉnh / thành phố và 3.321 xã / phường / đặc khu, lấy từ Cục Thống kê (`danhmuchanhchinh.nso.gov.vn`, ngày ghi trong trường `asOf`).
Backend chưa có API danh mục; file được tải khi cần (chunk riêng) qua `useAdminUnits()` và dùng trong ô chọn địa chỉ khu trọ, nơi thường trú của người thuê.
