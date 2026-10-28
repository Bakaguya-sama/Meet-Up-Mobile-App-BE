# Step 2 tracker — BE-16, BE-17 và BE-22

> Nguồn chính: `docs/13_implementation_plan.md`, Mục 5.3.  
> Trạng thái: ✅ hoàn tất; kiểm toán và đóng exit gate ngày 28/10/2026.
> Tiền điều kiện: Bước 1 đã ✅ Hoàn tất ngày 27/10/2026.

## Function, module và phạm vi

- [x] 1. BE-16 — Route Matrix và route validation.
- [x] 2. BE-17 — Feature và member utility.
- [x] 3. BE-22 — Group ranking và fairness.
- [x] 4. Nối Bước 2 vào recommendation-run pipeline hiện có mà không triển khai API kết quả/explanation của Bước 3.

## Checklist triển khai nguyên văn từ plan

- [x] 5. BE-16 tạo `RouteBatchPlanner` chia cả origins và destinations theo element/waypoint limit; giữ index mapping sau khi ghép batch.
- [x] 6. Gọi ComputeRouteMatrix với `TWO_WHEELER`; validate duration/distance hữu hạn, không âm; element lỗi thành `NO_ROUTE`.
- [x] 7. Loại candidate nếu bất kỳ valid member thiếu route; toàn batch lỗi trả `ROUTE_MATRIX_UNAVAILABLE`; không còn candidate trả `NO_ROUTABLE_CANDIDATES`; thiếu K dùng `effectiveK` và warning, không bịa ETA.
- [x] 8. BE-17 dựng feature schema có version và tính `T`, `P`, `Q`, `U` đúng thứ tự sau route validation.
- [x] 9. Validate mọi input/config hữu hạn; utility nằm `[0,1]`; `tauSeconds > 0`; tag weights dương; `alpha+beta+gamma=1`; missing policy tránh chia 0.
- [x] 10. `avoid` dùng `s(avoid)` như soft penalty, không hard filter. Preference meetup ưu tiên profile fallback theo tag.
- [x] 11. BE-22 hiện thực `min-sum`, `min-max`, `fair-pareto-v1`; tính `G`, candidate least-misery `F`, member rank, Pareto level và Monte Carlo inclusion probability.
- [x] 12. Tie-break deterministic theo strategy, seed, `utilityTieEpsilon` và `canonicalCandidateKey`; lưu full ranking, không chỉ top-K.
- [x] 13. Không gọi implementation này là XPO nguyên bản; tên production strategy là `fair-pareto-v1`.

## Deliverable nguyên văn từ plan

- [x] 14. Route provider port/adapter, batch planner và element assembler.
- [x] 15. Versioned FeatureBuilder, MemberUtilityScorer và GroupRanker.
- [x] 16. Golden test vectors tính tay cho công thức và ranking.
- [x] 17. Cost/element metadata để Bước 5 quan sát.

## Các lớp bắt buộc theo kiến trúc

- [x] 18. Domain/application contracts cho route element, feature, utility, ranking, warning và version snapshot.
- [x] 19. Google Routes HTTP adapter chỉ ở external boundary; timeout/retry/error mapping và response out-of-order.
- [x] 20. TypeORM entity/repository thật cho route/feature/full-ranking snapshot; DBML và migration khớp.
- [x] 21. Orchestrator/service nối đúng thứ tự route → feature → utility → rank → persist.
- [x] 22. DTO/response/error mapping chỉ mở rộng contract Bước 2 cần thiết; không làm trước Bước 3.
- [x] 23. Unit, adapter contract, repository integration và HTTP E2E chạy DB thật; Google Routes mock tại HTTP boundary.

## Exit gate nguyên văn từ plan

- [x] 24. Test matrix nhiều batch chứng minh mọi `(participantId, canonicalCandidateKey)` được join đúng một lần, không đảo index.
- [x] 25. Candidate có một `NO_ROUTE` bị loại; còn ít hơn K trả `effectiveK` và warning; không có route nào trả đúng failure code.
- [x] 26. Golden tests khớp ví dụ Doc 12: `T≈0.607` với 600/1200; `P=0.55` với high+avoid; `Q=0.6` với 4.5/99/999; `U=0.5892` với 0.60/0.30/0.10.
- [x] 27. Test reject `tauSeconds<=0`, negative/NaN/Infinity, invalid rating/review, weight sum sai và `S<=0`.
- [x] 28. Cùng snapshot/version/seed tạo cùng full rank; test matrix nhỏ tính tay cho `min-sum`, `min-max`, Pareto dominance và tie-breaker.
- [x] 29. Không candidate nào trong ranking thiếu route OK cho một valid member; utility đều hữu hạn và trong `[0,1]`.
- [x] 30. Lint/unit/integration/E2E/build pass.
- [x] 31. `tauSeconds`, utility weights, `p_missing`, `q_missing`, `n_ref`, sample count và epsilon chỉ dùng config có version; không coi dev/test values là production-approved.

## Kiểm toán cuối

- [x] 32. Duyệt lại từng dòng checklist gốc với code thực tế.
- [x] 33. Chạy build, lint, typecheck, toàn bộ unit/integration/E2E và migration cycle nếu schema đổi; mọi lệnh exit 0.
- [x] 34. Chạy integration/E2E hai lần liên tiếp, không flaky và không phụ thuộc thứ tự.
- [x] 35. Rà `TODO|FIXME|not implemented|skip|xit|it.skip|only(` trong phần Bước 2; không còn vi phạm.

## Vấn đề cần quyết định

- Production values/approver cho `q_missing`, `n_ref`, Monte Carlo sample count và
  `utilityTieEpsilon` chưa được nguồn chốt. Việc triển khai chỉ dùng dev/test config có version,
  không tuyên bố production approval.

## Bằng chứng đóng gate ngày 28/10/2026

- `npm.cmd run build`, `npm.cmd run typecheck`, `npx.cmd eslint "{src,apps,libs,test}/**/*.ts"`: exit 0.
- `npm.cmd test -- --runInBand`: 44 suites, 188 tests pass.
- `npm.cmd run test:integration` chạy hai lần: mỗi lần 2 suites, 13 tests pass trên PostgreSQL thật.
- `npx.cmd jest --config ./test/jest-e2e.json --runInBand` chạy hai lần: mỗi lần 6 suites, 53 tests pass qua HTTP app thật, PostgreSQL và Redis thật; Google Places/Routes giả lập tại HTTP boundary.
- Migration thật: `npm.cmd run migration:run` → `npm.cmd run migration:revert` → `npm.cmd run migration:run`, cả ba exit 0; integration test kiểm tra schema sau up/down/up.
- Grep có word-boundary cho `TODO|FIXME|not implemented|skip|xit|it.skip|only(` trong source/test Bước 2: không có kết quả vi phạm.
