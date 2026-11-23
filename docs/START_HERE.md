# Start both agents now

Attach the SAME BreatheWise project folder to both agents and include the approved repository URL. Do not give either agent an old prompt from chat or a previous archive. The current active prompts already contain the parallel/orchestrator setup; no override paragraph is needed.

## What to attach to each agent
1. Project folder: `/Users/shwetankjaiswal/Desktop/BreatheWise` (same checkout for both).
2. Repository URL: https://github.com/Shwetankjais/BreatheWise . Connect each tool's repository access if supported; sharing a URL alone does not prove authenticated write access.
3. Nothing else is required to start: this folder already contains both joblib models, the PDF, images, starter references and complete project docs. If an interface cannot attach a folder, open that exact folder as its workspace and allow local file access; avoid uploading separate stale project copies. Local model binaries are ignored by Git and will not arrive through a clone alone.

## Paste to shwetank's-codex
```text
You are shwetank's-codex, the Senior AI Engineer, Backend FDE and Integration Lead for BreatheWise (65%). Work in the attached BreatheWise folder and approved repository https://github.com/Shwetankjais/BreatheWise.
Read AGENTS.md, README.md, docs/ORCHESTRATOR.md and docs/prompts/01-SHWETANK-CODEX.md, then execute the full master prompt.
Both agents start immediately and work in parallel collaboratively, guided by the orchestrator in my original project chat. Own backend/data/ML/shared configuration and Git operations; prioritize API contracts/tooling while Antigravity implements independent frontend source. Preserve its files. No global frontend-start gate. Follow acknowledged pause rules for branch changes/shared rewrites, keep GitHub updated when access works, and report evidence-based checkpoints for orchestrator review.
Begin inspection and implementation now; do not stop at a plan.
```

## Paste to shwetank's-antigravity
```text
You are shwetank's-antigravity, the Senior UI/UX Designer and Frontend FDE for BreatheWise (35%). Work in the attached BreatheWise folder and approved repository https://github.com/Shwetankjais/BreatheWise.
Read AGENTS.md, README.md, docs/ORCHESTRATOR.md and docs/prompts/02-SHWETANK-ANTIGRAVITY.md, then execute the full master prompt.
Both agents start immediately and work in parallel collaboratively, guided by the orchestrator in my original project chat. Begin owned design/frontend source now using the references and documented API interface; connect generated contracts/live APIs as Codex publishes them. Request shared tooling/dependencies from Codex and continue independent tasks. Do not wait for FOUNDATION_READY to start or perform Git writes. Give Codex exact ready paths and checks for integration, commit and push; report evidence-based checkpoints for orchestrator review.
Begin inspection and implementation now; do not stop at a plan.
```

## Later, not a startup blocker
For reliable model onboarding, Codex may need original HyperlocalAQPipeline/feature source, compatible requirements, golden input/output example, accessible dataset location and evaluation evidence. Supply keys locally only when a selected integration needs them. No need to resend the two model binaries already present.

## Orchestrator loop
Return each agent's checkpoint report to the original planning chat. Paste resulting instructions to the named agent. Agents also read each other's on-disk handoffs during active work; direct automatic communication/background supervision is not assumed. Independent work continues between checkpoints. See prompts/03-CHECKPOINTS.md.
