# Đánh giá phạm vi chức năng MeetUp

## Kết luận

Đề cương **đủ mạnh để làm đồ án Pervasive and Mobile Computing**. Nó không chỉ là ứng dụng bản đồ: điện thoại lấy dữ liệu từ GPS, hệ thống hiểu bối cảnh của một nhóm người, đồng bộ gần thời gian thực, thay đổi cách gợi ý theo vị trí và trạng thái meetup, đồng thời kiểm soát quyền riêng tư và pin.

Để đáp ứng thuyết phục khi bảo vệ, cần biến các ý này thành chức năng và số đo cụ thể, thay vì chỉ nêu công nghệ. Bản hiện tại đã có đa số chức năng sản phẩm; còn thiếu vài quy tắc vận hành quan trọng và một kế hoạch đo lường.

## Những phần đã đáp ứng tốt

| Năng lực của môn | Chức năng trong đề cương | Minh chứng nên demo |
|---|---|---|
| Mobile sensing | Lấy GPS bằng Expo Location, xin quyền vị trí | Thiết bị di chuyển, vị trí trên bản đồ đổi theo thời gian |
| Context awareness | Vị trí thành viên, loại địa điểm, bán kính, thời điểm mở cửa | Đổi bộ lọc hoặc vị trí thì thứ hạng địa điểm đổi |
| Pervasive / realtime | Socket.IO, Redis, presence, phòng meetup | Hai máy thật thấy thay đổi vị trí và phiếu bầu |
| Phối hợp nhiều người | Lời mời, xác nhận tham gia, vote, chọn địa điểm | Một người tạo meetup, các người khác phản hồi |
| Context-aware recommendation | Trung tâm nhóm, ETA từng người, điểm công bằng | So sánh nơi gần 3 người nhưng quá xa 1 người với nơi công bằng hơn |
| Quyền riêng tư | Bật/tắt, theo thời hạn, gần đúng, chỉ trong meetup, TTL | Người không được cấp quyền không nhận được vị trí |
| Mobile resource awareness | Tần suất GPS theo di chuyển/trạng thái | Hiển thị chế độ tiết kiệm pin và thống kê số lần cập nhật |

## Phạm vi triển khai đã mở rộng

Tất cả chức năng từng nằm ở SHOULD HAVE nay là **cam kết triển khai**, không còn là phần làm nếu rảnh. Chúng làm sản phẩm hoàn chỉnh hơn nhưng cần được làm sau luồng meetup lõi để không ảnh hưởng phần realtime và privacy.

| Chức năng mở rộng | Giá trị thực tế | Điều kiện an toàn |
|---|---|---|
| Lọc đang mở cửa | Loại nơi đã đóng cửa tại thời điểm tìm kiếm | Chỉ áp dụng khi Places trả được dữ liệu; thiếu dữ liệu phải hiện rõ |
| Yêu thích và lịch sử | Dễ dùng lại nơi đã chọn, xem lại kế hoạch | Không lưu lịch sử GPS trong lịch sử meetup |
| ETA từng người và dẫn đường | Nhóm tự đánh giá sự công bằng, đi đến nơi đã chốt | ETA chỉ dùng vị trí còn hiệu lực |
| Chat nhóm | Trao đổi trong một meetup, không cần app chat riêng | Chỉ thành viên đang/đã thuộc meetup xem được tin nhắn |
| AI giải thích đề xuất | Hiểu vì sao địa điểm được xếp hạng cao | Chỉ gửi dữ liệu tổng hợp, không gửi tọa độ hoặc tên riêng không cần thiết |
| Phát hiện bạn ở gần | Gợi ý tạo meetup đúng ngữ cảnh | Cả hai bên phải bật tính năng; không thông báo tọa độ chính xác |

## Khoảng trống nên bổ sung

### Bắt buộc cho MVP

1. **Trạng thái meetup rõ ràng.** Cần có Nháp, Đang mời, Đang chọn, Đã chốt, Đã hủy, Đã kết thúc. Không có trạng thái, lời mời, vote và quyền chia sẻ khó kiểm soát.
2. **Xử lý vị trí cũ.** Vị trí quá 5 phút phải hiện “cũ”, không dùng để tính ETA nếu người dùng không xác nhận. Vị trí thiếu của thành viên phải được báo rõ.
3. **Ràng buộc quyền truy cập ở backend.** Client không được tự quyết định ai xem vị trí. Mỗi lần gửi hoặc phát vị trí, backend phải kiểm tra quan hệ bạn bè, cờ chia sẻ vị trí trong hồ sơ, trạng thái `accepted` và meetup còn hiệu lực.
4. **Quy tắc chọn địa điểm.** Xác định ai có quyền chốt, khi nào hết hạn vote, hòa phiếu xử lý thế nào, và có được đổi lựa chọn hay không.
5. **Hủy/rời meetup.** Thành viên có thể từ chối, rời; người tạo có thể hủy. Hệ thống phải dừng chia sẻ vị trí theo meetup ngay khi meetup kết thúc/hủy.
6. **Lỗi mạng và quyền GPS.** Có màn hình giải thích quyền bị từ chối, mạng mất, GPS không chính xác, và nút thử lại. Không được hiển thị vị trí cũ như thời gian thực.

### Nên bổ sung để tăng chất lượng môn học

1. **Thời gian và tình trạng tham gia.** Người tạo chọn thời gian bắt đầu; ứng dụng nhắc trước 30 phút. Thành viên chấp nhận hoặc từ chối meetup; vị trí chỉ được dùng khi họ đã bật cờ chia sẻ trong hồ sơ.
2. **Chế độ lấy vị trí thích ứng.** Không cần suy đoán hoạt động phức tạp. Quy tắc đơn giản: khi ở meetup và đang di chuyển, cập nhật mỗi 20–30 giây hoặc sau 50 m; khi đứng yên, mỗi 2 phút; khi tắt chia sẻ, không lấy vị trí. Ghi số lần cập nhật để so sánh pin.
3. **Độ tin cậy của vị trí.** Lưu `accuracy`, `updatedAt`; cảnh báo khi sai số lớn hơn 100 m. Địa điểm chỉ tính ETA cho thành viên có dữ liệu còn hiệu lực.
4. **Đồng bộ cờ chia sẻ.** Khi người dùng tắt chia sẻ trong hồ sơ, backend phải dừng nhận/phát vị trí ngay và xoá dữ liệu tạm trong Redis. Đây là demo quyền riêng tư rất trực quan.
5. **Công bằng của gợi ý.** Ngoài thời gian trung bình, bắt buộc dùng thời gian lâu nhất của một người. Hiển thị ETA mỗi người để nhóm tự kiểm tra.

### Chưa nằm trong cam kết triển khai

Giọng nói, thời tiết, phương tiện công cộng, dự đoán meetup và học từ lịch sử vẫn để hướng phát triển. Các mục này chỉ được bắt đầu khi toàn bộ chức năng cam kết, kiểm thử privacy và demo realtime đã ổn định.

## Cách chấm chất lượng thực tế

| Chỉ số | Mục tiêu demo | Cách đo |
|---|---|---|
| Độ trễ đồng bộ vị trí | p95 dưới 3 giây trên Wi-Fi/4G ổn định | Log thời điểm gửi và thời điểm máy khác nhận |
| Vị trí cũ | Không dùng quá 5 phút để xếp hạng | Tắt GPS hoặc mạng và kiểm tra nhãn “cũ” |
| Quyền riêng tư | 100% yêu cầu trái phép bị chặn | Test API/socket bằng tài khoản không được cấp quyền |
| Tiết kiệm tài nguyên | Số cập nhật khi đứng yên ít hơn khi trong meetup | Đếm event trong 15 phút mỗi chế độ |
| Công bằng | Nơi được đề xuất không chỉ tối ưu trung bình | Lưu Avg ETA và Max ETA cho top 3 nơi |
| Tỷ lệ luồng chính thành công | 100% trong bộ test demo | Tạo meetup → mời → gợi ý → vote → dẫn đường |

## Quyết định về quy mô meetup và cách gợi ý

Meetup không đặt giới hạn số thành viên. Tuy nhiên, không thể coi tất cả quy mô là cùng một phép tính ETA: Route Matrix tính theo số thành viên nhân số địa điểm. Vì vậy engine chạy theo ba mức.

| Số thành viên có vị trí hợp lệ | Cách tính | Trạng thái kết quả |
|---:|---|---|
| 2–20 | ETA chính xác cho từng người đến tối đa 5 địa điểm | Chính xác theo từng thành viên |
| 21–50 | Chia Route Matrix thành các batch, tổng hợp sau khi hoàn thành | Có thể mất thêm thời gian |
| Trên 50 | Gom cụm vị trí, tìm top địa điểm theo cụm, sau đó tính ETA chi tiết cho top 3 | Ước lượng theo cụm, hiển thị rõ trên UI |

Engine dùng một cách xếp hạng cố định, cân bằng Avg ETA, Max ETA, sở thích meetup và rating. Sở thích profile chỉ dùng để điền sẵn form. Lựa chọn trong meetup mới là dữ liệu quyết định. Mỗi người có thể đánh dấu “rất muốn”, “muốn” hoặc “không muốn” cho hoạt động/bối cảnh như cà phê, xem phim, trong nhà, yên tĩnh.

## Quyết định phạm vi đề xuất

Làm phần lõi trước cho meetup có số thành viên linh hoạt: tạo meetup, mời/xác nhận, chọn sở thích tạm thời, chia sẻ vị trí trong meetup, lấy top 5 địa điểm, hiển thị ETA, vote, chốt, nhắc lịch và mở Google Maps. Sau đó hoàn thiện bộ tính năng mở rộng đã cam kết: lọc đang mở cửa, yêu thích, lịch sử, chat, AI giải thích và phát hiện bạn ở gần. Chức năng kết bạn và màn hình bản đồ bạn bè vẫn cần có, nhưng không cần theo dõi 24/7.

Điểm khác biệt nên trình bày khi bảo vệ: “Ứng dụng không chỉ tìm quán ở trung tâm hình học. Nó dùng vị trí còn hiệu lực, ETA của từng người, trạng thái mở cửa và mức công bằng để hỗ trợ cả nhóm ra quyết định, trong khi quyền chia sẻ tự hết hạn.”
