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

1. Người tạo nhập tên, thời gian, loại địa điểm, bán kính và mời một hoặc nhiều người bằng lời mời trực tiếp hoặc liên kết mời có thời hạn.
2. Hệ thống tạo meetup ở trạng thái **Đang mời**, gửi thông báo.
3. Người được mời chấp nhận hoặc từ chối. Khi chấp nhận, họ chọn sở thích tạm thời cho meetup; profile chỉ dùng để điền sẵn khi họ chưa chọn. Nếu đã bật chia sẻ vị trí trong hồ sơ, vị trí hợp lệ tự được dùng cho meetup.
4. Khi có ít nhất 2 người tham gia và có đủ vị trí còn hiệu lực, người tạo bấm **Tìm địa điểm**. Engine luôn yêu cầu Route Matrix đầy đủ cho mọi thành viên hợp lệ; khi ma trận lớn, backend chia batch theo giới hạn provider nhưng không đổi sang ETA ước lượng theo cụm.
5. Hệ thống tìm địa điểm, lấy ETA và hiển thị tối đa 5 nơi cùng lý do xếp hạng. Địa điểm mở tại giờ meetup nhưng sắp đóng vẫn được giữ, được cảnh báo và chịu soft penalty nên có thể tụt hạng.
6. Thành viên vote. Đến hạn vote, người tạo chốt một nơi (hoặc hệ thống gợi ý nơi có nhiều vote nhất khi người tạo bấm chốt).
7. Hệ thống thông báo, meetup thành **Đã chốt**; mỗi người có thể mở Google Maps để đi.
8. Đến khi kết thúc hoặc hủy, hệ thống ngừng phát vị trí vào room meetup và chuyển trạng thái **Đã kết thúc** hoặc **Đã hủy**.

### 3.3 Chức năng mở rộng đã cam kết

Sau khi có danh sách đề xuất, người dùng có thể bật lọc “đang mở cửa”. Thành viên lưu địa điểm yêu thích, xem lịch sử meetup và mở dẫn đường tới nơi đã chốt. Mỗi meetup có phòng chat riêng; chỉ thành viên của meetup mới đọc hoặc gửi tin.

Người dùng có thể bật phát hiện bạn ở gần. Khi hai người là bạn bè, cùng bật tính năng và ở trong bán kính đã chọn, hệ thống chỉ gửi lời gợi ý tạo meetup. Thông báo không chứa tọa độ, địa chỉ hoặc vị trí chính xác của người kia.

Khi người dùng yêu cầu, hệ thống dùng điểm xếp hạng, ETA trung bình/lớn nhất, trạng thái mở cửa và sở thích để tạo lời giải thích ngắn. Dịch vụ AI chỉ nhận dữ liệu tổng hợp như “3 thành viên, Max ETA 15 phút”; không nhận latitude/longitude, lịch sử GPS hoặc tên thật.

### 3.5 Liên kết mời meetup và QR kết bạn

Người tạo meetup có thể tạo liên kết mời HTTPS/deep link để chia sẻ ngoài ứng dụng. Một link đang hiệu lực được **nhiều người khác nhau** dùng cho đến khi hết hạn hoặc bị thu hồi; retry của cùng actor không tạo membership hoặc lần dùng mới. Liên kết dùng token ngẫu nhiên có thời hạn và chỉ cho tham gia khi meetup còn nhận thành viên. Backend chỉ lưu hash của token; chuỗi token gốc chỉ xuất hiện trong URL trả cho người tạo. Tạo link mới với `revokePrevious=true` là thao tác rotate: trong cùng transaction thu hồi mọi link đang hiệu lực của meetup rồi tạo link mới. Lời mời trực tiếp theo tài khoản vẫn được giữ để gửi FCM cho người nhận cụ thể.

QR kết bạn dùng mô hình hybrid:

- **QR hồ sơ ổn định:** mã hóa URL chứa public handle không chứa email, số điện thoại hoặc user ID nội bộ. `public_handle` là cột unique, nullable trong `user_accounts`; không tạo bảng QR/profile riêng. Người quét xem hồ sơ công khai tối thiểu rồi chủ động bấm gửi lời mời kết bạn bằng handle, không nhận internal user ID. Chủ hồ sơ có thể tắt hoặc xoay public handle để vô hiệu QR cũ.
- **QR tạm thời:** mã hóa token ngẫu nhiên có TTL trong Redis cho tình huống gặp trực tiếp. Token chỉ resolve ra hồ sơ công khai tối thiểu sau khi người quét đăng nhập; hết hạn/thu hồi thì không dùng được. Kết quả cuối vẫn đi qua cùng luật tạo friendship hiện có.

Không lưu ảnh QR trong database. PostgreSQL chỉ lưu public handle và friendship; Redis chỉ giữ phiên QR tạm thời. Riêng link mời meetup cần bảng bền vững vì phải hỗ trợ thu hồi, hết hạn, audit và thống kê số lần dùng.

### 3.4 Sở thích meetup

Profile có thể lưu sở thích dài hạn để gợi ý trong form, nhưng giá trị điền sẵn không tự trở thành lựa chọn meetup nếu người dùng chưa xác nhận. Khi tạo hoặc nhận meetup, mỗi người có thể chọn một số tag hoạt động/bối cảnh với mức `high`, `normal`, `avoid`. Nếu đã chọn ít nhất một tag, chỉ những tag đã chọn được dùng; tag khác không tính và không lấy thêm từ profile. Nếu chưa chọn tag nào, dùng các tag đã lưu trong `UserPreference` làm `profile_fallback`. Không có tag trong cả hai nguồn thì không có preference để tính; không tự coi là `normal`. Xóa toàn bộ lựa chọn meetup sẽ trở lại fallback profile.

Hệ thống dùng một thuật toán cố định: cân bằng Avg ETA, Max ETA, điểm sở thích meetup và rating. Tag `avoid` làm hạ điểm địa điểm không phù hợp nhưng không có chế độ xếp hạng do người dùng chọn.

### 3.2 Chia sẻ vị trí

1. Người dùng chọn chế độ `off`, `friends`, `selected_friends` hoặc `meetup_only` trong hồ sơ; có thể đặt thời hạn và bật vị trí gần đúng. Mặc định là `off`.
2. Ứng dụng xin quyền hệ điều hành trước khi bắt đầu.
3. Khi có GPS mới, app gửi tọa độ, độ chính xác và thời điểm gửi.
4. Backend xác thực, kiểm tra chế độ và thời hạn chia sẻ ở mỗi lần nhận/phát vị trí. Phần realtime lưu vị trí mới nhất vào Redis với TTL 5 phút; TTL không thay thế thời hạn đồng ý chia sẻ.
5. Chế độ `friends` yêu cầu bạn bè đã chấp nhận; `selected_friends` còn yêu cầu người xem thuộc danh sách được chọn, kể cả khi xem qua meetup. Chế độ `meetup_only` chỉ cho thành viên `accepted` của meetup còn hoạt động; mọi truy cập theo meetup đều phải kiểm tra thành viên ở backend. Vị trí gần đúng được làm tròn phía backend trước khi trả/phát.
6. Khi hết TTL, rời/hủy/kết thúc meetup hoặc tắt cờ chia sẻ trong hồ sơ, vị trí không còn được phát và bị xóa khỏi cache.

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc |
|---|---|
| BR-01 | Chỉ người dùng đã xác thực mới dùng chức năng bạn bè, vị trí và meetup. |
| BR-02 | Quan hệ bạn bè phải được chấp nhận trước khi gửi lời mời meetup hoặc xem vị trí theo quan hệ bạn bè. |
| BR-03 | Quyền xem vị trí được backend kiểm tra cho từng lần phát dữ liệu. Không tin cậy cờ quyền do mobile tự gửi. |
| BR-04 | Vị trí chỉ còn hiệu lực 5 phút. UI hiển thị thời điểm cập nhật; quá 5 phút là vị trí cũ. |
| BR-05 | Vị trí trong meetup yêu cầu thành viên `accepted`, meetup còn hoạt động và chế độ/thời hạn chia sẻ của chủ vị trí cho phép người xem. `selected_friends` vẫn giới hạn người xem trong meetup. Khi rời/hủy/kết thúc meetup, backend ngừng phát vị trí vào room đó. |
| BR-06 | Meetup cần ít nhất 2 thành viên chấp nhận và ít nhất 2 vị trí còn hiệu lực mới cho phép tìm địa điểm theo nhóm. |
| BR-07 | Người tạo chỉ được sửa thông tin, bộ lọc và quản lý lời mời/thành viên trước cả hạn mời và khi chưa chốt. Từ đúng thời điểm hạn mời, không sửa các nội dung đó, không mời thêm hoặc phản hồi lời mời; organizer vẫn có thể hủy. Trước khi chốt, thành viên đã chấp nhận vẫn có thể rời và thành viên invited/accepted vẫn có thể sửa preference của chính mình. Sau khi chốt, organizer không sửa meetup và có thể hủy hoặc kết thúc theo điều kiện của meetup. Khi được mời lại vào cùng meetup, thành viên giữ preference tạm thời đã lưu trước đó. |
| BR-08 | Mỗi thành viên có tối đa một vote cho một meetup; vote mới thay vote cũ trước hạn vote. Organizer có thể đặt `voteDeadlineAt` khi tạo/cập nhật meetup; nếu bỏ trống thì không có hạn tự động và organizer chốt thủ công. |
| BR-09 | Người tạo quyết định cuối cùng. Nếu chọn theo đa số, hòa phiếu ưu tiên nơi có `Max ETA` thấp hơn, sau đó điểm tổng cao hơn. |
| BR-10 | Không lưu lịch sử GPS trong PostgreSQL ở MVP. Chỉ lưu latest location tạm thời trong Redis. |
| BR-11 | Dữ liệu vị trí có accuracy trên 100 m được gắn cảnh báo và không dùng để khẳng định người dùng đã đến nơi. |
| BR-12 | Thông báo chỉ gửi cho sự kiện liên quan: lời mời, địa điểm được chốt, nhắc giờ bắt đầu và thay đổi/hủy meetup. |
| BR-13 | Lọc đang mở cửa chỉ áp dụng khi Google Places trả dữ liệu giờ mở. Nếu thiếu dữ liệu, UI phải ghi rõ thay vì tự kết luận. |
| BR-14 | Địa điểm yêu thích và lịch sử meetup chỉ lưu thông tin meetup/nơi đã chọn. Chúng không lưu lịch sử tuyến đường hoặc GPS. |
| BR-15 | Chat chỉ dành cho thành viên của meetup. Khi thành viên rời hoặc bị remove, họ không gửi hoặc nhận tin mới; họ chỉ xem lịch sử có `sentAt <= leftAt`. Người chưa từng là member, declined hoặc meetup đã inactive không đọc/gửi chat. PostgreSQL cưỡng chế quyền gửi ngay khi insert để không có race giữa kiểm tra quyền và rời meetup. |
| BR-16 | Lời giải thích AI là thông tin tham khảo, không thay đổi thứ tự xếp hạng. Nó chỉ dùng dữ liệu tổng hợp đã lọc bỏ tọa độ và dữ liệu nhận diện không cần thiết. |
| BR-17 | Phát hiện bạn ở gần yêu cầu cả hai người cùng bật tính năng, là bạn bè và có vị trí còn hiệu lực. Hệ thống không tự bật chia sẻ vị trí vì tính năng này. |
| BR-18 | Gợi ý bạn ở gần được giới hạn tối đa một lần cho cùng một cặp trong 2 giờ để tránh làm phiền. |
| BR-19 | Meetup không giới hạn số thành viên. Chỉ thành viên có trạng thái tham gia và vị trí còn hiệu lực được dùng để tính recommendation. |
| BR-20 | Mọi candidate được xếp hạng phải có ETA hợp lệ cho mọi thành viên có location hợp lệ. Route Matrix chia batch theo giới hạn origin × destination của provider; số thành viên lớn có thể làm run bị từ chối/giới hạn bởi cost policy nhưng không được thay ETA thật bằng cluster estimate trong v1. |
| BR-21 | Nếu thành viên đã chọn ít nhất một tag meetup, chỉ các tag meetup đã chọn được tính; tag thiếu không tính, không mặc định `normal` và không fallback từng tag. Chỉ khi chưa chọn tag meetup nào mới fallback toàn bộ sang các tag đã lưu trong profile. Xóa toàn bộ lựa chọn meetup đưa thành viên về fallback profile. |
| BR-22 | Candidate `CLOSED` tại `scheduledAt` bị loại. Candidate vẫn `OPEN` nhưng sẽ đóng trong cửa sổ `closingSoonWindowSeconds` không bị loại; engine tính `closingRisk` có version, áp soft penalty vào ranking và trả warning `CLOSING_SOON`. Thiếu/không chắc giờ đóng không bị phạt như thể đã biết chắc. |
| BR-23 | Mọi thành viên được phép xem kết quả đều thấy ETA của mọi thành viên trong run. Preference, matched tags và utility chỉ được trả cho chính người đang gọi API; organizer không được xem feature riêng của người khác. Group utility/least-misery chỉ là dữ liệu nội bộ, không trả công khai vì có thể suy ra utility cá nhân ở nhóm nhỏ. |
| BR-24 | Sau khi vote/chốt, không tính lại feature và không cần endpoint feature mới. Thành viên dùng `runId` của kết quả vote/finalize để gọi lại GET recommendation run; backend dựng response theo actor từ snapshot bất biến. Người ngoài, người chỉ được mời hoặc bị từ chối không được đọc run. |
| BR-25 | Link mời meetup chỉ do organizer tạo/thu hồi, phải có hạn dùng không vượt `invitationDeadlineAt`, không chứa meetup ID nhạy cảm trong token và chỉ lưu `token_hash`. Một link hiệu lực được nhiều actor khác nhau dùng; cùng actor accept lại là idempotent và không tăng `useCount`. `POST` tạo link với `revokePrevious=true` atomically thu hồi mọi link hiệu lực trước khi tạo link mới. Accept yêu cầu đăng nhập và tuân state/deadline của meetup. |
| BR-26 | QR hồ sơ chỉ mở preview tối thiểu rồi dùng luồng gửi friend request hiện có; không tự kết bạn khi scan. `public_handle` unique/nullable ở `user_accounts`; preview và request QR dùng handle hoặc QR session token, không trả/nhận internal user ID. QR tạm thời dùng token entropy cao và Redis TTL. Cả hai loại đều áp dụng luật self/duplicate/block/rate-limit của friendship và không chứa email, số điện thoại, tọa độ hoặc access token. |

## 5. Công thức xếp hạng đơn giản

> **Trạng thái:** Công thức trong mục này là placeholder nghiệp vụ ban đầu, không phải thiết kế thuật toán đã chốt. Thiết kế có version, baseline, fairness ranking và lộ trình học từ feedback nằm trong `12_meetup_group_recommendation_engine.md`.

Với mỗi nơi `p`, hệ thống tính ETA của từng người bằng Google Routes. Điểm càng thấp càng tốt:

`Diem(p) = 0.50 × AvgETA + 0.35 × MaxETA + 0.20 × PhatNguyenVong - 0.05 × Rating`

- `AvgETA`: thời gian đi trung bình.
- `MaxETA`: thời gian đi lâu nhất của một người. Đây là phần bảo vệ sự công bằng.
- `PhatNguyenVong`: phạt khi loại địa điểm không đúng nhu cầu.
- `Rating`: điểm đánh giá chuẩn hóa 0–5.

`PhatNguyenVong` tính từ `MeetupMemberPreference`. Tag `high` có trọng số cao hơn `normal`; tag `avoid` hạ điểm địa điểm không phù hợp. Max ETA luôn được dùng để bảo vệ tính công bằng.

Hệ thống không dùng `priceLevel`, Budget filter hoặc PricePenalty. `priceLevel` là mức phân loại tham khảo từ Google Places, không phải giá thực tế; dùng nó để loại hoặc hạ hạng địa điểm có thể tạo gợi ý sai.

Các trọng số đặt trong cấu hình backend để nhóm có thể thử nghiệm. UI phải hiển thị Avg ETA, Max ETA và ETA từng người. Candidate sắp đóng cửa được áp soft penalty có version theo thiết kế tại `12_meetup_group_recommendation_engine.md`; không được hard-filter chỉ vì `CLOSING_SOON`. UI không cần tiết lộ toàn bộ công thức cho người dùng cuối.

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
**Luồng chính:** Chọn một trong bốn chế độ chia sẻ, thời hạn tùy chọn và độ chính xác; app lấy GPS theo tần suất phù hợp; backend kiểm tra quyền từng yêu cầu, lưu TTL và phát tới đúng bạn bè/room meetup. Chi tiết API và ranh giới tích hợp tại `11_location_privacy_api.md`.
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
**Luồng chính:** Người tạo bấm tìm; backend đọc sở thích meetup, tính search-center medoid, lấy nơi ứng viên, chia Route Matrix theo batch khi cần, chấm điểm theo thuật toán có version và trả top 5. Candidate mở nhưng sắp đóng chịu soft penalty và có warning; candidate đóng tại `scheduledAt` bị loại.
**Ngoại lệ:** Thiếu vị trí, API giới hạn/lỗi, không tìm thấy nơi phù hợp.
**Kết quả:** Danh sách có tên, ảnh nếu có, rating, giờ mở cửa, Avg ETA, Max ETA, ETA từng người và lý do xếp hạng. Response cho một viewer chỉ chứa preference/utility của chính viewer đó.

### UC-08 Vote và chốt địa điểm

**Tác nhân:** Thành viên meetup, Người tạo meetup.
**Điều kiện trước:** Có danh sách đề xuất và meetup ở Đang chọn.
**Luồng chính:** Thành viên chọn một nơi; hệ thống phát số vote mới; hết hạn hoặc khi đủ phản hồi, người tạo chốt.
**Ngoại lệ:** Vote sau hạn, vote nơi không nằm trong danh sách hiện tại, người tạo không có quyền với meetup khác.
**Kết quả:** Địa điểm và thời gian được chốt, mọi thành viên nhận FCM.

Sau khi có kết quả, API vote/finalize trả `runId` và candidate được chọn. Mobile dùng cùng `GET /api/v1/meetups/:meetupId/recommendation-runs/:runId` để xem lại ETA và feature của chính mình; không có route “feature sau vote” riêng và không recompute run.

### UC-09 Thiết lập sở thích meetup

**Tác nhân:** Người tạo meetup, Thành viên meetup.
**Điều kiện trước:** Meetup chưa chốt.
**Luồng chính:** Mỗi thành viên chọn tag hoạt động/bối cảnh với mức `high`, `normal` hoặc `avoid`. Profile có thể gợi ý form; chỉ tag được xác nhận mới lưu là lựa chọn meetup. Lưu thay thế danh sách tag đã chọn; danh sách rỗng xóa lựa chọn meetup.

**Ngoại lệ:** Không có lựa chọn meetup thì dùng `profile_fallback`; các tag không thuộc nguồn đang dùng không được tính.

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
**Điều kiện trước:** Là accepted member của meetup còn active để gửi/nhận tin; former member `left`/`removed` chỉ có quyền đọc đến `leftAt`.
**Luồng chính:** Mở phòng chat, gửi tin nhắn văn bản hoặc tối đa 5 tệp (ảnh, PDF, Office, văn bản và tệp nén trong allow-list; tối đa 10 MiB/tệp, 25 MiB/tin), nhận tin mới gần thời gian thực. Mobile sinh `clientMessageId` và giữ nguyên khi retry để server không tạo tin trùng. Tệp được xác minh extension/MIME/chữ ký, lưu riêng tư trên Cloudinary; API chỉ trả URL tải có hạn 15 phút. Antivirus/quarantine không thuộc v1. Server lưu message và outbox reference trong cùng transaction; worker fan-out sau commit vào `user:{userId}`, không broadcast qua meetup room có thể còn socket cũ. Participant được accepted sau có quyền đọc toàn bộ lịch sử trước lúc tham gia.
**Ngoại lệ:** Không phải member, declined, meetup inactive hoặc former member gửi tin thì bị từ chối; former member không thấy message sau `leftAt`; mạng mất thì HTTP vẫn đọc lại message đã lưu và UI báo trạng thái gửi.
**Kết quả:** Các thành viên trao đổi được về kế hoạch trong đúng meetup.

### UC-12A Chat riêng giữa bạn bè

**Tác nhân:** Hai tài khoản đã chấp nhận kết bạn.
**Điều kiện trước:** Friendship vẫn ở trạng thái `accepted`; mỗi message có văn bản hoặc tệp hợp lệ.
**Luồng chính:** Gửi/đọc lịch sử tại `GET/POST /api/v1/chats/direct/:peerId/messages`; mobile gửi `clientMessageId` ổn định qua mọi lần retry; message được lưu theo conversation chuẩn hóa cặp user và phát realtime reference `direct:chat-message` vào hai user room. Có thể gửi kèm tệp theo cùng giới hạn UC-12.
**Ngoại lệ:** Người lạ hoặc lời mời pending không thể gửi/đọc. Sau unfriend hoặc block, hai bên không thể gửi thêm hoặc tạo conversation mới nhưng vẫn chỉ đọc được lịch sử conversation đã tồn tại; PostgreSQL kiểm tra friendship khi insert để đóng race với thao tác unfriend/block.
**Kết quả:** Chỉ hai người bạn đã chấp nhận trao đổi được tin nhắn riêng.

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

### UC-16 Chia sẻ liên kết mời meetup

**Tác nhân:** Người tạo meetup, Người nhận liên kết.

**Điều kiện trước:** Meetup còn nhận thành viên; organizer đã đăng nhập.

**Luồng chính:** Organizer tạo link có hạn; backend trả raw URL một lần và lưu hash token. Link có thể được nhiều người dùng cho đến expiry/revoke. Người nhận mở link, đăng nhập, xem preview tối thiểu và xác nhận tham gia. Backend kiểm tra token, deadline, trạng thái meetup rồi thêm/chuyển participant sang `accepted` trong transaction; accept lại của cùng actor trả membership hiện có và không tăng `useCount`. Organizer có thể thu hồi hoặc rotate bằng cách tạo link mới với `revokePrevious=true`, thao tác này thu hồi mọi link hiệu lực trước đó trong cùng transaction.

**Ngoại lệ:** Token sai/hết hạn/đã thu hồi, meetup đã khóa/hủy/kết thúc, actor đã bị loại theo policy hoặc request vượt rate limit.
**Kết quả:** Người nhận tham gia meetup qua link nhưng mọi luật membership hiện có vẫn được giữ; không lộ danh sách thành viên hoặc vị trí trong preview công khai.

### UC-17 Kết bạn bằng QR hybrid

**Tác nhân:** Người dùng tạo QR, Người dùng quét QR.

**Điều kiện trước:** Hai bên đã đăng nhập khi gửi lời mời kết bạn.

**Luồng chính:** Với QR hồ sơ, app mã hóa public profile URL; người quét xem preview tối thiểu rồi gửi request với `recipientPublicHandle`, không phải internal ID. Với QR tạm thời, backend tạo token TTL trong Redis; app mã hóa URL token, người quét resolve token rồi gửi request với `qrSessionToken`. Controller resolve public handle/session token và cả hai nhánh gọi cùng service tạo friendship.

**Ngoại lệ:** QR tắt/hết hạn/thu hồi, tự quét, đã có friendship/pending request, bị block hoặc rate limit.
**Kết quả:** Tạo pending friend request hoặc trả trạng thái quan hệ hiện có; không lưu ảnh QR và không nhúng dữ liệu cá nhân nhạy cảm vào mã.

## 7. Dữ liệu cần lưu

| Nhóm | Dữ liệu chính | Nơi lưu |
|---|---|---|
| Tài khoản | User, refresh token, profile, trạng thái khóa | PostgreSQL |
| Quan hệ | Friendship, lời mời bạn bè, `user_accounts.public_handle` ổn định (unique/nullable) | PostgreSQL |
| Meetup | Meetup, MeetupMember, MeetupMemberPreference, Vote, PlaceSnapshot, FavoritePlace, ChatMessage, hash/token metadata của link mời | PostgreSQL |
| Profile | UserPreference dùng để điền sẵn preference meetup | PostgreSQL |
| Quyền | PrivacySetting, thời hạn chia sẻ | PostgreSQL |
| Context mở rộng | NearbyPreference, ngưỡng gần, lần gợi ý gần nhất, AI explanation cache đã ẩn dữ liệu nhạy cảm | PostgreSQL hoặc Redis TTL |
| Realtime | LatestLocation, presence, active meetup, socket room, phiên QR kết bạn tạm thời | Redis có TTL |

`PlaceSnapshot` chỉ lưu thông tin nơi đã được chọn hoặc danh sách đã dùng cho meetup; không cần lưu toàn bộ lịch sử truy vấn.
