# Tài liệu tích hợp API cho Frontend

Nguồn chuẩn: 14 file controller, 16 controller class, 73 HTTP route decorator, DTO/validation, use case và exception filter hiện tại. Code được ưu tiên khi khác docs/Swagger.

## 1. Quy ước chung

- **Base path:** `/api/v1` (cấu hình `API_PREFIX`, mặc định `api/v1`).
- **Auth:** route ghi `Bearer user/admin` dùng header `Authorization: Bearer <accessToken>`. Không dùng cookie auth.
- **Request validation:** field thừa bị từ chối (`whitelist + forbidNonWhitelisted`); query được transform sang number khi DTO khai báo.
- **Validation error:** `400 { statusCode:400, code:'INVALID_INPUT', message:'Request validation failed', errors:[...] }`.
- **Domain error:** `{ statusCode:number, code:string, message:string, path:string }`.
- **Timestamp:** string ISO 8601; input thời điểm meetup/privacy phải có `Z` hoặc UTC offset.
- **Pagination:** response offset có `{items,total,offset,limit}`. Friends mặc định `offset=0,limit=20,max=50`; meetups mặc định `offset=0,limit=20,max=100`; chat cursor mặc định `limit=50,max=100`.
- **No-store:** response account, privacy, friend, meetup, recommendation, chat đều không nên cache lâu dài.
- **TypeScript:** tất cả type/interface được cung cấp tại [`fe-api-types.ts`](./fe-api-types.ts).

## 2. Authentication và profile

| STT | Nhóm | Tên | Method + Endpoint | Auth | Input | Response | Error | Mục đích |
|---|---|---|---|---|---|---|---|---|
| 1 | Auth | Register | `POST /api/v1/auth/register` | Public; throttle 10/phút | **Body:**<br>`email`: string email, bắt buộc, max 255<br>`password`: string, bắt buộc, 8–128<br>`displayName`: string, bắt buộc, 1–100<br>`deviceName`: string, tùy chọn, 1–150<br>Type: `RegisterRequest` | `201`<br>`AuthResponse` gồm access/refresh token, TTL và user | `400 – INVALID_INPUT`<br>`409 – email đã tồn tại` | Tạo tài khoản và session đầu tiên |
| 2 | Auth | Login | `POST /api/v1/auth/login` | Public; throttle 10/phút | **Body:** `email`, `password`, `deviceName?`<br>Type: `LoginRequest` | `200 AuthResponse` | `401 – INVALID_CREDENTIALS`<br>`403 – ACCOUNT_LOCKED` | Đăng nhập |
| 3 | Auth | Google OAuth start | `GET /api/v1/auth/google` | Public | Không input JSON | OAuth redirect | `401 – Google OAuth thất bại` | Bắt đầu OAuth; FE mở browser/deep link |
| 4 | Auth | Google OAuth callback | `GET /api/v1/auth/google/callback` | Public | Query do Google cung cấp | `200 AuthResponse` | `401 – OAuth identity không hợp lệ` | Hoàn tất OAuth |
| 5 | Auth | Refresh token | `POST /api/v1/auth/refresh` | Public; throttle 30/phút | **Body:** `refreshToken`: string 1–4096<br>Type: `RefreshTokenRequest` | `200 AuthResponse` | `401 – INVALID_TOKEN` | Rotate token; thay cả hai token local |
| 6 | Auth | Logout | `POST /api/v1/auth/logout` | Public | **Body:** `refreshToken`<br>Type: `RefreshTokenRequest` | `204` | `401 – INVALID_TOKEN` | Thu hồi session |
| 7 | Auth | Current user | `GET /api/v1/auth/me` | Bearer user | — | `200 UserProfileResponse` | `401 – token invalid`<br>`403 – ACCOUNT_LOCKED` | Lấy profile caller |
| 8 | Auth | Update profile | `PATCH /api/v1/auth/profile` | Bearer user | **Body:** `displayName?` 1–100; `avatarUrl?` max 1000 hoặc null; `preferences?`<br>Type: `UpdateProfileRequest` | `200 UserProfileResponse` | `400 – INVALID_INPUT`<br>`404 – ACTIVITY_TAG_NOT_FOUND` | Partial update profile |
| 9 | Auth | Update me alias | `PATCH /api/v1/auth/me` | Bearer user | Giống STT 8 | `200 UserProfileResponse` | Giống STT 8 | Alias; FE chỉ cần dùng một route |
| 10 | Auth | Get preferences | `GET /api/v1/auth/preferences` | Bearer user | — | `200 UserPreferenceResponse` | `401/403` | Prefill preference UI |
| 11 | Auth | Save preferences | `PUT /api/v1/auth/preferences` | Bearer user | **Body:** `tags`: `{activityTagId?:number,tagCode?:string,level:'high'\|'normal'\|'avoid'}[]`<br>Type: `SaveUserPreferencesRequest` | `200 UserPreferenceResponse` | `400 – INVALID_PREFERENCE_LEVEL`<br>`404 – ACTIVITY_TAG_NOT_FOUND` | Replace profile preference |
| 12 | Auth | Activity tags | `GET /api/v1/auth/activity-tags` | Public | — | `200 ActivityTagResponse[]` | — | Danh mục tag, cache tối đa 300 giây |

## 3. Privacy và location

| STT | Nhóm | Tên | Method + Endpoint | Auth | Input | Response | Error | Mục đích |
|---|---|---|---|---|---|---|---|---|
| 13 | Privacy | Get settings | `GET /api/v1/auth/privacy` | Bearer user | — | `200 PrivacySettingsResponse` | `401/403/404` | Đọc privacy hiện tại |
| 14 | Privacy | Replace settings | `PUT /api/v1/auth/privacy` | Bearer user | **Body:** `sharingMode`; `sharingExpiresAt:string\|null`; `useApproximateLocation:boolean`; `nearbyFeatureEnabled:boolean`; `selectedFriendIds:uuid[]` unique max 100<br>Type: `SavePrivacySettingsRequest` | `200 PrivacySettingsResponse` | `400 – INVALID_INPUT` | Replace toàn bộ configuration |
| 15 | Privacy | Remove selected friend | `DELETE /api/v1/auth/privacy/selected-friends/:friendId` | Bearer user | **Params:** `friendId`: UUID<br>Type: `{friendId:UUID}` | `204` | `400 – invalid UUID` | Idempotent; có thể downgrade mode khi danh sách rỗng |
| 16 | Location | Publish location | `POST /api/v1/locations` | Bearer user | **Body:** `latitude` -90..90; `longitude` -180..180; `accuracy>=0`; `recordedAt`: ISO; `meetupId?`: UUID<br>Type: `PublishLocationRequest` | `200 PublishLocationResponse` | `400 – INVALID_LOCATION_SAMPLE`<br>`403 – LOCATION_ACCESS_DENIED` | Lưu latest location TTL 5 phút |
| 17 | Location | Get projected location | `GET /api/v1/locations/:ownerId` | Bearer user | **Params:** `ownerId`: UUID<br>**Query:** `scope?:friends\|meetup`; `meetupId?:UUID` bắt buộc khi meetup<br>Type: `LocationPermissionParams` | `200 ProjectedLocationResponse \| null` | `403 – LOCATION_ACCESS_DENIED` | Trả exact/rounded theo privacy, không trả history |
| 18 | Location | Check permission | `GET /api/v1/locations/permissions/:ownerId` | Bearer user | Params/query giống STT 17 | `200 LocationPermissionResponse` | `400 – invalid scope/UUID`<br>`403 – account locked` | Pre-check UI; không tạo reusable grant |

## 4. Friends và QR

| STT | Nhóm | Tên | Method + Endpoint | Auth | Input | Response | Error | Mục đích |
|---|---|---|---|---|---|---|---|---|
| 19 | Friends | Search users | `GET /api/v1/friends/search` | Bearer user | **Query:** `q` string 1–255; `offset?` 0..100000; `limit?` 1..50<br>Type: `SearchFriendsParams` | `200 FriendSearchResponse` | `400 – INVALID_INPUT` | Search active user + friendship state |
| 20 | Friends | List friends | `GET /api/v1/friends` | Bearer user | **Query:** paging<br>Type: `FriendPageParams` | `200 FriendshipListResponse` | `401/403` | Accepted friends |
| 21 | Friends | Pending requests | `GET /api/v1/friends/requests` | Bearer user | **Query:** `direction?:received\|sent`, paging<br>Type: `FriendRequestsParams` | `200 FriendshipListResponse` | `400 – INVALID_INPUT` | Inbox/outbox request |
| 22 | Friends | Resolve stable QR | `GET /api/v1/friends/qr-profiles/:publicHandle` | Bearer user | **Params:** opaque handle 43 chars | `200 PublicQrProfileResponse` | `404 – FRIEND_QR_NOT_FOUND`<br>`429 – FRIEND_QR_RATE_LIMITED` | Preview stable profile; không tự gửi request |
| 23 | Friends | Resolve temporary QR | `GET /api/v1/friends/qr-sessions/:token` | Bearer user | **Params:** opaque token 43 chars | `200 TemporaryQrProfileResponse` | `404/429` | Preview session còn hạn |
| 24 | Friends | Revoke temporary QR | `DELETE /api/v1/friends/qr-sessions/:sessionId` | Bearer user/owner | **Params:** sessionId UUID | `204` | `404/429` | Revoke session |
| 25 | Friends | Create temporary QR | `POST /api/v1/friends/qr-sessions` | Bearer user | — | `201 CreateFriendQrSessionResponse` | `429` | Trả QR URL/token tạm, không log/lưu dài hạn ở FE |
| 26 | Friends | Rotate public handle | `POST /api/v1/friends/public-handle/rotate` | Bearer user | — | `200 PublicHandleResponse` (non-null) | `429` | Handle cũ bị vô hiệu |
| 27 | Friends | Get public handle | `GET /api/v1/friends/public-handle` | Bearer user | — | `200 PublicHandleResponse` | `429` | null = disabled/chưa tạo |
| 28 | Friends | Disable public handle | `DELETE /api/v1/friends/public-handle` | Bearer user | — | `204` | `429` | Tắt stable QR |
| 29 | Friends | Send request | `POST /api/v1/friends/requests` | Bearer user | **Body:** đúng một selector trong `recipientId`, `recipientPublicHandle`, `qrSessionToken`<br>Type: `SendFriendRequest` | `201 FriendshipResponse \| QrFriendRequestResponse` | `400 – SELF_FRIENDSHIP/selector`<br>`404 – FRIEND_USER_NOT_FOUND`<br>`409 – FRIENDSHIP_ALREADY_EXISTS`<br>`429` | Gửi request; QR resolve và send là hai bước riêng |
| 30 | Friends | Accept request | `POST /api/v1/friends/requests/:requestId/accept` | Bearer recipient | **Params:** requestId UUID | `200 FriendshipResponse` | `403 – FRIENDSHIP_RESPONSE_FORBIDDEN`<br>`404 – FRIENDSHIP_NOT_FOUND`<br>`409 – FRIENDSHIP_NOT_PENDING` | Accept |
| 31 | Friends | Reject request | `POST /api/v1/friends/requests/:requestId/reject` | Bearer recipient | UUID path | `200 FriendshipResponse` | Giống STT 30 | Reject |
| 32 | Friends | Unfriend | `DELETE /api/v1/friends/:friendshipId` | Bearer participant | UUID path | `204` | `404 – FRIENDSHIP_NOT_FOUND`<br>`409 – FRIENDSHIP_NOT_ACCEPTED` | Chặn gửi direct mới; không xóa history |

## 5. Meetups, preferences, vote và invite links

| STT | Nhóm | Tên | Method + Endpoint | Auth | Input | Response | Error | Mục đích |
|---|---|---|---|---|---|---|---|---|
| 33 | Meetups | Create meetup | `POST /api/v1/meetups` | Bearer user | **Body:** `CreateMeetupRequest`: title 1–150; description? max1000; scheduled/deadlines ISO+offset; radius 100..50000; placeType regex; inviteeIds UUID[] unique min1 | `201 MeetupDetailResponse` | `400 – MEETUP_INVITEE_UNAVAILABLE/INVALID_INPUT` | Organizer tự accepted |
| 34 | Meetups | List meetups | `GET /api/v1/meetups` | Bearer user | Query `offset?`, `limit?`<br>Type: `MeetupPageParams` | `200 MeetupListResponse` | `401/403` | Invited/accepted/closed visible |
| 35 | Meetups | History | `GET /api/v1/meetups/history` | Bearer user | Paging | `200 MeetupHistoryListResponse` | `401/403` | Finished meetup + selected snapshot |
| 36 | Meetups | Detail | `GET /api/v1/meetups/:meetupId` | Bearer visible actor | meetupId UUID | `200 MeetupDetailResponse` | `404 – MEETUP_NOT_FOUND` | Canonical state cho UI |
| 37 | Meetups | Update | `PATCH /api/v1/meetups/:meetupId` | Bearer organizer | UUID + partial `UpdateMeetupRequest` | `200 MeetupDetailResponse` | `403 – MEETUP_FORBIDDEN`<br>`409 – state/deadline conflict` | Update trước finalization |
| 38 | Meetups | Invite participants | `POST /api/v1/meetups/:meetupId/invitations` | Bearer organizer | `{inviteeIds:UUID[]}`<br>Type: `InviteParticipantsRequest` | `200 MeetupDetailResponse` | `400 – MEETUP_INVITEE_UNAVAILABLE`<br>`403` | Invite/reinvite accepted friends |
| 39 | Meetups | Accept invitation | `POST /api/v1/meetups/:meetupId/invitations/accept` | Bearer invitee | UUID path | `200 MeetupDetailResponse` | `404/409` | Accept |
| 40 | Meetups | Reject invitation | `POST /api/v1/meetups/:meetupId/invitations/reject` | Bearer invitee | UUID path | `200 MeetupDetailResponse` | `404/409` | Reject |
| 41 | Meetups | Leave meetup | `POST /api/v1/meetups/:meetupId/leave` | Bearer member | UUID path | `200 MeetupDetailResponse` | `403/409` | Leave; history chat chỉ tới leftAt |
| 42 | Meetups | Remove participant | `DELETE /api/v1/meetups/:meetupId/participants/:userId` | Bearer organizer | Hai UUID path | `200 MeetupDetailResponse` | `403 – MEETUP_FORBIDDEN` | Remove member |
| 43 | Meetups | Cancel | `POST /api/v1/meetups/:meetupId/cancel` | Bearer organizer | UUID | `200 MeetupDetailResponse` | `403/409` | Cancel |
| 44 | Meetups | Finish | `POST /api/v1/meetups/:meetupId/finish` | Bearer organizer | UUID | `200 MeetupDetailResponse` | `409 – MEETUP_VOTING_OPEN/invalid state` | Finish selected meetup sau scheduled start |
| 45 | Preferences | Get my meetup preference | `GET /api/v1/meetups/:meetupId/preferences` | Bearer member | UUID | `200 MeetupMemberPreferenceResponse` | `404/403` | Explicit hoặc profile fallback |
| 46 | Preferences | Set meetup preference | `PUT /api/v1/meetups/:meetupId/preferences` | Bearer member | `{preferences:{activityTagId>=1,level}[]}`<br>Type: `SetMeetupPreferencesRequest` | `200 MeetupMemberPreferenceResponse` | `400/404` | Replace; empty = clear explicit |
| 47 | Preferences | Preference summary | `GET /api/v1/meetups/:meetupId/preferences/summary` | Bearer member | UUID | `200 MeetupPreferenceSummaryResponse` | `403/404` | Pre-check trước recommendation |
| 48 | Vote | Cast/change vote | `PUT /api/v1/meetups/:meetupId/recommendation-runs/:runId/vote` | Bearer accepted | UUID params + `{recommendationPlaceId:UUID}`<br>Type: `CastMeetupVoteRequest` | `200 CastMeetupVoteResponse` | `409 – RECOMMENDATION_STALE_CONTEXT/MEETUP_VOTING_CLOSED`<br>`400 – candidate ngoài run` | Một active vote/member; retry cùng candidate không đổi |
| 49 | Vote | Finalize | `POST /api/v1/meetups/:meetupId/recommendation-runs/:runId/finalize` | Bearer organizer | `{recommendationPlaceId?:UUID}`<br>Type: `FinalizeMeetupRequest` | `200 FinalizeMeetupResponse` | `403 – MEETUP_FORBIDDEN`<br>`409 – stale/state`<br>`400 – không vote và không explicit selection` | Omit ID để dùng vote winner |
| 50 | Invite link | Create link | `POST /api/v1/meetups/:meetupId/invite-links` | Bearer organizer | `{expiresAt:ISO,revokePrevious?:boolean}`<br>Type: `CreateMeetupInviteLinkRequest` | `201 MeetupInviteLinkResponse` | `400 – MEETUP_INVITE_LINK_INVALID_EXPIRY`<br>`403`<br>`409`<br>`429` | Raw URL chỉ trả lúc tạo |
| 51 | Invite link | Revoke link | `DELETE /api/v1/meetups/:meetupId/invite-links/:linkId` | Bearer organizer | UUID params | `204` | `403/404/429` | Revoke |
| 52 | Invite link | Preview | `GET /api/v1/meetup-invites/:token/preview` | Public | opaque token path | `200 MeetupInvitePreviewResponse` | `404/429` | Không trả participant/location |
| 53 | Invite link | Accept | `POST /api/v1/meetup-invites/:token/accept` | Bearer user | opaque token | `200 AcceptMeetupInviteResponse` | `404/429` | Join bằng link |

## 6. Recommendations và favorites

| STT | Nhóm | Tên | Method + Endpoint | Auth | Input | Response | Error | Mục đích |
|---|---|---|---|---|---|---|---|---|
| 54 | Recommendation | Candidate search | `POST /api/v1/meetups/:meetupId/recommendations/candidates` | Bearer organizer active | meetupId UUID; không body | `200 CandidateSearchResponse` | `400 – RECOMMENDATION_INSUFFICIENT_LOCATIONS`<br>`403`<br>`503 – PLACE_SEARCH_UNAVAILABLE` | Candidate-only search quanh center server |
| 55 | Recommendation | Create run | `POST /api/v1/meetups/:meetupId/recommendation-runs` | Bearer authorized | **Header:** `Idempotency-Key?:UUID`<br>**Body:** `topK`1..5; filters categories 1..3, opening enum, radius 1..10000<br>Type: `CreateRecommendationRunRequest` | `200 RecommendationRunResponse` | `409 – IDEMPOTENCY_KEY_REUSED/RUN_IN_PROGRESS`<br>`422 – NO_ELIGIBLE_CANDIDATES/NO_ROUTABLE_CANDIDATES`<br>`503 – provider` | Tạo synchronous immutable run |
| 56 | Recommendation | Get run | `GET /api/v1/meetups/:meetupId/recommendation-runs/:runId` | Bearer accepted | UUID params | `200 RecommendationRunResponse` | `403 – RECOMMENDATION_RUN_FORBIDDEN`<br>`404 – RECOMMENDATION_RUN_NOT_FOUND` | Viewer-aware snapshot; check contextStatus |
| 57 | Recommendation | Record impression | `POST /api/v1/meetups/:meetupId/recommendation-runs/:runId/impressions` | Bearer accepted | `RecordRecommendationImpressionRequest` | `200 RecommendationEventReceiptResponse` | `404 – candidate/run`<br>`409 – RECOMMENDATION_EVENT_ID_REUSED` | Gửi khi card thực sự render |
| 58 | Recommendation | Record feedback | `POST /api/v1/meetups/:meetupId/recommendation-runs/:runId/feedback-events` | Bearer accepted | `RecordRecommendationFeedbackRequest` | `200 RecommendationEventReceiptResponse` | `409 – RECOMMENDATION_NOT_SHOWN/EVENT_ID_REUSED` | Navigation/other post-display event; vote/finalize/favorite đã tự link server-side |
| 59 | Recommendation | Replay audit | `POST /api/v1/meetups/:meetupId/recommendation-runs/:runId/replay` | Bearer accepted | UUID params | `200 ReplayRecommendationRunResponse` | `403/404`<br>`409 – version/snapshot mismatch` | Recompute từ snapshot; providerCalls=0 |
| 60 | Favorite | List favorites | `GET /api/v1/favorites/places` | Bearer user | — | `200 FavoritePlaceResponse[]` | `401/403` | Favorite của caller |
| 61 | Favorite | Add favorite | `POST /api/v1/favorites/places` | Bearer user | `{placeId:string 1..300}`<br>Type: `AddFavoritePlaceRequest` | `201 FavoritePlaceResponse` | `404 – RECOMMENDATION_CANDIDATE_NOT_FOUND` | Duplicate idempotent |
| 62 | Favorite | Remove favorite | `DELETE /api/v1/favorites/places/:placeId` | Bearer user | URL-encoded placeId 1..300 | `204` | `400 – invalid length` | Idempotent remove |

Privacy: `memberEtas` có thể hiển thị cho mọi accepted participant; `viewerFeature` chỉ thuộc caller. Không hiển thị/suy luận preference hoặc utility của người khác.

## 7. Chat, notifications, admin và system

| STT | Nhóm | Tên | Method + Endpoint | Auth | Input | Response | Error | Mục đích |
|---|---|---|---|---|---|---|---|---|
| 63 | Meetup chat | List messages | `GET /api/v1/meetups/:meetupId/chat/messages` | Bearer member/former | **Query:** `before?` ISO và `beforeId?` UUID phải đi cùng; `limit?`1..100<br>Type: `ChatMessagePageParams` | `200 MeetupChatMessageResponse[]` | `400 – INVALID_INPUT`<br>`403 – CHAT_FORBIDDEN` | Late member xem full history; former tới leftAt |
| 64 | Meetup chat | Send message | `POST /api/v1/meetups/:meetupId/chat/messages` | Bearer accepted, active meetup | **multipart:** clientMessageId UUID bắt buộc; text? max2000; files? max5, 10MiB/file, 25MiB/tổng<br>Type: `SendChatMessageRequest` | `201 MeetupChatMessageResponse` | `400 – INVALID_INPUT/file signature`<br>`403 – CHAT_FORBIDDEN` | Retry cùng clientMessageId không duplicate |
| 65 | Direct chat | List messages | `GET /api/v1/chats/direct/:peerId/messages` | Bearer participant | Cursor query như STT63 | `200 DirectChatMessageResponse[]` | `403 – DIRECT_CHAT_FORBIDDEN` nếu chưa từng có conversation và không accepted friend | History cũ vẫn đọc sau unfriend/block |
| 66 | Direct chat | Send message | `POST /api/v1/chats/direct/:peerId/messages` | Bearer accepted friend | multipart như STT64 | `201 DirectChatMessageResponse` | `400`<br>`403 – DIRECT_CHAT_FORBIDDEN` | Conversation tạo ở tin hợp lệ đầu tiên |
| 67 | Notifications | Register device | `POST /api/v1/notifications/devices` | Bearer user | `{token:string 20..4096,platform:'android'\|'ios'}`<br>Type: `RegisterDeviceTokenRequest` | `201 DeviceTokenMutationResponse` | `400 – INVALID_INPUT` | Đăng ký FCM/APNs token |
| 68 | Notifications | Update device | `PUT /api/v1/notifications/devices/:deviceTokenId` | Bearer owner | UUID + body như STT67 | `200 DeviceTokenMutationResponse` | `403/404 – device access error` | Rotate token/platform |
| 69 | Notifications | Revoke device | `DELETE /api/v1/notifications/devices/:deviceTokenId` | Bearer owner | UUID | `204` | `403/404` | Logout/revoke device |
| 70 | Admin | Lock account | `POST /api/v1/admin/accounts/:accountId/lock` | Bearer admin | accountId UUID + `{reason:string}`<br>Type: `AdminAccountLockRequest` | `200 AdminAccountLockResponse` | `403 – admin required`<br>`404 – ACCOUNT_NOT_FOUND`<br>`409 – ADMIN_SELF_LOCK` | Khóa và revoke session |
| 71 | Admin | Unlock account | `DELETE /api/v1/admin/accounts/:accountId/lock` | Bearer admin | accountId UUID | `200 AdminAccountLockResponse` | `403/404` | Mở khóa |
| 72 | System | Liveness | `GET /api/v1/health` | Public | — | `200 HealthResponse` | — | Process đang chạy |
| 73 | System | Readiness | `GET /api/v1/health/ready` | Public | — | `200 ReadyResponse` hoặc `503 NotReadyResponse` | `503 – PostgreSQL/Redis/outbox worker unavailable` | Quyết định instance nhận traffic |

Chat attachment response chứa `downloadUrl` signed có hạn và `expiresAt`; FE không persist URL. Outbox/realtime không chứa text/file metadata, vì vậy phải fetch REST resource sau event.

## 8. Socket.IO realtime

- Namespace: `/realtime`.
- Handshake auth: `auth: { token: accessToken }` hoặc `Authorization: Bearer ...`.
- Kết nối thành công tự join room cá nhân. `meetup:join` chỉ accepted member.

| STT | Event | Hướng | Payload | Ack/Error | Type |
|---|---|---|---|---|---|
| R1 | `presence:heartbeat` | client → server | Không payload | `{ok:true}` | `PresenceHeartbeatAck` |
| R2 | `meetup:join` | client → server | `{meetupId:UUID}` | `{meetupId,joined:true}` hoặc WS `{code:'FORBIDDEN'\|'INVALID_EVENT_PAYLOAD'}` | `MeetupJoinMessage`, `MeetupJoinAck` |
| R3 | `location:update` | client → server | `LocationUpdateMessage` | `{accepted:true}` | `LocationUpdateMessage`, `LocationUpdateAck` |
| R4 | `location:updated` | server → client | `{ownerId,meetupId,location:ProjectedLocationResponse}` | — | `LocationUpdatedPayload` |
| R5 | `meetup:chat-message` | server → user room | `MeetupChatMessageCreatedV1` reference-only | — | `MeetupChatMessageCreatedV1` |
| R6 | `direct:chat-message` | server → user room | `DirectChatMessageCreatedV1` reference-only | — | `DirectChatMessageCreatedV1` |
| R7 | Integration event name (`MeetupCreated.v1`, `VoteUpdated.v1`, `MeetupFinalized.v1`, v.v.) | server → user/meetup room | Union `IntegrationEvent` | — | `IntegrationEvent` |

Sau event, FE refetch endpoint canonical; event không phải full UI model.

## 9. Swagger/OpenAPI đối chiếu

Không có `swagger.json`, `openapi.json` hoặc YAML được commit trong repo. `SwaggerModule` chỉ tạo document khi app boot và `SWAGGER_ENABLED=true`; trong phiên tạo tài liệu này không export runtime JSON. Do đó chỉ đối chiếu được decorator Swagger trong controller với code/DTO.

| STT | Endpoint | Điểm khác biệt | Code | Swagger decorator |
|---|---|---|---|---|
| 1 | Chat GET/POST | Response schema chưa khai báo đầy đủ | Use case trả `MeetupChatMessageResponse`/`DirectChatMessageResponse` | Controller chủ yếu khai báo request multipart, thiếu response schema |
| 2 | Recommendation impression/feedback/replay | Response schema chưa khai báo | Use case trả receipt/replay result | Không có `@ApiOkResponse` schema chi tiết |
| 3 | Favorites | Request/response schema chưa khai báo đầy đủ | DTO/use case/entity xác định contract | Controller chỉ có tag/not-found decorator |
| 4 | Admin lock/unlock | Response schema chưa khai báo | Public account-lock adapter trả mutation result | Controller không khai báo `@ApiOkResponse` |
| 5 | Candidate search | Opening contract mô tả `openNow` trong decorator cũ | Engine hiện dùng scheduled opening evidence cho run; candidate-only adapter vẫn có provider opening shape | Cần kiểm tra runtime JSON/client generator trước khi dùng field này cho UI |

Tài liệu và `fe-api-types.ts` theo code/DTO/use case, không theo phần Swagger thiếu.

## 10. Cần xác nhận

1. `AdminAccountLockResponse`: controller/use case không khai báo schema response chính xác ngoài `id/locked`; type giữ index signature `unknown` cho field bổ sung.
2. Không có Swagger JSON runtime để so sánh tự động đủ 73 endpoint; cần boot app với dependency thật và export document nếu FE dùng code generation.
3. `GET /locations/permissions/:ownerId` có mô tả controller rằng meetup-scope membership verification cần kết nối đầy đủ; không dùng endpoint này thay authorization của GET location.
4. Candidate-only endpoint là API kỹ thuật trước run; UI production nên ưu tiên create/get `recommendation-runs` trừ khi luồng sản phẩm thật sự cần màn hình debug candidate.

## 11. Đối chiếu số lượng

- Controller files: **14**.
- Controller classes: **16**.
- HTTP route decorators trong source: **73**.
- HTTP endpoint rows trong tài liệu: **73** (STT 1–73).
- Socket client events: **3**; server event channels/contracts được liệt kê riêng.
