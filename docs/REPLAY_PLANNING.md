# Historical forecast-only activity-window comparison

This is a separate retrospective/replay mode, not current safe-time advice, a health recommendation or prospective activity planning. Public `/api/v1/activity-plan` and live hourly-trajectory readiness stay gated. Replay uses only saved forecasts, never target observations, from exactly one model version, one issue, one station and one split.

## Implemented contracts

- `GET /api/v1/models/{model_version}/replay-issues?split=test&limit=25&offset=0` lists only complete24-hour forecast groups at or after the fixed model's fit/selection cutoff. `limit` is1–100. Result retains explicit model, dataset mode, clock basis, timezone, issue, station, split, forecast-artifact/source-dataset hashes and historical-publication-unknown qualification.
- `POST /api/v1/activity-plan/replay` accepts `model_version`, `issue_at`, `duration_minutes`, optional `split` (default test), `earliest_start_h` (0), `latest_end_h` (24), `sensitivity` (general), `max_window_mean_ugm3` (null) and `limit` (5, max24).

Supported model versions are `delhi-recorded-pm25-hourly-v2` and `delhi-openaq-pm25-hourly-v1`. The original supplied native model and five-horizon recordedv1 do not have a supported complete replay trajectory. Horizons are verified against registered model metadata, not inferred from model names. Artifact and issue-purged supplement integrity is checked through the existing registry.

Recorded model `issue_at` must be naive source-clock time; UTC model timestamps must carry explicit zero UTC offset. The service never attaches UTC to naive archive clocks or joins their timestamps to current inputs. Split names come from each model's evaluation protocol. Test/validation/fold issues before fixed-model fit/selection availability are rejected usefully, matching the issue-time-purged evaluation convention.

## Eligibility and comparison method

Every trajectory must contain exactly the24 distinct saved forecast horizons1…24, all on the selected issue/station/version, in compatible PM2.5 µg/m³ units. Every target must equal issue+horizon hours on that model's clock. Missing/duplicate hours, invalid/negative concentrations, mixed identities and misaligned targets return a typed `status=unavailable` with a reason code, coverage count and no recommendations. No hour is interpolated, shifted, clipped or silently zero-filled. Zero remains a valid predicted concentration.

Only whole-hour durations are implemented:60–1440minutes, multiples of60. A target at issue+h is treated as the predicted mean for the immediately preceding source-clock hour. For recorded-clock data this is explicitly a source-clock comparison assumption; unresolved original interval/timezone semantics remain a limitation. A candidate starts at issue+start_h and ends after the requested duration, within the caller's earliest/latest bounds.

`concentration_time = sum(selected hourly predicted concentrations ×1hour)`, units **µg·h/m³**. This is a concentration-time proxy, not inhaled dose or a calibrated personal-health risk. Mean/peak concentrations and score are returned separately.

Sensitivity is an explicit engineering preference:

- `general`: `ranking_score = concentration_time`.
- `sensitive`: `ranking_score = concentration_time +0.25×peak_concentration×duration_hours`. This peak-aversion coefficient is a documented comparison preference, not clinically derived or a safety guarantee.

Candidates rank by score ascending, then earlier source-clock start to break ties. The optional caller-provided mean-concentration ceiling filters eligibility; no default safe/unsafe health threshold is invented. If no complete window satisfies duration/bounds/ceiling, return `status=no_suitable_window`, `code=NO_WINDOW_MEETS_CRITERIA`, counts and an empty windows list. Complete trajectory coverage does not force a recommendation.

## Actual saved-artifact examples

At the checkpoint, the issue-purged test set contains **10,142** complete recorded-clock issues and **195** complete UTC issues. These counts concern available complete saved forecast trajectories, not station-wide monitoring coverage or prospective reliability.

```sh
curl 'http://127.0.0.1:8000/api/v1/models/delhi-recorded-pm25-hourly-v2/replay-issues?split=test&limit=1'
curl -X POST http://127.0.0.1:8000/api/v1/activity-plan/replay \
  -H 'Content-Type: application/json' \
  -d '{"model_version":"delhi-recorded-pm25-hourly-v2","issue_at":"2025-01-01T00:00:00","split":"test","duration_minutes":120}'
curl -X POST http://127.0.0.1:8000/api/v1/activity-plan/replay \
  -H 'Content-Type: application/json' \
  -d '{"model_version":"delhi-openaq-pm25-hourly-v1","issue_at":"2026-08-19T16:30:00Z","split":"test","duration_minutes":120}'
```

Actual general-ranking outputs:

| Version / single issue | Best2h source-clock window | Concentration-time | Mean / peak µg/m³ |
| --- | --- | ---: | --- |
| Recordedv2 /2025-01-01T00:00:00 |2025-01-01T12:00:00…14:00:00 |373.029863 µg·h/m³ |186.514932 /197.277394 |
| UTCv1 /2026-08-19T16:30:00Z |2026-08-20T14:30:00Z…16:30:00Z |138.047760 µg·h/m³ |69.023880 /71.992562 |

These are historical forecast comparisons. Their targets' observed outcomes are not queried or used to choose the windows, and no accuracy/safety claim follows from a low ranking score. Historical publication availability remains unknown; prospective inputs and extreme underprediction remain separate model limitations.

## Focused verification

`UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked pytest -q apps/api/tests/test_replay_planning.py`: **21 passed** across both clock bases. Tests cover complete same-issue inputs, extreme outcome mutation leaving rankings unchanged, zero preservation, exact units, missing-hour/mixed-issue rejection, duplicate horizons, wrong model/station, target misalignment, invalid/negative predictions, no-suitable-window behavior, explicit peak-aversion ordering, clock mismatch, fixed-model cutoff rejection, unsupported versions and unsupported fractional-hour durations. Source hashes change when fixture outcome bytes change while trajectory/ranking outputs stay identical. Focused Ruff lint/format pass. Actual registered artifacts were separately queried to verify counts and the example outputs above.

Actual in-process FastAPI handler smoke also passed6 checks across both registered datasets: complete-issue catalogue200, available120-minute plan200 with the measured values above, and caller ceiling0 returning `no_suitable_window`200. These are actual local artifact/API-handler checks, not a browser or provider-network test.
