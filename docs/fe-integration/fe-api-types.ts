/** Frontend-copyable API contracts derived from backend DTOs/controllers. */

export type UUID = string;
/** ISO 8601 string with timezone. */
export type ISODateTime = string;
export type PreferenceLevel = 'high' | 'normal' | 'avoid';
export type UserRole = 'user' | 'admin';

export interface ApiErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  path?: string;
  errors?: unknown[];
}

export interface OffsetPage<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Authentication / profile
// ---------------------------------------------------------------------------

export interface PreferenceInput {
  activityTagId?: number;
  tagCode?: string;
  level: PreferenceLevel;
}

export interface UserPreferenceTagResponse {
  activityTagId: number;
  tagCode: string;
  displayName: string;
  level: PreferenceLevel;
}

export interface UserPreferenceResponse {
  id?: UUID | null;
  userId: UUID;
  updatedAt?: ISODateTime | null;
  tags: UserPreferenceTagResponse[];
}

export interface UserProfileResponse {
  id: UUID;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  preferences?: UserPreferenceResponse | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresIn: number;
  user: UserProfileResponse;
}

/** POST /auth/register */
export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  deviceName?: string;
}

/** POST /auth/login */
export interface LoginRequest {
  email: string;
  password: string;
  deviceName?: string;
}

/** POST /auth/refresh and POST /auth/logout */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/** PATCH /auth/profile and PATCH /auth/me */
export interface UpdateProfileRequest {
  displayName?: string;
  avatarUrl?: string | null;
  preferences?: PreferenceInput[];
}

/** PUT /auth/preferences */
export interface SaveUserPreferencesRequest {
  tags: PreferenceInput[];
}

export interface ActivityTagResponse {
  id: number;
  code: string;
  displayName: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Privacy / location
// ---------------------------------------------------------------------------

export type SharingMode = 'off' | 'friends' | 'selected_friends' | 'meetup_only';
export type LocationScope = 'friends' | 'meetup';

/** PUT /auth/privacy */
export interface SavePrivacySettingsRequest {
  sharingMode: SharingMode;
  sharingExpiresAt: ISODateTime | null;
  useApproximateLocation: boolean;
  nearbyFeatureEnabled: boolean;
  selectedFriendIds: UUID[];
}

/** GET/PUT /auth/privacy */
export interface PrivacySettingsResponse extends SavePrivacySettingsRequest {
  isLocationSharingEnabled: boolean;
  updatedAt: ISODateTime | null;
}

/** POST /locations */
export interface PublishLocationRequest {
  latitude: number;
  longitude: number;
  accuracy: number;
  recordedAt: ISODateTime;
  meetupId?: UUID;
}

export interface PublishLocationResponse {
  accepted: boolean;
  expiresInSeconds: number;
}

/** GET /locations/:ownerId and /locations/permissions/:ownerId */
export interface LocationPermissionParams {
  ownerId: UUID;
  scope?: LocationScope;
  meetupId?: UUID;
}

export interface ProjectedLocationResponse {
  latitude: number;
  longitude: number;
  accuracy: number;
  recordedAt: ISODateTime;
  isApproximate: boolean;
}

export interface LocationPermissionResponse {
  allowed: boolean;
  precision: 'precise' | 'approximate' | null;
  expiresAt: ISODateTime | null;
}

// ---------------------------------------------------------------------------
// Friends / QR
// ---------------------------------------------------------------------------

export type FriendshipStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';

export interface FriendshipResponse {
  id: UUID;
  userAId: UUID;
  userBId: UUID;
  requestedById: UUID;
  status: FriendshipStatus;
  requestedAt: ISODateTime;
  respondedAt: ISODateTime | null;
  updatedAt: ISODateTime;
}

export interface FriendUserResponse {
  id: UUID;
  displayName: string;
  avatarUrl: string | null;
}

export interface FriendSearchItemResponse extends FriendUserResponse {
  friendship: FriendshipResponse | null;
}

export interface FriendshipListItemResponse extends FriendshipResponse {
  user: FriendUserResponse | null;
}

export type FriendSearchResponse = OffsetPage<FriendSearchItemResponse>;
export type FriendshipListResponse = OffsetPage<FriendshipListItemResponse>;

/** GET /friends/search */
export interface SearchFriendsParams {
  q: string;
  offset?: number;
  limit?: number;
}

/** GET /friends and /friends/requests */
export interface FriendPageParams {
  offset?: number;
  limit?: number;
}

export interface FriendRequestsParams extends FriendPageParams {
  direction?: 'received' | 'sent';
}

/** POST /friends/requests: exactly one selector. */
export type SendFriendRequest =
  | { recipientId: UUID; recipientPublicHandle?: never; qrSessionToken?: never }
  | { recipientId?: never; recipientPublicHandle: string; qrSessionToken?: never }
  | { recipientId?: never; recipientPublicHandle?: never; qrSessionToken: string };

export interface QrFriendRequestResponse {
  status: 'pending';
  requestedAt: ISODateTime;
}

export interface PublicQrProfileResponse {
  publicHandle: string;
  displayName: string;
  avatarUrl: string | null;
  friendship: FriendshipStatus | null;
}

export interface TemporaryQrProfileResponse {
  displayName: string;
  avatarUrl: string | null;
  friendship: FriendshipStatus | null;
}

export interface CreateFriendQrSessionResponse {
  sessionId: UUID;
  qrUrl: string;
  expiresAt: ISODateTime;
}

export interface PublicHandleResponse {
  publicHandle: string | null;
}

// ---------------------------------------------------------------------------
// Meetups / preferences / history
// ---------------------------------------------------------------------------

export type MeetupStatus =
  | 'draft' | 'inviting' | 'choosing' | 'selected' | 'cancelled' | 'finished';
export type ParticipantStatus = 'invited' | 'accepted' | 'declined' | 'left' | 'removed';

export interface CreateMeetupRequest {
  title: string;
  description?: string | null;
  scheduledAt: ISODateTime;
  invitationDeadlineAt: ISODateTime;
  voteDeadlineAt?: ISODateTime | null;
  searchRadiusM: number;
  placeType: string;
  inviteeIds: UUID[];
}

export interface UpdateMeetupRequest {
  title?: string;
  description?: string | null;
  scheduledAt?: ISODateTime;
  invitationDeadlineAt?: ISODateTime;
  voteDeadlineAt?: ISODateTime | null;
  searchRadiusM?: number;
  placeType?: string;
}

export interface InviteParticipantsRequest { inviteeIds: UUID[] }
export interface MeetupPageParams { offset?: number; limit?: number }

export interface MeetupParticipantResponse {
  id: UUID;
  userId: UUID;
  invitedById: UUID;
  status: ParticipantStatus;
  respondedAt: ISODateTime | null;
  joinedAt: ISODateTime | null;
  leftAt: ISODateTime | null;
}

export interface MeetupSummaryResponse {
  id: UUID;
  organizerId: UUID;
  title: string;
  description?: string | null;
  scheduledAt: ISODateTime;
  invitationDeadlineAt: ISODateTime;
  voteDeadlineAt: ISODateTime | null;
  searchRadiusM: number;
  placeType: string;
  status: MeetupStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  cancelledAt: ISODateTime | null;
  finishedAt: ISODateTime | null;
  chosenRecommendationPlaceId: UUID | null;
  chosenRunId: UUID | null;
  chosenById: UUID | null;
  chosenAt: ISODateTime | null;
}

export interface MeetupDetailResponse extends MeetupSummaryResponse {
  participants: MeetupParticipantResponse[];
}

export type MeetupListResponse = OffsetPage<MeetupSummaryResponse>;

export interface SelectedPlaceHistoryResponse {
  recommendationPlaceId: UUID;
  canonicalCandidateKey: string;
  provider: string;
  providerPlaceId: string;
  name: string;
}

export interface MeetupHistoryItemResponse {
  meetupId: UUID;
  title: string;
  description: string | null;
  scheduledAt: ISODateTime;
  finishedAt: ISODateTime;
  selectedPlace: SelectedPlaceHistoryResponse;
}

export type MeetupHistoryListResponse = OffsetPage<MeetupHistoryItemResponse>;

export interface MeetupPreferenceInput {
  activityTagId: number;
  level: PreferenceLevel;
}

export interface SetMeetupPreferencesRequest { preferences: MeetupPreferenceInput[] }

export interface MeetupPreferenceTagResponse extends UserPreferenceTagResponse {
  source: 'meetup_input' | 'profile_fallback';
  updatedAt: ISODateTime | null;
}

export interface MeetupMemberPreferenceResponse {
  meetupId: UUID;
  participantId: UUID;
  userId: UUID;
  hasExplicitMeetupPreference: boolean;
  tags: MeetupPreferenceTagResponse[];
}

export interface MeetupPreferenceSummaryResponse {
  meetupId: UUID;
  totalParticipants: number;
  submittedCount: number;
  fallbackCount: number;
  participants: Array<{
    participantId: UUID; userId: UUID; status: ParticipantStatus;
    hasExplicitMeetupPreference: boolean;
    source: 'meetup_input' | 'profile_fallback';
    tags: MeetupPreferenceTagResponse[];
  }>;
}

// ---------------------------------------------------------------------------
// Meetup invite links
// ---------------------------------------------------------------------------

export interface CreateMeetupInviteLinkRequest {
  expiresAt: ISODateTime;
  revokePrevious?: boolean;
}

export interface MeetupInviteLinkResponse {
  id: UUID;
  inviteUrl: string;
  expiresAt: ISODateTime;
  revokedAt: null;
}

export interface MeetupInvitePreviewResponse {
  title: string;
  scheduledAt: ISODateTime;
  expiresAt: ISODateTime;
}

export interface AcceptMeetupInviteResponse {
  meetupId: UUID;
  status: 'accepted';
  alreadyMember: boolean;
}

// ---------------------------------------------------------------------------
// Recommendations / vote / feedback
// ---------------------------------------------------------------------------

export type OpeningFilter = 'ANY' | 'OPEN_AT_REQUEST_TIME' | 'OPEN_AT_SCHEDULED_TIME';
export type ContextStatus = 'CURRENT_CONTEXT' | 'STALE_CONTEXT';

export interface CreateRecommendationRunRequest {
  requestId?: UUID;
  topK: number;
  filters: { categories: string[]; openingFilter: OpeningFilter; radiusMeters: number };
}

export interface RecommendationRunHeaders { 'Idempotency-Key'?: UUID }

export interface CandidateSearchResponse {
  meetupId: UUID;
  placeType: string;
  searchedAround: { latitude: number; longitude: number };
  candidates: Array<{
    providerPlaceId: string; name: string; categories: string[];
    latitude: number; longitude: number; formattedAddress?: string;
    rating?: number; openingHours?: { openNow?: boolean };
  }>;
}

export interface RecommendationExplanationResponse {
  summaryCode: string;
  facts: Array<{
    key:string; value:string|number;
    unit?:'SECOND'|'METER'|'UTILITY_0_1'|'PROBABILITY_0_1'|'COUNT';
    source:'ROUTES'|'PLACES'|'WEATHER'|'ENGINE';
  }>;
  warnings: string[];
}

export interface RecommendationResultResponse {
  rank: number;
  avgEtaSeconds: number;
  maxEtaSeconds: number;
  etaRangeSeconds: number;
  scheduledOpeningStatus: 'OPEN' | 'CLOSED' | 'UNKNOWN' | null;
  openingEvidence?: Record<string, unknown> | null;
  candidate: { canonicalCandidateKey:string;providerPlaceId:string;name:string };
  memberEtas: Array<{participantId:UUID;etaSeconds:number}>;
  viewerFeature: null | {
    participantId:UUID;matchedTags:unknown[];travelUtility:number;
    preferenceUtility:number;placeQualityUtility:number;memberUtility:number;
  };
  explanation: RecommendationExplanationResponse;
}

export interface RecommendationRunResponse {
  id: UUID; meetupId: UUID; requestId: UUID;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  requestedAt: ISODateTime; scheduledAtSnapshot: ISODateTime;
  openingFilter: OpeningFilter; openingEvaluatorVersion: string;
  routingPreferenceRequested: 'TRAFFIC_UNAWARE'|'TRAFFIC_AWARE';
  routingPreferenceEffective: 'TRAFFIC_UNAWARE'|'TRAFFIC_AWARE';
  weatherPolicyRequested: 'OFF'|'WARN_ONLY'|'FILTER_OUTDOOR';
  weatherPolicyEffective: 'OFF'|'WARN_ONLY'|'FILTER_OUTDOOR';
  contextStatus: ContextStatus; warnings: string[];
  results: RecommendationResultResponse[];
}

export interface RecordRecommendationImpressionRequest {
  eventId: UUID;
  canonicalCandidateKey: string;
  rank: number;
  shownAt: ISODateTime;
}

export type RecommendationFeedbackEventType =
  | 'PLACE_VOTED' | 'VOTE_CHANGED' | 'MEETUP_PLACE_SELECTED'
  | 'NAVIGATION_OPENED' | 'FAVORITE_ADDED' | 'MEETUP_COMPLETED';

export interface RecordRecommendationFeedbackRequest {
  eventId: UUID;
  eventType: RecommendationFeedbackEventType;
  canonicalCandidateKey?: string;
  fromCanonicalCandidateKey?: string;
  occurredAt: ISODateTime;
}

export interface RecommendationEventReceiptResponse {
  eventId: UUID;
  idempotent: boolean;
}

export interface ReplayRecommendationRunResponse {
  runId: UUID; algorithmVersion:string; configVersion:string;
  featureSchemaVersion:string; randomSeed:string;
  fullRankFingerprint:string; replayConsistent:true; providerCalls:0;
}

export interface CastMeetupVoteRequest { recommendationPlaceId: UUID }
export interface CastMeetupVoteResponse {
  meetupId:UUID;runId:UUID;recommendationPlaceId:UUID;
  canonicalCandidateKey:string;voteCount:number;changed:boolean;
}

export interface FinalizeMeetupRequest { recommendationPlaceId?: UUID }
export interface FinalizeMeetupResponse {
  meetupId:UUID;runId:UUID;recommendationPlaceId:UUID;
  canonicalCandidateKey:string;chosenById:UUID;chosenAt:ISODateTime;voteCount:number;
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

export interface AddFavoritePlaceRequest { placeId: string }
export interface FavoritePlaceResponse {
  id:UUID;provider:string;providerPlaceId:string;
  canonicalCandidateKey:string;placeName:string;createdAt:ISODateTime;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatMessagePageParams {
  before?: ISODateTime;
  beforeId?: UUID;
  limit?: number;
}

/** Multipart/form-data for meetup/direct message endpoints. */
export interface SendChatMessageRequest {
  clientMessageId: UUID;
  text?: string;
  files?: File[];
}

export interface ChatAttachmentResponse {
  fileName:string;mimeType:string;bytes:number;
  downloadUrl:string;expiresAt:ISODateTime;
}

export interface MeetupChatMessageResponse {
  id:UUID;conversationId:UUID;meetupId:UUID;senderUserId:UUID;
  clientMessageId:UUID;textContent:string;sentAt:ISODateTime;
  attachments:ChatAttachmentResponse[];
}

export interface DirectChatMessageResponse {
  id:UUID;conversationId:UUID;senderUserId:UUID;recipientUserId:UUID;
  clientMessageId:UUID;textContent:string;sentAt:ISODateTime;
  attachments:ChatAttachmentResponse[];
}

// ---------------------------------------------------------------------------
// Notifications / admin / health
// ---------------------------------------------------------------------------

export interface RegisterDeviceTokenRequest {
  token:string;
  platform:'android'|'ios';
}
export type UpdateDeviceTokenRequest = RegisterDeviceTokenRequest;
export interface DeviceTokenMutationResponse { id:UUID }

export interface AdminAccountLockRequest { reason:string }
/** Exact extra account fields are not documented by the controller. */
export interface AdminAccountLockResponse {
  id:UUID;
  locked:boolean;
  [key:string]: unknown;
}

export interface HealthResponse { status:'ok';timestamp:ISODateTime }
export interface ReadyResponse {
  status:'ready';
  dependencies:{postgres:'up';redis:'up';outboxWorker:'up'};
}
export interface NotReadyResponse { status:'not_ready' }

// ---------------------------------------------------------------------------
// Socket.IO / integration events
// ---------------------------------------------------------------------------

export interface RealtimeHandshakeAuth { token:string }
export interface PresenceHeartbeatAck { ok:true }
export interface MeetupJoinMessage { meetupId:UUID }
export interface MeetupJoinAck { meetupId:UUID;joined:true }
export interface LocationUpdateMessage extends PublishLocationRequest {}
export interface LocationUpdateAck { accepted:true }
export interface LocationUpdatedPayload {
  ownerId:UUID;meetupId:UUID;location:ProjectedLocationResponse;
}
export interface RealtimeError { code:'UNAUTHORIZED'|'FORBIDDEN'|'INVALID_EVENT_PAYLOAD' }

export type IntegrationEventName =
  | 'MeetupCreated.v1' | 'MeetupUpdated.v1' | 'MeetupCancelled.v1'
  | 'MeetupFinished.v1' | 'MeetupMemberChanged.v1' | 'PreferenceUpdated.v1'
  | 'LocationUpdated.v1' | 'RecommendationReady.v1' | 'VoteUpdated.v1'
  | 'MeetupFinalized.v1' | 'MeetupInviteLinkAccepted.v1'
  | 'MeetupChatMessageCreated.v1' | 'DirectChatMessageCreated.v1';

export interface EventMetadata<T extends IntegrationEventName> {
  eventId:UUID;eventName:T;occurredAt:ISODateTime;
}
export interface MeetupCreatedV1 extends EventMetadata<'MeetupCreated.v1'> {
  meetupId:UUID;organizerId:UUID;inviteeIds:UUID[];
}
export interface MeetupLifecycleV1 extends EventMetadata<'MeetupUpdated.v1'|'MeetupCancelled.v1'|'MeetupFinished.v1'> { meetupId:UUID }
export interface MeetupMemberChangedV1 extends EventMetadata<'MeetupMemberChanged.v1'> {meetupId:UUID;userId:UUID;membershipStatus:string}
export interface PreferenceUpdatedV1 extends EventMetadata<'PreferenceUpdated.v1'> {meetupId:UUID;participantId:UUID}
export interface LocationUpdatedV1 extends EventMetadata<'LocationUpdated.v1'> {ownerId:UUID;meetupId?:UUID;location:{visibility:'exact'|'approximate'|'hidden'}}
export interface RecommendationReadyV1 extends EventMetadata<'RecommendationReady.v1'> {meetupId:UUID;runId:UUID;placeIds:string[];strategy:'exact'|'batched'|'clustered'}
export interface VoteUpdatedV1 extends EventMetadata<'VoteUpdated.v1'> {meetupId:UUID;runId:UUID;placeId:UUID;voteCount:number}
export interface MeetupFinalizedV1 extends EventMetadata<'MeetupFinalized.v1'> {meetupId:UUID;runId:UUID;placeId:UUID;canonicalCandidateKey:string;scheduledAt:ISODateTime}
export interface MeetupInviteLinkAcceptedV1 extends EventMetadata<'MeetupInviteLinkAccepted.v1'> {meetupId:UUID;participantId:UUID;inviteLinkId:UUID}
export interface MeetupChatMessageCreatedV1 extends EventMetadata<'MeetupChatMessageCreated.v1'> {conversationId:UUID;meetupId:UUID;messageId:UUID;senderUserId:UUID}
export interface DirectChatMessageCreatedV1 extends EventMetadata<'DirectChatMessageCreated.v1'> {conversationId:UUID;messageId:UUID;senderUserId:UUID;recipientUserId:UUID}

export type IntegrationEvent =
  | MeetupCreatedV1 | MeetupLifecycleV1 | MeetupMemberChangedV1
  | PreferenceUpdatedV1 | LocationUpdatedV1 | RecommendationReadyV1
  | VoteUpdatedV1 | MeetupFinalizedV1 | MeetupInviteLinkAcceptedV1
  | MeetupChatMessageCreatedV1 | DirectChatMessageCreatedV1;
