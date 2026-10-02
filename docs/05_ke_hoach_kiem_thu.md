# Kế hoạch kiểm thử và demo MeetUp

## Kịch bản demo bắt buộc

1. Ba máy đăng nhập, gửi/nhận lời mời bạn bè.
2. Người A tạo meetup cà phê lúc 19:00, mời B và C.
3. B chấp nhận meetup và đã bật chia sẻ vị trí trong hồ sơ. C chấp nhận nhưng tắt chia sẻ vị trí trong hồ sơ để cho thấy hệ thống báo thiếu dữ liệu.
4. A và B bật vị trí. A di chuyển hoặc giả lập vị trí; B thấy ghim A đổi trong vài giây và có thời điểm cập nhật.
5. A tìm địa điểm. App giải thích chưa thể tính cho C, nhưng vẫn xếp hạng dựa trên A/B theo quy tắc đã nêu.
6. B bật vị trí, tìm lại. Top 5 hiện Avg ETA, Max ETA, ETA từng người, giá/rating/giờ mở.
7. Cả nhóm vote, A chốt, cả ba nhận thông báo và mở dẫn đường.
8. A hủy hoặc kết thúc meetup. Kiểm tra B không còn nhận vị trí theo meetup và Redis key hết hạn/xóa.
9. Bật lọc đang mở cửa, lưu một nơi yêu thích, mở lịch sử meetup và dẫn đường.
10. Gửi tin nhắn trong chat meetup. Dùng tài khoản không phải thành viên để xác nhận không đọc/gửi được tin.
11. Bấm “Vì sao gợi ý?”. Kiểm tra lời giải thích nhắc ETA, loại địa điểm hoặc giờ mở nhưng không chứa tọa độ hay địa chỉ vị trí của thành viên.
12. Bật phát hiện bạn ở gần ở hai máy thử nghiệm. Kiểm tra chỉ khi cả hai cùng opt-in mới có một thông báo gợi ý; không có thông báo lặp trong 2 giờ.
13. Tạo meetup 21 người bằng dữ liệu thử nghiệm để kiểm tra Route Matrix chạy theo batch; tạo meetup trên 50 người để kiểm tra UI ghi rõ kết quả theo cụm.
14. Cho các thành viên chọn sở thích khác với profile và kiểm tra thứ hạng dùng preference trong meetup.

## Bộ test trọng tâm

| Nhóm | Tình huống | Kết quả mong đợi |
|---|---|---|
| Quyền | X cố xem vị trí Y khi Y không cấp quyền | API và socket không trả tọa độ; log có lý do từ chối |
| TTL | Vị trí không cập nhật hơn 5 phút | UI ghi “vị trí cũ”; xếp hạng yêu cầu xác nhận hoặc bỏ qua người đó |
| Meetup | Thành viên rời meetup | Không nhận thông báo/vote/địa điểm mới; backend ngừng phát vị trí vào room meetup |
| Vote | Một người đổi vote | Tổng vote giảm ở nơi cũ và tăng ở nơi mới, không tạo thêm vote |
| Recommendation | Một nơi có Avg ETA thấp nhưng Max ETA cao | Điểm công bằng có thể đẩy nơi đó xuống dưới |
| GPS | Từ chối quyền hoặc accuracy >100 m | Có hướng dẫn bật quyền/cảnh báo; không khẳng định vị trí chính xác |
| Mạng | Mất mạng lúc gửi vị trí | UI báo đang chờ; khi nối lại chỉ gửi latest location hợp lệ |
| Thông báo | Bấm notification “Place selected” | Mở đúng trang chi tiết meetup đã chốt |
| Bộ lọc | Places thiếu giờ mở | UI ghi “chưa có dữ liệu”, không tự suy đoán địa điểm đang mở |
| Chat | Tài khoản không thuộc meetup gọi API chat | Backend từ chối; thành viên hợp lệ nhận tin realtime |
| AI | Kiểm tra payload gửi dịch vụ AI | Chỉ có số người, ETA, bộ lọc và điểm; không có latitude/longitude, tên thật, lịch sử GPS |
| AI fallback | Dịch vụ AI lỗi hoặc timeout | App hiển thị lý do từ thuật toán, luồng vote vẫn dùng được |
| Bạn ở gần | Chỉ một người bật tính năng | Không có gợi ý hoặc tiết lộ vị trí của người còn lại |
| Chống làm phiền | Cùng một cặp ở gần liên tục | Tối đa một thông báo trong 2 giờ |
| Quy mô meetup | 21–50 thành viên có vị trí hợp lệ | Request Route Matrix chia batch; kết quả không mất thành viên hợp lệ |
| Quy mô meetup lớn | Trên 50 thành viên | Có nhãn “ước lượng theo cụm”; top 3 được tính ETA chi tiết |
| Sở thích | Profile khác lựa chọn meetup | Điểm dùng preference trong meetup, profile chỉ có nhãn `profile_fallback` khi chưa chọn |
| Sở thích meetup | Thay đổi tag `high`, `normal`, `avoid` | Thứ hạng thay đổi theo preference meetup; profile chỉ dùng khi chưa chọn |

## Dữ liệu cần ghi trong lúc test

Không lưu lịch sử GPS thật vào báo cáo. Chỉ lưu số liệu tổng hợp: thời điểm gửi/nhận event, số event mỗi chế độ, số request Places/Routes/AI, kết quả request bị chặn vì privacy, số gợi ý bạn ở gần đã bị giới hạn, thời gian trả recommendation và tỉ lệ test pass. Dùng tài khoản thử nghiệm và xóa dữ liệu sau buổi demo.
