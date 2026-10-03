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
| `org/members` | Danh sách thành viên · thêm / sửa / khóa / mở khóa / gỡ (gõ tên xác nhận) / cấp lại mật khẩu — phó quản lý chỉ xem |
| `properties` | Danh sách (thẻ, tỉ lệ lấp đầy) · tạo khu · chi tiết 6 tab: Phòng (sơ đồ), Thông tin & cài đặt thu, Bên cho thuê (xem số giấy tờ 👁), Ngân hàng, Nội quy, Nhóm phòng · ngừng dùng / khôi phục |
| `rooms` | Sơ đồ theo tầng / bảng, lọc khu-trạng thái-tầng · thêm phòng · tạo hàng loạt (sinh mã `{tầng}{01..n}`) · chi tiết: bảo trì, ngừng dùng, khôi phục, lịch sử hợp đồng, "Tạo hợp đồng" |
| `renters` | Tìm theo tên không dấu / SĐT / đủ số giấy tờ · thêm / sửa (trùng số giấy tờ → đề xuất dùng hồ sơ cũ) · chi tiết + lịch sử thuê |
| `contract-templates` | Danh sách theo loại · tạo từ mẫu gợi ý · trình soạn điều khoản + trường tùy biến (7 kiểu, tự sinh key) · ngừng dùng / khôi phục |
| `contracts` | Danh sách (tab trạng thái, sắp hết hạn, quá hạn, không cọc) · wizard 6 bước tạo / sửa nháp · chi tiết 9 tab + mọi thao tác theo ma trận trạng thái: kích hoạt (checklist, xác nhận vượt sức chứa), hủy nháp, người ở, phụ lục giá, gia hạn, báo trả phòng, thanh lý, tài sản, xe, ghi chú |
| `exports` | Hộp thoại xuất Excel người thuê (khu / tầng / nhóm / phòng, đang ở hoặc khoảng ngày, chia sheet, số giấy tờ đầy đủ) |

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
