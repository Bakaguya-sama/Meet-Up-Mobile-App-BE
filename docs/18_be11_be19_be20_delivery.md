# BE-11, BE-19, BE-20 delivery notes

Branch `hao/feat`, based on the latest `main` at implementation start.

## BE-11 Meetup chat

- `GET /meetups/{meetupId}/chat/messages?limit=50&before={ISO8601}&beforeId={messageUuid}` reads messages in chronological order. `limit` is clamped to 1–100. `before` and `beforeId` must be supplied together; use the oldest returned message as the next cursor. The compound cursor preserves messages with equal timestamps.
- `POST /meetups/{meetupId}/chat/messages` accepts `{ "text": "..." }`, with 1–2,000 trimmed characters.
- `POST` requires an authenticated, accepted participant and an active meetup (`inviting`, `choosing`, or `selected`). PostgreSQL repeats this authorization in a `BEFORE INSERT` trigger, so a concurrent leave/remove cannot insert a message after the application pre-check.
- `GET` permits an active accepted participant. A `left`/`removed` former participant may read only messages with `sentAt <= leftAt`; an outsider, declined participant, or inactive meetup is denied. A former participant can neither send nor receive any later message.
- Sent messages are persisted before `meetup:chat-message` is fan-out to the current accepted members' `user:{userId}` Socket.IO rooms. It is deliberately not broadcast to the meetup room, because a stale socket membership must not leak a later message. The payload is `{ id, meetupId, senderUserId, textContent, sentAt }`, and `eventId` is the same message ID. If realtime delivery fails, the stored message remains readable over HTTP and a warning is logged.
- Chat is text-only; editing, deletion, attachments, and retention are outside the currently specified behavior.
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

The existing implementation plan does not define chat retention, edit/delete, or attachment behavior, so those are not introduced. The former-member history policy is now explicit: retain only history through `leftAt`, never allow a new send/delivery. Integration and HTTP gate evidence is recorded in the plan after PostgreSQL test infrastructure is available; no deploy claim is made without that evidence.
