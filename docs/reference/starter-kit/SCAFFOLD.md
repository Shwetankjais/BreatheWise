> ARCHIVED REFERENCE TEMPLATE — source content below is for inspiration only. Active BreatheWise AGENTS.md, ORCHESTRATION.md and ORCHESTRATOR.md govern execution. Both agents start in parallel; only Codex performs shared-checkout Git writes. Do not apply a template's generic commit/branch instructions independently.

# Website scaffold reference

Use the repository’s actual framework conventions. For a greenfield build, choose the layout that reflects deployable applications and existing constraints. Create each directory when the first real file belongs there.

## One application

```text
project/
├── AGENTS.md
├── README.md
├── docs/
├── public/                 # Public static assets
├── src/
│   ├── routes/             # Framework route entry points and page composition
│   ├── features/           # Feature-specific UI and behavior
│   ├── components/         # Reusable UI across features
│   ├── styles/             # Global styles and design tokens, where needed
│   └── server/             # Server-only code, if the app has a server
│       ├── domain/         # Shared business rules, when needed
│       └── data/           # Persistence and external adapters
└── tests/                  # Cross-feature tests, if the repo uses this convention
```

Use framework-specific names such as `app/` or `pages/` when required. Keep client and server imports within the framework’s allowed boundaries. Add the actual manifests, lockfile, ignore rules, environment example, and migration path as applicable.

## Separate web and API applications

Use this shape when separate deployables or existing ownership boundaries justify it.

```text
project/
├── AGENTS.md
├── README.md
├── docs/
├── apps/
│   ├── web/                # Routes, feature UI, shared UI, and styles
│   └── api/                # API entry points, domain rules, and persistence
├── packages/
│   └── contracts/          # Shared request and response contracts, if needed
└── tests/                  # Cross-application flows, if needed
```

Keep configurations near their owners. Share code across packages when multiple consumers need the same contract or behavior. Follow an existing repo’s topology, recording any intentional change in the architecture doc.

## First working slice

1. Pick one required journey and trace it from user action to verifiable result.
2. Set up the minimum runnable project or locate the existing entry point.
3. Implement the route, UI states, and any necessary server logic and persistence.
4. Verify the successful path and a meaningful failure path. Check desktop and mobile layouts for the affected screens.
5. Update the README with confirmed commands, review the diff, commit the slice, and push to the verified GitHub branch.
