import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../src/lib/api/client';
import { formatReplayTimestamp } from '../src/lib/replay';

const metadata = { contract_version: '1.4.0', data_mode: 'live', request_id: 'replay-check', source: 'saved-model-forecasts', generated_at: '2026-11-24T00:00:00Z', quality_flags: [] };
const payload = { model_version: 'delhi-openaq-pm25-hourly-v1', issue_at: '2026-08-19T16:30:00+00:00', duration_minutes: 120, sensitivity: 'sensitive' as const, max_window_mean_ugm3: 0 };
describe('Historical replay API integration', () => {
  beforeEach(() => { apiClient.setDemoMode(false); apiClient.setSessionToken(null); });
  afterEach(() => { vi.unstubAllGlobals(); apiClient.setDemoMode(false); });
  it('requests complete issues from the selected model with bounded pagination', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ meta: metadata, data: { issues: [], total_count: 0 } }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const result = await apiClient.getReplayIssues('delhi-openaq-pm25-hourly-v1', 25);
    expect(result.ok).toBe(true);
    expect(fetcher.mock.calls[0][0]).toBe('/api/v1/models/delhi-openaq-pm25-hourly-v1/replay-issues?split=test&limit=25&offset=25');
  });
  it('preserves a single UTC issue, peak preference and valid zero concentration ceiling', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ meta: metadata, data: { status: 'no_suitable_window', windows: [] } }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const result = await apiClient.planReplay(payload);
    expect(result.ok).toBe(true);
    expect(fetcher.mock.calls[0][0]).toBe('/api/v1/activity-plan/replay');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(payload);
  });
  it('retains an unavailable live API result without generating fallback windows', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ meta: metadata, error: { code: 'REPLAY_UNAVAILABLE', message: 'Complete trajectory missing', retryable: false } }), { status: 503 })));
    const result = await apiClient.planReplay(payload);
    expect(result.ok).toBe(false);
    if (!result.ok) { expect(result.status).toBe(503); expect(result.error.code).toBe('REPLAY_UNAVAILABLE'); }
  });
  it('does not invoke actual replay APIs from explicit demo mode', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); apiClient.setDemoMode(true);
    const issues = await apiClient.getReplayIssues(payload.model_version);
    const plan = await apiClient.planReplay(payload);
    expect(issues.ok).toBe(false); expect(plan.ok).toBe(false); expect(fetcher).not.toHaveBeenCalled();
  });
});

const utcIssue = '2026-08-19T16:30:00+00:00';
it('labels UTC_hour_ending explicitly UTC without converting recorded clocks', () => {
  expect(formatReplayTimestamp(utcIssue, 'UTC_hour_ending')).toBe('2026-08-19 16:30:00 UTC');
  expect(formatReplayTimestamp('2025-01-01T00:00:00', 'recorded_clock')).toBe('2025-01-01 00:00:00 (recorded source clock)');
});
