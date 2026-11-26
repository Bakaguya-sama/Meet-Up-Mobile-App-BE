# Place collection, member budget, and AI preference input

## Place data for local experiments

`outputs/place-data/hcmc-osm-places.json` contains 1,000 named places collected from OpenStreetMap in central Ho Chi Minh City. The collector is `src/scripts/collect-hcmc-places.ts`; run it with:

```sh
npm run places:collect-hcmc
```

Use `PLACE_COLLECTION_LIMIT` to change the target (1–10,000), or pass an output path after `--`. The default file is a local collection artifact, not a runtime recommendation index. It includes OSM `tags`, derived `types`/`primaryType`, coordinates, address components, opening hours, website/phone when mapped, and `priceLevel`/`priceRange` only when the source explicitly provides parseable tags. OSM does not provide Google's primary type or standardized price fields, so those fields can be null or the primary type is explicitly marked as an OSM tag mapping.

The dataset is OpenStreetMap data under ODbL 1.0. Preserve the attribution and license metadata in the artifact and downstream exports. It is not Google Places content. Bulk export/storage of Google Maps content is restricted; Google's Place IDs are exempt, and coordinates have limited caching exceptions. For live Places API integration, request only the fields needed for an interactive result and follow the current [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies).

## Per-participant meetup budget

`meetup_participants.budget_vnd` is nullable and accepts a nonnegative int32 number of VND (0–2,147,483,647). `PUT /api/v1/meetups/:meetupId/preferences` accepts:

```json
{
  "preferences": [{ "activityTagId": 2, "level": "high" }],
  "budgetVnd": 250000
}
```

Omitting `budgetVnd` preserves the current value; sending `null` clears it. `GET .../preferences` and `GET .../preferences/summary` return the member budget. Recommendation context receives each accepted participant's `budgetVnd`; this change does not implement filtering, penalties, or other budget ranking behavior.

## AI preference draft

`POST /api/v1/meetups/:meetupId/preferences/suggest` returns **schemaVersion 2**. This is a breaking change for the earlier AI draft client: remove `conversation`, send server-owned `suggestionId` + `revision` on subsequent turns, and pair `aiSuggestionId` + `aiSuggestionRevision` on confirmation. The ordinary manual PUT remains compatible.

- `clarification`: display `replyText`; send the next text/audio with the returned ID and revision. No confirmation payload.
- `proposal`: display `effectivePreferences`, `budgetVnd`, and any audio `transcript` for review. Allow edits. Only an explicit Confirm action sends `confirmation` (with edits) through the existing PUT.
- `manual_fallback`: display the active tags and ordinary form. Keep the user's current local edits. Do not send AI IDs on a manual save.

### FE flow and merge rules

1. POST `{}` to open a session without spending a model call, or start directly with `{"message":"Muốn đi cà phê, tối đa 200k riêng mình"}`.
2. POST the next answer with `suggestionId` and `revision` from the last response. Send text **or** audio. Do not replay client history. Disable overlapping submissions and discard late responses from older local requests.
3. Display `effectivePreferences` (including profile fallback); `preferences` contains the complete explicit selection that PUT replaces. For a budget-only change, `preferences: []` can legitimately preserve profile fallback. Never substitute the display array automatically.
4. The model emits changes, not a replacement list. The domain merges changes into the existing selection. Untouched tags and budget survive. Removing the final tag through AI falls back to manual input because an empty explicit list restores profile fallback.
5. Budget actions are `keep`, `set`, `clear`. `confirmation` omits `budgetVnd` for keep, sends a number for set, and null for clear. If the user edits budget in the review form, send that explicit edit. Zero is valid; never use truthiness to decide whether to send it.
6. Group totals, ranges and vague budgets require clarification. `{"suggestionId":"...","revision":1,"skipBudget":true}` abandons pending budget changes and preserves the saved budget; send no text/audio alongside it. Budget is optional.
7. On Confirm, PUT the reviewed complete selection with both AI provenance fields. Do not auto-save a proposal or invoke the recommendation engine merely because a proposal arrived.

Example confirmation payload (tag IDs must come from the active catalog):

```json
{
  "preferences": [{"activityTagId": 2, "level": "high"}],
  "budgetVnd": 200000,
  "aiSuggestionId": "c6a9aa92-8123-4e26-8823-e8d19cf14507",
  "aiSuggestionRevision": 1
}
```

### Sessions, expiry and failure handling

- Redis holds normalized draft state, actor/meetup scope, fingerprints and revisions with an absolute TTL (default 15 minutes). Turns do not extend expiry. No SQL preference write occurs until PUT.
- A lease serializes turns. Each model call reserves a revision before calling the provider. Confirmation atomically consumes a matching proposal once. Cross-user, cross-meetup, expired, consumed or superseded proposals cannot be confirmed.
- Any meetup edit conservatively invalidates the draft; current effective profile preferences and the active catalog are checked as well. Confirmation rechecks the member snapshot inside the existing locked SQL write.
- Redis consumption occurs **before** the SQL transaction; there is no distributed transaction. If the SQL write fails afterward, the proposal is already consumed. Start a fresh draft or use the manual form. If a PUT response is lost, GET current preferences before deciding to retry.
- At most 5 model turns and 3 clarification responses per session. Defaults: 6 suggestion requests/minute and 60/day per user; the initial greeting also counts. Provider calls have a shared timeout and at most one short retry for transient HTTP failures.
- Disabled AI, rate limit, provider timeout/error, invalid model output or session-store failure returns HTTP 200 `manual_fallback` with a safe `fallbackReason`. The disabled/rate-limit path can return saved values rather than an earlier unsaved draft; FE must preserve its local editor.
- Invalid inputs/audio: 400 `INVALID_INPUT`. Missing/unowned/expired continuation: 404 `PREFERENCE_DRAFT_NOT_FOUND`. Busy/reused/revision mismatch: 409 `PREFERENCE_DRAFT_CONFLICT`. Changed saved data: 409 `PREFERENCE_DRAFT_STALE`. Redis unavailable during confirmation: 503 `PREFERENCE_DRAFT_UNAVAILABLE`. For 404/409, offer a new draft or manual editing. For an in-flight conflict, wait for that request before retrying.

### Text, audio and privacy

Text is limited to 2,000 characters. Audio uses `audioBase64` with `audioMimeType`: WAV, MP3/MPEG, OGG, WebM, FLAC, AAC or M4A. Limits: 2,000,000 decoded bytes and 60 seconds, with a 4 MB HTTP JSON body cap. The backend checks actual format, audio tracks and measurable duration. Video, MIME spoofing and recordings with missing/invalid duration are rejected. Browser WebM recordings may lack duration; FE should record/export a supported measurable file or offer text entry.

The Gemini adapter accepts text/audio and returns structured extraction. The domain independently validates nested keys, enums, active tag IDs, duplicate tags and verbatim evidence. Budget amounts must match the deterministic VND parser. Audio transcription can still be wrong: show it for correction and start the next text turn with the correction. Schema/evidence validation cannot prove semantic accuracy.

The application does not persist raw text, audio, transcript or evidence in Redis/SQL/logs. Normalized tags and budget **are** temporarily stored in Redis until TTL. Provider handling of submitted content is governed by the project's Gemini account terms. Application telemetry contains suggestion ID, AI usage, proposed/final tag IDs, outcome, safe failure reason, prompt version, revision and duration; it excludes raw text/audio and budget amounts. Do not enable HTTP request-body logging for these routes.

The model never calls tools or writes preferences. Requests for unsupported constraints fall back to the form. The existing engine's `avoid` means lower preference, not a hard exclusion; do not promise allergy/accessibility/smoke-free guarantees from these tags.

### Configuration and DDD ownership

| Setting | Default | Purpose |
|---|---|---|
| `MEETUP_PREFERENCE_AI_ENABLED` | `false` | Feature switch; manual form remains available |
| `GEMINI_API_KEY` | unset | Provider credential |
| `MEETUP_PREFERENCE_AI_MODEL` | `gemini-2.5-flash-lite` | Configurable; benchmark before choosing a production model |
| `MEETUP_PREFERENCE_AI_TIMEOUT_MS` | `8000` | Shared deadline, including any retry |
| `MEETUP_PREFERENCE_AI_SESSION_TTL_SECONDS` | `900` | Absolute session lifetime |
| `MEETUP_PREFERENCE_AI_REQUESTS_PER_MINUTE` | `6` | User-level admission limit |
| `MEETUP_PREFERENCE_AI_REQUESTS_PER_DAY` | `60` | User-level daily admission limit |

The Meetups domain owns extraction validation, budget normalization and merge rules in `domain/services/preference-draft.ts`. Application use cases coordinate authorization, sessions, versions, confirmation and telemetry through ports. Infrastructure implements Gemini, Redis and audio parsing. HTTP DTOs/OpenAPI and FE integration types expose the contract. No new budget ranking algorithm is implemented.

### Verification and rollout limits

Deterministic tests cover domain merge/validation, suggestion and confirmation flows with an in-memory store, mocked Gemini retries/timeouts, and real WAV parsing. These do not establish real model quality or Redis/SQL integration correctness. Before enabling production: exercise two simultaneous turns/confirmations against real Redis, test recorded device audio, and run a labeled Vietnamese text/audio evaluation on the configured model. Include negation, corrections, mixed language, group budgets, zero/clear/omitted budget, unsupported constraints and prompt injection.

Track proposal-to-confirmation rate, tag-edit rate, turns to confirmation, fallback reasons, latency and provider cost. Do not claim a quality score before a labeled evaluation. Redis Lua uses `SET KEEPTTL` (Redis 6+). The Jest command enables VM modules because the audio parsers are ESM.

## Database rollout

Apply migration `1792310000000-add-meetup-participant-budget` before deploying code that writes `budgetVnd`. Backward-compatible clients may omit the field.
