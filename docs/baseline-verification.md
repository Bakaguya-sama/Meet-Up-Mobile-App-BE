# Baseline verification — Bước 0

> Hoàn tất: 27/10/2026
>
> Phạm vi: BE-01 đến BE-09 và BE-13 của `13_implementation_plan.md`.

## Evidence theo function

| BE | Acceptance criterion đã kiểm chứng | Evidence |
|---|---|---|
| BE-01 | JWT access/refresh hợp lệ, refresh-token reuse thu hồi cả family, account bị khóa không đăng nhập. | `src/bounded-contexts/auth/application/use-cases/session-flows.use-case.spec.ts`; `user-account.aggregate.spec.ts` |
| BE-02 | Profile preference chỉ là prefill, không thay preference meetup. | `update-profile.use-case.spec.ts`; `meetup-preferences.use-cases.spec.ts`; `profile-preference-fallback.adapter.spec.ts` |
| BE-03 | Pair canonical, cấm self/duplicate và contract response nhất quán. | `friendship.aggregate.spec.ts`; `send-friend-request.use-case.spec.ts`; `friends.e2e-spec.ts`. DB unique pair/locking được định nghĩa trong migration/repository; không có PostgreSQL concurrency test trong baseline này. |
| BE-04 | `off`, `friends`, `selected_friends`, `meetup_only`; quyền được đọc lại trên mỗi request, không cache. | `privacy-settings.aggregate.spec.ts`; `location-access.service.spec.ts`; `privacy.e2e-spec.ts` |
| BE-05 | Location hữu hạn/fresh, privacy trước ghi, latest location Redis TTL 300 giây, không persistence GPS. | `publish-location.use-case.spec.ts`; `redis-location.adapter.spec.ts`; `location-access.service.spec.ts` |
| BE-06 | Handshake JWT, room từ chối non-member, presence và publisher shared contract. | `location.gateway.spec.ts`; `realtime-publisher.adapter.spec.ts` |
| BE-07 | AES-256-GCM/Fingerprint, token revoke, outbox delivery sau transaction, retry exponential tối đa 5. | `aes-device-token-cipher.spec.ts`; `device-token.use-cases.spec.ts`; `outbox-worker.service.spec.ts`; `outbox-worker.service.ts` |
| BE-08 | Meetup lifecycle/member invariant; `recommendationMode` không còn nhận/trả ở API BE-08. | `meetup.aggregate.spec.ts`; `meetups.e2e-spec.ts`; contract DTO/OpenAPI. Cột legacy vẫn lưu nội bộ với giá trị cố định `balanced` để tương thích schema hiện hữu. |
| BE-09 | Preference meetup thay profile theo tag; fallback khi thiếu; `avoid` được giữ nguyên. | `meetup-preferences.use-cases.spec.ts`; `meetup.aggregate.spec.ts` |
| BE-13 | Candidate-only `POST /api/v1/meetups/:meetupId/recommendations/candidates`, adapter Google Places, auth/state/errors; không xếp hạng theo provider order. | `find-place-candidates.use-case.spec.ts`; `google-places.adapter.spec.ts`; `recommendations.e2e-spec.ts`; `recommendations.controller.ts` |

## Exit-gate commands

| Command | Actual result |
|---|---|
| `npm run lint` | Exit code 0 |
| `npm test -- --runInBand` | 34 suites passed, 149 tests passed |
| `npm run test:e2e -- --runInBand` | 5 suites passed, 47 tests passed |
| `npm run build` | Exit code 0 |

`test:e2e` was run with localhost socket permission because the sandbox blocks Supertest's temporary listener with `EACCES`; the allowed execution passed.

## Contracts locked for subsequent steps

- BE-13 remains `POST /api/v1/meetups/:meetupId/recommendations/candidates` and is candidate-only.
- Public REST and realtime contracts remain under `/api/v1` and versioned integration-event names.
- BE-08 does not expose an organizer-selectable recommendation strategy; a later recommendation run persists server-selected `rankingStrategy` as defined by plan Q2.

## Assumption

- **[Giả định]** The legacy `meetup_sessions.recommendation_mode` column is retained as a fixed internal compatibility value until the append-only recommendation schema migration of a later step. Removing it now would exceed Bước 0 and require a data migration; it is no longer accepted, documented, or returned by the BE-08 API.
