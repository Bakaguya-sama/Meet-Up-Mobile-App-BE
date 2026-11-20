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

`POST /api/v1/meetups/:meetupId/preferences/suggest` accepts a `message`, recent `{role,text}` conversation turns, or `audioBase64` with `audioMimeType`. The backend sends the request to Gemini `gemini-2.5-flash-lite` when `MEETUP_PREFERENCE_AI_ENABLED=true`. The API returns a `suggestionId` and one of:

- `clarification`: show `replyText`, collect another user turn, and resend the conversation.
- `proposal`: show tags and `budgetVnd` for review. Submit confirmed values through the existing `PUT .../preferences` route.
- `manual_fallback`: AI is disabled or unavailable; show the active tags and continue with the regular form.

The draft endpoint does not persist audio, message history, or suggested preferences. Send `suggestionId` back with the confirmed `PUT` request to correlate privacy-safe telemetry containing AI usage, proposed tag IDs, final tag IDs, and completion duration. Logs never include user text, audio, or budget amount. Use `GEMINI_API_KEY` for the provider. When disabled, provider errors, or invalid provider output occurs, the use case returns manual fallback. Audio request JSON is limited to 4 MB at the HTTP entry point.

## Database rollout

Apply migration `1792310000000-add-meetup-participant-budget` before deploying code that writes `budgetVnd`. Backward-compatible clients may omit the field.
