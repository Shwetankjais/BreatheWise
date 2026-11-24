// This separate static deployment intentionally opts into the existing labeled
// demo client before React initializes. Local/API builds keep their own entry.
import { apiClient } from '../../apps/web/src/lib/api/client';
import './scope.css';

// Static hosting has no API. Return an explicit unavailable result locally for
// any existing UI flow that attempts a server request; never substitute data.
const networkFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.href);
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({
      meta: { request_id: 'github-pages-static', generated_at: new Date().toISOString(), data_mode: 'demo', source: 'GitHub Pages static demo', quality_flags: ['backend_not_hosted'], contract_version: '1.4.0' },
      error: { code: 'STATIC_DEMO_API_UNAVAILABLE', message: 'This GitHub Pages demo has no hosted API. Run the local prototype for real observations, history and authenticated server persistence.', requirements_missing: ['hosted_api'], retryable: false },
    }), {status: 503, headers: {'Content-Type': 'application/json'}});
  }
  return networkFetch(input, init);
};
apiClient.setDemoMode(true);
void import('../../apps/web/src/main');
