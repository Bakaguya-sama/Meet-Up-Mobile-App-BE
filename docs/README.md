# Tài liệu đồ án MeetUp

Bộ tài liệu này chuyển đề cương “Ứng dụng kết nối bạn bè và gợi ý địa điểm gặp mặt theo vị trí thời gian thực” thành phần việc có thể thiết kế, lập trình và kiểm thử.

Các tài liệu dùng thuật ngữ tiếng Việt khi có thể. Những tên kỹ thuật cần giữ nguyên được ghi ngắn gọn: GPS, API, Socket.IO, Redis, FCM và PlantUML.

| Tài liệu | Dùng khi nào |
|---|---|
| `01_danh_gia_pham_vi.md` | Chốt phạm vi và giải thích sự phù hợp với môn Pervasive and Mobile Computing. |
| `02_nghiep_vu_va_dac_ta.md` | Thiết kế luồng nghiệp vụ, quy tắc và đặc tả use case. |
| `03_usecase_users.puml` | Dán vào PlantUML để tạo sơ đồ use case của người dùng. |
| `07_usecase_admin.puml` | Dán vào PlantUML để tạo sơ đồ use case của quản trị viên. |
| `04_product_backlog.md` | Theo dõi backlog theo sprint, tiêu chí hoàn thành và phụ thuộc. |
| `05_ke_hoach_kiem_thu.md` | Chuẩn bị demo và đo các điểm “pervasive” quan trọng. |
| `06_database_schema.dbml` | Dán vào dbdiagram.io để xem mô hình dữ liệu PostgreSQL/PostGIS và ranh giới dữ liệu Redis TTL. |
| `08_huong_dan_cau_truc_ddd.md` | Quy ước bounded context, layer, dependency, domain model và quy trình phát triển backend theo DDD. |
| `09_cong_nghe_su_dung.md` | Stack kỹ thuật, chiến lược Neon/Redis, Docker Compose, biến môi trường và cách triển khai theo từng môi trường. |
| `MeetUp_Product_Backlog_Function_Points.xlsx` | Chia việc theo Function Points, backlog và tiến độ. |
| `friends/friends_api.md` | API kết bạn BE-03, quy tắc concurrency, migration, QR hybrid và kiểm thử. |
| `chat/chat_api.md` | Contract chat meetup/direct hợp nhất, idempotency, attachment, quyền lịch sử và realtime recovery. |
| `11_location_privacy_api.md` | Cài đặt quyền riêng tư vị trí, kiểm quyền mỗi yêu cầu và contract cho realtime. |
| `outbox_event/notifications_api.md` | Đăng ký thiết bị FCM, mã hóa token, outbox retry và contract deep-link notification. |
| `outbox_event/realtime_event_contracts.md` | Contract integration event có version, Socket room, outbox, retry/idempotency và notification payload. |
| `13_backend2_roadmap.md` | Roadmap triển khai Backend 2: realtime, recommendation, FCM, AI, nearby và quan sát hệ thống. |
| `11_backend_integration_handoff.md` | Handoff giữa hai developer backend: owner, contract, outbox, migration và nhật ký phối hợp. |
| `12_meetup_group_recommendation_engine.md` | Thiết kế kỹ thuật recommendation pipeline, fairness ranking, feedback logging và lộ trình offline learning/LTR. |
| `13_implementation_plan.md` | Thứ tự triển khai, dependency, exit gate và quyết định đã khóa cho toàn bộ function backend. |
| `18_be11_be19_be20_delivery.md` | API, ranh giới context và lưu ý triển khai cho BE-11, BE-19, BE-20. |
| `19_be10_voting_delivery.md` | Contract vote/finalize theo displayed run, transactional outbox và bằng chứng Bước 4. |
| `20_be12_meetup_history.md` | API lịch sử meetup, quyền xem và snapshot địa điểm đã chốt theo BE-12. |

## Cách dùng nhanh

1. Đọc `01` để thống nhất phần Core, Planned và các mục chỉ làm nếu còn thời gian.
2. Dùng `02`, sơ đồ `03` và file `06` để thiết kế UI, API và cơ sở dữ liệu.
3. Điền tên thành viên vào sheet `Phan cong` của Excel, sau đó chia các hạng mục theo FP.
4. Trước mỗi sprint, kéo các hạng mục `Sẵn sàng` từ sheet `Backlog` sang công việc sprint.

## Phạm vi khuyến nghị để làm chắc

Phạm vi triển khai gồm Android, một thành phố, di chuyển bằng xe máy/ô tô theo dữ liệu Google Routes, meetup có số thành viên linh hoạt và chia sẻ vị trí bằng một cờ chung trong hồ sơ. Thành viên meetup đã chấp nhận sẽ tự được dùng vị trí hợp lệ khi cờ này bật. Sau phần lõi, nhóm sẽ triển khai: lọc đang mở cửa, địa điểm yêu thích, lịch sử meetup, ETA từng thành viên, dẫn đường, chat nhóm, AI giải thích đề xuất và phát hiện bạn bè ở gần.

Meetup không giới hạn số thành viên ở cấp sản phẩm. Engine v1 không gom cụm hoặc thay ETA thật bằng ước lượng: Route Matrix được chia batch theo cả chiều origin và destination, và run có thể bị từ chối theo giới hạn/cost policy nếu không thể tạo ETA hợp lệ cho mọi thành viên. Công thức xếp hạng có version, baseline và hướng đánh giá được mô tả trong `12_meetup_group_recommendation_engine.md`.

Các quyết định mở rộng đã khóa gồm: địa điểm còn mở nhưng sắp đóng chỉ bị cảnh báo và hạ hạng mềm; mọi participant được thấy ETA nhưng chỉ thấy preference/utility của chính mình; cùng GET recommendation run được dùng trước và sau vote. Link mời meetup dùng token hash bền vững có expiry/revoke. QR kết bạn dùng hybrid giữa public handle ổn định và phiên tạm thời Redis TTL; không lưu ảnh QR và không tự kết bạn khi quét.

Sở thích profile chỉ là giá trị mặc định. Khi tạo hoặc nhận meetup, mỗi người chọn sở thích tạm thời cho meetup; lựa chọn này là dữ liệu chính để xếp hạng.

Budget filter và PricePenalty không nằm trong phạm vi vì `priceLevel` của Google Places là mức phân loại tham khảo, không đủ đáng tin để quyết định hoặc hạ hạng địa điểm. Giọng nói và gợi ý theo thời tiết vẫn là phần mở rộng. AI chỉ nhận dữ liệu tổng hợp của nhóm và kết quả xếp hạng; không gửi tọa độ chính xác hoặc lịch sử GPS cho dịch vụ AI.
# Chat media configuration

Set `CLOUDINARY_ENABLED=true` and provide `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` to enable image/file uploads. Keep the API secret only in the backend environment. With the flag unset or false, text chat remains available and file uploads return a service-unavailable response. The backend stores assets as authenticated Cloudinary resources and returns signed download links that expire after 15 minutes. If the Cloudinary product environment blocks PDF/archive delivery, allow those delivery formats in the Cloudinary security settings.
