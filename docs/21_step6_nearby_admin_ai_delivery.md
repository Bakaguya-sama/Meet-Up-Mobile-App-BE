# Bước 6 — Nearby, admin và AI explanation

## BE-18 — Privacy-safe nearby

`PublishLocationUseCase` lưu latest location hợp lệ vào Redis `location:{userId}` trong 300 giây rồi gọi `NearbyDetector` đối với publish không gắn meetup. Detector chỉ xét accepted friends do Friends public reader trả về. Mỗi bên phải là account active, bật `nearbyFeatureEnabled`, bật location sharing, còn hạn và cho phép phía kia theo privacy mode.

Khoảng cách Haversine `<= NEARBY_RADIUS_METERS` là inside; giá trị mặc định là `3000 m`, hợp lệ trong khoảng `100..50000`. Pair key sắp xếp hai UUID, vì vậy A–B và B–A dùng cùng `nearby-state:*` và `nearby-cooldown:*`. Lua script Redis thực hiện transition/claim nguyên tử. Inside liên tục không phát lại dù cooldown đã hết; chỉ outside rồi re-enter mới đủ điều kiện claim mới. Cooldown là 2 giờ, state là 7 ngày. Nếu transaction outbox thất bại, claim theo `eventId` được compensate an toàn.

Một transition tạo hai `NearbyFriendDetected.v1` recipient-specific trong một PostgreSQL transaction. Worker chỉ gửi sau commit. Mobile nhận `{type:'nearby.friend', friendId}`; outbox, push, metric và log không có coordinate, exact distance, address, token hay GPS history.

## BE-19 — Account administration

`POST /api/v1/admin/accounts/:accountId/lock` và `DELETE .../lock` dùng JWT guard rồi `RolesGuard('admin')`; role canonical là `user_accounts.role`. Admin use case cấm self-lock và gọi public administration port của Auth. TypeORM unit of work khóa account, đổi trạng thái, revoke toàn bộ session khi lock và ghi audit trong cùng transaction. Audit chỉ có actor/action/subject/timestamp và `{locked:boolean}`. Unlock không phục hồi session cũ.

## BE-27 — Gemini wording với deterministic fallback

`GET /api/v1/meetups/:meetupId/recommendation-runs/:runId/ai-explanations` chỉ cho accepted participant và chỉ đọc completed persisted run. Projector lấy `rank`, `summaryCode`, warning và structured explanation facts; không đọc member features, raw preference/utility, coordinate, GPS history, name/email, token hoặc provider payload.

`AiExplanationPromptBuilder` dựng system instruction và user JSON từ facts đã redact; prompt template được versioned trong source để review/test. `AI_EXPLANATION_PROMPT_VERSION` chỉ chọn version đã duyệt (`v1` hiện tại), không nhận arbitrary multi-line prompt từ env. Cache Redis `ai-explanation:{sha256}` có TTL 86400 giây. Fingerprint gồm run/snapshot, config version, provider `google-gemini`, model `gemini-2.5-flash-lite`, prompt version và schema version. External adapter mặc định tắt qua `AI_EXPLANATION_ENABLED=false`; khi bật, key chỉ đọc từ `GEMINI_API_KEY`, timeout 5000 ms và retry đúng một lần với backoff. Gemini phải trả structured JSON `{text,factKeys}`; text tối đa 1500 ký tự và mọi `factKeys` phải thuộc snapshot allow-list.

Provider disabled, timeout/network/HTTP error, invalid JSON/schema, unsupported fact, output quá dài hoặc cache lỗi đều trả rule fallback deterministic. Luồng chỉ tạo wording response/cache; không ghi recommendation run, không đổi candidate/filter/score/utility/rank/vote/selection.

## Environment

```text
AI_EXPLANATION_ENABLED=false
GEMINI_API_KEY=<required only when enabled>
AI_EXPLANATION_PROMPT_VERSION=v1
NEARBY_RADIUS_METERS=3000
```

## Bằng chứng kiểm thử

- Unit: nearby privacy/boundary/compensation; Redis-independent AI validation/cache/fallback; Gemini HTTP retry/structured response; push payload redaction.
- Integration: `test/step6.integration-spec.ts` dùng PostgreSQL + Redis thật cho pair concurrency/re-entry, account/friend/privacy/location readers, transactional outbox và AI cache TTL/corruption.
- E2E: `test/step6.e2e-spec.ts` publish HTTP đồng thời qua controller → use case → Redis → PostgreSQL outbox; `test/recommendation-runs.e2e-spec.ts` kiểm authorization/fallback/privacy/rank immutability; admin E2E/integration kiểm role, self-lock, revoke session, audit và rollback.
