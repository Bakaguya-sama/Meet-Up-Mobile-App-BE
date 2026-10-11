# Audit và hướng khắc phục

## Phạm vi

Rà soát source hiện có theo `02_nghiep_vu_va_dac_ta.md`, `06_database_schema.dbml`, `08_huong_dan_cau_truc_ddd.md` và các contract BE-03/location privacy.

## Vấn đề và quyết định

1. **Google OAuth khởi động khi cấu hình rỗng.** OAuth là capability đã cam kết, nên môi trường không phải test phải fail-fast với thông báo cấu hình rõ ràng, thay vì để Passport ném lỗi lúc khởi tạo strategy.
2. **Thiếu `oauth_identities`.** Bổ sung migration append-only, entity/domain model, persistence port và flow login dùng `provider_account_id` làm định danh chính. Account-linking qua email chỉ được cho phép khi Google xác nhận email verified.
3. **Profile và preference không atomic.** Khi PATCH chứa cả hai, use case chạy chung một `AuthUnitOfWork` để lỗi preference rollback toàn bộ profile change.
4. **Thu hồi selected audience có race condition.** Thêm port locked-update; adapter khóa row trong transaction, nạp aggregate, gọi domain method và lưu trong cùng transaction.
5. **Documentation drift.** Đồng bộ contract khi implementation thay đổi; còn lại API Friends/README sẽ được rà soát cùng task contract riêng.

## Tiêu chí xác minh

- Unit test cho invariant và transaction behavior.
- E2E test cho API privacy.
- Build, lint, unit và e2e test đều đạt.
