/**
 * BreatheWise API Client
 * Strictly aligned with contract 1.1.0 in packages/contracts/api.d.ts
 *
 * Rules:
 * - NO automatic demo fallback on 503s, 401s, 404s, or network failures in live mode.
 * - Explicit opt-in Demo mode with persistent labeling and separate storage.
 * - Preserves response metadata and structured errors ({meta, error}).
 * - Authentic Bearer session auth for account endpoints (me, saved-places, alert-rules, alerts).
 */

import {
  City,
  StationView,
  Measurement,
  Forecast,
  Capabilities,
  History,
  PlaceView,
  PlaceInput,
  RuleView,
  RuleInput,
  NotificationView,
  Identity,
  Preferences,
  Metadata,
  ErrorDetail,
  Pollutant,
  Advisory,
  ActivityRequest,
  RouteRequest,
  WeatherRequest,
  ApiResult,
  StationCatalogue,
  ObservedRankings,
  ArchiveCatalogue,
  ArchiveExplore,
  ArchiveCompare,
  ModelCatalogue,
  ModelEvaluation,
  UtcModelEvaluation,
  PredictionPage,
  UtcPredictionPage,
  GeometryResponse,
  Coordinates,
  ForecastRunPage,
  ForecastRunView,
  ForecastRunDetail,
  ShadowPoint,
  Schemas
} from './types';

import {
  DEMO_CITIES,
  DEMO_STATIONS,
  DEMO_MEASUREMENTS,
  DEMO_CAPABILITIES,
  DEMO_ADVISORIES,
  DEMO_IDENTITY,
  DEMO_STATION_CATALOGUE,
  DEMO_OBSERVED_RANKINGS,
  DEMO_ARCHIVE_CATALOGUE,
  DEMO_ARCHIVE_EXPLORE,
  DEMO_ARCHIVE_COMPARE,
  DEMO_MODELS,
  DEMO_MODEL_EVALUATION,
  DEMO_PREDICTION_PAGE,
  DEMO_GEOMETRY_RESPONSE
} from './demoData';

class MemoryStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = value;
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
}

const memoryStore = new MemoryStorage();

function getStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // fallback if restricted
  }
  return memoryStore;
}

const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as unknown as { env?: Record<string, string> }).env : undefined;
const configuredBase = metaEnv?.VITE_API_BASE_URL
  ? String(metaEnv.VITE_API_BASE_URL).trim().replace(/\/+$/, '')
  : '';

export class BreatheWiseApiClient {
  private isDemoMode = false;
  private sessionToken: string | null = null;
  private readonly baseUrl: string = configuredBase
    ? (configuredBase.endsWith('/api/v1') ? configuredBase : `${configuredBase}/api/v1`)
    : '/api/v1';

  // Storage keys
  private readonly KEY_SESSION = 'breathewise_session_token';
  private readonly KEY_DEMO_PLACES = 'breathewise_demo_places';
  private readonly KEY_DEMO_RULES = 'breathewise_demo_rules';
  private readonly KEY_DEMO_ALERTS = 'breathewise_demo_alerts';

  constructor() {
    this.loadSessionToken();
    this.initDemoStorage();
  }

  private loadSessionToken() {
    const storage = getStorage();
    this.sessionToken = storage.getItem(this.KEY_SESSION);
  }

  getSessionToken(): string | null {
    return this.sessionToken;
  }

  setSessionToken(token: string | null): void {
    this.sessionToken = token;
    const storage = getStorage();
    if (token) {
      storage.setItem(this.KEY_SESSION, token.trim());
    } else {
      storage.removeItem(this.KEY_SESSION);
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getDemoMode(): boolean {
    return this.isDemoMode;
  }

  setDemoMode(enabled: boolean): void {
    this.isDemoMode = enabled;
  }

  private initDemoStorage() {
    const storage = getStorage();
    if (!storage.getItem(this.KEY_DEMO_PLACES)) {
      const initialPlaces: PlaceView[] = [
        { id: 'demo-place-1', label: 'Home (Connaught Place)', latitude: 28.6315, longitude: 77.2167 },
        { id: 'demo-place-2', label: 'Office (Aerocity T3)', latitude: 28.5510, longitude: 77.1210 }
      ];
      storage.setItem(this.KEY_DEMO_PLACES, JSON.stringify(initialPlaces));
    }
    if (!storage.getItem(this.KEY_DEMO_RULES)) {
      const initialRules: RuleView[] = [
        {
          id: 'demo-rule-1',
          station_id: 'delhi-anand-vihar',
          pollutant: 'pm25',
          threshold: 250,
          averaging_period_minutes: 60,
          cooldown_minutes: 60,
          enabled: true,
          channel: 'in_app',
          trigger: 'latest_known_hourly_observation_strictly_above_threshold',
          unit: 'µg/m³'
        }
      ];
      storage.setItem(this.KEY_DEMO_RULES, JSON.stringify(initialRules));
    }
    if (!storage.getItem(this.KEY_DEMO_ALERTS)) {
      const initialAlerts: NotificationView[] = [
        {
          id: 'demo-alert-1',
          rule_id: 'demo-rule-1',
          created_at: new Date(Date.now() - 45 * 60000).toISOString(),
          read_at: null,
          threshold: 250,
          value: 284.5,
          unit: 'µg/m³',
          status: 'unread'
        }
      ];
      storage.setItem(this.KEY_DEMO_ALERTS, JSON.stringify(initialAlerts));
    }
  }

  /**
   * Core HTTP request handler
   * Strict adherence: No silent demo fallback on 4xx/5xx errors in live mode
   */
  async request<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    };

    if (this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`;
    }

    try {
      let cleanPath = path;
      if (cleanPath.startsWith(this.baseUrl)) {
        cleanPath = cleanPath.slice(this.baseUrl.length);
      } else if (cleanPath.startsWith('/api/v1')) {
        cleanPath = cleanPath.slice('/api/v1'.length);
      }
      if (!cleanPath.startsWith('/')) {
        cleanPath = `/${cleanPath}`;
      }
      const res = await fetch(`${this.baseUrl}${cleanPath}`, {
        ...options,
        headers
      });

      if (res.status === 204) {
        return {
          ok: true,
          data: undefined as any,
          meta: {
            contract_version: '1.1.0',
            data_mode: 'live',
            request_id: 'client-no-content',
            source: 'backend-status-204'
          },
          status: 204
        };
      }

      const json = await res.json().catch(() => null);

      if (res.ok) {
        if (json && typeof json === 'object' && 'data' in json && 'meta' in json) {
          return {
            ok: true,
            data: json.data as T,
            meta: json.meta as Metadata,
            status: res.status
          };
        }
        return {
          ok: true,
          data: json as T,
          meta: {
            contract_version: '1.1.0',
            data_mode: 'live',
            request_id: 'client-envelope-fallback',
            source: 'api-v1'
          },
          status: res.status
        };
      }

      // Structured error response
      if (json && typeof json === 'object' && 'error' in json) {
        return {
          ok: false,
          error: json.error as ErrorDetail,
          meta: json.meta as Metadata,
          status: res.status
        };
      }

      return {
        ok: false,
        error: {
          code: `HTTP_${res.status}`,
          message: res.statusText || 'An unexpected server error occurred',
          retryable: res.status >= 500
        },
        status: res.status
      };
    } catch (err: any) {
      return {
        ok: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err?.message || 'Failed to connect to BreatheWise API service at 127.0.0.1:8000',
          retryable: true
        },
        status: 503
      };
    }
  }

  // ==========================================
  // Public Environmental & Observational APIs
  // ==========================================

  async getCities(): Promise<ApiResult<City[]>> {
    if (this.isDemoMode) {
      return {
        ok: true,
        data: DEMO_CITIES,
        meta: { contract_version: '1.1.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
        status: 200
      };
    }
    return this.request<City[]>('/cities');
  }

  async getStations(cityId: string, pollutant?: Pollutant): Promise<ApiResult<StationView[]>> {
    if (this.isDemoMode) {
      const filtered = DEMO_STATIONS.filter(s => s.city_id === cityId);
      return {
        ok: true,
        data: filtered,
        meta: { contract_version: '1.1.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
        status: 200
      };
    }
    const query = new URLSearchParams({ city_id: cityId });
    if (pollutant) query.set('pollutant', pollutant);
    return this.request<StationView[]>(`/stations?${query.toString()}`);
  }

  async getStation(stationId: string): Promise<ApiResult<StationView>> {
    if (this.isDemoMode) {
      const stn = DEMO_STATIONS.find(s => s.id === stationId);
      if (stn) {
        return {
          ok: true,
          data: stn,
          meta: { contract_version: '1.1.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
          status: 200
        };
      }
      return {
        ok: false,
        error: { code: 'STATION_NOT_FOUND', message: 'Station not found in demo fixtures', retryable: false },
        status: 404
      };
    }
    return this.request<StationView>(`/stations/${stationId}`);
  }

  async getLatest(stationId: string, pollutant: Pollutant = 'pm25'): Promise<ApiResult<Measurement>> {
    if (this.isDemoMode) {
      const key = `${stationId}:${pollutant}`;
      const m = DEMO_MEASUREMENTS[key];
      if (m) {
        return {
          ok: true,
          data: m,
          meta: { contract_version: '1.1.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
          status: 200
        };
      }
      return {
        ok: false,
        error: {
          code: 'MEASUREMENT_NOT_FOUND',
          message: `No ${pollutant.toUpperCase()} measurement available for station in demo fixtures`,
          retryable: false
        },
        status: 404
      };
    }
    return this.request<Measurement>(`/stations/${stationId}/latest?pollutant=${pollutant}`);
  }

  async getForecast(stationId: string, pollutant: Pollutant = 'pm25', horizons?: number[]): Promise<ApiResult<Forecast>> {
    const params = new URLSearchParams({ pollutant });
    if (horizons) {
      horizons.forEach(h => params.append('horizons', h.toString()));
    }
    return this.request<Forecast>(`/stations/${stationId}/forecast?${params.toString()}`);
  }

  async getHistory(stationId: string, startIso: string, endIso: string, pollutant: Pollutant = 'pm25'): Promise<ApiResult<History>> {
    const params = new URLSearchParams({
      station_id: stationId,
      start: startIso,
      end: endIso,
      pollutant
    });
    return this.request<History>(`/history?${params.toString()}`);
  }

  async getHotspots(cityId: string, horizonH: 1 | 3 | 6 | 24 = 6, threshold: number = 0, pollutant: Pollutant = 'pm25'): Promise<ApiResult<any>> {
    if (this.isDemoMode) {
      return {
        ok: false,
        error: {
          code: 'MODEL_UNAVAILABLE',
          message: 'Emerging hotspot forecast ranking requires operational multi-horizon model inference (currently unavailable)',
          retryable: false
        },
        meta: { contract_version: '1.1.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
        status: 503
      };
    }
    const params = new URLSearchParams({
      city_id: cityId,
      horizon_h: horizonH.toString(),
      threshold: threshold.toString(),
      pollutant
    });
    return this.request<any>(`/hotspots?${params.toString()}`);
  }

  async getCapabilities(): Promise<ApiResult<Capabilities>> {
    if (this.isDemoMode) {
      return {
        ok: true,
        data: DEMO_CAPABILITIES,
        meta: { contract_version: '1.1.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
        status: 200
      };
    }
    return this.request<Capabilities>('/capabilities');
  }

  async getAdvisories(pollutant: Pollutant = 'pm25'): Promise<ApiResult<Advisory[]>> {
    if (this.isDemoMode) {
      return {
        ok: true,
        data: DEMO_ADVISORIES.filter(a => a.pollutant === pollutant),
        meta: { contract_version: '1.1.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
        status: 200
      };
    }
    return this.request<Advisory[]>(`/advisories?pollutant=${pollutant}`);
  }

  async getCoverage(cityId: string, populationEpoch: number = 2020): Promise<ApiResult<any>> {
    return this.request<any>(`/coverage?city_id=${cityId}&population_epoch=${populationEpoch}`);
  }

  async getModelPerformance(modelVersion?: string, cityId?: string, horizonH?: 1 | 3 | 6 | 12 | 24): Promise<ApiResult<any>> {
    const params = new URLSearchParams();
    if (modelVersion) params.set('model_version', modelVersion);
    if (cityId) params.set('city_id', cityId);
    if (horizonH) params.set('horizon_h', horizonH.toString());
    const query = params.toString();
    return this.request<any>(`/model-performance${query ? `?${query}` : ''}`);
  }

  async planActivity(req: ActivityRequest): Promise<ApiResult<any>> {
    return this.request<any>('/activity-plan', {
      method: 'POST',
      body: JSON.stringify(req)
    });
  }

  async compareRoutes(req: RouteRequest): Promise<ApiResult<any>> {
    return this.request<any>('/routes/compare', {
      method: 'POST',
      body: JSON.stringify(req)
    });
  }

  async simulateWeather(req: WeatherRequest): Promise<ApiResult<any>> {
    return this.request<any>('/scenarios/weather', {
      method: 'POST',
      body: JSON.stringify(req)
    });
  }

  // ==========================================
  // Account & Persistence APIs (Bearer Session)
  // ==========================================

  async getMe(): Promise<ApiResult<Identity>> {
    if (this.isDemoMode) {
      return {
        ok: true,
        data: DEMO_IDENTITY,
        meta: { contract_version: '1.1.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
        status: 200
      };
    }
    if (!this.sessionToken) {
      return {
        ok: false,
        error: { code: 'AUTH_REQUIRED', message: 'A provisioned bearer session is required to access account features', retryable: false },
        status: 401
      };
    }
    return this.request<Identity>('/me');
  }

  async getPreferences(): Promise<ApiResult<Preferences>> {
    if (this.isDemoMode) {
      return {
        ok: true,
        data: DEMO_IDENTITY.preferences,
        meta: { contract_version: '1.1.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
        status: 200
      };
    }
    if (!this.sessionToken) {
      return {
        ok: false,
        error: { code: 'AUTH_REQUIRED', message: 'A provisioned bearer session is required', retryable: false },
        status: 401
      };
    }
    return this.request<Preferences>('/preferences');
  }

  async updatePreferences(prefs: Partial<Preferences>): Promise<ApiResult<Preferences>> {
    if (this.isDemoMode) {
      DEMO_IDENTITY.preferences = { ...DEMO_IDENTITY.preferences, ...prefs };
      return {
        ok: true,
        data: DEMO_IDENTITY.preferences,
        meta: { contract_version: '1.1.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
        status: 200
      };
    }
    return this.request<Preferences>('/preferences', {
      method: 'PATCH',
      body: JSON.stringify(prefs)
    });
  }

  async getSavedPlaces(): Promise<ApiResult<PlaceView[]>> {
    if (this.isDemoMode) {
      const storage = getStorage();
      const raw = storage.getItem(this.KEY_DEMO_PLACES);
      const data: PlaceView[] = raw ? JSON.parse(raw) : [];
      return {
        ok: true,
        data,
        meta: { contract_version: '1.1.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
        status: 200
      };
    }
    if (!this.sessionToken) {
      return {
        ok: false,
        error: { code: 'AUTH_REQUIRED', message: 'A provisioned bearer session is required to view saved places', retryable: false },
        status: 401
      };
    }
    return this.request<PlaceView[]>('/saved-places');
  }

  async createSavedPlace(input: PlaceInput): Promise<ApiResult<PlaceView>> {
    if (this.isDemoMode) {
      const storage = getStorage();
      const raw = storage.getItem(this.KEY_DEMO_PLACES);
      const list: PlaceView[] = raw ? JSON.parse(raw) : [];
      const newPlace: PlaceView = {
        id: `demo-place-${Date.now()}`,
        label: input.label,
        latitude: input.latitude,
        longitude: input.longitude
      };
      list.push(newPlace);
      storage.setItem(this.KEY_DEMO_PLACES, JSON.stringify(list));
      return {
        ok: true,
        data: newPlace,
        meta: { contract_version: '1.1.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
        status: 200
      };
    }
    return this.request<PlaceView>('/saved-places', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  }

  async deleteSavedPlace(placeId: string): Promise<ApiResult<void>> {
    if (this.isDemoMode) {
      const storage = getStorage();
      const raw = storage.getItem(this.KEY_DEMO_PLACES);
      const list: PlaceView[] = raw ? JSON.parse(raw) : [];
      const updated = list.filter(p => p.id !== placeId);
      storage.setItem(this.KEY_DEMO_PLACES, JSON.stringify(updated));
      return {
        ok: true,
        data: undefined,
        meta: { contract_version: '1.1.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
        status: 204
      };
    }
    return this.request<void>(`/saved-places/${placeId}`, {
      method: 'DELETE'
    });
  }

  async getAlertRules(): Promise<ApiResult<RuleView[]>> {
    if (this.isDemoMode) {
      const storage = getStorage();
      const raw = storage.getItem(this.KEY_DEMO_RULES);
      const data: RuleView[] = raw ? JSON.parse(raw) : [];
      return {
        ok: true,
        data,
        meta: { contract_version: '1.1.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
        status: 200
      };
    }
    if (!this.sessionToken) {
      return {
        ok: false,
        error: { code: 'AUTH_REQUIRED', message: 'A provisioned bearer session is required to view alert rules', retryable: false },
        status: 401
      };
    }
    return this.request<RuleView[]>('/alert-rules');
  }

  async createAlertRule(input: RuleInput): Promise<ApiResult<RuleView>> {
    if (this.isDemoMode) {
      const storage = getStorage();
      const raw = storage.getItem(this.KEY_DEMO_RULES);
      const list: RuleView[] = raw ? JSON.parse(raw) : [];
      const newRule: RuleView = {
        id: `demo-rule-${Date.now()}`,
        station_id: input.station_id,
        pollutant: input.pollutant,
        threshold: input.threshold,
        averaging_period_minutes: input.averaging_period_minutes,
        cooldown_minutes: input.cooldown_minutes,
        enabled: input.enabled,
        channel: input.channel,
        trigger: 'latest_known_hourly_observation_strictly_above_threshold',
        unit: 'µg/m³'
      };
      list.push(newRule);
      storage.setItem(this.KEY_DEMO_RULES, JSON.stringify(list));
      return {
        ok: true,
        data: newRule,
        meta: { contract_version: '1.1.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
        status: 200
      };
    }
    return this.request<RuleView>('/alert-rules', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  }

  async deleteAlertRule(ruleId: string): Promise<ApiResult<void>> {
    if (this.isDemoMode) {
      const storage = getStorage();
      const raw = storage.getItem(this.KEY_DEMO_RULES);
      const list: RuleView[] = raw ? JSON.parse(raw) : [];
      const updated = list.filter(r => r.id !== ruleId);
      storage.setItem(this.KEY_DEMO_RULES, JSON.stringify(updated));
      return {
        ok: true,
        data: undefined,
        meta: { contract_version: '1.1.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
        status: 204
      };
    }
    return this.request<void>(`/alert-rules/${ruleId}`, {
      method: 'DELETE'
    });
  }

  async getAlerts(limit: number = 50, offset: number = 0): Promise<ApiResult<NotificationView[]>> {
    if (this.isDemoMode) {
      const storage = getStorage();
      const raw = storage.getItem(this.KEY_DEMO_ALERTS);
      const data: NotificationView[] = raw ? JSON.parse(raw) : [];
      return {
        ok: true,
        data,
        meta: { contract_version: '1.1.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
        status: 200
      };
    }
    if (!this.sessionToken) {
      return {
        ok: false,
        error: { code: 'AUTH_REQUIRED', message: 'A provisioned bearer session is required to view notifications', retryable: false },
        status: 401
      };
    }
    return this.request<NotificationView[]>(`/alerts?limit=${limit}&offset=${offset}`);
  }

  async markAlertRead(notificationId: string): Promise<ApiResult<NotificationView>> {
    if (this.isDemoMode) {
      const storage = getStorage();
      const raw = storage.getItem(this.KEY_DEMO_ALERTS);
      const list: NotificationView[] = raw ? JSON.parse(raw) : [];
      const item = list.find(n => n.id === notificationId);
      if (item) {
        item.read_at = new Date().toISOString();
        item.status = 'read';
        storage.setItem(this.KEY_DEMO_ALERTS, JSON.stringify(list));
        return {
          ok: true,
          data: item,
          meta: { contract_version: '1.1.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
          status: 200
        };
      }
      return {
        ok: false,
        error: { code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found in demo storage', retryable: false },
        status: 404
      };
    }
    return this.request<NotificationView>(`/alerts/${notificationId}/read`, {
      method: 'POST'
    });
  }

  // ----------------------------------------------------------------------
  // Contract 1.2.0 Methods: Station Catalogue & Observed Rankings
  // ----------------------------------------------------------------------

  async getStationCatalogue(cityId: string = 'delhi', issueAt?: string | null): Promise<ApiResult<StationCatalogue>> {
    if (this.isDemoMode) {
      return {
        ok: true,
        data: DEMO_STATION_CATALOGUE,
        meta: { contract_version: '1.2.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
        status: 200
      };
    }
    const query = new URLSearchParams({ city_id: cityId });
    if (issueAt) query.set('issue_at', issueAt);
    return this.request<StationCatalogue>(`/station-catalogue?${query.toString()}`);
  }

  async getObservedRankings(
    cityId: string = 'delhi',
    pollutant: Pollutant = 'pm25',
    limit: number = 20,
    includeStale: boolean = false,
    issueAt?: string | null
  ): Promise<ApiResult<ObservedRankings>> {
    if (this.isDemoMode) {
      return {
        ok: true,
        data: DEMO_OBSERVED_RANKINGS,
        meta: { contract_version: '1.2.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
        status: 200
      };
    }
    const query = new URLSearchParams({
      city_id: cityId,
      pollutant,
      limit: String(limit),
      include_stale: String(includeStale)
    });
    if (issueAt) query.set('issue_at', issueAt);
    return this.request<ObservedRankings>(`/observed-rankings?${query.toString()}`);
  }

  // ----------------------------------------------------------------------
  // Contract 1.2.0 Methods: Audited Recorded-Clock Archive
  // ----------------------------------------------------------------------

  async getArchiveCatalogue(): Promise<ApiResult<ArchiveCatalogue>> {
    if (this.isDemoMode) {
      return {
        ok: true,
        data: DEMO_ARCHIVE_CATALOGUE,
        meta: {
          contract_version: '1.2.0',
          data_mode: 'demo',
          request_id: 'demo-req',
          source: 'demo_fixture'
        },
        status: 200
      };
    }
    return this.request<ArchiveCatalogue>('/archive/catalogue');
  }

  async getArchiveExplore(
    stationId: string,
    pollutant: Pollutant,
    start: string,
    end: string,
    aggregation: 'daily' | 'monthly' = 'daily',
    minCount?: number,
    minCoverage?: number
  ): Promise<ApiResult<ArchiveExplore>> {
    if (this.isDemoMode) {
      const isCo = pollutant === 'co';
      const exploreData: ArchiveExplore = isCo
        ? {
            ...DEMO_ARCHIVE_EXPLORE,
            station_id: stationId,
            pollutant: 'co',
            unit: 'mg/m³',
            distribution: {
              ...DEMO_ARCHIVE_EXPLORE.distribution,
              minimum: 0.2,
              p05: 0.4,
              p25: 0.8,
              median: 1.4,
              mean: 1.6,
              p75: 2.1,
              p95: 3.8,
              maximum: 5.2,
              stddev: 0.9
            },
            points: DEMO_ARCHIVE_EXPLORE.points.map(p => ({
              ...p,
              value: p.value !== null ? Number((p.value * 0.01).toFixed(2)) : null
            }))
          }
        : {
            ...DEMO_ARCHIVE_EXPLORE,
            station_id: stationId,
            pollutant
          };
      return {
        ok: true,
        data: exploreData,
        meta: {
          contract_version: '1.2.0',
          data_mode: 'demo',
          request_id: 'demo-req',
          source: 'demo_fixture'
        },
        status: 200
      };
    }
    const query = new URLSearchParams({
      station_id: stationId,
      pollutant,
      start,
      end,
      aggregation
    });
    if (minCount !== undefined) query.set('min_count', String(minCount));
    if (minCoverage !== undefined) query.set('min_coverage', String(minCoverage));
    return this.request<ArchiveExplore>(`/archive/explore?${query.toString()}`);
  }

  async getArchiveCompare(
    stationIds: string[],
    pollutant: Pollutant,
    start: string,
    end: string,
    aggregation: 'daily' | 'monthly' = 'daily',
    clockAssumption: 'same_recorded_clock' = 'same_recorded_clock'
  ): Promise<ApiResult<ArchiveCompare>> {
    if (this.isDemoMode) {
      return {
        ok: true,
        data: DEMO_ARCHIVE_COMPARE,
        meta: {
          contract_version: '1.2.0',
          data_mode: 'demo',
          request_id: 'demo-req',
          source: 'demo_fixture'
        },
        status: 200
      };
    }
    const queryParts = stationIds.map(id => `station_ids=${encodeURIComponent(id)}`);
    queryParts.push(`pollutant=${encodeURIComponent(pollutant)}`);
    queryParts.push(`start=${encodeURIComponent(start)}`);
    queryParts.push(`end=${encodeURIComponent(end)}`);
    queryParts.push(`aggregation=${encodeURIComponent(aggregation)}`);
    queryParts.push(`clock_assumption=${encodeURIComponent(clockAssumption)}`);
    return this.request<ArchiveCompare>(`/archive/compare?${queryParts.join('&')}`);
  }

  // ----------------------------------------------------------------------
  // Contract 1.2.0 Methods: Model Registry & Evaluation
  // ----------------------------------------------------------------------

  async getReplayIssues(modelVersion: string, offset = 0): Promise<ApiResult<Schemas['ReplayIssuePage']>> {
    if (this.isDemoMode) return { ok: false, status: 409, error: { code: 'REPLAY_DEMO_UNAVAILABLE', message: 'Exit demo mode to use actual saved forecast trajectories.', retryable: false } };
    const query = new URLSearchParams({ split: 'test', limit: '25', offset: String(offset) });
    return this.request<Schemas['ReplayIssuePage']>(`/models/${encodeURIComponent(modelVersion)}/replay-issues?${query}`);
  }

  async planReplay(body: Schemas['ReplayPlanRequest']): Promise<ApiResult<Schemas['ReplayPlan']>> {
    if (this.isDemoMode) return { ok: false, status: 409, error: { code: 'REPLAY_DEMO_UNAVAILABLE', message: 'Replay planning requires actual saved forecasts.', retryable: false } };
    return this.request<Schemas['ReplayPlan']>('/activity-plan/replay', { method: 'POST', body: JSON.stringify(body) });
  }

  async getModels(): Promise<ApiResult<ModelCatalogue>> {
    if (this.isDemoMode) {
      return {
        ok: true,
        data: DEMO_MODELS,
        meta: { contract_version: '1.2.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
        status: 200
      };
    }
    return this.request<ModelCatalogue>('/models');
  }

  async getModelEvaluation(
    modelVersion: string,
    horizonH?: number | null,
    evaluationPath?: string | null
  ): Promise<ApiResult<ModelEvaluation | UtcModelEvaluation>> {
    if (this.isDemoMode) {
      return {
        ok: false,
        error: {
          code: 'EVALUATION_UNAVAILABLE',
          message: 'Evaluation metrics are unavailable in demo mode. Connect to live API to inspect audited experimental model evaluation results.',
          retryable: false
        },
        status: 503
      };
    }
    const query = horizonH !== undefined && horizonH !== null ? `?horizon_h=${horizonH}` : '';
    const endpoint = evaluationPath || `/models/${encodeURIComponent(modelVersion)}/evaluation`;
    return this.request<ModelEvaluation | UtcModelEvaluation>(`${endpoint}${query}`);
  }

  async getModelPredictions(
    modelVersion: string,
    horizonH: number = 1,
    split: string = 'test',
    limit: number = 100,
    offset: number = 0,
    options?: {
      predictionsPath?: string | null;
      issueTimePurged?: boolean;
      targetStart?: string | null;
      targetEnd?: string | null;
    }
  ): Promise<ApiResult<PredictionPage | UtcPredictionPage>> {
    if (this.isDemoMode) {
      return {
        ok: false,
        error: {
          code: 'PREDICTIONS_UNAVAILABLE',
          message: 'Held-out test predictions are unavailable in demo mode. Connect to live API to view audited prediction rows.',
          retryable: false
        },
        status: 503
      };
    }
    const query = new URLSearchParams({
      horizon_h: String(horizonH),
      split,
      limit: String(limit),
      offset: String(offset)
    });
    if (options?.issueTimePurged !== undefined) {
      query.set('issue_time_purged', String(options.issueTimePurged));
    }
    if (options?.targetStart) {
      query.set('target_start', options.targetStart);
    }
    if (options?.targetEnd) {
      query.set('target_end', options.targetEnd);
    }
    const endpoint = options?.predictionsPath || `/models/${encodeURIComponent(modelVersion)}/predictions`;
    return this.request<PredictionPage | UtcPredictionPage>(`${endpoint}?${query.toString()}`);
  }

  // ----------------------------------------------------------------------
  // Contract 1.2.0 Methods: Route Geometry
  // ----------------------------------------------------------------------

  async getRouteGeometry(
    origin: Coordinates,
    destination: Coordinates,
    mode: 'driving' | 'walking' | 'cycling' = 'driving',
    alternatives: number = 3
  ): Promise<ApiResult<GeometryResponse>> {
    if (this.isDemoMode) {
      return {
        ok: true,
        data: DEMO_GEOMETRY_RESPONSE,
        meta: { contract_version: '1.2.0', data_mode: 'demo', request_id: 'demo-req', source: 'demo_fixture' },
        status: 200
      };
    }
    return this.request<GeometryResponse>('/routes/geometry', {
      method: 'POST',
      body: JSON.stringify({
        origin,
        destination,
        mode,
        alternatives
      })
    });
  }

  // ----------------------------------------------------------------------
  // Contract 1.2.0 & 1.3.0 Additive Methods: Shadow Forecast Runs
  // ----------------------------------------------------------------------

  async getForecastRuns(
    stationId?: string,
    modelVersion?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<ApiResult<ForecastRunPage>> {
    if (this.isDemoMode) {
      return {
        ok: true,
        data: {
          total_count: 0,
          limit,
          offset,
          runs: []
        },
        meta: {
          contract_version: '1.2.0',
          data_mode: 'demo',
          request_id: 'demo-runs',
          source: 'demo_fixture'
        },
        status: 200
      };
    }
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String(offset)
    });
    if (stationId) query.set('station_id', stationId);
    if (modelVersion) query.set('model_version', modelVersion);
    return this.request<ForecastRunPage>(`/forecast-runs?${query.toString()}`);
  }

  async getForecastRun(runId: string): Promise<ApiResult<ForecastRunDetail>> {
    if (this.isDemoMode) {
      return {
        ok: false,
        error: {
          code: 'FORECAST_RUN_UNAVAILABLE',
          message: 'Individual shadow forecast run detail is unavailable in demo mode.',
          retryable: false
        },
        status: 404
      };
    }
    return this.request<ForecastRunDetail>(`/forecast-runs/${encodeURIComponent(runId)}`);
  }
}

export const apiClient = new BreatheWiseApiClient();
