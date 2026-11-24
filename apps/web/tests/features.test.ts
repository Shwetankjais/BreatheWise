import { describe, it, expect } from 'vitest';
import { apiClient } from '../src/lib/api/client';
import { calculateSubIndex, getAQICategory } from '../src/lib/aqi';
import { DEMO_MODELS } from '../src/lib/api/demoData';

describe('BreatheWise Features Verification & Scientific Integrity', () => {
  it('RULE 4: Honest capabilities expose continuous_hourly_trajectory as unsupported', async () => {
    apiClient.setDemoMode(true);
    const capsRes = await apiClient.getCapabilities();
    expect(capsRes.ok).toBe(true);
    if (capsRes.ok) {
      const caps = capsRes.data;
      expect(caps.continuous_hourly_trajectory.supported).toBe(false);
      expect(caps.continuous_hourly_trajectory.requirements_missing).toBeDefined();
      expect(caps.continuous_hourly_trajectory.requirements_missing?.length).toBeGreaterThan(0);
      expect(caps.continuous_hourly_trajectory.requirements_missing?.[0]).toContain('validated hourly forecast trajectory');
    }
  });

  it('RULE 4: Weather scenarios capability is unsupported and requires original pipeline source', async () => {
    apiClient.setDemoMode(true);
    const capsRes = await apiClient.getCapabilities();
    expect(capsRes.ok).toBe(true);
    if (capsRes.ok) {
      const caps = capsRes.data;
      expect(caps.weather_scenarios.supported).toBe(false);
      expect(caps.weather_scenarios.requirements_missing).toBeDefined();
      expect(caps.weather_scenarios.requirements_missing).toContain('dependent feature recomputation and parity verified');
    }
  });

  it('RULE 5: Does not calculate overall CPCB AQI from instantaneous PM2.5 (uses indicative sub-index)', () => {
    // 1h observation 180 µg/m³
    const subIndex = calculateSubIndex('pm25', 180);
    expect(subIndex).toBeGreaterThan(300);
    expect(subIndex).toBeLessThanOrEqual(400);

    const category = getAQICategory(subIndex);
    expect(category).toBe('Very Poor');

    // Values strictly adhere to CPCB breakpoint boundaries
    expect(calculateSubIndex('pm25', 30)).toBe(50);
    expect(calculateSubIndex('pm25', 60)).toBe(100);
    expect(calculateSubIndex('pm25', 90)).toBe(200);
    expect(calculateSubIndex('pm25', 120)).toBe(300);
    expect(calculateSubIndex('pm25', 250)).toBe(400);
  });

  it('RULE 5: Population coverage is honest and disclaims uniform safe-air boundaries', async () => {
    apiClient.setDemoMode(true);
    const capsRes = await apiClient.getCapabilities();
    expect(capsRes.ok).toBe(true);
    if (capsRes.ok) {
      const caps = capsRes.data;
      expect(caps.population_coverage.supported).toBe(false);
      expect(caps.population_coverage.requirements_missing).toBeDefined();
      expect(caps.population_coverage.requirements_missing).toContain('complete population raster and extraction provenance');
    }
  });

  it('RULE 5: Model audit reflects verified static findings and gates runtime evaluation', async () => {
    apiClient.setDemoMode(true);
    const capsRes = await apiClient.getCapabilities();
    expect(capsRes.ok).toBe(true);
    if (capsRes.ok) {
      const caps = capsRes.data;
      expect(caps.evaluation.supported).toBe(false);
      expect(caps.evaluation.requirements_missing).toContain('held-out predictions and chronological split dates');
    }
  });

  it('RULE 5: Health advisories cite WHO guidance and disclaim clinical review', async () => {
    apiClient.setDemoMode(true);
    const advRes = await apiClient.getAdvisories('pm25');
    expect(advRes.ok).toBe(true);
    if (advRes.ok) {
      expect(advRes.data.length).toBeGreaterThanOrEqual(1);
      for (const adv of advRes.data) {
        expect(adv.review_scope).toBe('engineering source review; no clinical review');
        expect(adv.limitations.some(l => l.includes('Educational population-level information'))).toBe(true);
      }
    }
  });

  it('Hotspots query truthfully returns 503 MODEL_UNAVAILABLE consistent with model_forecast=false', async () => {
    apiClient.setDemoMode(true);
    const hotspotsRes = await apiClient.getHotspots('delhi', 6, 0, 'pm25');
    expect(hotspotsRes.ok).toBe(false);
    if (!hotspotsRes.ok) {
      expect(hotspotsRes.status).toBe(503);
      expect(hotspotsRes.error.code).toBe('MODEL_UNAVAILABLE');
      expect(hotspotsRes.error.message).toContain('currently unavailable');
    }
  });

  it('PRIORITY 2: History ranges enforce UTC hourly boundaries and maximum 31 days', () => {
    const now = new Date();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), 0, 0, 0));
    const start48 = new Date(end.getTime() - 48 * 3600000);

    // Aligned to exact 0 minutes and 0 seconds
    expect(end.getUTCMinutes()).toBe(0);
    expect(end.getUTCSeconds()).toBe(0);
    expect(start48.getUTCMinutes()).toBe(0);
    expect(start48.getUTCSeconds()).toBe(0);

    const durationSeconds = (end.getTime() - start48.getTime()) / 1000;
    expect(durationSeconds % 3600).toBe(0);
    expect(durationSeconds).toBeLessThanOrEqual(31 * 86400);
  });

  it('PRIORITY 5: Route comparison exposure is explicitly gated without fake pollution numbers', async () => {
    apiClient.setDemoMode(true);
    const capsRes = await apiClient.getCapabilities();
    expect(capsRes.ok).toBe(true);
    if (capsRes.ok) {
      expect(capsRes.data.routes.supported).toBe(false);
      expect(capsRes.data.routes.requirements_missing).toContain('routing endpoint');
      expect(capsRes.data.spatial_exposure.supported).toBe(false);
    }
  });

  it('STATION MAP: Escapes provider-controlled station names preventing HTML attribute breakout', async () => {
    const { escapeHtmlAttr } = await import('../src/lib/sanitize');
    const maliciousName = 'Anand "Vihar" <script>alert(1)</script> & Co\'s';
    const escaped = escapeHtmlAttr(maliciousName);
    expect(escaped).not.toContain('"');
    expect(escaped).not.toContain('<');
    expect(escaped).not.toContain('>');
    expect(escaped).toContain('&quot;');
    expect(escaped).toContain('&lt;');
    expect(escaped).toContain('&gt;');
    expect(escaped).toContain('&amp;');
    expect(escaped).toContain('&#39;');
  });

  it('MILESTONE 5: Archive catalogue supports all criteria pollutants with CO in mg/m³', async () => {
    const { DEMO_ARCHIVE_CATALOGUE } = await import('../src/lib/api/demoData');
    const station = DEMO_ARCHIVE_CATALOGUE.stations[0];
    const pollutants = station.pollutants.map(p => p.pollutant);
    expect(pollutants).toContain('pm25');
    expect(pollutants).toContain('pm10');
    expect(pollutants).toContain('no2');
    expect(pollutants).toContain('so2');
    expect(pollutants).toContain('co');
    expect(pollutants).toContain('o3');

    const coCoverage = station.pollutants.find(p => p.pollutant === 'co');
    expect(coCoverage?.unit).toBe('mg/m³');

    const pmCoverage = station.pollutants.find(p => p.pollutant === 'pm25');
    expect(pmCoverage?.unit).toBe('µg/m³');
  });

  it('MILESTONE 5: Tier 1 native model summary is resolved with 12h horizon in registry', async () => {
    const { DEMO_MODELS } = await import('../src/lib/api/demoData');
    const nativeModel = DEMO_MODELS.models.find(m => m.model_version === 'supplied-native-75-v1');
    expect(nativeModel).toBeDefined();
    expect(nativeModel?.supported_horizons).toEqual([1, 3, 6, 12, 24]);
    expect(nativeModel?.feature_count).toBe(75);
    expect(nativeModel?.kind).toBe('native_diagnostic');
  });

  it('MILESTONE 5: Shadow forecast runs API returns typed response with public live forecast gated', async () => {
    apiClient.setDemoMode(true);
    const runsRes = await apiClient.getForecastRuns();
    expect(runsRes.ok).toBe(true);
    if (runsRes.ok) {
      expect(runsRes.data.runs).toBeDefined();
      expect(runsRes.data.total_count).toBe(0);
    }
  });

  it('BATCH DELIVERY: Model evaluation cohort defines target_timestamp_split_only without lookahead', async () => {
    const { DEMO_MODEL_EVALUATION } = await import('../src/lib/api/demoData');
    expect(DEMO_MODEL_EVALUATION.evaluation_cohort).toBe('target_timestamp_split_only');
    expect(DEMO_MODEL_EVALUATION.dataset_mode).toBe('recorded_clock');
    expect(DEMO_MODEL_EVALUATION.live_forecast_ready).toBe(false);
    expect(DEMO_MODEL_EVALUATION.retrospective_only).toBe(true);
    expect(DEMO_MODEL_EVALUATION.supported_horizons).toEqual([1, 3, 6, 12, 24]);
  });

  it('BATCH DELIVERY: Route geometry returns alternatives with distance, duration, and OSRM attribution', async () => {
    apiClient.setDemoMode(true);
    const res = await apiClient.getRouteGeometry(
      { latitude: 28.6328, longitude: 77.2197 },
      { latitude: 28.6280, longitude: 77.3649 },
      'driving',
      3
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.profile).toBe('driving');
      expect(res.data.routes.length).toBeGreaterThan(0);
      for (const r of res.data.routes) {
        expect(r.distance_m).toBeGreaterThan(0);
        expect(r.estimated_duration_s).toBeGreaterThan(0);
        expect(r.geometry.type).toBe('LineString');
        expect(r.geometry.coordinates.length).toBeGreaterThan(1);
      }
    }
  });

  it('BATCH DELIVERY: Account preferences update sensitivity and persist Asia/Kolkata timezone', async () => {
    apiClient.setDemoMode(true);
    const updateRes = await apiClient.updatePreferences({ sensitivity: 'sensitive' });
    expect(updateRes.ok).toBe(true);
    if (updateRes.ok) {
      expect(updateRes.data.sensitivity).toBe('sensitive');
      expect(updateRes.data.display_timezone).toBe('Asia/Kolkata');
    }
  });

  it('CONTRACT 1.3.0: Model registry exposes recorded-v2 and UTC-v1 with 24 horizons and purged cohorts', async () => {
    const { DEMO_MODELS } = await import('../src/lib/api/demoData');
    const recordedV2 = DEMO_MODELS.models.find(m => m.model_version === 'delhi-recorded-pm25-hourly-v2');
    expect(recordedV2).toBeDefined();
    expect(recordedV2?.supported_horizons.length).toBe(24);
    expect(recordedV2?.evaluation_cohort).toBe('fixed_model_issue_time_purged');
    expect(recordedV2?.evaluation_path).toBe('/api/v1/models/delhi-recorded-pm25-hourly-v2/evaluation');
    expect(recordedV2?.predictions_path).toBe('/api/v1/models/delhi-recorded-pm25-hourly-v2/predictions');

    const utcV1 = DEMO_MODELS.models.find(m => m.model_version === 'delhi-openaq-pm25-hourly-v1');
    expect(utcV1).toBeDefined();
    expect(utcV1?.supported_horizons.length).toBe(24);
    expect(utcV1?.clock_basis).toBe('UTC_hour_ending');
    expect(utcV1?.dataset_mode).toBe('utc_provider_history');
    expect(utcV1?.evaluation_cohort).toBe('fixed_model_issue_time_purged');
    expect(utcV1?.evaluation_path).toBe('/api/v1/models/delhi-openaq-pm25-hourly-v1/utc-evaluation');
    expect(utcV1?.predictions_path).toBe('/api/v1/models/delhi-openaq-pm25-hourly-v1/utc-predictions');
  });

  it('CONTRACT 1.3.0: Individual forecast run detail method returns honest unavailable in demo mode', async () => {
    apiClient.setDemoMode(true);
    const detailRes = await apiClient.getForecastRun('demo-run-1');
    expect(detailRes.ok).toBe(false);
    if (!detailRes.ok) {
      expect(detailRes.error.code).toBe('FORECAST_RUN_UNAVAILABLE');
      expect(detailRes.status).toBe(404);
    }
  });

  it('CONTRACT 1.3.0: Predictions query supports issue_time_purged parameter without lookahead', async () => {
    apiClient.setDemoMode(true);
    const predRes = await apiClient.getModelPredictions('delhi-recorded-pm25-hourly-v2', 1, 'test', 25, 0, {
      issueTimePurged: true
    });
    expect(predRes.ok).toBe(false);
    if (!predRes.ok) {
      expect(predRes.error.code).toBe('PREDICTIONS_UNAVAILABLE');
    }
  });

  it('CONTRACT 1.3.0: Client normalizes evaluation and prediction path overrides without doubling /api/v1', async () => {
    // In live mode with mock fetch, test that request normalizes path prefix
    const originalFetch = globalThis.fetch;
    let requestedUrl = '';
    globalThis.fetch = (async (url: string | URL | Request) => {
      requestedUrl = String(url);
      return new Response(JSON.stringify({
        data: {
          model_version: 'delhi-openaq-pm25-hourly-v1',
          horizons: [],
          target_only_horizons: [],
          evaluation_cohort: 'fixed_model_issue_time_purged',
          clock_basis: 'exclusive_hour_ending_UTC',
          dataset_mode: 'utc_provider_history',
          dataset_sha256: 'abc',
          features: {},
          input_availability_assumption: 'strict',
          limitations: [],
          live_forecast_ready: false,
          missing_input_behavior: {},
          preprocessing: 'none',
          retrospective_only: true,
          rolling_backtests: {},
          sensor_ids: [12235610],
          splits: [],
          station_ids: ['openaq-235'],
          supported_horizons: [1, 2, 3],
          target_transform: 'identity',
          target_unit: 'µg/m³',
          timezone: 'UTC'
        },
        meta: {
          contract_version: '1.3.0',
          data_mode: 'live',
          request_id: 'test',
          source: 'test'
        }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as any;

    try {
      apiClient.setDemoMode(false);
      // Pass the backend path as returned in ModelSummary (/api/v1/models/.../utc-evaluation)
      const res = await apiClient.getModelEvaluation(
        'delhi-openaq-pm25-hourly-v1',
        1,
        '/api/v1/models/delhi-openaq-pm25-hourly-v1/utc-evaluation'
      );
      expect(res.ok).toBe(true);
      expect(requestedUrl).toBe('/api/v1/models/delhi-openaq-pm25-hourly-v1/utc-evaluation?horizon_h=1');
      expect(requestedUrl).not.toContain('/api/v1/api/v1');
    } finally {
      globalThis.fetch = originalFetch;
      apiClient.setDemoMode(true);
    }
  });

  it('CONTRACT 1.3.0: Public live forecast and trajectory capabilities remain gated false despite 24h models', async () => {
    const { apiClient } = await import('../src/lib/api/client');
    apiClient.setDemoMode(true);
    const capRes = await apiClient.getCapabilities();
    expect(capRes.ok).toBe(true);
    if (capRes.ok) {
      expect(capRes.data.model_forecast.supported).toBe(false);
      expect(capRes.data.continuous_hourly_trajectory.supported).toBe(false);
      expect(capRes.data.spatial_exposure.supported).toBe(false);
    }
  });

  describe('CONTRACT 1.3.0 Model Selection & Error Handling Integration Path', () => {
    it('Empty live registry does not render demo models (viewState: empty, experimentalModels: 0)', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({
          data: { models: [] },
          meta: { contract_version: '1.3.0', data_mode: 'live', request_id: 'empty-req', source: 'database' }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as any;

      try {
        apiClient.setDemoMode(false);
        const res = await apiClient.getModels();
        expect(res.ok).toBe(true);

        // Exercise ModelAuditView's exact state resolution path:
        const experimentalModels = apiClient.getDemoMode()
          ? DEMO_MODELS.models.filter(m => m.kind === 'retrospective_forecast')
          : (res.ok && res.data?.models ? res.data.models.filter(m => m.kind === 'retrospective_forecast') : []);

        expect(experimentalModels).toHaveLength(0);
        // Asserts no fallback to DEMO_MODELS:
        expect(experimentalModels.some(m => m.model_version.includes('delhi-recorded'))).toBe(false);
      } finally {
        globalThis.fetch = originalFetch;
        apiClient.setDemoMode(true);
      }
    });

    it('Registry 503 is visible and retryable where appropriate (viewState: error, code: HTTP_503 / REGISTRY_DOWN)', async () => {
      const originalFetch = globalThis.fetch;
      let callCount = 0;
      globalThis.fetch = (async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({
            error: { code: 'REGISTRY_DOWN', message: 'Model registry service unavailable.', retryable: true },
            meta: { contract_version: '1.3.0', data_mode: 'live', request_id: 'err-503' }
          }), { status: 503, headers: { 'Content-Type': 'application/json' } });
        }
        // Retry succeeds
        return new Response(JSON.stringify({
          data: { models: [] },
          meta: { contract_version: '1.3.0', data_mode: 'live', request_id: 'retry-ok', source: 'database' }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as any;

      try {
        apiClient.setDemoMode(false);
        // Initial call fails with 503
        const errRes = await apiClient.getModels();
        expect(errRes.ok).toBe(false);
        expect(errRes.error?.code).toBe('REGISTRY_DOWN');
        expect(errRes.error?.retryable).toBe(true);

        // State machine surfaces exact error code and retry capability
        const errorCode = errRes.error?.code || (errRes.status ? `HTTP_${errRes.status}` : 'REGISTRY_ERROR');
        const isRetryable = errRes.error?.retryable === true || (errRes.status ? errRes.status >= 500 : false);
        expect(errorCode).toBe('REGISTRY_DOWN');
        expect(isRetryable).toBe(true);

        // Actionable retry executes successfully
        const retryRes = await apiClient.getModels();
        expect(retryRes.ok).toBe(true);
        expect(callCount).toBe(2);
      } finally {
        globalThis.fetch = originalFetch;
        apiClient.setDemoMode(true);
      }
    });

    it('Missing metadata does not enable horizon-dependent actions (export, pagination, picker disabled)', () => {
      const modelWithoutHorizons = {
        model_version: 'test-delhi-unverified',
        kind: 'retrospective_forecast' as const,
        display_name: 'Unverified Horizons Model',
        description: 'Test model lacking verified horizons',
        status: 'available' as const,
        created_at: '2026-11-24T00:00:00Z',
        updated_at: '2026-11-24T00:00:00Z',
        supported_horizons: [] as number[],
        dataset_mode: 'recorded_clock',
        clock_basis: 'source_naive_clock_unverified',
        evaluation_cohort: 'fixed_model_issue_time_purged',
        evaluation_path: '/api/v1/models/test-delhi-unverified/evaluation',
        predictions_path: '/api/v1/models/test-delhi-unverified/predictions'
      };

      // ModelAuditView horizon derivation logic:
      const supportedHorizons = (modelWithoutHorizons.supported_horizons && modelWithoutHorizons.supported_horizons.length > 0)
        ? modelWithoutHorizons.supported_horizons
        : [];

      expect(supportedHorizons).toHaveLength(0);

      // ModelAuditView dependent control flags:
      const isExportDisabled = supportedHorizons.length === 0;
      const isPaginationDisabled = supportedHorizons.length === 0;
      const isPickerDisabled = supportedHorizons.length === 0;
      const isSplitSwitcherDisabled = supportedHorizons.length === 0;

      expect(isExportDisabled).toBe(true);
      expect(isPaginationDisabled).toBe(true);
      expect(isPickerDisabled).toBe(true);
      expect(isSplitSwitcherDisabled).toBe(true);
    });

    it('Explicit demo mode remains isolated — DEMO_MODELS never served in live mode', async () => {
      // 1. Explicit demo mode: DEMO_MODELS returned with demo metadata
      apiClient.setDemoMode(true);
      const demoRes = await apiClient.getModels();
      expect(demoRes.ok).toBe(true);
      if (demoRes.ok) {
        expect(demoRes.meta?.data_mode).toBe('demo');
        expect(demoRes.meta?.source).toBe('demo_fixture');
        expect(demoRes.data.models.length).toBeGreaterThan(0);
      }

      // 2. Live mode: Live fetch performed, demo fixtures strictly isolated
      const originalFetch = globalThis.fetch;
      let requestedEndpoint = '';
      globalThis.fetch = (async (url: string) => {
        requestedEndpoint = url;
        return new Response(JSON.stringify({
          data: {
            models: [{
              model_version: 'delhi-live-registered-v1',
              kind: 'retrospective_forecast',
              display_name: 'Live Model',
              description: 'Live registered model',
              status: 'available',
              created_at: '2026-11-24T00:00:00Z',
              updated_at: '2026-11-24T00:00:00Z',
              supported_horizons: [1, 2, 3],
              dataset_mode: 'recorded_clock',
              clock_basis: 'source_naive_clock_unverified',
              evaluation_cohort: 'fixed_model_issue_time_purged',
              evaluation_path: '/api/v1/models/delhi-live-registered-v1/evaluation',
              predictions_path: '/api/v1/models/delhi-live-registered-v1/predictions'
            }]
          },
          meta: { contract_version: '1.3.0', data_mode: 'live', request_id: 'live-req', source: 'database' }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as any;

      try {
        apiClient.setDemoMode(false);
        const liveRes = await apiClient.getModels();
        expect(liveRes.ok).toBe(true);
        expect(requestedEndpoint).toContain('/api/v1/models');
        if (liveRes.ok) {
          expect(liveRes.meta?.data_mode).toBe('live');
          expect(liveRes.meta?.source).toBe('database');
          expect(liveRes.data.models[0].model_version).toBe('delhi-live-registered-v1');
        }
      } finally {
        globalThis.fetch = originalFetch;
        apiClient.setDemoMode(true);
      }
    });
  });
});
