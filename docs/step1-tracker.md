# Step 1 tracker — BE-14 và BE-15

> Nguồn: `docs/13_implementation_plan.md`, Mục 5.2.  
> Trạng thái: ✅ Hoàn tất ngày 27/10/2026.

## Exit-gate workstreams (kiểm toán 27/10/2026)

- [x] 1. TypeORM repository thật và API synchronous POST/GET.
- [x] 2. ContextBuilder áp dụng privacy, freshness, validation và location projection.
- [x] 3. Google adapter phân trang, budget, retry/timeout và lỗi giữa chừng.
- [x] 4. DBML đồng bộ hoàn toàn với entity và migration.
- [x] 5. Migration cycle trên PostgreSQL thật: up → down → up.
- [x] 6. Integration/E2E qua HTTP và database thật, lặp hai lần.
- [x] 7. Full quality gate: build, lint, typecheck, unit, integration, E2E, migration và source audit.

Các mục con đã đóng: entity run/candidate, repository constraint mapping, GET authorization,
provider page metadata, terminal failure persistence, database fixture isolation và evidence commands.

## Function, endpoint và module

- [x] 1. `RecommendationsModule` theo layering `presentation → application → domain`; các port, DTO và adapter tách riêng.
- [x] 2. BE-14 `POST /api/v1/meetups/:meetupId/recommendation-runs` synchronous, validated request, context, persistence/idempotency và error mapping.
- [x] 3. BE-14 `GET /api/v1/meetups/:meetupId/recommendation-runs/:runId` trả đúng run đã persist và kiểm quyền.
- [x] 4. BE-14 migration append-only, TypeORM entity/repository, unique `(meetup_id, request_id)`, DBML cùng schema.
- [x] 5. BE-15 place-provider port/Google adapter, mapping versioned, deterministic multi-category retrieval/pagination trong budget.
- [x] 6. BE-15 merge/dedup/filter/medoid context, lifecycle run failure và candidate snapshot persistence.

## Checklist triển khai từ plan

- [x] 7. Tạo bounded module `recommendations` theo layering hiện có; định nghĩa orchestrator, context builder, ports và DTO trước adapter.
- [x] 8. BE-14 validate actor, meetup state, UUID `requestId`, `topK`, radius, distinct categories và `openingFilter`; output là `ValidatedRecommendationRequest`.
- [x] 9. Thêm idempotency unique `(meetup_id, request_id)` và `payload_hash`; same key/same payload trả run cũ, different payload trả 409 `IDEMPOTENCY_KEY_REUSED`.
- [x] 10. Context chỉ nhận accepted member có quyền chia sẻ, latest location chưa stale và dữ liệu tọa độ/accuracy/timestamp hợp lệ; sort member theo `participantId`; dưới 2 member trả `INSUFFICIENT_VALID_MEMBERS`.
- [x] 11. Snapshot `rankingStrategy`, `algorithmVersion`, `configVersion`, `featureSchemaVersion` và provider/category mapping version; `recommendationMode` không là input organizer.
- [x] 12. BE-15 tạo query deterministic cho từng required category với ANY/OR; Text Search có một `includedType`, strict type và optional `openNow` tại request time.
- [x] 13. Phân trang round-robin trong `providerCallBudget`; union/dedup `canonicalCandidateKey`; giữ source category/page metadata.
- [x] 14. Residual hard filter required field, exact radius, category/policy/business status; không hard-filter `avoid`, rating/opening thiếu.
- [x] 15. First page lỗi sau retry: `PLACE_SEARCH_UNAVAILABLE`; không còn candidate: `NO_ELIGIBLE_CANDIDATES`.
- [x] 16. Adapter không ghi database/đổi run state; engine chỉ dùng canonical provider contract.

## Deliverable

- [x] 17. RecommendationModule, run/context contracts, place-provider port/adapter.
- [x] 18. Migration append-only run/idempotency/candidate snapshot; DBML cập nhật.
- [x] 19. POST/GET run API theo Q3/Q5.
- [x] 20. Unit, adapter contract, integration và E2E tests.

## Exit gate

- [x] 21. Same requestId/same payload không tạo run thứ hai; different payload trả 409 đúng code.
- [x] 22. 0/1 valid member trả `INSUFFICIENT_VALID_MEMBERS`; stale/unauthorized/invalid location không lọt context.
- [x] 23. Multi-category deterministic; merge không duplicate canonical key; backend exact-radius filter.
- [x] 24. `avoid` không bị loại; `OPEN_AT_REQUEST_TIME` chỉ dùng `openNow` khi request.
- [x] 25. Provider first-page failure và empty candidates chuyển run `FAILED` với đúng code.
- [x] 26. Migration database rỗng; DBML cùng schema; lint/unit/integration/E2E/build pass.
- [x] 27. Không hard-code production values: validation mechanism/versioning dùng `recommendation-config-dev-v1` theo Q10.

## Kiểm toán cuối

- [x] 28. Mở lại từng item tracker, đối chiếu code thực tế.
- [x] 29. Chạy đầy đủ lệnh exit gate và ghi evidence.
- [x] 30. Rà `TODO|FIXME|not implemented|skip|xit|it.skip|only(` trong phần Bước 1 đã sửa; không còn kết quả vi phạm.

## Evidence cuối

| Kiểm chứng | Kết quả ngày 27/10/2026 |
|---|---|
| `npm run build` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `npx eslint "{src,apps,libs,test}/**/*.ts"` | Exit 0 |
| `npm test -- --runInBand` | 39 suite, 166 test pass |
| `npm run test:integration -- --runInBand` × 2 | Mỗi lần 2 suite, 13 test pass trên PostgreSQL thật |
| `npm run test:e2e -- --runInBand` × 2 | Mỗi lần 6 suite, 51 test pass qua HTTP app thật, PostgreSQL và Redis; Google giả lập tại HTTP boundary |
| `npm run migration:run` → kiểm tra schema → `npm run migration:revert` → kiểm tra drop → `npm run migration:run` | Exit 0; sau mỗi up: `recommendation_runs` 15 cột, `recommendation_candidates` 14 cột; sau down: cả hai relation không tồn tại |
| Source audit bằng `rg` trên source/migration/test Bước 1 | 0 finding |

**[Giả định].** PostgreSQL/Redis test dùng cùng image và config của `compose.yaml`, đổi host port sang
`55432`/`56379` để tránh xung đột dịch vụ cục bộ; port mặc định của dự án không đổi.

**Vấn đề cần quyết định.** Không còn vấn đề chặn Bước 1. Các ngưỡng production chưa được phê duyệt
vẫn giữ ngoài scope; dev/staging dùng config có version theo Q10.
