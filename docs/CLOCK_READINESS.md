# Clock alignment and UTC-native input readiness — 24 November 2026

The recorded-clock models remain retrospective. The local archive does not establish a timezone or interval boundary; no timestamp shift was selected and no source clock was promoted to UTC. A separate, actual UTC-native single-sensor history is now available for independent training.

## Identity and interval evidence

The archive's `station_crosswalk.csv` labels `site_301` as Anand Vihar/DPCC, but explicitly qualifies its coordinate context as user-supplied approximate, not official registry verified. Its weather-coordinate context is28.6476/77.3158. This supports a candidate association with the current monitor, not a verified replacement/sensor crosswalk. Its pollutant Parquet timestamp is naive with `isAdjustedToUTC=0`; original `Timestamp` headers and a `1Hr` filename establish neither IST/UTC nor start/end labeling. Existing documentation explicitly leaves clock semantics unverified. Public CPCB/DPCC searches did not supply an authoritative original-export clock/interval or source-ID crosswalk; third-party client descriptions were not treated as proof.

Actual OpenAQ metadata identifies location235 as Anand Vihar, New Delhi–DPCC, coordinates28.646835/77.316032, CPCB provider168, DPCC owner8524, fixed government monitor, `Asia/Kolkata`. Sensor12235610 measures PM2.5 inµg/m³; its own available record starts18February2025 at22:15UTC. Older sensor384 is separate and was not spliced into this history. Full metadata and cache hashes are in [CLOCK_READINESS.json](CLOCK_READINESS.json).

OpenAQ documents exclusive ending datetimes and UTC/local offsets. The fetched `/hours` rows carry explicit `period.datetimeFrom`/`datetimeTo`; verified rows span exactly one hour, with endpoint UTC minute30 and IST whole-hour endpoints. Both offset-bearing timestamps must denote the same instant, and the local offset must match Asia/Kolkata. These facts establish the new provider clock independently of the archive. [OpenAQ time convention](https://docs.openaq.org/using-the-api/dates-datetimes), [hourly resource](https://docs.openaq.org/resources/measurements).

The adapter preserves reported `value`, not reconstructed `summary.avg`;5,551 fetched raw rows differ between those fields. Provider coverage support-start bounds differ from period-start bounds in12,903 raw rows. Complete coverage therefore means **provider-declared**100%, not independent reconstruction from raw subhour samples. No units/clock/clipping adjustments were made to fit the archive.

## Available observations and actual availability

The bounded download uses one location and sensor only,19February2025 through31October2026, in23 disjoint28-day-or-shorter requests plus2 metadata requests. It yielded13,188 valid observed hourly values;9,509 are provider-declared complete and eligible for a separately specified UTC training protocol. Another3,679 partial/unknown coverage rows remain visible but are not training-eligible. Two unknown/flagged-quality and three invalid/missing rows were rejected; gaps are never zero-filled. Raw responses and normalized CSV remain ignored under `work/utc-history/openaq-235/`.

CSV SHA256: `90779cc9e54d54523af906ddc3d2c63c75a8e84d51d7ac7b1222d6192c09ef04`. A complete replay used0 network requests and25 cache hits, retaining the same hash. [UTC_HISTORY.json](UTC_HISTORY.json) contains count/identity/provenance/hash evidence; keys remain local headers and never enter reports.

Historical publication times remain unknown. Every row's `first_seen_at_utc` records this actual fetch, not a fabricated historical release time. A retrospective study must explicitly assume historical measurements were available; a prospective service must enforce actual first-seen cutoffs. OpenAQ warns that older observations can arrive out of order, so a latest-only query is insufficient. [Sensor measurement extent](https://docs.openaq.org/resources/sensors), [out-of-order reporting](https://docs.openaq.org/resources/latest).

The refreshed live-cache evidence includes a24November03:30UTC observation first retrieved06:00:57UTC, a150.96minute retrieval lag and partial-hour flag. This is an upper bound on publication lag, not the provider's exact reporting delay or an established service distribution. It cannot establish a universally safe issue-time freshness allowance.

## Cutoff and readiness rules

UTC models must bind to exact sensor12235610, UTC exclusive hour-ending labels, retained:30 phase, PM2.5 units and the declared completeness policy. For shadow operation require `available_at <= issue_at` and `measurement_end <= input_cutoff <= issue_at`; reject stale/incomplete current input, keep missing older lags explicit, and use only elapsed-hour source values through cutoff. Record failure, input provenance and target time. Score only compatible observations actually received after the forecast was issued.

A full hourly output does not establish live readiness. Recorded-clock models remain incompatible with provider UTC absent original clock/crosswalk evidence. UTC retrospective training remains distinct from prospective availability/outcome verification; public live forecasts, calibrated probabilities, exposure and activity recommendations stay gated.

## Reproduction and focused checks

```sh
UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked python scripts/fetch_utc_history.py
UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked python scripts/audit_clock_readiness.py
UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked pytest -q apps/api/tests/test_utc_history.py
```

Eight normalization checks passed: exact phase/zero preservation, original units, unknown historical publication, partial/unknown coverage, invalid/missing quality, UTC/local consistency and timezone offset, no future measurements, half-open windows and731-day download bounds. All three owned Python files pass focused Ruff lint/format. No dependency, original adapter, archive data, model-v1 artifact or frontend source was changed.
