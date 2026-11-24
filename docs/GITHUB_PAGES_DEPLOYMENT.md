# GitHub Pages public demo

Public URL: https://shwetankjais.github.io/BreatheWise/
Deployment implementation: d4c20fc4302b01c488b8bbf02985307bf50ce8db, branch feat/foundation. GitHub Actions Pages build/deploy45421443266 succeeded. Initial implementation adcc52d also passed backend CI45420938916. No main merge, Vercel/Render account or paid resource was used.

Actual Chromium verification on24November2026: desktop1440×1000/mobile390×844 returnedHTTP200; all ten navigation tabs rendered with persistent explicit Demo Preview and public scope notices; reload retained explicit demo; zero JavaScript page errors, zero unavailable-backend network requests and no horizontal body overflow. Evidence GITHUB_PAGES_VERIFICATION.json; repeat with `node tools/browser-tests/live/pages.mjs` from repository root. First harness tab selector was corrected; an existing history flow's API request is now answered explicitly unavailable in the deployment-only entry. No fabricated server response/data fallback is used.

The separate tools/github-pages entry explicitly selects the existing demo client before React initializes, adds the public scope notice, scans existing frontend source for Tailwind styling, and uses project base /BreatheWise/. Existing apps/web source and localhost entry are preserved. The workflow publishes only compiled static assets from work/github-pages-dist; no .env, tokens, databases, private archives or models are uploaded. GitHub's documented [Pages Actions workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) is used.

## Exact public scope

Synthetic overview/map, weather/model/history/route fixture previews and educational screens are visibly labeled demo. Saved-place/account previews are browser-local demo behavior, not server identity or cross-device persistence. Real station intake, weather API context, measured retrospective evaluation/playback, local archive/comparison, complete saved forecast replay, learned shadow runs and server alerts/accounts are not hosted on Pages. Some views consequently show unavailable states; the deployment entry returns503 STATIC_DEMO_API_UNAVAILABLE locally when a server-backed flow requests /api. V5 live inference, spatial exposure and future activity planning remain gated.

The real-data local prototype remains running on127.0.0.1:5173 with its API8000. It is not a public backend. DEPLOYMENT_ASSET_INVENTORY.json records local hashes/provenance and unestablished redistribution rights. Prior Vercel/Render setup documentation describes an optional future full-stack hosting path, not a requirement for this deployed static demo. No production API URL/CORS/database migrations can be claimed for GitHub Pages because no API/database is deployed there.
