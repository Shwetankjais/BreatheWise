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

  // ----------------------------------------------------------------------
  // Contract 1.2.0 Additive Endpoints Tests
  // ----------------------------------------------------------------------

  it('CONTRACT 1.2.0: getStationCatalogue returns structured station intake and pollutant availability', async () => {
    apiClient.setDemoMode(true);
    const res = await apiClient.getStationCatalogue('delhi');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.city_id).toBe('delhi');
      expect(res.data.stations.length).toBeGreaterThan(0);
      const anandVihar = res.data.stations.find(s => s.id === 'delhi-anand-vihar');
      expect(anandVihar).toBeDefined();
      expect(anandVihar?.pollutants.length).toBeGreaterThan(0);
      const pm25Availability = anandVihar?.pollutants.find(p => p.pollutant === 'pm25');
      expect(pm25Availability?.coverage_state).toBe('reported_complete');
      expect(pm25Availability?.freshness).toBe('fresh');
      expect(pm25Availability?.status).toBe('available');
    }
  });

  it('CONTRACT 1.2.0: getObservedRankings returns ranked concentration rows with explicit scientific caveats', async () => {
    apiClient.setDemoMode(true);
    const res = await apiClient.getObservedRankings('delhi', 'pm25', 10);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.city_id).toBe('delhi');
      expect(res.data.pollutant).toBe('pm25');
      expect(res.data.ranking_kind).toBe('observed_concentration');
      expect(res.data.rows.length).toBeGreaterThan(0);
      expect(res.data.rows[0].rank).toBe(1);
      expect(res.data.rows[0].station.id).toBeDefined();
      expect(res.data.rows[0].measurement.value).toBeGreaterThan(0);
      expect(res.data.limitations.some(lim => lim.toLowerCase().includes('not predicted hotspots'))).toBe(true);
    }
  });

  it('CONTRACT 1.2.0: getArchiveCatalogue returns eligible historical stations with recorded-clock metadata', async () => {
    apiClient.setDemoMode(true);
    const res = await apiClient.getArchiveCatalogue();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.dataset_id).toBe('delhi_observed_archive_v1');
      expect(res.data.dataset_mode).toBe('recorded_clock');
      expect(res.data.clock_basis).toBe('source_naive_clock_unverified');
      expect(res.data.timezone).toBeNull();
      expect(res.data.stations.length).toBeGreaterThan(0);
      const site301 = res.data.stations.find(s => s.station_id === 'site_301');
      expect(site301).toBeDefined();
      expect(site301?.pollutants.length).toBeGreaterThan(0);
    }
  });

  it('CONTRACT 1.2.0: getArchiveExplore returns bucketed points and distribution statistics', async () => {
    apiClient.setDemoMode(true);
    const res = await apiClient.getArchiveExplore(
      'site_301',
      'pm25',
      '2023-11-01T00:00:00',
      '2023-11-08T00:00:00',
      'daily'
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.station_id).toBe('site_301');
      expect(res.data.dataset_mode).toBe('recorded_clock');
      expect(res.data.distribution).toBeDefined();
      expect(res.data.distribution.mean).toBeGreaterThan(0);
      expect(res.data.distribution.median).toBeGreaterThan(0);
      expect(res.data.points.length).toBeGreaterThan(0);
      expect(res.data.points[0].meets_requested_sufficiency).toBe(true);
    }
  });

  it('CONTRACT 1.2.0: getArchiveCompare strictly enforces clock_assumption=same_recorded_clock and returns pair agreement', async () => {
    apiClient.setDemoMode(true);
    const res = await apiClient.getArchiveCompare(
      ['site_301', 'site_113'],
      'pm25',
      '2023-11-01T00:00:00',
      '2023-11-08T00:00:00',
      'daily',
      'same_recorded_clock'
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.clock_assumption).toBe('same_recorded_clock');
      expect(res.data.alignment_status).toBe('conditional_same_recorded_clock_only');
      expect(res.data.forecast_evaluation).toBe(false);
      expect(res.data.pair_agreement.length).toBeGreaterThan(0);
      expect(res.data.pair_agreement[0].mean_absolute_difference).toBeGreaterThan(0);
      expect(res.data.pair_agreement[0].interpretation).toContain('not forecast evaluation');
    }
  });

  it('CONTRACT 1.2.0: getModels lists native diagnostic and retrospective models', async () => {
    apiClient.setDemoMode(true);
    const res = await apiClient.getModels();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.models.length).toBeGreaterThanOrEqual(2);
      const diagnostic = res.data.models.find(m => m.kind === 'native_diagnostic');
      expect(diagnostic).toBeDefined();
      expect(diagnostic?.native_diagnostics_ready).toBe(true);
      expect(diagnostic?.live_forecast_ready).toBe(false);

      const retrospective = res.data.models.find(m => m.kind === 'retrospective_forecast');
      expect(retrospective).toBeDefined();
      expect(retrospective?.retrospective_evaluation_ready).toBe(true);
      expect(retrospective?.live_forecast_ready).toBe(false);
    }
  });

  it('CONTRACT 1.2.0: getModelEvaluation returns 503 EVALUATION_UNAVAILABLE in demo mode (no invented evaluation numbers)', async () => {
    apiClient.setDemoMode(true);
    const res = await apiClient.getModelEvaluation('delhi-recorded-pm25-v1');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(503);
      expect(res.error.code).toBe('EVALUATION_UNAVAILABLE');
      expect(res.error.message).toContain('unavailable in demo mode');
    }
  });

  it('CONTRACT 1.2.0: getModelEvaluation queries live endpoint and handles verified evaluation response', async () => {
    apiClient.setDemoMode(false);
    const originalFetch = globalThis.fetch;
    const mockEval = {
      model_version: 'delhi-recorded-pm25-v1',
      dataset_mode: 'recorded_clock',
      dataset_sha256: '43cb7d50000f3614657bfadc7f83f2954c879e561e790ccf13b5b75d247558df',
      live_forecast_ready: false,
      publication_time_known: false,
      retrospective_only: true,
      preprocessing: 'no fit/scaling/imputation',
      target_transform: 'identity',
      target_unit: 'µg/m³',
      station_ids: ['site_301'],
      supported_horizons: [1, 3, 6, 12, 24],
      input_availability_assumption: 'same_recorded_clock_causal_lags_only',
      limitations: ['Retrospective recorded-clock experiment only'],
      features: { target: [], lag: [] },
      splits: [{ name: 'test', start_recorded_at: '2025-01-01T00:00:00', end_recorded_at_exclusive: '2026-11-01T00:00:00' }],
      rolling_backtests: {},
      horizons: [
        {
          horizon_h: 1,
          splits: {
            test: {
              all_available: {
                lightgbm: { count: 14718, mae: 18.977, rmse: 30.193, bias: -0.434 },
                persistence: { count: 14718, mae: 20.892, rmse: 33.127, bias: -0.049 }
              },
              common_baseline_cohort: {
                lightgbm: { count: 13977, mae: 18.913, rmse: 30.125, bias: -0.306 },
                persistence: { count: 13977, mae: 20.870, rmse: 33.119, bias: 0.070 }
              },
              high_pollution_definition: 'observed target >= 150 µg/m³',
              high_pollution_threshold_ugm3: 150,
              high_pollution_observed_target_ge_150: {
                lightgbm: { count: 2492, mae: 33.919, rmse: 50.778, bias: -9.203 }
              }
            }
          }
        }
      ]
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: mockEval,
        meta: { contract_version: '1.2.0', data_mode: 'live', request_id: 'req-eval', source: 'db' }
      })
    });
    globalThis.fetch = fetchMock;

    try {
      const res = await apiClient.getModelEvaluation('delhi-recorded-pm25-v1');
      expect(fetchMock).toHaveBeenCalled();
      expect(fetchMock.mock.calls[0][0]).toContain('/models/delhi-recorded-pm25-v1/evaluation');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.model_version).toBe('delhi-recorded-pm25-v1');
        expect(res.data.horizons[0].splits['test'].common_baseline_cohort.lightgbm.mae).toBe(18.913);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('CONTRACT 1.2.0: getRouteGeometry returns GeoJSON LineString alternatives and distance/duration with exposure gated', async () => {
    apiClient.setDemoMode(true);
    const res = await apiClient.getRouteGeometry(
      { latitude: 28.6328, longitude: 77.2197 },
      { latitude: 28.6280, longitude: 77.3649 },
      'driving',
      2
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.exposure_ready).toBe(false);
      expect(res.data.provider).toBe('demo_corridor_fixture');
      expect(res.data.attribution).toContain('Demonstration corridor geometries');
      expect(res.data.routes.length).toBeGreaterThan(0);
      expect(res.data.routes[0].distance_m).toBeGreaterThan(0);
      expect(res.data.routes[0].estimated_duration_s).toBeGreaterThan(0);
      expect(res.data.routes[0].geometry.type).toBe('LineString');
      expect(res.data.routes[0].geometry.coordinates.length).toBeGreaterThan(1);
    }
  });

  it('CONFIGURABLE API: getBaseUrl returns configured or default API base, and normalizes paths', async () => {
    expect(apiClient.getBaseUrl()).toMatch(/\/api\/v1$/);
    const originalFetch = globalThis.fetch;
    let requestedUrl = '';
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      requestedUrl = String(url);
      return new Response(JSON.stringify({ ok: true, meta: { data_mode: 'live', contract_version: '1.4.0', request_id: 'test' }, data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
    try {
      apiClient.setDemoMode(false);
      // Calling request with leading /api/v1 should not duplicate /api/v1
      await apiClient.request('/api/v1/stations?city_id=delhi');
      expect(requestedUrl).toBe(`${apiClient.getBaseUrl()}/stations?city_id=delhi`);

      // Calling request without /api/v1 should prepend baseUrl
      await apiClient.request('/cities');
      expect(requestedUrl).toBe(`${apiClient.getBaseUrl()}/cities`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('ENVIRONMENT CONTEXT: getLocationContext returns nearest station and Open-Meteo weather context', async () => {
    apiClient.setDemoMode(true);
    const res = await apiClient.getLocationContext(28.6139, 77.2090, 'delhi');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.in_bounds).toBe(true);
      expect(res.data.nearest_station).toBeDefined();
      expect(res.data.weather).toBeDefined();
      expect(res.data.weather?.source).toContain('Open-Meteo');
      expect(res.data.weather?.estimate_type).toBe('gridded_numerical_weather_prediction');
      expect(res.data.ground_pollutants).toBeDefined();
      expect(res.data.ground_pollutants['pm25'].available).toBe(true);
    }
  });

  it('STATION POLLUTANTS: getStationPollutants returns all criteria pollutants with availability flags', async () => {
    apiClient.setDemoMode(true);
    const res = await apiClient.getStationPollutants('demo-stn-1');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data['pm25']).toBeDefined();
      expect(res.data['pm25'].available).toBe(true);
      expect(res.data['o3']).toBeDefined();
      expect(res.data['o3'].available).toBe(false);
    }
  });
});
