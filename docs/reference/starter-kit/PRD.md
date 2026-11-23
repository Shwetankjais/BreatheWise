> ARCHIVED REFERENCE TEMPLATE — source content below is for inspiration only. Active BreatheWise AGENTS.md, ORCHESTRATION.md and ORCHESTRATOR.md govern execution. Both agents start in parallel; only Codex performs shared-checkout Git writes. Do not apply a template's generic commit/branch instructions independently.

# Product requirements

## Problem and outcome

- **Source problem statement** — [paste it or link to the authoritative brief]
- **Mode** — [new project or enhancement]
- **Users and roles** — [primary users, secondary users, and permission differences]
- **Current experience** — [what users do today, what fails, and supporting evidence]
- **Desired outcome** — [observable result for the user]
- **Success measure** — [what will demonstrate success and how to measure it]

## Scope

| Priority | Requirement | Source or user need |
| --- | --- | --- |
| Required | [Capability the release must support] | [Brief or user workflow] |
| Optional | [Capability to consider if time allows] | [Reason] |

**Out of scope for this release** — [agreed boundaries]

**Existing behavior to preserve** — [routes, permissions, data, contracts, or user habits affected by the work]

## Core journeys

Describe each journey using the same fields. Include important failure and recovery paths.

- **User and starting condition** — [role, signing in or signed out, initial data]
- **Trigger and steps** — [what the user does in order]
- **Successful outcome** — [screen state, record change, or other observable result]
- **Failure and recovery** — [invalid input, permissions, timeouts, retries, or other relevant cases]
- **Design expectations** — [reference, interaction behavior, mobile layout, and accessibility needs]

## Acceptance criteria

Give each required criterion a stable ID. Use observable outcomes and add rows for the actual problem statement.

| ID | Given | When | Then | Verification |
| --- | --- | --- | --- | --- |
| AC-01 | [Relevant role and starting state] | [Primary action] | [Visible result and durable effect, if applicable] | [Browser journey or test] |
| AC-02 | [Invalid input or a denied action] | [User attempts the operation] | [Clear feedback and expected data state] | [Browser and/or API verification] |
| AC-03 | [Existing data or behavior, if enhancing] | [User repeats the established workflow] | [Supported behavior continues] | [Regression check] |

## Constraints and decisions

- **Required stack, hosting, integrations, data, schedule, budget** — [constraints that apply]
- **Quality targets** — [accessibility, responsiveness, performance, privacy, or reliability expectations]
- **Assumptions** — [decision being made, why, and what would change it]
- **Open decisions** — [material questions, owner, and when they need an answer]

## Implementation milestones

| Milestone | User-visible outcome | Acceptance IDs | Dependency or risk |
| --- | --- | --- | --- |
| [First usable slice] | [End-to-end outcome] | [IDs] | [What must be ready] |
| [Next slice] | [End-to-end outcome] | [IDs] | [What must be ready] |
