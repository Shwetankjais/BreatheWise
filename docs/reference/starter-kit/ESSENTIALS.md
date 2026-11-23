> ARCHIVED REFERENCE TEMPLATE — source content below is for inspiration only. Active BreatheWise AGENTS.md, ORCHESTRATION.md and ORCHESTRATOR.md govern execution. Both agents start in parallel; only Codex performs shared-checkout Git writes. Do not apply a template's generic commit/branch instructions independently.

# Developer setup and operations

Keep this page aligned with the checked-in scripts and CI configuration. Provide commands that work from the repository root or state the working directory.

## Local development

- **Prerequisites** — [runtime and version, package manager, local services]
- **Install** — [lockfile-based installation command]
- **Configure** — [copy the example, set needed values, and obtain access through the project’s existing process]
- **Initialize data** — [migration and seed commands for local or disposable test data]
- **Run** — [command and local URL]
- **Smoke check** — [first route, sample input, and expected result]

## Environment variables

List names and purpose. Use placeholders in committed examples.

| Variable | Required where | Purpose |
| --- | --- | --- |
| [VARIABLE_NAME] | [Local, test, preview, or production] | [How it is used and where developers get the value] |

## Verification commands

| Check | Exact command or procedure | What success looks like |
| --- | --- | --- |
| Lint and type checks | [Commands] | [Expected output] |
| Tests | [Unit, integration, or end-to-end commands] | [Expected output] |
| Production build | [Command] | [Expected result] |
| Browser smoke test | [Route, role, actions, and test data] | [Expected UI and persistence] |

## GitHub and delivery

- **Repository and working branch** — [URL, upstream, branch and review rules]
- **Per-change checkpoint** — Confirm scope, run relevant checks, review and stage intended edits, commit, push, and record any sync gap.
- **CI and deploy** — [Triggers, target environments, required configuration, and deploy commands if applicable]
- **Release verification** — [Health checks, important routes, and any migration checks]
- **Troubleshooting** — [Common setup symptoms, safe recovery steps, and relevant logs]
