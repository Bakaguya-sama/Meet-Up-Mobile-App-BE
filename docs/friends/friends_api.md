# BE-03 — Kết bạn

Triển khai UC-02, PB-03/PB-04 trong bounded context `friends`. Domain và application dùng TypeScript thuần; controller gọi use case/query; TypeORM là adapter. Friends đọc hồ sơ qua public application API `UserDirectory` của Auth, không đọc bảng hoặc repository của Auth.

## API

Base URL: `/api/v1/friends`. Tất cả endpoint yêu cầu `Authorization: Bearer <accessToken>`. Guard hiện tại kiểm tra JWT, session và trạng thái tài khoản. Swagger tại `/docs`, nhóm **Friends**.

| Method | Path                          | Input                                                                        | Thành công                                                         |
| ------ | ----------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| GET    | `/search`                     | `q` (tên/email), `offset`, `limit`                                           | 200, trang người dùng và quan hệ hiện tại                          |
| GET    | `/`                           | `offset`, `limit`                                                            | 200, trang bạn bè `accepted`                                       |
| GET    | `/requests`                   | `direction=received\|sent`, `offset`, `limit`                                | 200, trang lời mời `pending`                                       |
| GET    | `/qr-profiles/:publicHandle`  | Stable handle                                                                | 200, hồ sơ tối thiểu và trạng thái friendship; không có account ID |
| GET    | `/public-handle`              | Không cần body                                                               | 200, handle hiện tại hoặc `null` nếu chưa có/đã tắt                |
| POST   | `/public-handle/rotate`       | Không cần body                                                               | 200, public handle mới                                             |
| DELETE | `/public-handle`              | Không cần body                                                               | 204, handle bị vô hiệu hóa                                         |
| POST   | `/qr-sessions`                | Không cần body                                                               | 201, `sessionId`, `qrUrl`, `expiresAt`                             |
| GET    | `/qr-sessions/:token`         | Opaque token                                                                 | 200, preview không có account ID                                   |
| DELETE | `/qr-sessions/:sessionId`     | Session ID                                                                   | 204, session bị thu hồi                                            |
| POST   | `/requests`                   | Chính xác một trong `recipientId`, `recipientPublicHandle`, `qrSessionToken` | 201; selector QR chỉ trả `{ status, requestedAt }`                 |
| POST   | `/requests/:requestId/accept` | Không cần body                                                               | 200, friendship `accepted`                                         |
| POST   | `/requests/:requestId/reject` | Không cần body                                                               | 200, friendship `rejected`                                         |
| DELETE | `/:friendshipId`              | Không cần body                                                               | 204, friendship bị hủy                                             |

Pagination: `offset=0`, `limit=20` mặc định; `offset` từ 0–100000, `limit` từ 1–50, chỉ nhận số nguyên. `direction` mặc định `received`. Kết quả trang có `{ items, total, offset, limit }`.

Tìm kiếm không phân biệt hoa/thường, khớp một phần tên/email, trim khoảng trắng; `q` dài 1–255 ký tự sau trim. `%`, `_`, `\` là ký tự tìm kiếm bình thường. Loại chính actor, tài khoản bị khóa và đã xóa. Chỉ trả `id`, `displayName`, `avatarUrl` và `friendship` (`null` nếu chưa có quan hệ); không trả email hoặc thông tin xác thực.

`POST /requests` yêu cầu đúng một selector: `{ "recipientId": "<uuid>" }`, `{ "recipientPublicHandle": "<opaque handle>" }` hoặc `{ "qrSessionToken": "<opaque token>" }`. Hai selector QR resolve người nhận đang hoạt động rồi dùng lại friend-request use case hiện có. Nhánh QR chỉ trả `{ status, requestedAt }`, không có account ID. Selector rỗng, null hoặc có nhiều giá trị trả `400`; handle/session không hợp lệ, bị disable, hết hạn hoặc account không hoạt động trả lỗi người nhận không khả dụng.

Friendship gồm `id`, `userAId`, `userBId`, `requestedById`, `status`, `requestedAt`, `respondedAt`, `updatedAt`. Timestamp trả ISO 8601. Danh sách quan hệ thêm `user` là hồ sơ của phía còn lại; `user=null` nếu tài khoản đó đã bị khóa/xóa sau khi tạo quan hệ. Quan hệ vẫn được giữ, không làm lệch pagination. Dùng `requestedById` để phân biệt lời mời đến/đi trong kết quả tìm kiếm.

## Quy tắc và lỗi

- Không tự kết bạn, kể cả UUID khác cách viết hoa/thường.
- Mỗi cặp UUID được sắp thứ tự và chỉ có một dòng. Gửi trùng cùng chiều hoặc ngược chiều trả 409, không tự động chấp nhận.
- Chỉ người nhận được accept/reject và chỉ khi `pending`. Hai phía đọc cùng một quan hệ nên trạng thái cập nhật nhất quán.
- BE-03 giữ lời mời `rejected` ở trạng thái đóng; gửi lại cùng cặp trả 409. Cả hai phía có thể hủy friendship đã `accepted`; thao tác chuyển quan hệ sang `rejected` và loại hai phía khỏi selected audience của nhau. Mở lại, hủy lời mời và API chặn/mở chặn chưa thuộc task này. `blocked` được giữ trong enum theo schema và không được phản hồi.
- Không tạo lời mời đến tài khoản thiếu, bị khóa hoặc đã xóa. Trạng thái tài khoản được kiểm tra qua Auth trước khi ghi.

| HTTP | Code                            | Ý nghĩa                                                 |
| ---- | ------------------------------- | ------------------------------------------------------- |
| 400  | `SELF_FRIENDSHIP`               | Tự kết bạn                                              |
| 400  | Lỗi validation                  | UUID/query/body không hợp lệ; trường thừa bị từ chối    |
| 401  | Lỗi xác thực hiện tại           | Thiếu/sai/hết hạn token hoặc session không còn hiệu lực |
| 403  | `ACCOUNT_LOCKED`                | Actor bị khóa                                           |
| 403  | `FRIENDSHIP_RESPONSE_FORBIDDEN` | Người gửi tự phản hồi                                   |
| 404  | `FRIEND_USER_NOT_FOUND`         | Không tìm thấy tài khoản hoạt động                      |
| 404  | `FRIENDSHIP_NOT_FOUND`          | Lời mời không tồn tại hoặc actor không thuộc cặp        |
| 409  | `FRIENDSHIP_ALREADY_EXISTS`     | Cặp đã có lời mời/quan hệ                               |
| 409  | `FRIENDSHIP_NOT_PENDING`        | Lời mời đã được phản hồi                                |

## Database và concurrency

Migration mới `1760000003000-create-friendships-table.ts`; không sửa migration cũ. Chạy `npm run migration:run` trên database development riêng trước khi khởi động API.

Database bảo vệ bằng unique pair, check `user_a_id < user_b_id`, check requester thuộc cặp, foreign key và check thời điểm phản hồi phù hợp trạng thái. Insert dùng unique constraint để xử lý cả hai request đến đồng thời. Accept/reject dùng `SELECT ... FOR UPDATE` và ghi trong cùng transaction: chỉ một phản hồi thành công, phản hồi còn lại trả 409. Không gọi dịch vụ ngoài trong transaction.

Task này cung cấp REST; FCM/Socket.IO/outbox delivery thuộc phần Notifications/Realtime ở sprint tiếp theo. Mobile tải lại danh sách để nhận trạng thái mới.

## Kiểm thử

```powershell
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
npx eslint "{src,test}/**/*.ts"
```

Unit test kiểm tra invariant và use case/query. HTTP contract test chạy controller, validation, filter và use case thật với persistence/identity giả; không thay thế test JWT hay test database.

BE-34 có integration/E2E riêng chạy trên PostgreSQL và Redis thật tại `test/invite-links-friend-qr.integration-spec.ts` và `test/invite-links-friend-qr.e2e-spec.ts`. Test kiểm tra migration cycle, stable-handle rotate/disable, Redis TTL/revoke/hash-only, selector privacy, duplicate/self và rate limit.

## Extension đã chốt — QR kết bạn hybrid

QR không thay đổi friendship aggregate; cả hai nhánh cuối cùng vẫn gọi cùng service tạo friend request và giữ nguyên lỗi self/duplicate/pending/accepted/blocked.

Application layer tách theo một hành vi trên một use case: `GetPublicHandleUseCase`, `RotatePublicHandleUseCase`, `DisablePublicHandleUseCase`, `PreviewFriendQrSessionUseCase`, `ResolveFriendQrSessionRecipientUseCase` và `RevokeFriendQrSessionUseCase`. Controller chỉ điều phối route; resolve token/handle và luật nghiệp vụ nằm trong application/domain/adapters tương ứng.

### QR hồ sơ ổn định

- Backend cấp một `publicHandle` entropy cao, unique và không chứa UUID nội bộ/email/số điện thoại. Handle được lưu nullable/unique tại `user_accounts.public_handle`; disable đặt handle ở trạng thái không resolve và rotate thay handle hiện hành, nên handle cũ không resolve. Audit dùng audit log hiện có, không tạo bảng profile/QR riêng.
- Mobile có thể gọi `GET /public-handle` sau đăng nhập hoặc khi mở lại màn hình QR để lấy handle hiện tại. API chỉ đọc, không tự tạo hay rotate handle; trả `{ "publicHandle": null }` nếu tài khoản chưa có handle hoặc đã disable. Response dùng `Cache-Control: no-store`.
- QR chỉ mã hóa HTTPS universal/app link chứa handle. Scan mở preview tối thiểu (`publicHandle`, `displayName`, `avatarUrl`, friendship status), sau đó người quét phải chủ động gọi `POST /requests` với `{ "recipientPublicHandle": "..." }`; preview không trả internal user ID và không auto-friend.

Contract stable handle:

```http
GET  /api/v1/friends/qr-profiles/:publicHandle
GET  /api/v1/friends/public-handle
POST /api/v1/friends/public-handle/rotate
DELETE /api/v1/friends/public-handle
POST /api/v1/friends/requests
```

### QR tạm thời

- Backend tạo opaque token và lưu mapping theo SHA-256 token hash → owner/session/revoke state trong Redis TTL. QR mã hóa URL token; raw token không dùng làm Redis key/value và không có bảng QR session trong PostgreSQL.
- `POST /qr-sessions` trả `sessionId`, `qrUrl`, `expiresAt`; raw token chỉ có trong URL trả một lần. Redis dùng SHA-256 token làm key và lưu owner/session ID làm value với TTL cấu hình `FRIEND_QR_SESSION_TTL_SECONDS`.
- `GET /qr-sessions/:token` yêu cầu JWT và chỉ trả `{ displayName, avatarUrl, friendship }`. Token hết hạn/thu hồi không resolve; raw token không xuất hiện trong log/event. Response có `Cache-Control: no-store`.
- Sau resolve, mobile gọi cùng `POST /requests` với `{ "qrSessionToken": "..." }`. Controller resolve session rồi gọi use case friendship hiện có. Rate limit theo account/token/IP; scan chính mình hoặc quan hệ đã tồn tại trả lỗi hiện có.
- `DELETE /qr-sessions/:sessionId` chỉ thu hồi session của account đang đăng nhập; sai owner hoặc session không tồn tại trả lỗi unavailable. Tạo, resolve, gửi request QR và revoke dùng `FRIEND_QR_RATE_LIMIT` theo scope phù hợp.

```http
POST   /api/v1/friends/qr-sessions
GET    /api/v1/friends/qr-sessions/:token
DELETE /api/v1/friends/qr-sessions/:sessionId
```

Không lưu bitmap QR. PostgreSQL chỉ lưu public handle và friendship cuối; Redis lưu phiên tạm thời. Nếu sau này cần link QR chia sẻ dài hạn có revoke/audit riêng, khi đó mới thiết kế bảng token bền vững thay vì kéo dài TTL Redis.
