> ARCHIVED REFERENCE TEMPLATE — source content below is for inspiration only. Active BreatheWise AGENTS.md, ORCHESTRATION.md and ORCHESTRATOR.md govern execution. Both agents start in parallel; only Codex performs shared-checkout Git writes. Do not apply a template's generic commit/branch instructions independently.

# Repository agent instructions

Fill in the project-specific references below. Put this file at the repository root or merge the applicable rules into existing root guidance.

## Project references

| Subject | File or location |
| --- | --- |
| Developer entry point | `README.md` |
| Requirements and acceptance | `docs/PRD.md` |
| Architecture and file ownership | `docs/ARCHITECTURE.md` |
| Install, run, test, and deploy | `docs/ESSENTIALS.md` |
| Release or submission evidence, when used | `docs/SUBMISSION.md` |
| Approved GitHub repository | [owner/repository or full URL] |
| Branch and review policy | [base branch, working branch pattern, PR requirements] |
| Required verification commands | [actual commands or link to their source] |

Use the existing equivalent when a listed path differs. Keep the list synchronized with the repository.

## Before editing

1. Verify the attached project path, Git root, current branch, working tree, and intended remote. Keep project edits and project-created files within that path.
2. Read the README, the task and relevant requirements, architecture notes, and scoped instructions for the areas you will touch. Inventory the repo, then trace the affected code and tests. Skip generated content, vendor caches, and secret values.
3. Identify behavior that must be preserved, the acceptance criteria for the change, and any unrelated working-tree edits. Record assumptions and a short plan for multi-step changes.

## Code and product

- Follow the actual repository topology and framework entry points. Place domain logic, request handling, UI, persistence, and configuration in their established locations. Keep components and modules focused, name them plainly, and reuse established behavior.
- Validate untrusted input at boundaries. Enforce data permissions on the trusted side. Preserve supported existing data and document any migration or integration setup.
- Wire complete workflows through the real application. Cover responsive layouts, keyboard interaction, accessible labels and focus, and applicable loading, empty, error, and success states.
- Verify changed behavior through normal entry points. Run relevant existing checks and add focused coverage when a meaningful regression would otherwise go undetected. Record unavailable checks accurately.

## Git and handoff

- For every coherent completed change, review relevant checks and staged diff, commit intended edits with a descriptive message, and push to the verified working branch when access permits. Keep user edits and secrets out of the commit. Follow hooks, branch protection, and the repo's review workflow.
- Keep a local commit if syncing fails. Diagnose the failure, retry safely, and report the branch and local-only commits if the blocker persists. Preserve existing branch history and unrelated changes.
- Update docs affected by the change. Report behavior delivered, verification evidence, any open gaps, and the GitHub branch or PR with its latest commit and sync status.
