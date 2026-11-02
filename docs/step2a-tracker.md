# Bước 2A tracker — Temporal context và opening tại `scheduledAt`

Ngày bắt đầu: 30/10/2026

Trạng thái: ✅ Hoàn tất (30/10/2026; contract ETA được điều chỉnh và kiểm chứng lại 02/11/2026). Mọi dấu `[x]` đã được đối chiếu với code và bằng chứng gate thực tế.

## 1. Function, endpoint và module

- [x] 1.1 BE-28 — Temporal context và opening tại `scheduledAt` được tích hợp xuyên suốt module `recommendations`.
- [x] 1.2 `POST /api/v1/meetups/:meetupId/recommendation-runs` lấy `scheduledAt` từ meetup canonical, không nhận giá trị này từ client, và snapshot cả `requestedAt` lẫn `scheduledAt`.
- [x] 1.3 `GET /api/v1/meetups/:meetupId/recommendation-runs/:runId` so sánh thời gian meetup hiện tại với snapshot và trả `contextStatus=STALE_CONTEXT` khi khác mà không sửa ranked snapshot đã hoàn tất.
- [x] 1.4 Contract/guard dùng chung cho vote/finalize từ chối stale run; không triển khai endpoint vote/finalize của Bước 4 trước thời hạn.

## 2. Schema, DBML, migration, entity và repository

- [x] 2.1 Persist `requestedAt` và `scheduledAt` trên recommendation run bằng schema append-only.
- [x] 2.2 Persist evaluator version, opening status/evidence và fallback indicator cho từng candidate.
- [x] 2.4 Entity TypeORM, repository mapping và DBML khớp migration về tên, kiểu, nullable, index, FK và enum/check constraint.
- [x] 2.5 Migration chạy sạch trên PostgreSQL thật theo vòng `up → kiểm tra schema → down → up`.

## 3. Temporal contract và scheduled opening

- [x] 3.1 Thêm opening policy `OPEN_AT_SCHEDULED_TIME`; request tới Google Places không gửi `openNow` cho policy này.
- [x] 3.2 Places canonical contract lấy current/regular opening periods và timezone cần thiết bằng field mask có version/cost metadata.
- [x] 3.3 `ScheduledOpeningEvaluator` dùng timezone địa điểm, không dùng timezone server, và trả `OPEN`, `CLOSED` hoặc `UNKNOWN`.
- [x] 3.4 Current hours được ưu tiên khi bao phủ `scheduledAt`; fallback regular hours có evidence/cờ riêng.
- [x] 3.5 Chỉ candidate `CLOSED` bị loại; `UNKNOWN` được giữ với warning `OPENING_STATUS_UNKNOWN` và evidence.
- [x] 3.6 Candidate `CLOSED` bị loại trước Routes; `OPEN` và `UNKNOWN` tiếp tục pipeline.

## 4. ETA và stale context

- [x] 4.1 Persist và trả `etaSeconds` hợp lệ cho từng member–candidate sau route validation; đây là thời lượng di chuyển duy nhất cho UI.
- [x] 4.2 Không persist/return giờ khởi hành suy diễn; calendar integration nằm ngoài scope.
- [x] 4.3 Completed run immutable; thay đổi `scheduledAt` chỉ làm kết quả GET có `STALE_CONTEXT`, không cập nhật snapshot/ranking cũ.
- [x] 4.4 Stale-context guard có contract/test để Bước 4 dùng khi vote/finalize.

## 5. Validation, error handling và API contract

- [x] 5.1 Validate `scheduledAt`, timezone, periods và ETA; dữ liệu hours/timezone thiếu hoặc invalid trở thành `UNKNOWN`, không làm fail run hoặc bị coi là `CLOSED`.
- [x] 5.2 DTO/response/OpenAPI thể hiện opening policy, `contextStatus`, opening evidence/status, `scheduledAt`, `requestedAt` và `etaSeconds` đúng phạm vi hiện tại.
- [x] 5.3 Error/warning mapping giữ nguyên semantics idempotency và các lỗi recommendation hiện có.

## 6. Test và deliverable

- [x] 6.1 Unit test evaluator bằng fixed clock/timezone cho open, closed, overnight, 24h, thiếu/invalid hours và timezone, current-hours ưu tiên, regular-hours fallback.
- [x] 6.2 Provider contract test chứng minh `OPEN_AT_SCHEDULED_TIME` không gửi `openNow` và field mask có opening/timezone fields.
- [x] 6.3 Unit/integration test chứng minh `CLOSED` bị loại trước Routes; `UNKNOWN` được giữ với warning/evidence.
- [x] 6.4 Test ETA 1.500 giây được persist/return chính xác; không có field/cột giờ khởi hành suy diễn.
- [x] 6.5 Repository/integration test trên PostgreSQL thật đối chiếu temporal/opening snapshot và ETA.
- [x] 6.6 E2E tạo run, đổi `scheduledAt`, GET trả stale; ranked snapshot không đổi; stale guard chặn vote/finalize contract.
- [x] 6.7 Integration/E2E chạy hai lần liên tiếp, không flaky và không phụ thuộc thứ tự.

## 7. Exit gate nguyên văn từ plan

- [x] 7.1 `OPEN_AT_SCHEDULED_TIME` không gửi `openNow`; fixture open/closed/overnight/24h trả đúng `OPEN/CLOSED` theo timezone địa điểm.
- [x] 7.2 Thiếu/invalid hours hoặc timezone trả `UNKNOWN`, candidate vẫn còn và có `OPENING_STATUS_UNKNOWN`.
- [x] 7.3 Candidate `CLOSED` bị loại trước weather/Routes mới; `OPEN` được giữ.
- [x] 7.4 ETA từng member được persist/return đúng; output và schema không chứa giờ khởi hành suy diễn.
- [x] 7.5 Đổi `scheduledAt` sau completed run làm GET trả `STALE_CONTEXT`; ranked snapshot không bị sửa và stale run bị chặn ở vote/chốt.
- [x] 7.6 Migration cycle, lint/unit/integration/E2E/build pass.

## 8. Kiểm toán cuối

- [x] 8.1 Đối chiếu lại từng dòng checklist Bước 2A với code thực tế.
- [x] 8.2 Build, lint, typecheck, toàn bộ unit, integration và E2E thoát mã 0.
- [x] 8.3 Grep `TODO|FIXME|not implemented|skip|xit|it.skip|only(` trong phạm vi sửa đổi không còn finding.
- [x] 8.4 Cập nhật `13_implementation_plan.md`: trạng thái, evidence từng exit gate, file sửa/tạo, giả định, vấn đề cần quyết định và bàn giao Bước 3.

## Bằng chứng gate

- `npm run lint` → exit `0`.
- `npm run build` → exit `0`; `npm run typecheck` → exit `0`.
- `npm test -- --runInBand` → `46/46` suites, `203/203` tests pass sau khi xóa test/hàm giờ khởi hành suy diễn.
- `npm run test:integration` chạy hai lần liên tiếp trên PostgreSQL 18 cô lập → mỗi lần `2/2` suites, `14/14` tests pass; test recommendation riêng gồm schema assertions, legacy backfill và migration `up → down → up`.
- `npm run test:e2e -- --runInBand` chạy hai lần liên tiếp trên PostgreSQL 18 + Memurai 8.1.240 thật, Google mock tại HTTP boundary → mỗi lần `6/6` suites, `57/57` tests pass.
- Source audit regex trong toàn bộ `.ts/.dbml` đã sửa → `0` finding; `git diff --check` → exit `0`.

## Giả định

- [Giả định] Run được tạo trước migration Bước 2A không có temporal snapshot gốc để khôi phục chính xác. Migration backfill `requested_at=created_at`, `scheduled_at_snapshot=meetup.scheduled_at` hiện tại, `opening_filter=ANY`, version `legacy-pre-temporal-v1`/`not-applied` và warning `LEGACY_TEMPORAL_CONTEXT_BACKFILL`; freshness guard luôn coi các run legacy này là `STALE_CONTEXT` để không cho vote/chốt trên dữ liệu suy đoán. Run mới vẫn dùng version scheduled-opening chính thức.

## Vấn đề cần quyết định

- Chưa ghi nhận.
