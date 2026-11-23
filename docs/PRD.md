# Product requirements and acceptance

## Problem
Forecast station-level pollutant concentrations and upcoming episodes across the user's selected Indian cities; help residents compare lower-exposure outdoor times; provide interpretable monitoring/population context and educational health guidance with honest uncertainty. Later spatial estimates, routes and weather scenarios must reflect actual validated capabilities.

## Cities
Delhi/New Delhi; Mumbai/Navi Mumbai; Hyderabad; Bengaluru; Pune; Chennai; Kolkata; Ahmedabad; Lucknow; Moradabad; Srinagar; Ghaziabad; Agra; Indore; Guwahati; Jaipur. User supplied 247 candidate stations; supplied national model/report references 782. Audit actual eligible coverage and normalize aliases/boundaries; never assume every candidate is live or usable. Delhi first real slice, then eligible cities. No fake stations.

## Required journeys and acceptance IDs
| ID | Required behavior | Evidence |
|---|---|---|
| AC01 | Choose city/station/pollutant; map selection opens correct real station detail with source, units and timestamps | API + browser checks |
| AC02 | Display actual model forecasts only at supported horizons, with issue/target times and artifact identity; verify inverse target transform | Golden parity test + browser |
| AC03 | Rank monitored locations at +1/+3/+6/+24h by a documented forecast severity rule; probabilities only if calibrated | Ranking and missing-input tests |
| AC04 | Planner compares duration/start-time choices using supported complete trajectory, sensitivity policy and transparent concentration-time method; declines unsupported/no-suitable windows | Domain + API + browser |
| AC05 | Show reviewed pollutant health guidance; no individual disease diagnosis | Source/content review + browser |
| AC06 | EDA filters city/station/date, returns reproducible chart values with valid/missing counts | Analytical fixture + actual data sample |
| AC07 | Population view shows epoch/projection and valid station context; city coverage analysis uses complete raster extent | Raster extraction check + map |
| AC08 | Show freshness, missingness, fallback provenance; intervals/probabilities only when validated | Stale/outage/uncalibrated tests |
| AC09 | Save/delete places and preferences across refresh; ownership isolated by user | Persistence + cross-user tests |
| AC10 | Alert rules generate one appropriate event, respect cooldown and record delivery/failure; configured channels work | Worker idempotency + delivery test |
| AC11 | Evaluation view displays actual per-horizon/city metrics and baseline comparison; unavailable when evidence absent | Evaluation schema + browser |
| AC12 | Responsive accessible UI; keyboard flows; reduced motion; loading/empty/error/partial/success states | Mobile/desktop browser and accessibility checks |
| AC13 | Install/run/check commands reproduce a local full-stack setup with real model/data configuration | Clean setup walkthrough and CI |

## Requested extensions, included as gated work
AC14 route comparison: actual alternative routed geometries, distance/duration and method-labeled concentration-time exposure, spatial support and coverage. No fabricated live traffic, causal route health reduction, or 'cleanest street' claim. AC15 what-if weather: supported feature perturbations, consistency checks and recalculated dependent features, explicitly model sensitivity. AC16 facility planning: verified POIs and honest station-distance support. AC17 monitor placement: population coverage optimization. AC18 explanations: validated model explanations, no causal source attribution.

These extensions remain in the backlog until prerequisites are met; do not quietly remove them. An unsupported capability should communicate the concrete dependency and return a structured unavailable response. Such a response is honest behavior, but it does NOT count as delivery of the underlying feature.

## Scientific boundaries
Ground observations are targets; CAMS is model background. PM2.5 forecasts are not automatically overall AQI. Forecast supported pollutants only. Follow documented averaging/completeness for derived CPCB-method indices and label them as project computed. Do not invent calibrated confidence from a single regression output. No source-contribution donut with guessed percentages (including the sample screenshot). No disease identification from pollution/population. Population buffers overlap and are not unique exposed headcounts. No implied real-time data from historical files. Historical replay is allowed only with persistent replay-date labeling.

## Success
All required acceptance IDs have evidence with actual configured dependencies. Real model inference agrees with teammate golden predictions within recorded tolerance. Forecast error/baselines and gaps are disclosed, not promised ahead of evaluation. Optional features are tracked separately with readiness. Performance is measured on realistic station counts and mobile/desktop; decorative motion cannot block essential tasks.

## Parallel collaboration
Both agents begin immediately under the original-chat orchestrator; follow ORCHESTRATOR.md and ARCHITECTURE.md ownership. Codex handles shared/backend/model work and Git writes, Antigravity handles owned frontend source and UI evidence. Readiness checkpoints enable dependent integration; they do not block independent work. Record progress and scoped requests in each owner's handoff.
