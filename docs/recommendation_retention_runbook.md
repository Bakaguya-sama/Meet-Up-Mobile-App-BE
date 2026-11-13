# Recommendation snapshot retention runbook

## Q13 policy v1

`recommendation-retention-q13-v1` deletes from the `recommendation_runs` aggregate root: failed runs after 7 days, completed-unused runs after 30 days, and shown/voted/selected runs after 180 days. PostgreSQL cascade removes candidate, member-feature, place, impression, feedback and hold snapshots; the worker never deletes child tables independently.

Runs with a `recommendation_run_holds` reason of `replay`, `evaluation`, `export`, or `legal_hold` are excluded until an operator manually removes that hold row. Archive/anonymization is not part of this release.

## Operation

The in-process worker schedules one bounded batch at 03:30 `Asia/Ho_Chi_Minh`. It processes at most 100 roots, uses `FOR UPDATE SKIP LOCKED` so concurrent workers do not claim the same root, and retries a failed batch with exponential backoff for at most three attempts. The worker is opt-in: set `RECOMMENDATION_RETENTION_ENABLED=true` only in the environment where deletion is intended.

The former 7-day staging dry-run and Tech Lead acknowledgement are deliberately not release gates under the approved Q13 revision. A dry-run remains available at the use-case boundary for a safe one-off operational preview; it never deletes rows.

## Monitoring and alerting

The worker emits redacted structured audit fields: policy version, dry-run flag, scanned, eligible, deleted, protected, failed, duration and oldest eligible age. It must not log coordinates, member feature payloads, tokens or provider payloads.

Alert when failed is greater than zero, a batch duration exceeds 10 minutes, backlog rises for three consecutive days, or deletion exceeds both 150% of the seven-day average and 1,000 runs in one batch.

## Readiness

`GET /health/ready` returns 503 when PostgreSQL, Redis or the outbox worker is unavailable. External providers are not readiness dependencies and are handled as degraded per-request dependencies.
