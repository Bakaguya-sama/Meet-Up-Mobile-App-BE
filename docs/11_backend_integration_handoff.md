# Handoff tích hợp giữa Backend 1 và Backend 2

> Cập nhật chung bởi cả hai developer backend.

Tài liệu này là điểm đồng bộ kỹ thuật cho hai developer backend. Mục tiêu là cho phép làm song song mà không truy cập trực tiếp repository/bảng của bounded context còn lại.

## 1. Phân ranh giới hiện tại

| Khu vực | Chủ sở hữu | Thành phần chính | Quy tắc tích hợp |
|---|---|---|---|
| Auth, profile, privacy | Backend 1 | `auth` | Export public application service/port; không để context khác đọc TypeORM repository Auth. |
| Friends | Backend 1 | `friends` | Cung cấp friendship đã accepted qua public port. |
| Meetup, membership, vote | Backend 1 | `meetups` khi được tạo | Cung cấp membership accepted, meetup active và event versioned. |
| Latest location, Socket, presence | Backend 2 | `locations`, `realtime`, Redis | Dùng contract Meetup; không tự suy luận membership từ mobile. |
| Device token, FCM, outbox delivery | Backend 2 | `notifications`, `outbox` | Cung cấp hàm gửi chung; nghiệp vụ Meetup/Vote quyết định khi nào ghi outbox push. |
| Recommendation, Google Maps, AI, nearby | Backend 2 | các context tương lai | Chỉ lấy Meetup/Preference/Location qua public port hoặc event. |

## 2. Thành phần đang có và owner

| Thành phần | File/đường dẫn | Owner | Consumer dự kiến |
|---|---|---|---|
| Access-token validation | `shared-kernel/application/access-token-validator.port.ts` | Backend 1 | Socket gateway, protected API |
| Location privacy reader | `auth/application/public/location-privacy-reader.ts` | Backend 1 | Backend 2 location access service |
| Friendship reader | `friends/application/public/*` | Backend 1 | Backend 2 location/nearby |
| Location store | `locations/application/ports/location.port.ts` | Backend 2 | Recommendation, nearby qua public port tương lai |
| Socket rooms | `shared-kernel/application/realtime-publisher.port.ts` | Backend 2 | Meetup/Vote events |
| Presence | `shared-kernel/application/presence.port.ts` | Backend 2 | Các feature cần online/offline aggregate |
| Push notification | `notifications/application/ports/push-notification.port.ts` | Backend 2 | Outbox dispatcher |
| Device-token store | `notifications/application/ports/device-token-store.port.ts` | Backend 2 | Chỉ notification infrastructure |
| Transactional outbox | `shared-kernel/application/outbox.port.ts` | Backend 2 foundation | Bounded context ghi event trong transaction của chính nó |

## 3. Database ownership

| Bảng | Owner | Ghi chú |
|---|---|---|
| `user_accounts`, `user_sessions`, privacy/profile | Backend 1 | Backend 2 không query trực tiếp. |
| `friendships` | Backend 1 | Chỉ dùng dữ liệu friendship qua port public. |
| `device_tokens` | Backend 2 | Chỉ lưu AES-256-GCM ciphertext và HMAC fingerprint; không lưu plaintext FCM token. |
| `outbox_events` | Foundation / Backend 2 vận hành worker | Bất kỳ context nào cũng có thể ghi row bằng `OutboxPort` trong transaction của mình; không tự gọi worker. |

Migration là append-only. Người tạo migration cần:

1. Dùng timestamp lớn hơn migration mới nhất.
2. Chạy migration vào shared database trước khi branch khác phụ thuộc schema.
3. Cập nhật `docs/06_database_schema.dbml` cùng pull request.
4. Không sửa migration đã chạy trên shared database.

## 4. Contract liên backend cần chốt

### Meetup membership cho Socket/location

Backend 1 cần cung cấp implementation cho `MeetupLocationAccessPort` ở Location context:

```ts
canJoin(userId, meetupId): Promise<boolean>
canPublish(userId, meetupId): Promise<boolean>
canRead(ownerId, viewerId, meetupId): Promise<boolean>
```

Ba hàm đều phải chỉ trả `true` khi participant được accepted và meetup còn active. Hiện adapter mặc định deny toàn bộ để không có user nào tự join/publish vào meetup trước khi contract này được nối.

### Integration events

Event phải có `eventId`, `eventName` versioned và `occurredAt`. Không đưa token, GPS chính xác, refresh token hoặc dữ liệu nhạy cảm vào payload.

| Event | Producer | Consumer | Payload tối thiểu |
|---|---|---|---|
| `MeetupMemberChanged.v1` | Backend 1 / BE-08 | Backend 2 Socket/location | `eventId`, `meetupId`, `userId`, `membershipStatus`, `occurredAt` |
| `PreferenceUpdated.v1` | Backend 1 / BE-09 | Backend 2 recommendation | `eventId`, `meetupId`, `participantId`, `occurredAt` |
| `VoteUpdated.v1` | Backend 1 / BE-10 | Backend 2 Socket | `eventId`, `meetupId`, `placeId`, `voteCount`, `occurredAt` |
| `MeetupFinalized.v1` | Backend 1 / BE-10 | Backend 2 Socket + FCM | `eventId`, `meetupId`, `placeId`, `scheduledAt`, `occurredAt` |

Backend 1 ghi event vào `outbox_events` bằng `OutboxPort` trong cùng transaction persist Meetup/Vote. Worker chỉ dispatch sau commit; consumer phải xử lý idempotent theo `eventId`.

## 5. Luồng FCM chung

1. Mobile gọi `POST /api/v1/notifications/devices` để đăng ký token và lưu opaque `id` trả về.
2. Khi token xoay vòng, mobile gọi `PUT /api/v1/notifications/devices/:id`; khi logout, gọi `DELETE` cùng `id`.
3. Backend 1 chốt Meetup/Vote, persist thay đổi và ghi `MeetupFinalized.v1` destination `push` cùng transaction.
4. Outbox worker lấy recipient IDs, gọi `PushNotificationPort`.
5. FCM adapter đọc token active của từng user, giải mã ngay trước khi gửi. Token Firebase báo invalid sẽ bị revoke; lỗi khác retry tối đa 5 lần qua BullMQ.

Deep-link payload duy nhất được gửi xuống mobile:

```json
{
  "type": "meetup.finalized",
  "meetupId": "uuid",
  "placeId": "uuid-optional"
}
```

Không gửi title/body/token/GPS qua integration event; title/body hiện được xây dựng trong outbox dispatcher.

## 6. Checklist trước khi merge thay đổi liên backend

- [ ] Owner đã cập nhật public port/event schema và test contract.
- [ ] Không có import TypeORM repository/entity của context khác.
- [ ] Migration mới đã được review, chạy thành công và DBML đã cập nhật.
- [ ] Event có version, UUID `eventId`, timestamp và không chứa dữ liệu nhạy cảm.
- [ ] Outbox destination (`realtime` hoặc `push`) cùng recipient IDs đã rõ.
- [ ] Mobile deep-link vẫn chỉ dùng `type`, `meetupId`, `placeId?`.
- [ ] Test bao phủ authorization, duplicate event và failure/retry chính.
- [ ] Hai developer ghi một dòng vào nhật ký dưới đây.

## 7. Nhật ký phối hợp

| Ngày | Người cập nhật | Thay đổi / contract | Consumer cần kiểm tra | Trạng thái |
|---|---|---|---|---|
| 2026-10-14 | Backend 2 | BE-05/BE-06 location Socket, Redis presence và room contract | Backend 1 cần nối Meetup membership port | Chờ BE-08 |
| 2026-10-14 | Backend 2 | BE-07 `device_tokens`, FCM adapter, push outbox delivery | Backend 1 dùng `MeetupFinalized.v1` khi BE-10 hoàn thành | Sẵn sàng |
