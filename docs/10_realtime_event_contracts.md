# Contract realtime, outbox và notification

## Quy ước chung

- Mọi integration event đều dùng tên có phiên bản, ví dụ `VoteUpdated.v1`.
- `eventId` là UUID và là idempotency key phía consumer. Consumer phải bỏ qua event đã xử lý.
- `occurredAt` là ISO-8601 UTC. Không truyền access/refresh token, device token, latitude/longitude chính xác, GPS history, tên thật không cần thiết hoặc AI payload thô.
- Event được lưu vào `outbox_events` trong **cùng PostgreSQL transaction** với thay đổi nghiệp vụ. Worker BullMQ chỉ phát side effect sau commit.
- Thất bại delivery được retry tối đa 5 lần với exponential backoff. Lỗi lưu ở outbox đã được rút gọn, không chứa payload nhạy cảm.

## Socket rooms và lỗi

| Contract             | Giá trị                                             |
| -------------------- | --------------------------------------------------- |
| Meetup room          | `meetup:{meetupId}`                                 |
| User room            | `user:{userId}`                                     |
| Lỗi xác thực         | `UNAUTHORIZED`                                      |
| Lỗi quyền            | `FORBIDDEN`                                         |
| Meetup               | `MEETUP_NOT_FOUND`, `MEETUP_INACTIVE`               |
| Payload              | `INVALID_EVENT_PAYLOAD`, `EVENT_SCHEMA_INVALID`     |
| Idempotency/delivery | `EVENT_ALREADY_PROCESSED`, `OUTBOX_DELIVERY_FAILED` |

Room chỉ là routing. Gateway ở BE-06 vẫn phải xác thực JWT khi handshake và kiểm tra membership/trạng thái meetup trước khi join hoặc phát event.

## Integration event schemas

| Event                    | Trường bổ sung ngoài `eventId`, `eventName`, `occurredAt`                        |
| ------------------------ | -------------------------------------------------------------------------------- |
| `MeetupMemberChanged.v1` | `meetupId`, `userId`, `membershipStatus`                                         |
| `PreferenceUpdated.v1`   | `meetupId`, `participantId`                                                      |
| `LocationUpdated.v1`     | `ownerId`, `meetupId?`, `location.visibility` (`exact`, `approximate`, `hidden`) |
| `RecommendationReady.v1` | `meetupId`, `runId`, `placeIds`, `strategy` (`exact`, `batched`, `clustered`)    |
| `VoteUpdated.v1`         | `meetupId`, `placeId`, `voteCount`                                               |
| `MeetupFinalized.v1`     | `meetupId`, `placeId`, `scheduledAt`                                             |

`LocationUpdated.v1` chỉ truyền trạng thái location đã được project cho người xem; event contract không có trường tọa độ.

## Push deep-link data

Payload data giao cho mobile luôn có đúng ba trường nghiệp vụ:

```json
{ "type": "meetup.finalized", "meetupId": "uuid", "placeId": "uuid" }
```

Backend không phát URI deep-link. Mobile map `type` sang screen/router của chính ứng dụng. Danh sách recipient được lưu tách riêng ở metadata delivery của outbox, không nằm trong integration event.

## Firebase trong giai đoạn này

`FIREBASE_ENABLED=false` là mặc định nên local development và contract test dùng `PushNotificationAdapter`, không cần service-account và không thể gửi push ra ngoài. Khi BE-07 hiện thực device-token store/FCM adapter, bật cờ này và cung cấp đủ `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` từ secret manager.

## BE-05: latest location

- Sample được nhận qua `PublishLocationUseCase`; REST `POST /api/v1/locations` chỉ là kênh kiểm thử trước khi BE-06 gọi cùng use case từ Socket `location:update`.
- Server kiểm tra latitude/longitude hữu hạn và đúng biên, accuracy không âm/hữu hạn, `recordedAt` không ở tương lai và chưa quá 5 phút.
- `LocationAccessService.requirePublish()` luôn chạy trước khi ghi, do đó privacy thay đổi có hiệu lực ở lần publish kế tiếp.
- Chỉ Redis giữ exact latest sample tại `location:{ownerId}`, TTL 300 giây. PostgreSQL, outbox và log không có tọa độ.
- Mỗi viewer phải lấy sample qua `GetLatestLocationQuery`, vốn gọi `projectForViewer()` riêng cho viewer đó. Khi BE-06 phát Socket, gateway phải lặp theo viewer được authorize; không được broadcast exact sample chung cho room.
- Chưa có public contract của Meetups nên `MeetupLocationAdapter` từ chối toàn bộ read/publish có `meetupId`. Adapter này sẽ được thay bằng public membership/status adapter của BE-08.
