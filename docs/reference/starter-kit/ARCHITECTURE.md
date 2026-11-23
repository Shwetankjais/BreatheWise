> ARCHIVED REFERENCE TEMPLATE — source content below is for inspiration only. Active BreatheWise AGENTS.md, ORCHESTRATION.md and ORCHESTRATOR.md govern execution. Both agents start in parallel; only Codex performs shared-checkout Git writes. Do not apply a template's generic commit/branch instructions independently.

# Architecture

## Context and stack

Briefly describe the current system, the intended change, and the constraints that shape it. For an enhancement, identify the paths that already own the behavior.

| Layer | Selected technology or existing convention | Why it fits |
| --- | --- | --- |
| UI and routing | [Framework, rendering, and styles] | [Reason] |
| Server and API | [Runtime and contract style, if applicable] | [Reason] |
| Data and identity | [Storage, migrations, and access model, if applicable] | [Reason] |
| Verification and delivery | [Test tooling, CI, and hosting] | [Reason] |

## Repository topology

Use actual repository paths. Add or remove rows to match the project.

| Path | Responsibility | Boundary |
| --- | --- | --- |
| [App entry and routes] | [Route definitions and page composition] | [What is delegated to features or services] |
| [Feature modules] | [Feature UI and behavior] | [Allowed dependencies] |
| [Shared UI and styles] | [Reusable primitives and design tokens] | [Shared presentation contracts] |
| [Server and data code] | [Validation, authorization, domain rules, adapters, and queries] | [Trusted runtime and permitted callers] |
| [Tests and fixtures] | [Unit, integration, and browser verification] | [Fixture and environment rules] |

Prefer framework-native paths and existing equivalents. Keep required paths stable and note meaningful deviations.

## Request and data flow

For each core workflow, trace the actual path through the system.

1. **Entry point** — [route, action, or event]
2. **Validation and access** — [input contract, role, ownership, or other boundary]
3. **Domain and persistence** — [operation, data model, and transaction or retry behavior where relevant]
4. **Response and UI state** — [output contract, errors, loading, and recovery]
5. **Verification** — [test location or acceptance criterion]

## Compatibility and operations

- **Data evolution** — [migration, compatibility for existing records, and recovery plan]
- **External integrations** — [configuration names, failure handling, and local testing approach]
- **Deployment and observability** — [environment boundaries, health checks, relevant logs, and rollback path]
- **Decision record** — [date, decision, reason, and tradeoff for choices that affect future work]
