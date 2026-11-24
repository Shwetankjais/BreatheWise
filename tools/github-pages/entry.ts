import { apiClient } from '../../apps/web/src/lib/api/client';
import './scope.css';

const apiOrigin = import.meta.env.VITE_API_BASE_URL?.trim();
const scope = document.querySelector('[aria-label="Public deployment scope"]');

async function start() {
  if (apiOrigin) {
    const url = new URL(apiOrigin);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
      throw new Error('Public API URL must be HTTPS without credentials, query or fragment');
    }
    apiClient.setDemoMode(false);
    document.title = 'BreatheWise — Air Quality';
    if (scope) scope.textContent = 'Connecting to hosted API. Data sources and capabilities are being checked.';
    try {
      const base = apiOrigin.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
      const response = await fetch(`${base}/api/v1/health`, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('API health request failed');
      const health = await response.json();
      if (scope) scope.textContent = health.meta?.data_mode === 'demo'
        ? 'Hosted API connected — server supplies SYNTHETIC DEMO data. Real-data ingestion and model/archive assets are not configured. Public live ML forecasting remains unavailable.'
        : 'Hosted API connected. Check source timestamps, missing data and model capabilities; live telemetry does not imply operational ML forecasting.';
    } catch {
      if (scope) scope.textContent = 'Hosted API connection failed or timed out. Check network/CORS settings and retry by reloading. No automatic demo fallback is used.';
    }
  } else {
    // Static preview is explicit. Server-only actions stay unavailable.
    const networkFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      if (url.origin === location.origin && url.pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({
          meta: { request_id: 'github-pages-static', generated_at: new Date().toISOString(), data_mode: 'demo', source: 'GitHub Pages static demo', quality_flags: ['backend_not_hosted'], contract_version: '1.4.0' },
          error: { code: 'STATIC_DEMO_API_UNAVAILABLE', message: 'This static preview has no hosted API.', requirements_missing: ['hosted_api'], retryable: false },
        }), {status: 503, headers: {'Content-Type': 'application/json'}});
      }
      return networkFetch(input, init);
    };
    apiClient.setDemoMode(true);
  }
  await import('../../apps/web/src/main');
}
void start();
