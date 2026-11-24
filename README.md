# BreatheWise India
Local air pollution forecasting and exposure planning.

## Current state — 24 November 2026
Current checkpoint: contract1.3.0 adds two separate24-hour retrospective experiments (recorded-clock and verified UTC-native), issue-boundary-purged evaluation/playback, bounded provider-history caching and persisted experimental shadow-run/status APIs. Active allocation Codex55%/Antigravity45%; file ownership unchanged. See docs/FORECAST_MILESTONE.md for exact metrics/checks/limits. Supplied native75 remains diagnostic-only; actual delayed/stale/partial inputs keep public live forecasting, activity trajectories and spatial exposure unavailable. The prior frontend milestone5cd7127 remains accepted; new frontend1.3.0 source is ready for coordinated integration and remains uncommitted. No main merge or deployment.

Approved project folder: `/Users/shwetankjaiswal/Desktop/BreatheWise`.
Approved remote: https://github.com/Shwetankjais/BreatheWise .
Remote was verified empty and shell account has push rights. Codex initialized feat/foundation; sync evidence is recorded at checkpoints.

## Start
1. Read `AGENTS.md`, `docs/ORCHESTRATION.md` and `docs/ORCHESTRATOR.md`.
2. Attach this same folder and the approved GitHub URL to BOTH agents and start BOTH immediately using `docs/START_HERE.md`.
3. Codex (55%) implements backend/data/ML/shared foundation while Antigravity (45%) implements design/frontend in disjoint owned paths. Neither waits for the whole other workstream.
4. The original project chat is the orchestrator: bring back checkpoint reports for cross-workstream guidance. Routine independent work continues without waiting for an orchestrator reply.
5. Supply missing teammate source/data/example inputs at model onboarding (Gate B); both binaries are already under ignored `artifacts/models/`.
6. Use `docs/prompts/03-CHECKPOINTS.md` for scoped handoffs. Readiness markers describe available dependencies; they are not permission gates for starting all frontend work.

## Documentation
- `docs/START_HERE.md`: exact attachments and first messages for both agents.
- `docs/ORCHESTRATOR.md`: orchestrator role, decision authority and report format.
- `docs/PRD.md`: required journeys and acceptance criteria.
- `docs/ARCHITECTURE.md`: topology, ownership and storage.
- `docs/API_CONTRACTS.md`: endpoint plan and shared payload semantics.
- `docs/MODEL_INTEGRATION.md`: inspected artifacts, missing inputs and scientific limits.
- `docs/DESIGN.md`: visual direction and motion/accessibility requirements.
- `docs/ESSENTIALS.md`: intended command interface; commands must be implemented before being reported as runnable.
- `docs/handoffs/`: separate agent progress records.
- `docs/SUBMISSION.md`: verification and release evidence.

Copied starter files in `docs/reference/starter-kit/` retain their source content below an archive notice. They are non-governing reference templates; active root instructions and project requirements govern implementation, including the single-Git-writer rule. Binary model files are intentionally excluded from normal Git commits.

Model recovery and all 75 feature provenance statuses are documented in docs/MODEL_RECOVERY.json and docs/FEATURE_PROVENANCE.md. OpenAQ is authenticated locally; 70 real Anand Vihar hourly PM2.5 observations are cached. Source/timestamp/stale/partial flags and API/browser evidence are in docs/DATA_EVIDENCE.json; this snapshot does not imply current freshness or model readiness. Latest mobile-corrected snapshot: eight browser journeys, 22 frontend unit cases and production build pass. Full scientific/model/accessibility acceptance remains incomplete.

Delhi source decision: use local observed history plus OpenAQ ongoing intake. See docs/DELHI_DATA_COMPARISON.md and docs/DELHI_FEATURE_INPUTS.csv for measured coverage, clock-agreement hypotheses, efficiency and all 75 input blockers.
