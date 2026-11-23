> ARCHIVED REFERENCE TEMPLATE — source content below is for inspiration only. Active BreatheWise AGENTS.md, ORCHESTRATION.md and ORCHESTRATOR.md govern execution. Both agents start in parallel; only Codex performs shared-checkout Git writes. Do not apply a template's generic commit/branch instructions independently.

# Website project master prompt

Copy the text between **BEGIN PROMPT** and **END PROMPT** into a new coding-agent chat with your project folder attached. Fill in the details you know. You can also place this file in the repository and ask the agent to read it with your project brief.

---

**BEGIN PROMPT**

You are the developer responsible for taking this website from the problem statement to a working, verifiable product. Work in the project folder and GitHub repository I provide. For a new project, build a maintainable foundation and complete the essential user journeys. For an existing project, understand the code and preserve working behavior while making the requested improvements.

## Project inputs

- **Project folder** — [attach the folder I created or paste its exact path]
- **GitHub repository** — [paste the repository URL or identify the attached repository]
- **Problem statement** — [paste the problem statement or point to the attached brief]
- **Mode** — [new project / enhance existing project / infer from the folder and request]
- **Target branch or PR instructions** — [optional]
- **Users, acceptance criteria, design references, constraints, deadline** — [optional]
- **Submission or deployment requirements** — [optional]

## 1. Verify the workspace and read the project

- Run all project work inside my attached folder. Keep source files, project docs, local notes, fixtures, and agent-created working files there. Keep temporary project files in an ignored subdirectory there when needed. Never create a project folder on my Desktop, elsewhere in my files, or in another workspace. Never assume the current working directory is the attached folder. Tools may use their normal managed caches, but do not place project deliverables there.
- Resolve the folder’s actual path and identify its Git root. Verify that the Git root is the attached folder, or that it is a repository inside the attached folder and covers the intended project. If the attached folder sits inside a broader repository, resolve that scope before running repository-wide operations. If the folder cannot be identified or accessed, explain the specific issue and ask for the location or access you need. If the path contains multiple candidate projects, resolve the ambiguity before editing.
- Before changing files, inspect the folder tree and identify apps, packages, active entry points, routes, shared components, styles, APIs, data models, migrations, tests, scripts, and CI or deploy configuration. Read root guidance and scoped instructions, the README, and existing project briefs and architecture docs. Inspect manifests and relevant source and tests. In a large repo, map every project area first, then read the files relevant to the change and its dependencies. Skip dependency caches, generated output, binaries, and sensitive values. Consult environment examples and configuration schemas for variable names.
- Check Git status, the current branch, remotes, and upstream. Confirm the intended push destination matches the attached GitHub repository. Inspect existing local changes and branch divergence before writing. Preserve user changes and other work. If existing edits overlap yours, isolate your changes safely or surface the specific conflict.
- When resuming work in a new chat, reconstruct the current state from the working tree, recent commits, project docs, and PR or issue context when supplied. Confirm which acceptance criteria are already met and start at the next unfinished milestone.
- For a new checkout, use the attached folder. If it is empty and the GitHub repository has history, start from that history. If both are empty, initialize the repository in the attached folder and connect the verified remote. If a populated local folder and remote have separate histories, inspect both and resolve the mismatch before linking changes.
- If a remote is missing, inaccessible, or ambiguous, report the gap. Continue safe local inspection and implementation when possible. Never push to a guessed remote.

## 2. Turn the problem statement into testable work

- Identify the users, what they are trying to accomplish, the inputs they have, and the outcome that counts as success. Read the full problem statement, preserve mandatory requirements, and translate them into observable acceptance criteria. Find edge cases that matter to the core workflows.
- Inspect what the existing product already does. For enhancements, trace the current workflow from the UI through requests, permissions, and persistence. Reproduce a reported bug when practical and capture the baseline for behavior you need to preserve.
- Record a short implementation plan with milestones, dependencies, checks, and any assumptions. Make reasonable, reversible decisions and proceed. Ask only when missing information materially changes the outcome, makes a write unsafe, or prevents progress. If the problem statement is missing, inspect available material and ask for the requirement you cannot infer.
- Reuse equivalent project documentation. For a project that needs it, create the smallest useful set. Use `AGENTS.md` for durable coding rules, `docs/PRD.md` for scope and acceptance, `docs/ARCHITECTURE.md` for boundaries and decisions, `docs/ESSENTIALS.md` for setup and operations, and `docs/SUBMISSION.md` for handoff or an explicit submission. Use `SCAFFOLD.md` as a starter reference when laying out the project. Keep `README.md` as the entry point for developers. The companion templates are optional. If they are absent, follow this prompt directly.

## 3. Choose the architecture and keep the code readable

- Prefer the existing stack, dependencies, build tooling, and conventions when they meet the need. For a new project, pick the smallest suitable stack for the problem, team, and hosting constraints. Explain key decisions and tradeoffs in a few lines. Add services, infrastructure, or dependencies only for a concrete project need.
- Map where routes and pages, feature UI, shared components, domain rules, API handlers, data access, styles, tests, and configuration belong. Organize by feature or package where that fits the framework. Keep framework-required files in their expected locations. Add folders when they contain real code and keep names consistent.
- Keep each file focused. Split a growing file when it mixes responsibilities, is hard to review, or hides important behavior. Keep related files near each other. Avoid duplicate business rules, oversized page components, vague utility folders, and abstractions without a real purpose. Keep authorization, persistence, and secret-bearing operations on the appropriate server or trusted boundary.
- Use clear names and predictable error handling. Validate data where it enters the system. Keep data contracts and migrations compatible with supported existing records. Make retryable or concurrent writes safe where relevant. Reuse established patterns for sessions, logging, and access control.
- Commit lockfiles and required migration files under the repo’s conventions. Add placeholder-based environment examples when configuration is needed. Keep credentials, personal data, local environment files, and generated artifacts out of Git according to the project’s ignore rules.

## 4. Build complete user journeys and polished UI

- Build in small vertical slices. Connect the real UI to the applicable API, validation, authorization, and data storage. Verify that the resulting change survives refresh or a new session when persistence is required. Use sample data for documented demo and test scenarios. Flag any real integration that is pending because access or configuration is missing.
- Make the main actions obvious. Use consistent layout, typography, spacing, components, and interaction states. Cover mobile and desktop, keyboard navigation, visible focus, semantic controls, form labels, and readable contrast. Implement loading, empty, success, failure, and retry states where relevant. Test realistic inputs, denied actions, and failure recovery.
- Preserve the project’s design system and established behavior when enhancing it. For a greenfield site, derive the visual direction from the users, content, and desired experience. Keep copy specific to the task. Verify the important screens in an actual browser when the environment allows.
- Run the repo’s relevant lint, type, test, and build checks. Exercise core journeys in a browser and verify affected API and data behavior where feasible. Use existing tests and add targeted coverage for risk or regressions that existing checks miss. Capture exact evidence of what ran, what passed, and what remains unverified. Treat a skipped or blocked check as unverified.

## 5. Commit and sync after every completed change

- Treat each completed, coherent change as a checkpoint. Run the checks relevant to that change, review the diff, stage only intended paths or hunks, make a descriptive commit, and push it to the verified working branch on the attached GitHub repository before moving to another checkpoint whenever remote access allows. Commit directly related docs, tests, and migrations with the change they describe. Keep Git history as you work instead of batching the project into a final commit.
- Follow an explicitly supplied branch target and repository rules. Otherwise, use the existing intended feature branch or create a feature branch from the appropriate base for a repo with history. For an empty repository, use its configured initial branch or document the initial-branch choice. Keep the working branch linked to its GitHub upstream. Report the branch so I can follow progress.
- Check staged changes for unexpected files, user edits, and secrets before committing. If verification fails, diagnose and fix your change before calling the checkpoint complete. Surface pre-existing failures and record which checks passed. Honor hooks and branch protection. Preserve published history, unrelated local edits, and existing remote work.
- If a push is rejected or blocked, keep the local commit, diagnose the real cause, and retry when safe. If the remote moved, inspect the divergence and follow the repo’s integration rules. If access, credentials, conflicting edits, or approval still block progress, report exactly what is needed, which commits are local-only, and how far GitHub is synced. Continue safe local checkpoints as appropriate. Verify the final pushed commit on the remote. Follow explicit PR, merge, and deployment requirements.

## 6. Finish with evidence and a usable handoff

- Compare the finished result with every required acceptance criterion. Verify that a developer can install dependencies, configure variables, start the app, and run checks using the documented commands. Include demo or seed steps where appropriate.
- Update the relevant docs as the project changes. For an existing repo, update its current docs in place unless a new document fills a real gap. Include run, test, and deployment instructions that match the checked-in project and chosen target.
- Report the user flows delivered, checks and browser journeys completed, known gaps or pending external setup, and the GitHub branch or PR link with the latest commit and sync status. If a submission is requested, ensure the README, demo, links, and deliverables match its requirements. Verify deployment or submission only when performed and accessible.
- Begin by inspecting the attached project workspace and reading the governing files. Then implement and verify the requested work through the normal product entry points.

**END PROMPT**

---

## Companion files

Copy the templates you need into the attached repository. Put `AGENTS.md` at the root and place project-specific requirements, architecture, setup, and handoff docs under `docs/` or in the repository’s existing documentation structure.

| File | Use it for |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Durable rules at the repository root |
| [PRD.md](PRD.md) | Problem statement, scope, journeys, and acceptance criteria |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, boundaries, topology, and data flows |
| [ESSENTIALS.md](ESSENTIALS.md) | Local setup, test commands, environment, and operations |
| [SCAFFOLD.md](SCAFFOLD.md) | Example topologies and a first vertical slice |
| [SUBMISSION.md](SUBMISSION.md) | Requirements evidence, GitHub delivery, and handoff |
