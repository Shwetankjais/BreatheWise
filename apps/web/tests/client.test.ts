import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiClient } from '../src/lib/api/client';

describe('BreatheWise API Client — Contract 1.1.0 & Regression Tests', () => {
  beforeEach(() => {
    apiClient.setDemoMode(false);
    apiClient.setSessionToken(null);
  });

  afterEach(() => {
    apiClient.setDemoMode(false);
    apiClient.setSessionToken(null);
  });

  it('RULE 1: Live mode returns 503 NETWORK_ERROR without silent fixture fallback when backend is unreachable', async () => {
    // In live mode with backend offline (fetch fails)
    const result = await apiClient.getCities();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error.code).toBe('NETWORK_ERROR');
      expect(result.error.retryable).toBe(true);
      expect(result.error.message).toBeDefined();
    }
  });

  it('RULE 1: Explicit demo mode toggle activates isolated demo fixtures with contract metadata', async () => {
    apiClient.setDemoMode(true);
    expect(apiClient.getDemoMode()).toBe(true);

    const result = await apiClient.getCities();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(200);
      expect(result.meta.data_mode).toBe('demo');
      expect(result.meta.contract_version).toBe('1.1.0');
      expect(result.data.length).toBeGreaterThanOrEqual(16);

      const delhi = result.data.find(c => c.id === 'delhi');
      expect(delhi).toBeDefined();
      expect(delhi?.availability).toBe('synthetic_demo');
    }
  });

  it('RULE 2: Preserves Contract 1.1.0 metadata and error structures without swallowing', async () => {
    apiClient.setDemoMode(true);
    const stationRes = await apiClient.getStation('non-existent-station-id');
    expect(stationRes.ok).toBe(false);
    if (!stationRes.ok) {
      expect(stationRes.status).toBe(404);
      expect(stationRes.error.code).toBe('STATION_NOT_FOUND');
      expect(stationRes.error.retryable).toBe(false);
    }
  });

  it('RULE 2: Latest measurement endpoint returns single pollutant measurement per Contract 1.1.0', async () => {
    apiClient.setDemoMode(true);
    const res = await apiClient.getLatest('delhi-anand-vihar', 'pm25');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.pollutant).toBe('pm25');
      expect(res.data.unit).toBe('µg/m³');
      expect(typeof res.data.value).toBe('number');
      expect(res.data.station_id).toBe('delhi-anand-vihar');
      expect(res.data.observation_age_minutes).toBeDefined();
      expect(res.data.stale).toBe(false);
    }
  });

  it('RULE 2: getLatest returns distinct pollutant measurements and does not relabel PM2.5 for missing pollutants', async () => {
    apiClient.setDemoMode(true);

    // Anand Vihar has distinct PM2.5, PM10, NO2, CO in demo fixtures
    const pm25Res = await apiClient.getLatest('delhi-anand-vihar', 'pm25');
    expect(pm25Res.ok).toBe(true);
    if (pm25Res.ok) {
      expect(pm25Res.data.pollutant).toBe('pm25');
      expect(pm25Res.data.value).toBe(284.5);
    }

    const pm10Res = await apiClient.getLatest('delhi-anand-vihar', 'pm10');
    expect(pm10Res.ok).toBe(true);
    if (pm10Res.ok) {
      expect(pm10Res.data.pollutant).toBe('pm10');
      expect(pm10Res.data.value).toBe(412.0); // Distinct from PM2.5!
    }

    const no2Res = await apiClient.getLatest('delhi-anand-vihar', 'no2');
    expect(no2Res.ok).toBe(true);
    if (no2Res.ok) {
      expect(no2Res.data.pollutant).toBe('no2');
      expect(no2Res.data.value).toBe(78.4);
    }

    // SO2 is not in Anand Vihar demo fixture - should return 404 MEASUREMENT_NOT_FOUND rather than relabeling PM2.5
    const so2Res = await apiClient.getLatest('delhi-anand-vihar', 'so2');
    expect(so2Res.ok).toBe(false);
    if (!so2Res.ok) {
      expect(so2Res.status).toBe(404);
      expect(so2Res.error.code).toBe('MEASUREMENT_NOT_FOUND');
      expect(so2Res.error.message).toContain('SO2');
    }
  });

  it('RULE 3: Authenticated account endpoints require Bearer session token in live mode', async () => {
    apiClient.setDemoMode(false);
    apiClient.setSessionToken(null);

    const placesRes = await apiClient.getSavedPlaces();
    expect(placesRes.ok).toBe(false);
    if (!placesRes.ok) {
      expect(placesRes.status).toBe(401);
      expect(placesRes.error.code).toBe('AUTH_REQUIRED');
    }

    const rulesRes = await apiClient.getAlertRules();
    expect(rulesRes.ok).toBe(false);
    if (!rulesRes.ok) {
      expect(rulesRes.status).toBe(401);
      expect(rulesRes.error.code).toBe('AUTH_REQUIRED');
    }

    const alertsRes = await apiClient.getAlerts();
    expect(alertsRes.ok).toBe(false);
    if (!alertsRes.ok) {
      expect(alertsRes.status).toBe(401);
      expect(alertsRes.error.code).toBe('AUTH_REQUIRED');
    }

    const meRes = await apiClient.getMe();
    expect(meRes.ok).toBe(false);
    if (!meRes.ok) {
      expect(meRes.status).toBe(401);
      expect(meRes.error.code).toBe('AUTH_REQUIRED');
    }
  });

  it('RULE 3: Session token is stored and passed via Authorization: Bearer <token>', async () => {
    apiClient.setSessionToken('provisioned-test-token-xyz');
    expect(apiClient.getSessionToken()).toBe('provisioned-test-token-xyz');

    // Mock global fetch to verify header passing
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: { user_id: 'user-1', created_at: new Date().toISOString() },
        meta: { contract_version: '1.1.0', data_mode: 'live', request_id: 'req-1', source: 'db' }
      })
    });
    globalThis.fetch = fetchMock;

    try {
      const meRes = await apiClient.getMe();
      expect(fetchMock).toHaveBeenCalled();
      const calledHeaders = fetchMock.mock.calls[0][1].headers;
      expect(calledHeaders['Authorization']).toBe('Bearer provisioned-test-token-xyz');
      expect(meRes.ok).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('RULE 3: Demo account data is isolated in separate demo storage', async () => {
    apiClient.setDemoMode(true);
    const initialPlaces = await apiClient.getSavedPlaces();
    expect(initialPlaces.ok).toBe(true);
    if (initialPlaces.ok) {
      const initialCount = initialPlaces.data.length;

      const created = await apiClient.createSavedPlace({
        label: 'Isolated Demo Test Location',
        latitude: 28.6,
        longitude: 77.2
      });
      expect(created.ok).toBe(true);

      const afterAdd = await apiClient.getSavedPlaces();
      expect(afterAdd.ok).toBe(true);
      if (afterAdd.ok) {
        expect(afterAdd.data.length).toBe(initialCount + 1);
        expect(afterAdd.data.some(p => p.label === 'Isolated Demo Test Location')).toBe(true);
      }

      // Deleting place works in demo storage
      if (created.ok) {
        await apiClient.deleteSavedPlace(created.data.id);
        const afterDelete = await apiClient.getSavedPlaces();
        if (afterDelete.ok) {
          expect(afterDelete.data.some(p => p.id === created.data.id)).toBe(false);
        }
      }
    }
  });

  it('RULE 3: Alert rule creation strictly preserves valid threshold of 0 without replacing with default', async () => {
    apiClient.setDemoMode(true);
    const ruleRes = await apiClient.createAlertRule({
      station_id: 'delhi-anand-vihar',
      pollutant: 'pm25',
      threshold: 0,
      averaging_period_minutes: 60,
      cooldown_minutes: 60,
      enabled: true,
      channel: 'in_app'
    });

    expect(ruleRes.ok).toBe(true);
    if (ruleRes.ok) {
      expect(ruleRes.data.channel).toBe('in_app');
      expect(ruleRes.data.averaging_period_minutes).toBe(60);
      expect(ruleRes.data.threshold).toBe(0);
      expect(ruleRes.data.threshold).not.toBe(250);

      // Clean up
      await apiClient.deleteAlertRule(ruleRes.data.id);
    }
  });

  it('RULE 3: Creating alert rules validates channel and averaging period', async () => {
    apiClient.setDemoMode(true);
    const ruleRes = await apiClient.createAlertRule({
      station_id: 'delhi-anand-vihar',
      pollutant: 'pm25',
      threshold: 200,
      averaging_period_minutes: 60,
      cooldown_minutes: 60,
      enabled: true,
      channel: 'in_app'
    });

    expect(ruleRes.ok).toBe(true);
    if (ruleRes.ok) {
      expect(ruleRes.data.channel).toBe('in_app');
      expect(ruleRes.data.averaging_period_minutes).toBe(60);
      expect(ruleRes.data.threshold).toBe(200);

      // Clean up
      await apiClient.deleteAlertRule(ruleRes.data.id);
    }
  });
});
