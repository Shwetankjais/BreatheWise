# Visual direction

## Reference interpretation
Read both local images in docs/reference/visuals/. The India Gate photo suggests atmospheric depth, warm haze and a human-scale Indian setting. The dashboard suggests a clear map-first operational layout, green/teal accents, pollutant cards and route comparison. Use these as inspiration, not as a reason to copy sample numbers, source-contribution percentages, arbitrary confidence or health claims.

## Art direction
A calm public-health product with an atmospheric entry, editorial typography and a useful live workspace. Light ivory/slate surfaces, deep ink text, restrained teal primary actions and pollutant-category semantic accents. Warm haze belongs in hero atmosphere; it should not reduce chart/map contrast. Use defined tokens, consistent spacing/radii and at most two intentional font families with locally hosted/licensed assets when practical. No generic neon/glass layout or decorative motion over data controls.

## Screens
Overview with city switcher, freshness, concise concentration/forecast cards and map; station detail and forecast; hotspot watchlist with horizon controls; activity planner; experimental routes; EDA explorer; population coverage; saved places/preferences and alerts; model/methodology/data-status views. Do not put every tool on a single crowded screen. Support mobile list/map switching and collapsible side panels; preserve map attribution.

## Motion and 3D
Create a short restrained atmospheric hero: layered skyline/India Gate silhouette inspired by the image, drifting haze or particles and subtle parallax. Prefer CSS/SVG and Motion when sufficient. Optional React Three Fiber scene is lazy-loaded, decorative, pointer-nonblocking and outside core data rendering. Include static fallback, prefers-reduced-motion, visibility pause and reasonable mobile quality settings. Keep screen-reader/keyboard semantics independent of animation. Do not imply particles visualize measured pollution unless they do. Charts and map load separately; route navigation must not wait for 3D. Inspect performance before adding visual dependencies. Use optimized responsive WebP/AVIF assets where supported; keep sources/rights documented.

## Required states and truthfulness
Live, replay and demo are distinct persistent labels. Empty city coverage, stale observations, provider outage, unsupported horizon, unavailable spatial estimate and calibration absent must have helpful states. Derive UI capability from /capabilities. Avoid dead buttons and invented successful actions. Health language must use reviewed source text. Map hotspots represent monitored points or a documented spatial model; circles are not validated pollution boundaries. Use icons/text in addition to color. Provide accessible chart summaries and station tables, visible focus and readable contrast.

## Optional tools
shadcn/ui and Motion are selected candidates, not reasons to install unrelated packages. 21st.dev may inspire components subject to license/accessibility review. Agentation can be dev-only if it improves review. Tinyfish, image-to-code, Framer, motiondesign.dev and external skills are optional, never prerequisites or substitutes for data wiring. Do not add analytics by default; PostHog only after a concrete analytics need, configuration and privacy decision. No Notion writes or messages to other services are implied. Keep production dependency footprint small.

## Parallel collaboration
Both agents begin immediately under the original-chat orchestrator; follow ORCHESTRATOR.md and ARCHITECTURE.md ownership. Codex handles shared/backend/model work and Git writes, Antigravity handles owned frontend source and UI evidence. Readiness checkpoints enable dependent integration; they do not block independent work. Record progress and scoped requests in each owner's handoff.
