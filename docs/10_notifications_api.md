# BE-07 — Thiết bị & FCM

## Bảo mật token

FCM registration token là dữ liệu nhạy cảm. Backend chỉ nhận token qua HTTPS, mã hóa AES-256-GCM trước khi lưu và không trả token trong response, event, error hoặc log. `DEVICE_TOKEN_ENCRYPTION_KEY` phải là khóa 32 byte được mã hóa Base64 và được giữ ngoài Git.

Để phát hiện token trùng mà không lưu plaintext, bảng `device_tokens` giữ thêm HMAC-SHA-256 của token. Cùng token đăng ký lại sẽ được gán cho account hiện tại, nhằm xử lý trường hợp người dùng đăng xuất rồi đăng nhập account khác trên cùng thiết bị.

## API

Mọi endpoint yêu cầu `Authorization: Bearer <accessToken>`.

| Method | Path                                | Body                          | Kết quả      |
| ------ | ----------------------------------- | ----------------------------- | ------------ |
| POST   | `/api/v1/notifications/devices`     | `{ token, platform: "android" | "ios" }`     | `201 { id }` |
| PUT    | `/api/v1/notifications/devices/:id` | `{ token, platform }`         | `200 { id }` |
| DELETE | `/api/v1/notifications/devices/:id` | —                             | `204`        |

`id` là UUID opaque để mobile lưu cục bộ. Không truyền token qua URL. Cập nhật/thu hồi token của account khác trả lỗi quyền truy cập.

## Outbox và FCM

Outbox worker chỉ gửi push sau khi transaction nghiệp vụ đã commit. BullMQ retry tối đa 5 lần với exponential backoff; `attempt_count`, `last_error` và trạng thái outbox ghi lại lần giao hàng. Lỗi Firebase chỉ được đổi thành thông báo tổng quát trước khi đi vào outbox để không lộ thông tin token/provider.

Khi Firebase trả `messaging/registration-token-not-registered` hoặc `messaging/invalid-registration-token`, token bị revoke và event vẫn có thể hoàn tất; retry sẽ không giúp token không còn hợp lệ. Các lỗi khác được ném lại để worker retry.

Payload deep-link chỉ gồm:

```json
{
  "type": "meetup.finalized",
  "meetupId": "uuid",
  "placeId": "uuid-optional"
}
```

BE-07 chỉ là nền tảng gửi notification. Backend sở hữu Meetup/Vote sẽ ghi outbox event và quyết định thời điểm gửi.
