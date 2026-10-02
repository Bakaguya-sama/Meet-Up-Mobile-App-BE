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
| `MeetUp_Product_Backlog_Function_Points.xlsx` | Chia việc theo Function Points, backlog và tiến độ. |

## Cách dùng nhanh

1. Đọc `01` để thống nhất phần Core, Planned và các mục chỉ làm nếu còn thời gian.
2. Dùng `02`, sơ đồ `03` và file `06` để thiết kế UI, API và cơ sở dữ liệu.
3. Điền tên thành viên vào sheet `Phan cong` của Excel, sau đó chia các hạng mục theo FP.
4. Trước mỗi sprint, kéo các hạng mục `Sẵn sàng` từ sheet `Backlog` sang công việc sprint.

## Phạm vi khuyến nghị để làm chắc

Phạm vi triển khai gồm Android, một thành phố, di chuyển bằng xe máy/ô tô theo dữ liệu Google Routes, meetup có số thành viên linh hoạt và chia sẻ vị trí bằng một cờ chung trong hồ sơ. Thành viên meetup đã chấp nhận sẽ tự được dùng vị trí hợp lệ khi cờ này bật. Sau phần lõi, nhóm sẽ triển khai: lọc đang mở cửa, địa điểm yêu thích, lịch sử meetup, ETA từng thành viên, dẫn đường, chat nhóm, AI giải thích đề xuất và phát hiện bạn bè ở gần.

Meetup không giới hạn số thành viên ở cấp sản phẩm. Engine gợi ý tự chọn cách tính theo quy mô: tối đa 20 người tính ETA chính xác; 21–50 người chạy theo batch; trên 50 người gom cụm vị trí trước rồi tính chi tiết cho các địa điểm tốt nhất. Hệ thống dùng một cách xếp hạng cố định, cân bằng ETA, sở thích meetup và rating.

Sở thích profile chỉ là giá trị mặc định. Khi tạo hoặc nhận meetup, mỗi người chọn sở thích tạm thời cho meetup; lựa chọn này là dữ liệu chính để xếp hạng.

Budget filter và PricePenalty không nằm trong phạm vi vì `priceLevel` của Google Places là mức phân loại tham khảo, không đủ đáng tin để quyết định hoặc hạ hạng địa điểm. Giọng nói và gợi ý theo thời tiết vẫn là phần mở rộng. AI chỉ nhận dữ liệu tổng hợp của nhóm và kết quả xếp hạng; không gửi tọa độ chính xác hoặc lịch sử GPS cho dịch vụ AI.
