# BE-11, BE-19, BE-20 delivery notes

Branch `hao/feat`, based on the latest `main` at implementation start.

## BE-11 Meetup chat

- `GET /meetups/{meetupId}/chat/messages?limit=50&before={ISO8601}` reads messages in chronological order. `limit` is clamped to 1–100.
- `POST /meetups/{meetupId}/chat/messages` accepts `{ "text": "..." }`, with 1–2,000 trimmed characters.
- Both operations require an authenticated, accepted participant and an active meetup (`inviting`, `choosing`, or `selected`).
- Sent messages are persisted before `meetup:chat-message` is published to the meetup Socket.IO room. If realtime delivery fails, the stored message remains readable over HTTP and a warning is logged.
- Chat is text-only; editing, deletion, attachments, and retention are outside the currently specified behavior.

## BE-20 Favorite places

- `POST /favorites/places` accepts `{ "placeId": "..." }`, either a canonical candidate key or provider Place ID.
- `GET /favorites/places` returns the caller's favorite snapshots.
- `DELETE /favorites/places/{placeId}` removes by canonical candidate key or provider Place ID and returns 204.
- A place ID must match a persisted recommendation candidate. An unknown ID returns 404; repeated add is idempotent under the per-user canonical key unique constraint.
- Persisted data is limited to provider ID, canonical candidate key, and place name. It does not contain routes or coordinates.

## BE-19 Account administration

- `POST /admin/accounts/{accountId}/lock` accepts an optional `{ "reason": "..." }`.
- `DELETE /admin/accounts/{accountId}/lock` unlocks the account.
- Both require an authenticated `admin`. Locking revokes active refresh sessions in the same transaction as the account update and audit record. Access-token authentication also checks the locked account state.
- Audit metadata records only the boolean lock state; free-form reason, coordinates, tokens, and other sensitive values are excluded.
- Existing accounts and new signups default to role `user`. There is intentionally no API to grant roles. An operator with controlled database access may provision the first admin after verifying the account:

```sql
UPDATE user_accounts
SET role = 'admin', updated_at = now()
WHERE id = '<verified-account-uuid>';
```

Review the target account ID out-of-band before running this statement. Do not expose this operation through public registration or a user-facing endpoint.

## Delivery limits

The existing implementation plan does not define chat retention, edit/delete, or attachment behavior, so those are not introduced. Implementation checks and automated tests remain to be run by the project owner before merge/deploy.
