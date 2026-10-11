# Quyền riêng tư vị trí — Backend 1, S2

Auth sở hữu cài đặt; Locations sở hữu quyết định cho phép nhận/xem và cách giảm độ chính xác. Các context trao đổi qua public application API. Không đọc bảng của context khác, không dùng cờ `isFriend` hoặc `isParticipant` do client cung cấp.

## API

Tất cả endpoint yêu cầu Bearer access token và trả `Cache-Control: no-store`. Swagger nhóm **Location privacy**.

| Method | URL | Công dụng |
|---|---|---|
| GET | `/api/v1/auth/privacy` | Cài đặt của chính actor; chưa có bản ghi thì mặc định tắt |
| PUT | `/api/v1/auth/privacy` | Thay thế toàn bộ cài đặt của chính actor |
| DELETE | `/api/v1/auth/privacy/selected-friends/:friendId` | Bỏ một người khỏi `selectedFriendIds` của chính actor |
| GET | `/api/v1/locations/permissions/:ownerId` | Actor hiện tại có được xem vị trí của owner trong scope yêu cầu không |

Ví dụ PUT:

```json
{
  "sharingMode": "friends",
  "sharingExpiresAt": null,
  "useApproximateLocation": true,
  "nearbyFeatureEnabled": false,
  "selectedFriendIds": []
}
```

`sharingMode`, `sharingExpiresAt`, `useApproximateLocation` là bắt buộc. Hai trường còn lại mặc định `false` và `[]` mỗi lần PUT. Không dùng PUT như PATCH. `sharingExpiresAt` là timestamp ISO 8601 có timezone và ở tương lai, hoặc `null` để chia sẻ không giới hạn thời gian. Tắt chia sẻ yêu cầu thời hạn `null` và danh sách rỗng.

DELETE chỉ thay đổi settings thuộc actor từ JWT, không được tác động danh sách của người dùng khác. Nếu bỏ người cuối cùng khi đang ở `selected_friends`, aggregate chuyển mode sang `friends` theo policy hiện tại; thao tác vẫn idempotent.

GET/PUT trả các trường trên cùng `updatedAt` và `isLocationSharingEnabled` **hiệu lực tại thời điểm đọc**, tính cả thời hạn. Hết hạn không cần cron job để thu hồi quyền. Bật nearby không tự bật chia sẻ.

| Chế độ | Người được xem |
|---|---|
| `off` | Không cấp quyền nhận hoặc phát vị trí |
| `friends` | Bạn bè có quan hệ `accepted` hiện tại |
| `selected_friends` | Bạn bè `accepted` thuộc `selectedFriendIds`, áp dụng cả khi xem qua meetup |
| `meetup_only` | Chỉ thành viên `accepted` trong meetup còn hoạt động, sau khi backend xác minh |

Danh sách chọn gồm 1–100 UUID khác actor, không trùng, chỉ dùng với `selected_friends`. Khi lưu, Auth kiểm tra tài khoản tồn tại và đang hoạt động. Việc lưu một UUID chưa là bạn không cấp quyền: Locations luôn kiểm tra lại quan hệ `accepted` khi truy cập. Người dùng có thể xem vị trí của chính mình khi chế độ và scope cho phép.

API kiểm quyền nhận `scope=friends` (mặc định), hoặc `scope=meetup&meetupId=<uuid>`. Danh tính người xem luôn lấy từ JWT, không nhận từ query. Ví dụ response:

```json
{ "allowed": true, "precision": "approximate", "expiresAt": null }
```

Khi bị từ chối: `{ "allowed": false, "precision": null, "expiresAt": null }`. Không tiết lộ danh sách được chọn hay lý do tài khoản đích không hoạt động. Response này chỉ phục vụ UI, **không phải giấy phép có thể lưu lại để bỏ qua lần kiểm tra kế tiếp**.

Lỗi input trả 400, thiếu/sai token 401, actor bị khóa 403, tài khoản được chọn không hoạt động 404. Tác vụ nội bộ lấy/phát vị trí không được phép ném `LOCATION_ACCESS_DENIED` (403).

## Contract cho Backend 2

Import `LocationsModule`, inject `LocationAccessService` từ `application/services/location-access.service.ts`:

- Gọi `requirePublish(actorId, meetupId?)` trên **mỗi** lần nhận vị trí, trước khi ghi Redis. Không dùng kết quả từ mobile.
- Gọi `projectForViewer({ ownerId, viewerId, scope, meetupId? }, sample)` trên **mỗi** lần đọc/phát và cho **từng người nhận**. Hàm vừa kiểm quyền, vừa trả payload đã giảm độ chính xác nếu cần. Không broadcast cùng một payload chính xác cho cả room.
- `sample` gồm `latitude`, `longitude`, `accuracy` (mét), `recordedAt` (Date). Mẫu phải hữu hạn, tọa độ đúng khoảng, không trong tương lai, chưa đủ 5 phút tuổi và được ghi nhận từ thời điểm thay đổi privacy gần nhất. Sau thay đổi cài đặt cần lấy mẫu mới.
- Chế độ gần đúng làm tròn latitude/longitude đến 2 chữ số thập phân, `accuracy >= 1000m`; không trả thêm metadata chính xác từ input. Đây là tọa độ làm tròn, không phải cơ chế ẩn danh tuyệt đối. Chế độ chính xác giữ độ chính xác gốc.
- Các phép kiểm tra đọc cài đặt và quan hệ hiện tại, không cache quyền. Trạng thái khóa/xóa của cả owner và viewer đều được kiểm tra. Không ghi tọa độ vào PostgreSQL/log.

**Ranh giới hiện tại:** task này chưa cung cấp API lưu/lấy tọa độ, Redis location store, Socket hoặc worker xóa cache. Những phần đó thuộc Backend 2/PB-07. Chưa có context Meetups nên `LocationsModule` chưa truyền `MeetupLocationAccessPort`: mọi quyền theo meetup đang bị từ chối, kể cả khi client gửi meetupId hợp lệ. Khi làm Meetups, adapter của port phải xác minh thành viên accepted và trạng thái meetup từ public API của Meetups; truyền adapter vào tham số thứ ba của `LocationAccessService`. Tuyệt đối không thay bằng cờ từ request.

## Migration và kiểm thử

Chạy `npm run migration:run` trên database development riêng để tạo `privacy_settings`. Không sửa migration cũ. Unique user bảo đảm một cấu hình mỗi người; PUT upsert toàn bộ cấu hình atomically, giữ nguyên ID bản ghi. Cờ persisted chỉ biểu diễn chế độ bật/tắt; consumer phải dùng policy để tính expiry, không đọc cờ này riêng lẻ.

```powershell
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
npx eslint "{src,test}/**/*.ts"
```

Test bao phủ defaults, expiration boundary, tắt chia sẻ, selection, account availability, quan hệ hiện tại, kiểm quyền meetup qua fake server port, giảm độ chính xác và HTTP validation/authorization. HTTP test dùng identity/persistence giả; không xác minh JWT hoặc migration trên PostgreSQL thật. Không bổ sung script seed hoặc công cụ kiểm tra kết nối tạm.
