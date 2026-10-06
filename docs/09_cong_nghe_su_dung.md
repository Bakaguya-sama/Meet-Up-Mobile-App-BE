# Công nghệ sử dụng cho MeetUp

## 1. Mục đích

Tài liệu này chốt stack kỹ thuật và cách bố trí môi trường cho ứng dụng MeetUp. Mục tiêu là để mobile, backend và kiểm thử dùng cùng một quy ước, tránh việc mỗi thành viên tự chọn database, Redis client hoặc cách deploy khác nhau.

Kiến trúc tổng thể là **modular monolith**: một ứng dụng NestJS được deploy như một đơn vị, bên trong chia bounded context theo `08_huong_dan_cau_truc_ddd.md`. Project chưa dùng microservice.

## 2. Stack được chọn

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| Mobile | React Native, Expo, TypeScript | Ứng dụng Android, giao diện, GPS và push notification. |
| Backend | Node.js LTS, NestJS 11, TypeScript | REST API, WebSocket gateway, nghiệp vụ và tích hợp dịch vụ ngoài. |
| API | REST, OpenAPI/Swagger | API chính cho auth, bạn bè, meetup, recommendation và admin. |
| Realtime | Socket.IO | Vị trí khi app đang mở, presence, phản hồi lời mời, vote và chat. |
| Database bền vững | Neon PostgreSQL + PostGIS | User, friendship, meetup, vote, chat, place snapshot, audit và outbox. |
| ORM | TypeORM, migration | Mapping persistence, transaction và quản lý thay đổi schema. |
| Dữ liệu tạm thời | Redis | Latest location, presence, active meetup và cooldown có TTL. |
| Redis client | `ioredis` | Kết nối Redis từ NestJS; dùng chung cách cấu hình với BullMQ. |
| Background job | BullMQ | Gửi notification, nhắc lịch, retry và xử lý outbox ngoài transaction. |
| Push notification | Expo Notifications phía mobile, FCM phía server | Thông báo khi app background hoặc đã đóng. |
| Bản đồ và địa điểm | Google Maps SDK, Places API (New) | Hiển thị bản đồ và tìm địa điểm ứng viên. |
| Tuyến đường | Google Routes API, Compute Route Matrix | Tính ETA từng thành viên, Avg ETA và Max ETA. |
| Xác thực | Passport, JWT, Google Sign-In, Argon2 | Email/password, Google OAuth, access token và refresh token rotation. |
| Lưu token mobile | Expo SecureStore | Lưu refresh token an toàn trên thiết bị. |
| Object storage | Cloudinary ở giai đoạn đầu | Avatar và media chat; PostgreSQL chỉ lưu URL hoặc storage key. |
| Local infrastructure | Docker Compose | Chạy Redis local; có thể chạy PostgreSQL/PostGIS dự phòng hoặc phục vụ test. |
| Kiểm thử | Jest, Supertest, Testcontainers | Unit, integration và E2E cho HTTP, Socket, PostgreSQL và Redis. |
| Đóng gói | Docker | Tạo image backend giống nhau giữa staging và production. |

## 3. Sơ đồ triển khai

```mermaid
flowchart LR
    MOBILE[Expo mobile app]
    API[NestJS modular monolith]
    NEON[(Neon PostgreSQL + PostGIS)]
    REDIS[(Redis)]
    GOOGLE[Google Places and Routes]
    FCM[Firebase Cloud Messaging]
    STORAGE[Cloudinary]

    MOBILE -->|REST| API
    MOBILE <-->|Socket.IO| API
    API --> NEON
    API --> REDIS
    API --> GOOGLE
    API --> FCM
    API --> STORAGE
```

Socket.IO chỉ truyền cập nhật gần thời gian thực khi ứng dụng đang kết nối. FCM dùng cho thông báo khi ứng dụng ở background hoặc đã đóng. PostgreSQL là nguồn dữ liệu nghiệp vụ bền vững; Redis không thay thế PostgreSQL.

## 4. Chiến lược PostgreSQL với Neon

### 4.1 Môi trường phát triển

Nhóm dùng Neon cho cả development, staging và production. Mỗi thành viên phải dùng một Neon branch riêng, không cùng sửa trực tiếp một database development.

```text
Developer A -> branch dev-a
Developer B -> branch dev-b
Developer C -> branch dev-c
Demo/UAT    -> branch staging
Production  -> branch production
```

Branch của developer được tạo từ branch có schema ổn định gần nhất. Mọi thay đổi schema phải đi qua TypeORM migration và được commit vào Git. Không sửa schema thủ công rồi chỉ giữ thay đổi trên Neon Dashboard.

### 4.2 Chuỗi kết nối

Backend dùng hai chuỗi kết nối khác nhau:

```env
# Kết nối pooled cho API đang chạy.
DATABASE_URL=postgresql://user:password@endpoint-pooler.region.aws.neon.tech/meetup?sslmode=require

# Kết nối direct cho migration và tác vụ quản trị.
DATABASE_DIRECT_URL=postgresql://user:password@endpoint.region.aws.neon.tech/meetup?sslmode=require
```

- `DATABASE_URL` dùng cho NestJS runtime và TypeORM connection pool.
- `DATABASE_DIRECT_URL` dùng cho `migration:run`, `migration:revert` có kiểm soát và tác vụ quản trị.
- Không commit `.env`, connection string, password hoặc service-account key.
- NestJS dùng TypeORM với PostgreSQL driver `pg`; không dùng Neon serverless driver vì backend là tiến trình Node.js chạy lâu dài, không phải edge function.
- Bật PostGIS trên mỗi branch/database cần sử dụng bằng migration có kiểm soát:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 4.3 Quy tắc migration

1. Mỗi thay đổi schema phải có migration mới; không sửa migration đã chạy trên branch dùng chung.
2. Developer chạy migration trên branch cá nhân trước.
3. CI tạo database/test environment riêng, chạy toàn bộ migration và test.
4. Staging được migrate trước production.
5. Migration production chỉ chạy một lần trong deployment job, không tự chạy ở mọi replica NestJS khi khởi động.
6. Backup hoặc Neon branch snapshot phải được tạo trước migration có nguy cơ mất dữ liệu.

### 4.4 Khi nào dùng PostgreSQL local

PostgreSQL/PostGIS local không phải database phát triển mặc định. Container local chỉ dùng khi:

- cần làm việc offline;
- cần tái hiện lỗi không muốn ảnh hưởng Neon branch;
- chạy integration test cần tạo, reset và xóa dữ liệu tự động;
- CI không sử dụng một database test managed riêng.

## 5. Chiến lược Redis

### 5.1 Dữ liệu được lưu

Redis chỉ giữ dữ liệu ngắn hạn hoặc dữ liệu hạ tầng:

```text
location:{userId}                    TTL 5 phút
presence:{userId}                    TTL ngắn
active-meetup:{userId}               TTL theo phiên hoạt động
nearby-cooldown:{userA}:{userB}      TTL 2 giờ
bull:*                                Dữ liệu hàng đợi của BullMQ
```

Vị trí người dùng hết TTL không được dùng để tính ETA hoặc phát cho client. Không ghi lịch sử GPS vào PostgreSQL, outbox, audit log hoặc application log.

### 5.2 Redis theo môi trường

| Môi trường | Redis |
|---|---|
| Development | Redis chạy bằng Docker Compose trên máy developer. |
| Integration test | Redis container tạm thời qua Testcontainers hoặc Compose. |
| Staging | Managed Redis có kết nối TCP/TLS. |
| Production | Managed Redis có persistence/backup phù hợp và đặt gần backend. |

Managed Redis phải tương thích đầy đủ với Redis command/Lua script mà BullMQ sử dụng. Không chọn dịch vụ chỉ cung cấp REST API nếu BullMQ hoặc Socket.IO adapter cần kết nối Redis TCP lâu dài.

### 5.3 Redis client

Project dùng `ioredis` vì BullMQ sử dụng tốt client này và cần các khả năng reconnect, blocking connection, Pub/Sub, pipeline và Lua script.

```env
# Development
REDIS_URL=redis://localhost:6379

# Staging/production
REDIS_URL=rediss://default:password@managed-redis-host:port
```

Không dùng một connection duy nhất cho mọi trách nhiệm:

- command connection cho latest location, presence và TTL;
- subscriber connection riêng nếu dùng Pub/Sub;
- BullMQ Queue và Worker quản lý các connection cần thiết;
- Socket.IO Redis adapter có publisher/subscriber riêng khi được bật.

Connection phục vụ HTTP nên fail trong thời gian hữu hạn để API có thể trả `503`. BullMQ Worker được phép retry lâu dài và cần cấu hình `maxRetriesPerRequest: null` khi truyền trực tiếp một `ioredis` instance cho worker.

## 6. Vai trò của Docker Compose

Docker Compose không quyết định database phải local hay cloud. Nó chỉ khởi động các container mà môi trường hiện tại cần.

### Development mặc định

```text
NestJS: chạy bằng npm run start:dev
PostgreSQL: Neon branch cá nhân
Redis: Docker Compose local
```

Compose mặc định chỉ cần Redis:

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  redis_data:
```

Một Compose profile riêng có thể bổ sung image `postgis/postgis` cho offline development hoặc integration test. Production không chạy Neon trong Docker Compose; backend container kết nối đến Neon bằng `DATABASE_URL`.

## 7. REST, Socket.IO và push notification

### REST API

REST là kênh chính cho request cần response rõ ràng và trạng thái bền vững, ví dụ đăng nhập, tạo meetup, chấp nhận lời mời, tìm địa điểm và tải lịch sử. API được mô tả bằng OpenAPI/Swagger.

### Socket.IO

Socket.IO dùng cho:

- `location:update` và vị trí thành viên được phép xem;
- presence;
- cập nhật trạng thái participant;
- vote count;
- chat message;
- meetup được chốt, hủy hoặc kết thúc.

Gateway phải xác thực JWT khi kết nối và authorize lại khi join room hoặc xử lý event. Room không phải cơ chế phân quyền.

Ở giai đoạn đầu chỉ có một NestJS instance nên chưa cần Socket.IO Redis adapter. Chỉ thêm adapter khi backend chạy nhiều instance. Việc thêm adapter phải kèm cấu hình transport/load balancer phù hợp và test broadcast giữa các instance.

### Push notification

FCM dùng cho lời mời, địa điểm được chốt, nhắc giờ và thay đổi/hủy meetup khi app không hoạt động. Payload không chứa tọa độ chính xác, token xác thực hoặc nội dung nhạy cảm. Socket.IO không thay thế FCM và FCM không dùng để stream vị trí realtime.

## 8. Google Maps Platform

- Mobile dùng Google Maps SDK để hiển thị bản đồ, marker và mở dẫn đường.
- Backend gọi Places API (New) để tìm ứng viên theo loại và bán kính.
- Backend gọi Routes API `ComputeRouteMatrix` để lấy duration/distance từ thành viên đến các địa điểm.
- Chỉ yêu cầu các response field thực sự cần để giảm độ trễ và chi phí.
- Cache kết quả phù hợp theo place ID và thời gian ngắn; không cache vị trí người dùng như lịch sử.
- Google API key phía server và phía Android phải tách riêng, giới hạn API và restriction theo môi trường.

## 9. Xác thực và dữ liệu nhạy cảm

- Password được hash bằng Argon2, không mã hóa có thể giải ngược.
- Access token sống ngắn; refresh token được rotation và chỉ lưu hash ở PostgreSQL.
- Mobile lưu token bằng Expo SecureStore, không lưu trong AsyncStorage.
- Google Sign-In được backend xác minh token trước khi tạo phiên nội bộ.
- WebSocket dùng cùng danh tính đã xác thực với REST nhưng vẫn kiểm tra authorization theo từng meetup/location event.
- Không log password, access token, refresh token, connection string, tọa độ chính xác hoặc service-account credential.

## 10. Background job và outbox

Thay đổi domain và `outbox_events` được ghi trong cùng PostgreSQL transaction. Sau commit, worker đọc/publish event đến Socket.IO, FCM hoặc consumer khác.

BullMQ dùng cho:

- retry notification thất bại;
- nhắc lịch theo thời gian;
- tác vụ gọi dịch vụ ngoài cần retry/backoff;
- công việc không nên giữ HTTP request chờ lâu.

Không gọi Socket.IO, FCM hoặc AI trước khi transaction nghiệp vụ commit. Consumer phải idempotent vì job/event có thể được giao lại.

## 11. Kiểm thử

| Loại | Công cụ và môi trường |
|---|---|
| Domain unit test | Jest, không dùng database. |
| Application unit test | Jest với fake/in-memory port. |
| Repository integration | PostgreSQL/PostGIS container tạm thời, chạy migration thật. |
| Redis integration | Redis container thật; không chỉ dựa vào mock cho TTL/Lua/BullMQ. |
| HTTP E2E | Supertest với app NestJS test. |
| Socket E2E | `socket.io-client`, ít nhất hai user và kiểm tra authorization room. |
| External contract | Stub/recorded response cho Google, FCM và AI. |

Test tự động không chạy vào Neon branch development hoặc staging. Mỗi test suite phải có dữ liệu độc lập và cơ chế cleanup rõ ràng.

## 12. Biến môi trường tối thiểu

```env
NODE_ENV=development
PORT=3000

DATABASE_URL=
DATABASE_DIRECT_URL=
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

GOOGLE_CLIENT_ID=
GOOGLE_MAPS_API_KEY=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Project phải cung cấp `.env.example` chỉ chứa tên biến và giá trị mẫu không nhạy cảm. Staging và production lấy secret từ secret manager của nền tảng deploy, không copy `.env` vào Docker image.

## 13. Những lựa chọn chưa dùng

| Công nghệ | Quyết định |
|---|---|
| MongoDB/Firestore làm database chính | Không dùng vì dữ liệu có nhiều quan hệ, constraint và transaction. |
| Microservice | Không dùng khi chưa có nhu cầu scale/deploy/ownership độc lập được đo lường. |
| Neon serverless driver | Không dùng trong NestJS runtime; TypeORM kết nối bằng `pg`. |
| PostgreSQL production tự quản trong Compose | Không dùng khi đã chọn Neon managed PostgreSQL. |
| Redis lưu dữ liệu nghiệp vụ lâu dài | Không dùng; PostgreSQL vẫn là source of truth. |
| Socket.IO Redis adapter ngay từ đầu | Chưa dùng khi backend chỉ có một instance. |
| RabbitMQ/Kafka | Chưa cần; BullMQ + outbox đủ cho phạm vi hiện tại. |

## 14. Thứ tự triển khai nền tảng

1. Tạo Neon project, branch cho từng developer và bật PostGIS.
2. Thêm TypeORM, PostgreSQL driver, DataSource và migration scripts.
3. Tạo `.env.example`, validation cấu hình và quy tắc không log secret.
4. Thêm Redis Compose local và `ioredis` adapter.
5. Làm auth cùng vertical slice đầu tiên và integration test.
6. Thêm Socket.IO cùng xác thực/authorization.
7. Thêm BullMQ, outbox worker và FCM.
8. Tích hợp Google Places/Routes sau khi meetup và location contract ổn định.
9. Container hóa backend và tạo staging deployment.

Mỗi bước chỉ hoàn thành khi lint, test, build và migration từ database trống đều chạy thành công.
