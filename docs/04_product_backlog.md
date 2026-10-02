# Product backlog MeetUp

## Quy ước

- **Ưu tiên:** Core = luồng bắt buộc làm trước; Planned = chức năng đã cam kết triển khai sau Core; Could = chỉ làm nếu còn thời gian.
- **Điểm:** Story point dùng để lập sprint. Function Point trong Excel dùng để nhìn khối lượng chức năng và chia người.
- **Hoàn thành:** code qua review, test chính chạy, lỗi nghiêm trọng đã xử lý và có thể demo trên Android.

| ID | Hạng mục | Ưu tiên | Story point | Tiêu chí chấp nhận ngắn | Phụ thuộc |
|---|---|---:|---:|---|---|
| PB-01 | Đăng ký/đăng nhập Email và Google | Core | 8 | Tạo phiên, đăng xuất, xử lý lỗi xác thực | Backend, mobile |
| PB-02 | Hồ sơ, JWT và refresh token | Core | 5 | Sửa tên/ảnh; token hết hạn được làm mới an toàn | PB-01 |
| PB-03 | Gửi/nhận lời mời bạn bè | Core | 8 | Không trùng lời mời; accept/reject cập nhật hai phía | PB-01 |
| PB-04 | Danh sách và tìm kiếm bạn bè | Core | 5 | Tìm theo tên/email; chỉ hiện tài khoản hợp lệ | PB-03 |
| PB-05 | Xin quyền GPS và trạng thái quyền | Core | 5 | Giải thích khi từ chối/tắt GPS; có thử lại | PB-01 |
| PB-06 | Cài đặt quyền chia sẻ vị trí | Core | 8 | Có 4 chế độ, thời hạn, vị trí gần đúng | PB-05 |
| PB-07 | Gửi/nhận vị trí realtime có TTL | Core | 13 | Socket xác thực; Redis TTL; chỉ người được phép nhận | PB-06 |
| PB-08 | Bản đồ bạn bè và nhãn vị trí cũ | Core | 8 | Ghim, updatedAt, accuracy, nhãn cũ sau 5 phút | PB-07 |
| PB-09 | Tạo/sửa/hủy meetup và quản lý thành viên | Core | 13 | Không giới hạn thành viên; thời gian, trạng thái và lời mời rõ | PB-03 |
| PB-10 | Lời mời và phản hồi meetup | Core | 5 | Accept/reject; người tạo nhận cập nhật realtime | PB-09 |
| PB-11 | Dùng vị trí thành viên trong meetup | Core | 8 | Thành viên `accepted` đã bật chia sẻ trong hồ sơ được dùng; tự dừng phát vào room khi rời/hủy/kết thúc | PB-06, PB-09 |
| PB-12 | Tìm địa điểm theo loại/bán kính | Core | 8 | Trả top 5 có tên, rating, trạng thái giờ mở cửa nếu có | PB-09 |
| PB-13 | ETA, sở thích meetup và xếp hạng công bằng | Core | 21 | Profile chỉ prefill; preference trong meetup là chính; xử lý 3 mức quy mô | PB-07, PB-09, PB-12 |
| PB-14 | Vote realtime và chốt địa điểm | Core | 8 | Một vote/người; đổi trước hạn; người tạo chốt | PB-10, PB-13 |
| PB-15 | FCM cho lời mời, chốt, nhắc lịch | Core | 8 | Chạm thông báo mở đúng màn hình | PB-09, PB-14 |
| PB-16 | Lọc địa điểm đang mở cửa | Planned | 3 | Chỉ lọc khi Places có dữ liệu giờ mở | PB-12 |
| PB-17 | Dẫn đường và lịch sử meetup | Planned | 5 | Mở Google Maps; xem meetup đã kết thúc | PB-14 |
| PB-18 | Lưu địa điểm yêu thích | Planned | 3 | Thêm/xóa, không trùng | PB-12 |
| PB-19 | Group chat trong meetup | Planned | 8 | Chỉ thành viên được đọc/gửi tin realtime | PB-09 |
| PB-20 | AI giải thích đề xuất | Planned | 8 | Không gửi tọa độ/hồ sơ không cần thiết cho AI | PB-13 |
| PB-21 | Phát hiện bạn bè đang ở gần | Planned | 8 | Cả hai opt-in, không lộ vị trí chính xác, giới hạn 2 giờ | PB-07 |
| PB-22 | Admin tối giản và báo cáo người dùng | Planned | 5 | Khóa tài khoản, xem số liệu cơ bản | PB-01 |
| PB-23 | Đo độ trễ, pin, privacy và load test | Core | 8 | Có log, kịch bản test, kết quả demo | PB-07, PB-13 |
| PB-24 | Weather hoặc voice meetup | Could | 13 | Chỉ chọn một tính năng nếu toàn bộ Planned đã ổn | PB-13 |

## Sprint đề xuất 12 tuần

| Sprint | Tuần | Mục tiêu có thể demo | Backlog chính |
|---|---:|---|---|
| 0 | 1 | Scope, prototype UI, kiến trúc, CI | Thiết kế, môi trường, PB-19 chuẩn bị log |
| 1 | 2–3 | Vào app và kết bạn | PB-01 đến PB-04 |
| 2 | 4–5 | Xin quyền, chia sẻ và xem vị trí an toàn | PB-05 đến PB-08 |
| 3 | 6–7 | Tạo meetup, mời và chia sẻ theo meetup | PB-09 đến PB-11 |
| 4 | 8–9 | Top địa điểm có ETA công bằng | PB-12 đến PB-13 |
| 5 | 10 | Vote, chốt, FCM, lọc đang mở cửa và lịch sử | PB-14 đến PB-18 |
| 6 | 11 | Chat, AI giải thích, phát hiện bạn ở gần | PB-19 đến PB-21 |
| 7 | 12 | Admin, kiểm thử, sửa lỗi, Docker, demo | PB-22, PB-23, deployment |

## Definition of Done

Một hạng mục chỉ “Done” khi có API contract hoặc UI rõ ràng, kiểm tra quyền ở backend, test tối thiểu cho luồng thành công và lỗi chính, log không chứa tọa độ chính xác ngoài dữ liệu cần thiết, và demo được trên thiết bị Android.

## Ranh giới công việc Backend

Excel là nguồn phân công Backend chính. Hiện nhóm có hai người Backend: **Backend 1** sở hữu tài khoản, privacy và nghiệp vụ meetup; **Backend 2** sở hữu realtime, recommendation và tích hợp ngoài. Các ranh giới sau giúp hai người làm song song mà không đụng trách nhiệm:

| Nhóm chức năng | Người sở hữu | Ranh giới rõ ràng |
|---|---|---|
| Socket và vị trí | Backend 2 | Nền tảng Socket sở hữu kết nối, xác thực khi kết nối, room, presence và cách phát event. Chức năng vị trí chỉ nhận `location:update`, kiểm quyền, lưu Redis TTL và phát `LocationUpdated`. |
| Meetup và xếp hạng | Backend 1 / Backend 2 | Backend 1 quản lý trạng thái và thành viên meetup. Backend 2 sở hữu thuật toán xếp hạng cố định theo ETA, sở thích meetup và rating. |
| Vote và realtime | Backend 1 / Backend 2 | Backend 1 sở hữu luật vote/chốt và phát `VoteUpdated`. Backend 2 chỉ cung cấp kênh Socket để gửi event. |
| FCM | Backend 2 | Chỉ sở hữu token thiết bị, worker và hàm gửi chung. Luồng meetup, vote hoặc nearby quyết định lúc nào cần phát event, không tự gọi logic FCM. |
| Nearby friend | Backend 2 | Phải dùng quyền từ privacy, vị trí realtime và nền tảng FCM. Không tự đọc hoặc phát tọa độ chính xác. |
| Lịch sử, yêu thích, quản trị, quan sát | Backend 1 / Backend 2 | Backend 1 sở hữu lịch sử meetup, địa điểm yêu thích và quản trị tài khoản. Backend 2 sở hữu health check, metrics và log hệ thống. |

### Event cần chốt trước khi làm song song

`LocationUpdated`, `MeetupMemberChanged`, `PreferenceUpdated`, `RecommendationReady`, `VoteUpdated`, `MeetupFinalized`.

Mỗi event cần có tên, payload tối thiểu, người phát, người nhận và trường hợp không được phát do thiếu quyền. Không đưa token, tọa độ chính xác hoặc dữ liệu AI nhạy cảm vào log/event không cần thiết.
