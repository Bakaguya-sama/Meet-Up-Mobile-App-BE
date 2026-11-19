# Offline recommendation dataset and evaluation

## Purpose and boundary

BE-25 exports a reproducible, redacted dataset and compares `min-sum`, `min-max`, and `fair-pareto-v1` from immutable recommendation snapshots. It is an offline read-only process: it never calls Places, Routes, weather, Gemini, or any other provider, and it does not train or promote an LTR model.

The data lineage is `recommendation_runs` → `recommendation_candidates` / `recommendation_member_features` → `recommendation_impressions` → `recommendation_feedback_events`. A dataset row exists only for a candidate actually shown to a participant. A candidate that was not shown is **unknown**, never a negative example.

## Fields and leakage rule

Feature fields are snapshot values that existed when the run was requested: ETA/distance, member utility components, candidate quality/category, candidate aggregate utility/rank and temporal context. Labels are created only after exposure from feedback events. `vote`, `selection`, `favorite`, `navigation`, their counts, and all post-recommendation aggregates are excluded from the feature object. The builder emits no raw participant ID, coordinates, origin, token, provider payload, name, phone, or email.

`participantPseudonym` is a deterministic HMAC-SHA256-derived identifier using `OFFLINE_DATASET_PSEUDONYMIZATION_SALT`. Treat the salt as a secret; rotating it creates a new non-joinable dataset version.

## Label policy: `feedback-label-v1`

The highest applicable event wins: `MEETUP_PLACE_SELECTED=3`, `PLACE_VOTED`/`VOTE_CHANGED=2`, `FAVORITE_ADDED`/`NAVIGATION_OPENED=1`, and shown with no action=`0`. The `rawEvents` object preserves counts independently. `MEETUP_COMPLETED` is not a positive label. Candidate rows without an impression are not emitted and remain unknown.

## Running the evaluator

Use a non-production database URL with an approved read-only credential. The command requires explicit dataset and time-split windows and an explicit output path; it has no implicit production destination.

```powershell
$env:OFFLINE_DATASET_PSEUDONYMIZATION_SALT = 'secret-from-secret-manager'
npm run recommendation:offline-evaluate -- `
  --from 2026-01-01T00:00:00.000Z --to 2026-09-01T00:00:00.000Z `
  --train-from 2026-01-01T00:00:00.000Z --train-to 2026-07-01T00:00:00.000Z `
  --validation-from 2026-07-01T00:00:00.000Z --validation-to 2026-08-01T00:00:00.000Z `
  --test-from 2026-08-01T00:00:00.000Z --test-to 2026-09-01T00:00:00.000Z `
  --output outputs/offline-evaluation/dataset.ndjson
```

The command writes three files: NDJSON rows, `dataset.ndjson.manifest.json`, and `dataset.ndjson.report.json`. The manifest records schema/label/redaction versions, time window, row and run counts, observed algorithm/config versions, optional `GIT_COMMIT_SHA`, and a deterministic content SHA-256. Supplying the same source snapshot, salt, window and generator version produces the same row ordering and content checksum.

The retention policy protects a run only when an operator adds an `evaluation` or `export` hold before a long-running export. For a short local fixture run, no hold is necessary. Production evaluation orchestration must create/remove the hold audibly; this CLI is deliberately read-only and does not mutate retention state.

## Metrics and report semantics

Reports include each baseline and HitRate@K, NDCG@K, average ETA, group utility and least-misery utility. Ranking relevance uses only the impressed set. A group with no positive relevance has `HitRate=N/A`; a group with `IDCG=0` is excluded from NDCG and appears in `excludedRunCount`. `coverage` means evaluable groups divided by impressed groups, never a forced zero.

The current command exports the complete redacted dataset and a per-baseline metric report, including group-size, category, and algorithm/config-version breakdowns. A product report cannot be used as a promotion decision until the approved minimum sample, acceptance deltas, ETA/cost guardrails, and fairness formula are supplied.

## Fixtures, verification, and limitations

Unit fixtures cover three-member mixed-category exposure, participant vote versus group selection, navigation/vote/selection precedence, incomplete snapshots, `[from,to)` version filtering, salt/checksum determinism, HitRate/NDCG boundaries, 2/3/5-member segments, unavailable replay state, time-split rejection, and temporary NDJSON/manifest/report artifact output. PostgreSQL integration covers the TypeORM snapshot/impression/feedback join, pseudonymization/redaction, deterministic manifest output, and an `evaluation` hold. Replay is snapshot-only; it has no provider adapter dependency.

The large synthetic integration matrix is deterministic and contains 120 completed runs: 40 each for group sizes 2, 3, and 5; six candidates per run across `cafe`, `restaurant`, `park`, `bar`, and `movie_theater`; 2,400 member-feature rows; and 2,000 impressions. It spans three algorithm/config segments and January/February/March time windows. These rows validate data lineage and metric semantics only; they are not evidence for an LTR or production promotion decision.

This release does not collect GPS or real-world data. Fixture data is sufficient for implementation validation. Meaningful product comparison and any future LTR promotion require consented beta feedback with sufficient coverage across group size, category, and region, followed by Product, Tech Lead, and Security/Privacy approval.
