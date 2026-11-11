# BE-12 meetup history

## API

`GET /api/v1/meetups/history?offset=0&limit=20` trả danh sách meetup ở trạng thái `finished` mà người gọi từng tham gia với trạng thái `accepted`. `offset` và `limit` dùng cùng giới hạn như `GET /meetups`.

Mỗi mục trả các trường meetup cần cho màn lịch sử (`meetupId`, `title`, `description`, `scheduledAt`, `finishedAt`) và `selectedPlace` gồm recommendation place ID, canonical candidate key, provider, provider place ID, và tên địa điểm. API không trả danh sách participant hoặc thông tin recommendation nội bộ.

Meetup chưa chốt, đang diễn ra, bị hủy, hoặc người gọi không phải participant được chấp nhận sẽ không xuất hiện. Query kiểm tra membership ở server; client không truyền user ID để chọn lịch sử.

## Persistence and privacy

BE-12 không tạo bảng history trùng lặp. Meetup giữ trạng thái/thời gian kết thúc và FK tới run cùng địa điểm đã chốt; recommendation context giữ candidate snapshot được dùng để tạo kết quả. FK selection giữ snapshot cần thiết khi retention job chạy.

Reader chỉ chọn tên/provider ID/canonical key của candidate. Không đọc hoặc trả latitude/longitude, tọa độ member, ETA member, preference, route, hoặc GPS history. History không tạo bản ghi vị trí hay tuyến đường mới.
