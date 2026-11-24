# Local prototype — current completion evidence

Local URL: http://127.0.0.1:5173 . API/docs: http://127.0.0.1:8000/docs . The owned loopback supervisor is running; no deployment or main merge. Current allocation Codex40%/Antigravity60%, existing ownership unchanged.

Backend/model/replay/local operations are implemented at bdebeed; contract1.3 frontend PhaseA is accepted at2d979ad using the new13:17IST ACK, exact preserved bytes and36unchanged fingerprints. PhaseB replay UI/final combined desktop/mobilewalk remains pending its owned implementation and new freeze. Earlier OPEN/freeze/preflight failures are historical, not acceptance of a current UI snapshot.

## Working commands

Run from /Users/shwetankjaiswal/Desktop/BreatheWise. Existing .env credentials and selected archive/model paths are preserved. Tokens are private local files, never console output.

```sh
UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked python scripts/local_prototype.py prepare
BREATHEWISE_OPENMP_LIBRARY=/opt/anaconda3/lib/libomp.dylib UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked python scripts/local_prototype.py start
UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked python scripts/local_prototype.py status
BREATHEWISE_OPENMP_LIBRARY=/opt/anaconda3/lib/libomp.dylib UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked python scripts/prototype_cycle.py
UV_CACHE_DIR="$PWD/work/uv-cache" uv run --locked python scripts/local_prototype.py stop
```

The OpenMP path is verified for this Mac's existing isolated runtime; it is not a portable/global installation instruction. `start` refuses occupied8000/5173 and never silently chooses alternatives. `stop` authenticates to the owned local supervisor rather than killing arbitrary PIDs. Shutdown/restart was actually exercised. Read LOCALHOST_PROTOTYPE.md for identity provisioning, private token use, dataset/model configuration and ordered demo sequence.

## Implemented features and measured scope

| Feature | Actual verified scope |
| --- | --- |
| Intake |4Delhi monitors,309cached observations at preparation; timestamps/units/partial/stale/revision metadata retained |
| Archive |Recorded-clock exploration and conditional same-clock comparison; source301 timezone/interval/crosswalk unresolved |
| ML evaluation/playback |Both hourly recorded/UTC models; issue-purged comparison and playback, legacy5h model qualified |
| Availability-aware model |Independentlytrained delay3h-v2,24native models/40features/136092heldout rows; historical publication-delay SCENARIO, actual serving first-seen gates |
| Experimental runs |Persisted learned/baseline identity, nominal issue vs actual generation, cutoff/provenance/inputSHA, outcomes and duplicate prevention |
| Replay planning |One model/issue/station/clock and24actual forecast hours; concentration×duration ranking, engineering sensitivity, caller ceiling, incomplete/no-window states; no target observations in ranking |
| Accounts/alerts |Private local identity verified; actual place ownership/preferences/zero-thresholdrule persistence and real alert worker verified;0current notifications |
| Routes |Actual OSRM driving geometry/distance/provider duration; pollution exposure and traffic-aware ETA unavailable |
| Environmental Context |`GET /api/v1/environment/context`: Haversine distance, 50 km Delhi bounds limit, ground pollutant aggregation, Open-Meteo NWP gridded weather context |
| Station Pollutants |`GET /api/v1/stations/{id}/pollutants`: 6 criteria pollutants (PM2.5, PM10, NO₂, SO₂, CO, O₃) with 1-hr indicative tags, unavailable states, and CPCB 24h averaging notice |
| Model v5 Diagnostic |Supplied 69-feature LightGBM/XGBoost ensemble in `tools/model-v5`; offline diagnostic adapter verified (12 passed, 1 golden-skipped). Target transform 'none', declared horizons 1/3/6/12/24. Gated from operational API serving due to unverified golden parity, feature formulas/units, and training environment. |

The actual learned attempt51cded18-d577-4319-a602-d2683431b0be is rejected AVAILABILITY_REQUIRED_INPUT_UNAVAILABLE with inputSHA cd3d3b199e63ee5f5a142ecf44f248dc0a5ace6c7e231a32e7b368d2ef57bed2, zero forecasts and retained exclusions. Nominal issue2026-11-24T07:30Z, actual generation07:35:15Z. Required03:30/04:30UTC hours were partial. The remaining external condition is a complete verified3h/4h-old observation actually known by cutoff, plus compatible known history. No freshness relaxation, backdated actual generation, synthetic city forecast or prospective accuracy claim.

Matched scenario test MAE:1h23.489µg/m³ versus persistence23.218(N1283);24h29.474 versus28.981(N1305). Model beats both baselines at11/24hours only. Publication-delay assumptions also apply to training/selection label availability; issue bounds include the3h label delay. Complete results/definitions/hashes: AVAILABILITY_FORECAST.md/json. Older experiments and supplied native75 remain unchanged; the supplied model is diagnostic-only.

Actual2h replay outputs: recordedissue2025-01-01T00:00 best12..14h, concentration-time373.029863µg·h/m³; UTCissue2026-08-19T16:30Z best22..24h,138.047760. Complete issue catalogues contain10142recorded and195UTCtest trajectories. These are historical forecast comparisons, not present safe-time advice or inhaled-dose estimates.

## Endpoint examples

```text
GET /api/v1/models
GET /api/v1/models/delhi-openaq-pm25-delay3h-v2/availability-evaluation?horizon_h=1
GET /api/v1/models/delhi-openaq-pm25-hourly-v1/replay-issues?split=test&limit=5
POST /api/v1/activity-plan/replay
GET /api/v1/forecast-runs/51cded18-d577-4319-a602-d2683431b0be
```

Replay body example:

```json
{"model_version":"delhi-openaq-pm25-hourly-v1","issue_at":"2026-08-19T16:30:00Z","split":"test","duration_minutes":120,"sensitivity":"general"}
```

Add max_window_mean_ugm3=0 to exercise a real no_suitable_window response. An unavailable/incomplete issue returns its code/coverage, never filled/interpolated hours. See PROTOTYPE_CONTRACT.md and REPLAY_PLANNING.md.

## Verification and remaining gates

Test suites pass with 132 backend tests (1 default PostgreSQL skip) and 60 frontend Vitest cases. Full headless Playwright browser checks pass across desktop (1440px) and mobile (390px) with 0 horizontal scroll overflow. Prototype is live and supervised on http://127.0.0.1:5173 and http://127.0.0.1:8000. CI45350115600 passed 127 standard + 1 default PostgreSQL-only skip, 46 PostgreSQL, 89 forecast mechanics, 2 native mechanics, browser-tool strict types and packaging. Phase A accepted 49 frontend tests/build and 8 focused actual desktop/mobile checks, with model numbers/run details matching APIs; explicit empty/503 simulations are labeled in PROTOTYPE_PHASE_A_VERIFICATION.json. Actual localhost account API checks verified owner isolation, preferences and zero-thresholdrule; cached worker produced 0 real alerts. Whole-cycle rerun returned the same learned run (created false), no duplicate.

Public live forecasting, current safe-time planning, calibrated uncertainty/probabilities, spatial exposure, population extent and operational use of supplied75 remain gated. A genuine learned24target prospective run has not occurred with the currently ineligible inputs; software readiness does not replace that evidence. PhaseB UI and final combinedbrowser acceptance are recorded here when completed; no prior browser result is reused for those new paths.
