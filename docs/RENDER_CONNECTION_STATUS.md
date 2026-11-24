# Render API connection — 24 November 2026

API: https://breathewise-api-56wc.onrender.com . Frontend: https://shwetankjais.github.io/BreatheWise/ . Vercel is not required. GitHub Actions repository variable VITE_API_BASE_URL is set to this API origin. The connected Pages build calls the server; explicit static fixtures are used only without the URL or via user-selected preview mode.

## Actual HTTP findings

- Root 404 is expected; docs/OpenAPI/health return200, contract1.4.0.
- Readiness returns503 with database=true, model=false, providers=false. Successful station queries confirm database access beyond process health.
- Server is DATA_MODE=demo and contains synthetic station demo-delhi-001 with PM2.5=25µg/m³. This is not live telemetry.
- Station details/pollutants, cities, advisories and environmental context respond200. Missing pollutants are unavailable.
- Archive catalogue, retrospective evaluation and replay issues return503 because their assets are absent.
- Supplied v5 public selection returns503 V5_INFERENCE_UNAVAILABLE; its diagnostic metadata is available, not operational predictions.
- Saved places return401 without a newly provisioned hosted identity. Forecast-run list is empty.
- GitHub Pages origin initially received no access-control-allow-origin header. WEB_ORIGIN must include https://shwetankjais.github.io; update saved in render.yaml and requested from the service owner. Local127.0.0.1:5173 origin was allowed.

## Needed for real functionality

Set exact frontend CORS origin, redeploy and verify browser requests. Provision OpenAQ secret and verified live ingestion before switching to live mode. Do not simply relabel the demo database. Supply approved archive/model bundles via suitable storage for history/evaluation/replay. Provision a new hosted session for account tests. Configure routing provider for geometry; pollution exposure remains unavailable. Original v5 feature builder, target units and golden parity remain required; hosting does not resolve these.

Checks: frontend typecheck and connected Pages production build passed. HTTP findings are actual server responses; public browser result is recorded separately after deployment.

## Public deployment/browser result

Commit52ce63c was deployed successfully by GitHub Pages workflow45441458791. Actual Chromium desktop1440/mobile390 tests reached all10tabs with no pageerrors or horizontal overflow. Both profiles displayed the explicit hosted-connection failure and NETWORK_ERROR: API CORS still rejected the GitHub Pages origin. This is not successful API-to-screen acceptance. An actual OPTIONS preflight returned400 without access-control-allow-origin. The owner reported the WEB_ORIGIN update was made; the deployed response still needs re-verification after Render finishes applying it.

Actual route geometry POST returned503 ROUTING_UNAVAILABLE (missing trusted OSRM endpoint). Actual replay POST returned503 EVALUATION_UNAVAILABLE (missing registered artifacts). Weather context returned200 with weather.available=false and upstream429; the weather provider call was rate-limited, not successful modeled data. No hosted credentials/session were used or created.
