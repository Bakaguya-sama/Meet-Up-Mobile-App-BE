# Nghiệp vụ và đặc tả chức năng MeetUp

## 1. Mục đích và phạm vi

MeetUp giúp một nhóm bạn chọn nơi gặp mặt thuận tiện hơn. Ứng dụng chỉ chia sẻ vị trí khi người dùng chủ động đồng ý. Hệ thống không giới hạn số thành viên meetup, nhưng engine gợi ý thay đổi cách tính theo quy mô để giữ được độ trễ và chi phí hợp lý.

## 2. Tác nhân

| Tác nhân | Vai trò |
|---|---|
| Người dùng | Đăng nhập, kết bạn, quản lý quyền vị trí, tạo hoặc tham gia meetup. |
| Người tạo meetup | Người dùng tạo meetup; có quyền mời, chỉnh sửa khi chưa chốt, chốt hoặc hủy. |
| Thành viên meetup | Nhận lời mời, xem đề xuất và vote. Vị trí được dùng khi thành viên đã bật chia sẻ vị trí trong hồ sơ. |
| Quản trị viên | Khóa tài khoản vi phạm, xem báo cáo và tình trạng dịch vụ. |
| Google Maps Platform | Trả địa điểm, giờ mở cửa, giá/rating và ETA tuyến đường. |
| Firebase Cloud Messaging | Gửi thông báo đẩy. |
| Dịch vụ AI | Viết lời giải thích ngắn cho kết quả gợi ý từ dữ liệu đã được tổng hợp. |

Người tạo meetup và thành viên meetup đều là Người dùng. Google Maps và Firebase là tác nhân ngoài hệ thống.

## 3. Luồng nghiệp vụ chính

### 3.1 Tạo và chốt meetup

1. Người tạo nhập tên, thời gian, loại địa điểm, bán kính và mời một hoặc nhiều bạn.
2. Hệ thống tạo meetup ở trạng thái **Đang mời**, gửi thông báo.
3. Người được mời chấp nhận hoặc từ chối. Khi chấp nhận, họ chọn sở thích tạm thời cho meetup; profile chỉ dùng để điền sẵn khi họ chưa chọn. Nếu đã bật chia sẻ vị trí trong hồ sơ, vị trí hợp lệ tự được dùng cho meetup.
4. Khi có ít nhất 2 người tham gia và có đủ vị trí còn hiệu lực, người tạo bấm **Tìm địa điểm**. Engine tính chính xác với tối đa 20 người, chạy batch với 21–50 người và gom cụm khi trên 50 người.
5. Hệ thống tìm địa điểm, lấy ETA và hiển thị tối đa 5 nơi cùng lý do xếp hạng.
6. Thành viên vote. Đến hạn vote, người tạo chốt một nơi (hoặc hệ thống gợi ý nơi có nhiều vote nhất khi người tạo bấm chốt).
7. Hệ thống thông báo, meetup thành **Đã chốt**; mỗi người có thể mở Google Maps để đi.
8. Đến khi kết thúc hoặc hủy, hệ thống ngừng phát vị trí vào room meetup và chuyển trạng thái **Đã kết thúc** hoặc **Đã hủy**.

### 3.3 Chức năng mở rộng đã cam kết

Sau khi có danh sách đề xuất, người dùng có thể bật lọc “đang mở cửa”. Thành viên lưu địa điểm yêu thích, xem lịch sử meetup và mở dẫn đường tới nơi đã chốt. Mỗi meetup có phòng chat riêng; chỉ thành viên của meetup mới đọc hoặc gửi tin.

Người dùng có thể bật phát hiện bạn ở gần. Khi hai người là bạn bè, cùng bật tính năng và ở trong bán kính đã chọn, hệ thống chỉ gửi lời gợi ý tạo meetup. Thông báo không chứa tọa độ, địa chỉ hoặc vị trí chính xác của người kia.

Khi người dùng yêu cầu, hệ thống dùng điểm xếp hạng, ETA trung bình/lớn nhất, trạng thái mở cửa và sở thích để tạo lời giải thích ngắn. Dịch vụ AI chỉ nhận dữ liệu tổng hợp như “3 thành viên, Max ETA 15 phút”; không nhận latitude/longitude, lịch sử GPS hoặc tên thật.

### 3.4 Sở thích meetup

Profile có thể lưu sở thích dài hạn để điền sẵn form. Khi tạo hoặc nhận meetup, mỗi người chọn sở thích tạm thời cho lần gặp đó. Tag hoạt động/bối cảnh có ba mức: `high`, `normal`, `avoid`. `MeetupMemberPreference` là nguồn dữ liệu chính; `UserPreference` chỉ là `profile_fallback` khi thành viên chưa chọn gì.

Hệ thống dùng một thuật toán cố định: cân bằng Avg ETA, Max ETA, điểm sở thích meetup và rating. Tag `avoid` làm hạ điểm địa điểm không phù hợp nhưng không có chế độ xếp hạng do người dùng chọn.

### 3.2 Chia sẻ vị trí

1. Người dùng bật hoặc tắt chia sẻ vị trí trong hồ sơ.
2. Ứng dụng xin quyền hệ điều hành trước khi bắt đầu.
3. Khi có GPS mới, app gửi tọa độ, độ chính xác và thời điểm gửi.
4. Backend xác thực, kiểm tra cờ chia sẻ rồi lưu vị trí mới nhất vào Redis với TTL 5 phút.
5. Backend chỉ phát vị trí cho bạn bè đã kết bạn. Trong meetup, vị trí chỉ dùng cho thành viên `accepted` đã bật chia sẻ vị trí trong hồ sơ.
6. Khi hết TTL, rời/hủy/kết thúc meetup hoặc tắt cờ chia sẻ trong hồ sơ, vị trí không còn được phát và bị xóa khỏi cache.

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc |
|---|---|
| BR-01 | Chỉ người dùng đã xác thực mới dùng chức năng bạn bè, vị trí và meetup. |
| BR-02 | Quan hệ bạn bè phải được chấp nhận trước khi gửi lời mời meetup hoặc xem vị trí theo quan hệ bạn bè. |
| BR-03 | Quyền xem vị trí được backend kiểm tra cho từng lần phát dữ liệu. Không tin cậy cờ quyền do mobile tự gửi. |
| BR-04 | Vị trí chỉ còn hiệu lực 5 phút. UI hiển thị thời điểm cập nhật; quá 5 phút là vị trí cũ. |
| BR-05 | Thành viên `accepted` có cờ chia sẻ vị trí trong hồ sơ đang bật được dùng vị trí cho meetup. Khi rời/hủy/kết thúc meetup, backend ngừng phát vị trí vào room của meetup đó. |
| BR-06 | Meetup cần ít nhất 2 thành viên chấp nhận và ít nhất 2 vị trí còn hiệu lực mới cho phép tìm địa điểm theo nhóm. |
| BR-07 | Người tạo chỉ chỉnh sửa thành viên/bộ lọc trước khi chốt. Sau khi chốt chỉ được hủy meetup. |
| BR-08 | Mỗi thành viên có tối đa một vote cho một meetup; vote mới thay vote cũ trước hạn vote. |
| BR-09 | Người tạo quyết định cuối cùng. Nếu chọn theo đa số, hòa phiếu ưu tiên nơi có `Max ETA` thấp hơn, sau đó điểm tổng cao hơn. |
| BR-10 | Không lưu lịch sử GPS trong PostgreSQL ở MVP. Chỉ lưu latest location tạm thời trong Redis. |
| BR-11 | Dữ liệu vị trí có accuracy trên 100 m được gắn cảnh báo và không dùng để khẳng định người dùng đã đến nơi. |
| BR-12 | Thông báo chỉ gửi cho sự kiện liên quan: lời mời, địa điểm được chốt, nhắc giờ bắt đầu và thay đổi/hủy meetup. |
| BR-13 | Lọc đang mở cửa chỉ áp dụng khi Google Places trả dữ liệu giờ mở. Nếu thiếu dữ liệu, UI phải ghi rõ thay vì tự kết luận. |
| BR-14 | Địa điểm yêu thích và lịch sử meetup chỉ lưu thông tin meetup/nơi đã chọn. Chúng không lưu lịch sử tuyến đường hoặc GPS. |
| BR-15 | Chat chỉ dành cho thành viên của meetup. Khi thành viên rời meetup, họ không gửi tin mới nhưng vẫn xem được lịch sử theo chính sách của meetup. |
| BR-16 | Lời giải thích AI là thông tin tham khảo, không thay đổi thứ tự xếp hạng. Nó chỉ dùng dữ liệu tổng hợp đã lọc bỏ tọa độ và dữ liệu nhận diện không cần thiết. |
| BR-17 | Phát hiện bạn ở gần yêu cầu cả hai người cùng bật tính năng, là bạn bè và có vị trí còn hiệu lực. Hệ thống không tự bật chia sẻ vị trí vì tính năng này. |
| BR-18 | Gợi ý bạn ở gần được giới hạn tối đa một lần cho cùng một cặp trong 2 giờ để tránh làm phiền. |
| BR-19 | Meetup không giới hạn số thành viên. Chỉ thành viên có trạng thái tham gia và vị trí còn hiệu lực được dùng để tính recommendation. |
| BR-20 | Tối đa 20 thành viên tính ETA chính xác. Với 21–50 người, Route Matrix chia batch. Trên 50 người, hệ thống gom cụm vị trí và UI ghi rõ kết quả là ước lượng theo cụm. |
| BR-21 | Sở thích do thành viên chọn trong meetup luôn ưu tiên hơn profile. Profile chỉ được dùng khi không có lựa chọn tạm thời. |

## 5. Công thức xếp hạng đơn giản

Với mỗi nơi `p`, hệ thống tính ETA của từng người bằng Google Routes. Điểm càng thấp càng tốt:

`Diem(p) = 0.50 × AvgETA + 0.35 × MaxETA + 0.20 × PhatNguyenVong - 0.05 × Rating`

- `AvgETA`: thời gian đi trung bình.
- `MaxETA`: thời gian đi lâu nhất của một người. Đây là phần bảo vệ sự công bằng.
- `PhatNguyenVong`: phạt khi loại địa điểm không đúng nhu cầu.
- `Rating`: điểm đánh giá chuẩn hóa 0–5.

`PhatNguyenVong` tính từ `MeetupMemberPreference`. Tag `high` có trọng số cao hơn `normal`; tag `avoid` hạ điểm địa điểm không phù hợp. Max ETA luôn được dùng để bảo vệ tính công bằng.

Hệ thống không dùng `priceLevel`, Budget filter hoặc PricePenalty. `priceLevel` là mức phân loại tham khảo từ Google Places, không phải giá thực tế; dùng nó để loại hoặc hạ hạng địa điểm có thể tạo gợi ý sai.

Các trọng số đặt trong cấu hình backend để nhóm có thể thử nghiệm. UI phải hiển thị Avg ETA, Max ETA và ETA từng người; không cần tiết lộ toàn bộ công thức cho người dùng cuối.

## 6. Đặc tả use case

### UC-01 Đăng ký và đăng nhập

**Tác nhân:** Người dùng.  
**Điều kiện trước:** Chưa có phiên đăng nhập hợp lệ.  
**Luồng chính:** Người dùng chọn Email hoặc Google, nhập/ủy quyền thông tin, hệ thống xác thực và tạo phiên JWT.  
**Ngoại lệ:** Email đã tồn tại, thông tin không hợp lệ, Google OAuth bị hủy hoặc mạng lỗi.  
**Kết quả:** Vào màn hình chính; chỉ token an toàn được lưu trên thiết bị.

### UC-02 Quản lý bạn bè

**Tác nhân:** Người dùng.  
**Điều kiện trước:** Đã đăng nhập.  
**Luồng chính:** Tìm theo tên/email, gửi lời mời; người nhận chấp nhận/từ chối; danh sách bạn bè cập nhật và có thông báo.  
**Quy tắc:** Không thể tự kết bạn, không tạo lời mời trùng hoặc mời tài khoản đã bị khóa.  
**Kết quả:** Có friendship được chấp nhận hoặc lời mời được đóng.

### UC-03 Thiết lập và chia sẻ vị trí

**Tác nhân:** Người dùng.  
**Điều kiện trước:** Đã đăng nhập; có quyền hệ điều hành nếu muốn bật chia sẻ.  
**Luồng chính:** Bật/tắt chia sẻ vị trí trong hồ sơ; app lấy GPS theo tần suất phù hợp; backend kiểm tra quyền, lưu TTL và phát tới đúng bạn bè/room meetup.  
**Ngoại lệ:** Từ chối quyền GPS, GPS tắt, accuracy kém, mạng mất, hết thời hạn.  
**Kết quả:** Người được phép thấy ghim vị trí và thời điểm cập nhật; người không được phép không thấy dữ liệu.

### UC-04 Xem bản đồ bạn bè

**Tác nhân:** Người dùng.  
**Điều kiện trước:** Đã có ít nhất một bạn được phép chia sẻ.  
**Luồng chính:** Mở bản đồ, hệ thống trả latest location được phép; app hiển thị ghim, độ chính xác và “cập nhật x phút trước”; nhận cập nhật socket.  
**Ngoại lệ:** Vị trí cũ/hết TTL thì đổi nhãn, không giả vờ realtime.  
**Kết quả:** Người dùng biết ai đang chia sẻ vị trí hợp lệ.

### UC-05 Tạo meetup và mời thành viên

**Tác nhân:** Người tạo meetup.  
**Điều kiện trước:** Đã đăng nhập và có ít nhất một bạn bè.  
**Luồng chính:** Nhập thông tin meetup, chọn bạn, xác nhận tạo; backend tạo trạng thái Đang mời và FCM gửi lời mời.  
**Ngoại lệ:** Thời gian bắt đầu ở quá khứ, không có thành viên hoặc bán kính không hợp lệ. Không có giới hạn cứng số người được mời.  
**Kết quả:** Meetup có danh sách mời và hạn phản hồi.

### UC-06 Phản hồi lời mời meetup

**Tác nhân:** Thành viên meetup.  
**Điều kiện trước:** Có lời mời đang hiệu lực.  
**Luồng chính:** Mở lời mời, xem thông tin, chọn Chấp nhận hoặc Từ chối; nếu chấp nhận, chọn/sửa sở thích tạm thời. Nếu cờ chia sẻ vị trí trong hồ sơ đang bật, vị trí hợp lệ tự được dùng cho meetup.  
**Ngoại lệ:** Meetup đã hủy/đã chốt hoặc lời mời hết hạn.  
**Kết quả:** Trạng thái thành viên được cập nhật realtime cho người tạo.

### UC-07 Gợi ý địa điểm cho nhóm

**Tác nhân:** Người tạo meetup; Google Maps Platform.  
**Điều kiện trước:** Có tối thiểu 2 thành viên và 2 vị trí còn hiệu lực; meetup chưa chốt.  
**Luồng chính:** Người tạo bấm tìm; backend đọc sở thích meetup, tính điểm trung tâm, lấy nơi ứng viên, chọn chiến lược exact/batch/cluster theo số người, lấy route matrix, chấm điểm theo thuật toán cố định và trả top 5.  
**Ngoại lệ:** Thiếu vị trí, API giới hạn/lỗi, không tìm thấy nơi phù hợp.  
**Kết quả:** Danh sách có tên, ảnh nếu có, rating, giờ mở cửa, Avg ETA, Max ETA, ETA từng người và lý do xếp hạng.

### UC-08 Vote và chốt địa điểm

**Tác nhân:** Thành viên meetup, Người tạo meetup.  
**Điều kiện trước:** Có danh sách đề xuất và meetup ở Đang chọn.  
**Luồng chính:** Thành viên chọn một nơi; hệ thống phát số vote mới; hết hạn hoặc khi đủ phản hồi, người tạo chốt.  
**Ngoại lệ:** Vote sau hạn, vote nơi không nằm trong danh sách hiện tại, người tạo không có quyền với meetup khác.  
**Kết quả:** Địa điểm và thời gian được chốt, mọi thành viên nhận FCM.

### UC-09 Thiết lập sở thích meetup

**Tác nhân:** Người tạo meetup, Thành viên meetup.  
**Điều kiện trước:** Meetup chưa chốt.  
**Luồng chính:** Mỗi thành viên chọn tag hoạt động/bối cảnh với mức `high`, `normal` hoặc `avoid`. App điền sẵn từ profile nhưng lưu lựa chọn meetup riêng.  
**Ngoại lệ:** Không có lựa chọn thì dùng `profile_fallback`.  
**Kết quả:** Recommendation có dữ liệu preference rõ ràng, có thể giải thích được.

### UC-10 Dẫn đường và kết thúc meetup

**Tác nhân:** Thành viên meetup; Google Maps Platform.  
**Điều kiện trước:** Meetup đã chốt.  
**Luồng chính:** Người dùng bấm Dẫn đường để mở Google Maps; khi meetup kết thúc/hủy, backend ngừng phát vị trí vào room meetup và xóa cache phù hợp.  
**Kết quả:** Meetup được lưu lịch sử, không còn phát vị trí theo meetup.

### UC-11 Lọc, yêu thích, lịch sử và dẫn đường

**Tác nhân:** Người dùng; Google Maps Platform.  
**Điều kiện trước:** Đã đăng nhập; với dẫn đường, meetup đã chốt.  
**Luồng chính:** Người dùng bật/tắt bộ lọc đang mở cửa; lưu/bỏ lưu địa điểm; xem lịch sử meetup; bấm Dẫn đường để mở Google Maps.  
**Ngoại lệ:** Places không có giờ mở thì hiển thị “chưa có dữ liệu”; địa điểm đã đóng không bị ẩn nếu người dùng không bật lọc.  
**Kết quả:** Người dùng kiểm soát bộ lọc và dùng lại thông tin hữu ích mà không lưu lịch sử GPS. Hệ thống không có Budget filter vì `priceLevel` không phải giá thực tế.

### UC-12 Chat nhóm trong meetup

**Tác nhân:** Thành viên meetup.  
**Điều kiện trước:** Là thành viên meetup có quyền xem chat.  
**Luồng chính:** Mở phòng chat, gửi tin nhắn văn bản, nhận tin mới gần thời gian thực.  
**Ngoại lệ:** Không phải thành viên, meetup không tồn tại hoặc mạng mất thì không gửi được; UI báo trạng thái gửi.  
**Kết quả:** Các thành viên trao đổi được về kế hoạch trong đúng meetup.

### UC-13 AI giải thích đề xuất

**Tác nhân:** Người dùng; Dịch vụ AI.  
**Điều kiện trước:** Đã có danh sách địa điểm đã chấm điểm.  
**Luồng chính:** Người dùng bấm “Vì sao gợi ý?”; backend tạo dữ liệu tổng hợp đã bỏ tọa độ, gọi dịch vụ AI và trả 1–3 câu giải thích dễ hiểu.  
**Ngoại lệ:** Dịch vụ AI lỗi hoặc quá thời gian chờ thì hiển thị lý do có sẵn từ thuật toán, ví dụ “Max ETA thấp hơn các nơi khác”.  
**Kết quả:** Người dùng hiểu gợi ý mà dữ liệu nhạy cảm không rời khỏi hệ thống.

### UC-14 Phát hiện bạn ở gần

**Tác nhân:** Người dùng.  
**Điều kiện trước:** Hai người là bạn bè, cùng bật tính năng, có quyền chia sẻ phù hợp và vị trí còn hiệu lực.  
**Luồng chính:** Backend kiểm tra khoảng cách gần đúng theo ngưỡng người dùng chọn, áp dụng giới hạn 2 giờ và gửi thông báo “Bạn và một người bạn đang ở gần nhau. Tạo meetup?”.  
**Ngoại lệ:** Một bên tắt quyền, vị trí cũ hoặc đã gửi gợi ý gần đây thì không gửi thông báo.  
**Kết quả:** Có lời gợi ý theo ngữ cảnh mà không tiết lộ vị trí chính xác.

### UC-15 Quản trị tối giản

**Tác nhân:** Quản trị viên.  
**Luồng chính:** Xem báo cáo, khóa/mở khóa tài khoản, xem số liệu người dùng/meetup và trạng thái dịch vụ.  
**Kết quả:** Có công cụ xử lý vi phạm mà không làm phức tạp phần mobile.

## 7. Dữ liệu cần lưu

| Nhóm | Dữ liệu chính | Nơi lưu |
|---|---|---|
| Tài khoản | User, refresh token, profile, trạng thái khóa | PostgreSQL |
| Quan hệ | Friendship, lời mời bạn bè | PostgreSQL |
| Meetup | Meetup, MeetupMember, MeetupMemberPreference, Vote, PlaceSnapshot, FavoritePlace, ChatMessage | PostgreSQL |
| Profile | UserPreference dùng để điền sẵn preference meetup | PostgreSQL |
| Quyền | PrivacySetting, thời hạn chia sẻ | PostgreSQL |
| Context mở rộng | NearbyPreference, ngưỡng gần, lần gợi ý gần nhất, AI explanation cache đã ẩn dữ liệu nhạy cảm | PostgreSQL hoặc Redis TTL |
| Realtime | LatestLocation, presence, active meetup, socket room | Redis có TTL |

`PlaceSnapshot` chỉ lưu thông tin nơi đã được chọn hoặc danh sách đã dùng cho meetup; không cần lưu toàn bộ lịch sử truy vấn.
