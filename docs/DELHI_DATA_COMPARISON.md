# Delhi data-source decision — 24 November 2026

Use the local observed archive for historical Delhi analysis and OpenAQ for ongoing observation intake. Keep the sources and their timestamps separate until station identity and clock/interval semantics are reconciled. Neither source currently enables all end-to-end model, planning, spatial or evaluation features.

## What was actually checked

Read only the user-authorized NIErnaya_data folders, focusing on AirScope_India_final plus the original Aanad Vihar CSV. Queried all 54 cleaned pollutant Parquets with DuckDB, profiled 55 source site IDs, inspected the weather/fire/population schemas and actual coverage, and searched notebook code text without executing it. The final folder has neither its README's advertised src/airscope_pipeline.py nor data/original copy; original CSVs are available in the parent Pollutants 2017-2026 folder. No original HyperlocalAQPipeline implementation or golden inference row was found in the inspected notebook. Static string search is not proof that no such source exists elsewhere.

Fetched only location 235, PM2.5 sensor 12235610 for 29 October–1 November UTC, plus its current sensor metadata: three authenticated requests, 70 returned hourly observations, 2.42 seconds in this run. Provider metadata identifies CPCB/DPCC; source license metadata remains absent. Credentials were used only in the server-side header, never printed or archived. Snapshot checked at 2026-11-24T00:10:48Z (05:40:48 IST); sensor metadata's latest timestamp was 23 November 22:15Z (24 November 03:45 IST). This does not establish uninterrupted low-latency live service.

## Coverage and quality

| Question | Local Delhi archive | OpenAQ checked slice |
| --- | --- | --- |
| History | 4,047,408 grid rows, 2009–31 Oct 2026; different stations/parameters start later | 70 observations in selected 72h October window; ongoing sensor metadata through 23 Nov |
| Distinctness | 54 folders/55 IDs overall; exclude 172,368 copied rows, leaving 52 folders/54 IDs | Explicit provider location/sensor IDs; two PM2.5 sensors at Anand Vihar require current sensor selection |
| Observed PM2.5 | 2,885,092 non-null eligible values out of 3,875,040 grid rows (~74.5%); nulls are not zero | Actual reported hourly values and coverage flags; one-station scope cannot rank all Delhi stations |
| Other pollutants | PM10, NO2, SO2, O3, CO and more; raw headers specify CO mg/m³ and NOx ppb | Catalog may offer more sensors; only selected PM2.5 intake is implemented/verified |
| Clocks | Naive recorded clocks; timezone and interval start/end unresolved; historical publication times absent | Explicit UTC/local interval timestamps; documented exclusive period ends; local first-seen availability recorded conservatively |
| Weather | 4,998,672 rows/58 locations, Jan 2017–Oct 2026; composition starts Aug 2022; supplied model fields are not observed station truth | Selected air-quality provider does not supply the complete required weather/driver bridge |
| Fire | 33,987 detections only in Oct–Nov 2024 and Oct–Nov 2025 UTC | Not supplied by this selected PM2.5 intake |
| Population | Five epochs 2010/2015/2020/2025/2030; release, cell footprint, projections and aggregation require verification | Not supplied by this selected PM2.5 intake |
| Access/efficiency | Local queries avoid network cost; Parquet supports narrow typed reads | Small bounded incremental fetches are practical; use existing caching/retries/overlap lock, not national downloads |

For Anand Vihar, the cleaned file contains 124,176 hourly rows (2012–Oct 2026), including 91,287 observed PM2.5 values. All 7,296 rows of its 2026 original CSV matched the cleaned PM2.5 values/nulls exactly, with no unmatched timestamps. This checks one field/year, not the entire cleaning pipeline or physical station accuracy. Negative/nonfinite eligible values were absent in the nine profiled cleaned pollutant fields; that is not instrument calibration evidence. Duplicated series stay quarantined; imputed sensitivity products are not observed input.

## Overlap comparison and clock uncertainty

Comparisons preserve exact times and values, with no rounding, nearest-hour matching, interpolation or calibration. The OpenAQ location and local site_301 are name-matched candidates; an official site crosswalk is still needed.

| Explicit hypothesis for local clock | Non-null exact-time pairs | Mean absolute value difference (µg/m³) | Exact value matches |
| --- | --- | --- | --- |
| IST, timestamp denotes interval end | 63 | 7.0595 | 0 |
| IST, timestamp denotes interval start; compare its +1h end | 65 | 2.5615 | 13 |
| UTC, interval end or interval start +1h | 0 | unavailable | 0 |

The second hypothesis agrees more closely in this narrow sample. It does not certify the local clock convention, prove full station identity, or demonstrate that either record is more accurate. Different pairs enter each comparison because of missing data and window edges. This is record agreement, not independent measurement validation or forecast MAE. Do not silently shift the production archive by one hour on this evidence.

## CSV and storage

Original hourly CSVs already exist in the parent folder. A read-only conversion of the cleaned Anand Vihar file is in ignored work/data-source-audit/anand_vihar_observed.csv, preserving all 124,176 rows, naive timestamps, nulls and lineage. It is 29,077,977 bytes versus 4,114,696-byte Parquet (~7.1 times larger). Use CSV for inspection/interchange, retain Parquet for efficient backend queries. The local audit completed in 1.06 seconds on this machine/cache; this is a single-run observation, not a controlled benchmark against the network request.

## End-to-end recommendation and remaining requirements

1. Historical station explorer/EDA: use eligible observed local records; preserve separate source IDs, original units, masks, missingness and exclusions. Require explicit clock/period verification before importing as authoritative UTC history. Keep unavailable historical publication times explicit; do not backdate availability to measured time.
2. Current observations/alerts: continue the existing bounded OpenAQ cache/worker. Latest hourly readings can be stale or partial; server freshness gates remain active. Expand pollutants only with verified sensor identity and compatible units. CO mass concentration may convert mg/m³ to µg/m³; ppb conversion requires additional physical assumptions and is not automatic.
3. Model bridge: use the local assets as candidate sources only. Boundary-layer height was not found in the inspected weather schema; complete CAMS ozone/background semantics, issue-time forecast initialization/lead time, fire coverage for current 2026 issues, original formulas/missingness and golden parity remain missing. smog_pm25 is not verified CAMS PM2.5 and must not be substituted. Original declared horizons stay [1,3,6,12,24]; no operational forecast is enabled.
4. Population/spatial/route/planner: the local context assets help investigation, but exact raster release/footprint/epoch and verified spatial methods/continuous forecasts are still needed. No synthetic exposure, city forecast or evaluation evidence is produced.

Every ordered model input now has an archive-specific candidate/blocker in DELHI_FEATURE_INPUTS.csv and FEATURE_PROVENANCE.json. DELHI_DATA_AUDIT.json records reproducible counts, input hashes and actual fetch summaries. No credential or environmental time-series dump is committed. OPENAQ_API_KEY remains in the ignored local .env; .env.example documents the variable.

## Reproduce

From the BreatheWise checkout:

```sh
UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked python scripts/audit_delhi_sources.py \
  --archive /Users/shwetankjaiswal/Desktop/NIErnaya_data/AirScope_India_final \
  --raw-pollutants '/Users/shwetankjaiswal/Desktop/NIErnaya_data/Pollutants 2017-2026' \
  --fetch-openaq
```

Omit --fetch-openaq for an entirely local audit. The command writes only ignored project work/, not the source folder. It does not import observations into production or execute supplied notebooks/classes.

Official provider references: [hourly measurements and coverage](https://docs.openaq.org/resources/measurements), [timestamp semantics](https://docs.openaq.org/using-the-api/dates-datetimes), [terms and source attribution](https://docs.openaq.org/about/terms). Local source evidence: documentation/{Data_Dictionary,Timeline_Coverage,Cleaning_Log,Methodology}.md; actual cleaned Parquets and the hashed 2026 original CSV listed in DELHI_DATA_AUDIT.json.
