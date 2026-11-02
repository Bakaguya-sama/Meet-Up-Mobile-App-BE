# Outbox và integration event

Thư mục này chứa contract dùng chung cho event phát sau khi transaction nghiệp vụ đã commit. Các bounded context không tự gửi Socket, FCM hoặc side effect ngoài transaction; chúng ghi event vào outbox và worker giao event sau commit.

| Tài liệu | Nội dung |
|---|---|
| `realtime_event_contracts.md` | Versioning, event schema, room authorization, outbox retry/idempotency và notification deep-link payload. |
| `notifications_api.md` | Device token API, mã hóa/Fingerprint token FCM, policy retry/revoke và payload push. |

Hai tài liệu dùng chung outbox worker nhưng tách vai trò: `notifications_api.md` quy định vòng đời device token/FCM, còn `realtime_event_contracts.md` quy định event và delivery contract xuyên bounded context.
