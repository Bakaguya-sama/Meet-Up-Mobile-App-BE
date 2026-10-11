# BE-03 — Kết bạn

Triển khai UC-02, PB-03/PB-04 trong bounded context `friends`. Domain và application dùng TypeScript thuần; controller gọi use case/query; TypeORM là adapter. Friends đọc hồ sơ qua public application API `UserDirectory` của Auth, không đọc bảng hoặc repository của Auth.

## API

Base URL: `/api/v1/friends`. Tất cả endpoint yêu cầu `Authorization: Bearer <accessToken>`. Guard hiện tại kiểm tra JWT, session và trạng thái tài khoản. Swagger tại `/docs`, nhóm **Friends**.

| Method | Path | Input | Thành công |
|---|---|---|---|
| GET | `/search` | `q` (tên/email), `offset`, `limit` | 200, trang người dùng và quan hệ hiện tại |
| GET | `/` | `offset`, `limit` | 200, trang bạn bè `accepted` |
| GET | `/requests` | `direction=received\|sent`, `offset`, `limit` | 200, trang lời mời `pending` |
| POST | `/requests` | `{ "recipientId": "<uuid>" }` | 201, friendship |
| POST | `/requests/:requestId/accept` | Không cần body | 200, friendship `accepted` |
| POST | `/requests/:requestId/reject` | Không cần body | 200, friendship `rejected` |

Pagination: `offset=0`, `limit=20` mặc định; `offset` từ 0–100000, `limit` từ 1–50, chỉ nhận số nguyên. `direction` mặc định `received`. Kết quả trang có `{ items, total, offset, limit }`.

Tìm kiếm không phân biệt hoa/thường, khớp một phần tên/email, trim khoảng trắng; `q` dài 1–255 ký tự sau trim. `%`, `_`, `\` là ký tự tìm kiếm bình thường. Loại chính actor, tài khoản bị khóa và đã xóa. Chỉ trả `id`, `displayName`, `avatarUrl` và `friendship` (`null` nếu chưa có quan hệ); không trả email hoặc thông tin xác thực.

Friendship gồm `id`, `userAId`, `userBId`, `requestedById`, `status`, `requestedAt`, `respondedAt`, `updatedAt`. Timestamp trả ISO 8601. Danh sách quan hệ thêm `user` là hồ sơ của phía còn lại; `user=null` nếu tài khoản đó đã bị khóa/xóa sau khi tạo quan hệ. Quan hệ vẫn được giữ, không làm lệch pagination. Dùng `requestedById` để phân biệt lời mời đến/đi trong kết quả tìm kiếm.

## Quy tắc và lỗi

- Không tự kết bạn, kể cả UUID khác cách viết hoa/thường.
- Mỗi cặp UUID được sắp thứ tự và chỉ có một dòng. Gửi trùng cùng chiều hoặc ngược chiều trả 409, không tự động chấp nhận.
- Chỉ người nhận được accept/reject và chỉ khi `pending`. Hai phía đọc cùng một quan hệ nên trạng thái cập nhật nhất quán.
- BE-03 giữ lời mời `rejected` ở trạng thái đóng; gửi lại cùng cặp trả 409. Mở lại, hủy lời mời, hủy kết bạn và API chặn/mở chặn chưa thuộc task này. `blocked` được giữ trong enum theo schema và không được phản hồi.
- Không tạo lời mời đến tài khoản thiếu, bị khóa hoặc đã xóa. Trạng thái tài khoản được kiểm tra qua Auth trước khi ghi.

| HTTP | Code | Ý nghĩa |
|---|---|---|
| 400 | `SELF_FRIENDSHIP` | Tự kết bạn |
| 400 | Lỗi validation | UUID/query/body không hợp lệ; trường thừa bị từ chối |
| 401 | Lỗi xác thực hiện tại | Thiếu/sai/hết hạn token hoặc session không còn hiệu lực |
| 403 | `ACCOUNT_LOCKED` | Actor bị khóa |
| 403 | `FRIENDSHIP_RESPONSE_FORBIDDEN` | Người gửi tự phản hồi |
| 404 | `FRIEND_USER_NOT_FOUND` | Không tìm thấy tài khoản hoạt động |
| 404 | `FRIENDSHIP_NOT_FOUND` | Lời mời không tồn tại hoặc actor không thuộc cặp |
| 409 | `FRIENDSHIP_ALREADY_EXISTS` | Cặp đã có lời mời/quan hệ |
| 409 | `FRIENDSHIP_NOT_PENDING` | Lời mời đã được phản hồi |

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

Các test hiện tại không xác minh constraint hoặc concurrency trên PostgreSQL thật.
