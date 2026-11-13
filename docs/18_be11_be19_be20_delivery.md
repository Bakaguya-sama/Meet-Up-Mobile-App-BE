# BE-11, BE-19, BE-20 delivery notes

Branch `hao/feat`, based on the latest `main` at implementation start.

## BE-11 Meetup chat

- `GET /meetups/{meetupId}/chat/messages?limit=50&before={ISO8601}&beforeId={messageUuid}` reads messages in chronological order. `limit` is clamped to 1–100. `before` and `beforeId` must be supplied together; use the oldest returned message as the next cursor. The compound cursor preserves messages with equal timestamps.
- `POST /meetups/{meetupId}/chat/messages` requires a mobile-generated UUID `clientMessageId`, plus optional text/files. Reusing the same ID for retry returns the first durable message.
- `POST` requires an authenticated, accepted participant and an active meetup (`inviting`, `choosing`, or `selected`). PostgreSQL repeats this authorization in a `BEFORE INSERT` trigger, so a concurrent leave/remove cannot insert a message after the application pre-check.
- `GET` permits an active accepted participant. A `left`/`removed` former participant may read only messages with `sentAt <= leftAt`; an outsider, declined participant, or inactive meetup is denied. A former participant can neither send nor receive any later message.
- Message and outbox reference are atomic. `meetup:chat-message` is fan-out to a transactionally selected accepted-member snapshot, not the meetup room. Its payload contains routing IDs only; mobile recovers content and fresh attachment URLs through HTTP.
- Meetup/direct chat share `chat_conversations`, `chat_conversation_members`, `chat_messages` and normalized `chat_message_attachments`. A newly accepted meetup member sees all earlier history. Editing, deletion and retention remain outside scope.
- Attachments use an allow-list/signature check and authenticated Cloudinary assets. Antivirus/quarantine is not part of this version.
- Chat lives in the `chat` bounded context. It checks access through Meetups' public membership API and does not depend on Meetups persistence.

## BE-20 Favorite places

- `POST /favorites/places` accepts `{ "placeId": "..." }`, either a canonical candidate key or provider Place ID.
- `GET /favorites/places` returns the caller's favorite snapshots.
- `DELETE /favorites/places/{placeId}` removes by canonical candidate key or provider Place ID and returns 204.
- A place ID must match a persisted recommendation candidate. An unknown ID returns 404; repeated add is idempotent under the per-user canonical key unique constraint. Canonical candidate keys may be 300 characters; request DTO, use case, URL parameter validation, entity and migration use the same bound.
- Persisted data is limited to provider ID, canonical candidate key, and place name. It does not contain routes or coordinates.

## BE-19 Account administration

- `POST /admin/accounts/{accountId}/lock` accepts an optional `{ "reason": "..." }`.
- `DELETE /admin/accounts/{accountId}/lock` unlocks the account.
- Both require an authenticated `admin`. Locking revokes active refresh sessions in the same transaction as the account update and audit record. Access-token authentication also checks the locked account state.
- The admin-facing workflow lives in the `admin` bounded context. It calls Auth's public account-lock contract; Auth owns the account, session, and audit transaction.
- Audit metadata records only the boolean lock state; free-form reason, coordinates, tokens, and other sensitive values are excluded.
- Existing accounts and new signups default to role `user`. There is intentionally no API to grant roles. An operator with controlled database access may provision the first admin after verifying the account:

```sql
UPDATE user_accounts
SET role = 'admin', updated_at = now()
WHERE id = '<verified-account-uuid>';
```

Review the target account ID out-of-band before running this statement. Do not expose this operation through public registration or a user-facing endpoint.

## Delivery limits

Chat retention and edit/delete remain outside scope. Former meetup members retain history only through `leftAt`; direct participants retain existing read-only history after unfriend/block. The current database is a fresh environment, so migration `1792200000000-unify-chat-conversations` replaces provisional chat tables without a data backfill.

## Bước 4 closure evidence — 13/11/2026

- `test/chat-favorites-admin.integration-spec.ts` runs against PostgreSQL thật and covers concurrent direct retry/favorite, meetup membership boundary, attachment cleanup and reference-only outbox.
- `test/chat-favorites-admin.e2e-spec.ts` exercises HTTP chat/favorite behavior. The integrated suite passed 4 suites/30 tests twice; the E2E suite passed 8 suites/72 tests twice.
- The migration cycle `up → inspect tables/triggers/constraints → down → up` passed on isolated PostgreSQL/PostGIS. Checked objects include the unified four chat tables, `trg_chat_sender_can_send`, `trg_sync_meetup_chat_member`, and `uq_chat_messages_sender_client`.
