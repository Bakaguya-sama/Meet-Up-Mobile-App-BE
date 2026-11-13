# Unified meetup and direct chat

## Decisions

- Meetup and direct messages use the same durable conversation/member/message/attachment model.
- A meetup conversation is created in the same PostgreSQL transaction as its meetup. A direct conversation is created lazily by the first valid send and uses a canonical sorted user pair.
- A newly accepted meetup participant may read the complete conversation history, including messages before `joinedAt`.
- A former meetup participant may read only through `historyVisibleUntil = leftAt`. They cannot send or receive later realtime events.
- Unfriend/block prevents new direct sends and new conversation creation, but both existing participants retain read-only access to the previous conversation.
- Messages are immutable. Edit, delete and scheduled retention are outside the current scope.
- There is no antivirus/quarantine stage.

## HTTP contract

Existing routes remain stable:

| Operation | Route |
|---|---|
| Send meetup message | `POST /api/v1/meetups/:meetupId/chat/messages` |
| Read meetup history | `GET /api/v1/meetups/:meetupId/chat/messages` |
| Send direct message | `POST /api/v1/chats/direct/:peerId/messages` |
| Read direct history | `GET /api/v1/chats/direct/:peerId/messages` |

Send uses `multipart/form-data` and requires:

- `clientMessageId`: UUID generated once by mobile and reused for every retry of the same logical send;
- `text`: optional, trimmed, maximum 2,000 characters;
- `files`: optional, maximum 5; a message must have text or at least one file.

The database unique key `(conversation_id, sender_user_id, client_message_id)` makes sequential and concurrent HTTP retries return one durable message. Reusing a completed `clientMessageId` does not create a second message or outbox event. Concurrent attachment retries use a content-fingerprinted deterministic storage key; the database winner is returned and any non-winning distinct upload is deleted compensatingly.

History uses the compound cursor `before` (ISO-8601) plus `beforeId` (UUID). Both must be present together. Ordering is stable on `(sentAt DESC, id DESC)` and the API returns each page chronologically.

The response adds `conversationId` and `clientMessageId`; it retains the route-specific `meetupId` or `recipientUserId`. Attachment responses contain a signed private download URL with a 15-minute lifetime.

## Database model and authorization

- `chat_conversations`: discriminator `direct|meetup`, one meetup conversation or one canonical direct pair, and denormalized last-message fields for a future inbox.
- `chat_conversation_members`: membership/history boundary plus reserved last-read fields. Meetup rows are synchronized from `meetup_participants` by PostgreSQL trigger. Direct member rows remain after relationship changes to retain history.
- `chat_messages`: immutable content and required mobile idempotency key.
- `chat_message_attachments`: normalized private Cloudinary metadata. It never contains file bytes or signed/public URLs.

PostgreSQL is the final write-authority guard. Before inserting a message it locks and verifies the conversation plus the current accepted friendship or accepted active-meetup membership. This closes races with block/unfriend/leave/remove. Meetup realtime recipients are selected and locked inside the same message/outbox transaction, so a stale Socket room or an application-level pre-check cannot leak a later message.

Foreign keys use `RESTRICT` for user, meetup, conversation and message history. Account/meetup lifecycle must use status/soft deletion or an explicit future anonymization policy; deleting a parent must not silently cascade chat history.

## Attachments and storage retry

Allowed extensions/MIME/signatures, per-file limit 10 MiB, per-message limit 25 MiB and maximum 5 files are enforced before upload. Cloudinary resources are authenticated/private. The storage key is deterministic from conversation scope, `clientMessageId`, file order and a truncated SHA-256 content fingerprint; an identical concurrent retry may safely address the same asset, while different content addresses a different key. If persistence fails or loses an idempotency race, the application requests compensating deletion for non-winning assets.

Normalized attachment rows make future orphan reconciliation possible, but no retention or cleanup schedule is enabled in this version.

## Realtime recovery

`MeetupChatMessageCreated.v1` and `DirectChatMessageCreated.v1` are written atomically with the message. Their durable payload contains only message/conversation routing references, never text, attachment metadata or signed URLs. The outbox worker fan-outs to authorized `user:{userId}` rooms after commit.

On `meetup:chat-message` or `direct:chat-message`, mobile de-duplicates by `messageId` and refreshes through the corresponding HTTP history route. HTTP performs current authorization and creates fresh signed URLs. Socket is a low-latency hint; PostgreSQL plus HTTP history remains the recovery source of truth.
