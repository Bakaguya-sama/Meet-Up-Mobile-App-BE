# BE-10 vote and finalize delivery

## API

- `POST /api/v1/meetups` and `PATCH /api/v1/meetups/:meetupId` accept optional `voteDeadlineAt` as ISO-8601 with an explicit offset. It must be in the future and no later than `scheduledAt`. Sending `null` on PATCH clears the deadline. If unset, there is no automatic deadline; the organizer may finalize manually.
- `PUT /api/v1/meetups/:meetupId/recommendation-runs/:runId/vote` accepts `{ "recommendationPlaceId": "uuid" }`. Only accepted members may vote. Repeating the same vote is idempotent; a different vote replaces the existing vote for that member and meetup.
- `POST /api/v1/meetups/:meetupId/recommendation-runs/:runId/finalize` is organizer-only. An optional `recommendationPlaceId` explicitly selects a displayed candidate; without it, at least one vote is required and the deterministic vote winner is selected. Before a configured deadline, every accepted participant must have voted before finalization is allowed.

Candidate IDs are `recommendation_places.id`. The recommendation context exposes only completed runs and persisted top-K candidates. A run whose `scheduledAtSnapshot` differs from the current meetup schedule is rejected for voting and finalization.

## Persistence and events

The unique `(meetup_id, participant_id)` constraint enforces one vote per member and meetup. Composite foreign keys ensure the vote, meetup, run, candidate, and participant all refer to the same context. Meetup root locking serializes vote replacement and finalization; state changes and outbox rows share a PostgreSQL transaction.

- `VoteUpdated.v1`: `meetupId`, `runId`, `placeId` (recommendation place ID), and the resulting `voteCount`.
- `MeetupFinalized.v1`: `meetupId`, `runId`, `placeId`, `canonicalCandidateKey`, and `scheduledAt`.

Realtime vote events go to accepted meetup members. Finalization is sent to realtime and push recipients after commit. Event payloads contain no member location, preference, or ranking utility details.
