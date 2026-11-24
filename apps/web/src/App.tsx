import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  City,
  StationView,
  Measurement,
  Forecast,
  Capabilities,
  Advisory,
  NotificationView,
  PlaceView,
  RuleView,
  Identity,
  Pollutant,
  DataMode,
  ApiResult
} from './lib/api/types';
import { apiClient } from './lib/api/client';
import { Header } from './components/layout/Header';
import { AtmosphericHero } from './components/layout/AtmosphericHero';
import { NotificationDrawer } from './components/layout/NotificationDrawer';
import { Tabs, TabItem } from './components/ui/Tabs';
import { Dialog } from './components/ui/Dialog';
import { Button } from './components/ui/Button';

// Views
import { OverviewView } from './features/overview/OverviewView';
import { HotspotsView } from './features/hotspots/HotspotsView';
import { PlannerView } from './features/planner/PlannerView';
import { HealthView } from './features/health/HealthView';
import { ExplorerView } from './features/explorer/ExplorerView';
import { CoverageView } from './features/coverage/CoverageView';
import { SavedPlacesView } from './features/saved-places/SavedPlacesView';
import { ModelAuditView } from './features/model-performance/ModelAuditView';
import { RouteCompareView } from './features/routes/RouteCompareView';
import { WeatherScenarioView } from './features/scenarios/WeatherScenarioView';

export const App: React.FC = () => {
  // Navigation & Data Mode State
  const [activeTab, setActiveTab] = useState('overview');
  const [isDemoMode, setIsDemoMode] = useState<boolean>(apiClient.getDemoMode());
  const [dataMode, setDataMode] = useState<DataMode>(apiClient.getDemoMode() ? 'demo' : 'live');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Entities State
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [stations, setStations] = useState<StationView[]>([]);
  const [selectedStation, setSelectedStation] = useState<StationView | null>(null);
  const [latestMap, setLatestMap] = useState<Record<string, Measurement | null>>({});
  const [forecastResult, setForecastResult] = useState<ApiResult<Forecast> | null>(null);
  const [hotspotsResult, setHotspotsResult] = useState<ApiResult<any> | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [selectedPollutant, setSelectedPollutant] = useState<Pollutant>('pm25');
  const [selectedHotspotHorizon, setSelectedHotspotHorizon] = useState<1 | 3 | 6 | 24>(6);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);
  const [isLoadingLatest, setIsLoadingLatest] = useState(false);
  const latestRequestId = useRef(0);
  const forecastRequestId = useRef(0);

  // Auth & Account State
  const [sessionToken, setSessionToken] = useState<string | null>(apiClient.getSessionToken());
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [places, setPlaces] = useState<PlaceView[]>([]);
  const [alertRules, setAlertRules] = useState<RuleView[]>([]);
  const [notifications, setNotifications] = useState<NotificationView[]>([]);

  // Modals State
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [savePlaceModalStation, setSavePlaceModalStation] = useState<StationView | null>(null);
  const [savePlaceLabel, setSavePlaceLabel] = useState('');

  // Refresh Account Data (Places, Rules, Alerts, Identity)
  const loadPlacesAndRules = useCallback(async () => {
    const [placesRes, rulesRes, alertsRes, meRes] = await Promise.all([
      apiClient.getSavedPlaces(),
      apiClient.getAlertRules(),
      apiClient.getAlerts(),
      apiClient.getMe()
    ]);

    if (placesRes.ok) setPlaces(placesRes.data);
    else setPlaces([]);

    if (rulesRes.ok) setAlertRules(rulesRes.data);
    else setAlertRules([]);

    if (alertsRes.ok) setNotifications(alertsRes.data);
    else setNotifications([]);

    if (meRes.ok) setIdentity(meRes.data);
    else setIdentity(null);
  }, []);

  // 1. Initial Load: Cities, Capabilities, Advisories, Account
  useEffect(() => {
    let isMounted = true;

    async function initData() {
      const [citiesRes, capsRes, advRes] = await Promise.all([
        apiClient.getCities(),
        apiClient.getCapabilities(),
        apiClient.getAdvisories('pm25')
      ]);

      if (!isMounted) return;

      if (capsRes.ok) {
        setCapabilities(capsRes.data);
        if (!apiClient.getDemoMode()) {
          setDataMode(capsRes.meta?.data_mode || 'live');
        }
      }

      if (advRes.ok) {
        setAdvisories(advRes.data);
      }

      if (citiesRes.ok) {
        setCities(citiesRes.data);
        setConnectionError(null);

        // Select Delhi as default baseline city
        const defaultCity = citiesRes.data.find(c => c.id === 'delhi') || citiesRes.data[0];
        setSelectedCity(defaultCity || null);
      } else {
        setConnectionError(`${citiesRes.error.code}: ${citiesRes.error.message}`);
      }

      // Load user account resources
      await loadPlacesAndRules();
    }

    initData();
    return () => {
      isMounted = false;
    };
  }, [loadPlacesAndRules]);

  // 2. Load Stations & Hotspots when City or Demo Mode Changes
  useEffect(() => {
    if (!selectedCity) return;
    const currentCity = selectedCity;
    let isMounted = true;

    async function loadCityData() {
      const [stationsRes, hotspotsRes] = await Promise.all([
        apiClient.getStations(currentCity.id),
        apiClient.getHotspots(currentCity.id, selectedHotspotHorizon)
      ]);

      if (!isMounted) return;

      setHotspotsResult(hotspotsRes);

      if (stationsRes.ok) {
        setStations(stationsRes.data);
        if (stationsRes.data.length > 0) {
          setSelectedStation(stationsRes.data[0]);
        } else {
          setSelectedStation(null);
        }
      } else {
        setStations([]);
        setSelectedStation(null);
      }
    }

    loadCityData();
    return () => {
      isMounted = false;
    };
  }, [selectedCity, selectedHotspotHorizon, isDemoMode]);

  // 3. Load Latest Observations for Selected Pollutant across City Stations
  useEffect(() => {
    if (!selectedCity || stations.length === 0) {
      setLatestMap({});
      return;
    }

    const currentReqId = ++latestRequestId.current;
    let isMounted = true;
    setIsLoadingLatest(true);

    Promise.all(
      stations.map(async stn => {
        const res = await apiClient.getLatest(stn.id, selectedPollutant);
        return [stn.id, res.ok ? res.data : null] as const;
      })
    ).then(entries => {
      // Discard responses from older requests to prevent race condition mismatches
      if (!isMounted || currentReqId !== latestRequestId.current) return;
      setLatestMap(Object.fromEntries(entries));
      setIsLoadingLatest(false);
    });

    return () => {
      isMounted = false;
    };
  }, [selectedCity, stations, selectedPollutant, isDemoMode]);

  // 4. Load Forecast when Selected Station or Pollutant Changes
  useEffect(() => {
    if (!selectedStation) {
      setForecastResult(null);
      return;
    }

    const currentReqId = ++forecastRequestId.current;
    let isMounted = true;
    setIsLoadingForecast(true);

    apiClient.getForecast(selectedStation.id, selectedPollutant).then(res => {
      // Discard responses from older requests to prevent race condition mismatches
      if (!isMounted || currentReqId !== forecastRequestId.current) return;
      setForecastResult(res);
      setIsLoadingForecast(false);
    });

    return () => {
      isMounted = false;
    };
  }, [selectedStation, selectedPollutant, isDemoMode]);

  // Demo Mode Switcher
  const handleToggleDemoMode = async (enabled: boolean) => {
    apiClient.setDemoMode(enabled);
    setIsDemoMode(enabled);
    setDataMode(enabled ? 'demo' : 'live');

    // Reload cities and root data for the new mode
    const [citiesRes, capsRes] = await Promise.all([
      apiClient.getCities(),
      apiClient.getCapabilities()
    ]);

    if (capsRes.ok) setCapabilities(capsRes.data);

    if (citiesRes.ok) {
      setCities(citiesRes.data);
      setConnectionError(null);
      const defaultCity = citiesRes.data.find(c => c.id === 'delhi') || citiesRes.data[0];
      setSelectedCity(defaultCity || null);
    } else {
      setConnectionError(`${citiesRes.error.code}: ${citiesRes.error.message}`);
    }

    await loadPlacesAndRules();
  };

  const handleSelectStationById = (stationId: string) => {
    const match = stations.find(s => s.id === stationId);
    if (match) {
      setSelectedStation(match);
      setActiveTab('overview');
    }
  };

  const handleAuthenticate = async (token: string): Promise<boolean> => {
    apiClient.setSessionToken(token);
    setSessionToken(token);
    const meRes = await apiClient.getMe();
    if (meRes.ok) {
      setIdentity(meRes.data);
      await loadPlacesAndRules();
      return true;
    }
    // Auth failed
    apiClient.setSessionToken(null);
    setSessionToken(null);
    setIdentity(null);
    return false;
  };

  const handleSignOut = () => {
    apiClient.setSessionToken(null);
    setSessionToken(null);
    setIdentity(null);
    setPlaces([]);
    setAlertRules([]);
    setNotifications([]);
  };

  const handleMarkNotificationRead = async (id: string) => {
    await apiClient.markAlertRead(id);
    const alertsRes = await apiClient.getAlerts();
    if (alertsRes.ok) {
      setNotifications(alertsRes.data);
    }
  };

  const handleSavePlaceSubmit = async () => {
    if (!savePlaceModalStation || !savePlaceLabel.trim()) return;
    await apiClient.createSavedPlace({
      label: savePlaceLabel.trim(),
      latitude: savePlaceModalStation.latitude,
      longitude: savePlaceModalStation.longitude
    });
    setSavePlaceModalStation(null);
    setSavePlaceLabel('');
    await loadPlacesAndRules();
    setActiveTab('saved-places');
  };

  const unreadCount = notifications.filter(n => !n.read_at && n.status !== 'read').length;

  const currentMeasurement =
    selectedStation && latestMap[selectedStation.id]?.pollutant === selectedPollutant
      ? latestMap[selectedStation.id]
      : null;

  const tabs: TabItem[] = [
    { id: 'overview', label: 'Overview & Map' },
    {
      id: 'hotspots',
      label: 'Emerging Hotspots',
      badge: hotspotsResult?.ok && Array.isArray(hotspotsResult.data) ? hotspotsResult.data.length : undefined
    },
    { id: 'planner', label: 'Activity Planner' },
    { id: 'health', label: 'Health Guidance' },
    { id: 'history', label: 'Historical EDA' },
    { id: 'coverage', label: 'Population Extent' },
    { id: 'saved-places', label: 'Saved Places' },
    { id: 'model-audit', label: 'Model Audit' },
    { id: 'routes', label: 'Routes (Exp)' },
    { id: 'scenarios', label: 'What-If Scenarios' }
  ];

  if (!selectedCity && !connectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F5] text-slate-600">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold">Initializing BreatheWise Telemetry...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F5] text-slate-900 w-full max-w-full overflow-x-hidden">
      {/* 1. Persistent Demo Banner (When active) */}
      {isDemoMode && (
        <aside aria-label="Demo mode announcement" className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-600 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-950 animate-pulse" />
            <span>
              <strong>DEMO PREVIEW ACTIVE:</strong> High-fidelity synthetic scenarios for visual inspection. No live network requests are made.
            </span>
          </div>
          <button
            onClick={() => handleToggleDemoMode(false)}
            className="px-2.5 py-1 rounded bg-slate-950 text-amber-300 hover:bg-slate-900 font-bold transition-colors cursor-pointer self-start sm:self-auto"
          >
            Exit Demo Mode
          </button>
        </aside>
      )}

      {/* 2. Connection Warning Banner (When live backend is offline) */}
      {!isDemoMode && connectionError && (
        <aside aria-label="Connection warning" className="bg-red-50 text-red-900 px-4 py-3 text-xs border-b border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 mt-1 sm:mt-0 shrink-0" />
            <div>
              <span className="font-bold">Backend Service Offline ({connectionError}): </span>
              <span>
                Unable to connect to 127.0.0.1:8000. Start backend with <code className="bg-red-100 px-1 py-0.5 rounded font-mono">uv run --locked uvicorn breathewise.main:app --host 127.0.0.1 --port 8000</code>, or inspect frontend features via Demo Preview.
              </span>
            </div>
          </div>
          <button
            onClick={() => handleToggleDemoMode(true)}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors shrink-0 cursor-pointer self-start sm:self-auto"
          >
            Enter Demo Mode
          </button>
        </aside>
      )}

      {/* 3. Header */}
      <Header
        cities={cities}
        selectedCity={
          selectedCity || {
            id: 'delhi',
            name: 'Delhi NCR',
            aliases: ['delhi', 'ncr'],
            availability: 'eligible',
            eligible_station_count: 40,
            observed_station_count: 40
          }
        }
        onSelectCity={setSelectedCity}
        dataMode={dataMode}
        isDemoMode={isDemoMode}
        onToggleDemoMode={handleToggleDemoMode}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        unreadCount={unreadCount}
      />

      {/* 4. Atmospheric Hero Banner (India Gate Landmark Artwork) */}
      {selectedCity && <AtmosphericHero selectedCity={selectedCity} />}

      {/* 5. Primary App Workspace */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={setActiveTab}
            variant="pills"
          />
        </div>

        {/* View Routing */}
        <div className="transition-opacity duration-200">
          {activeTab === 'overview' && selectedCity && (
            <OverviewView
              selectedCity={selectedCity}
              stations={stations}
              selectedStation={selectedStation}
              onSelectStation={setSelectedStation}
              latestMap={latestMap}
              currentMeasurement={currentMeasurement}
              forecastResult={forecastResult}
              capabilities={capabilities}
              isDemoMode={isDemoMode}
              isLoadingForecast={isLoadingForecast}
              isLoadingLatest={isLoadingLatest}
              selectedPollutant={selectedPollutant}
              onSelectPollutant={setSelectedPollutant}
              onOpenSavePlaceModal={stn => {
                setSavePlaceModalStation(stn);
                setSavePlaceLabel(stn.name.split(',')[0]);
              }}
              onOpenAlertModal={() => setActiveTab('saved-places')}
            />
          )}

          {activeTab === 'hotspots' && selectedCity && (
            <HotspotsView
              hotspotsResult={hotspotsResult}
              selectedCity={selectedCity}
              capabilities={capabilities}
              isDemoMode={isDemoMode}
              onSelectStationById={handleSelectStationById}
              onHorizonChange={setSelectedHotspotHorizon}
              selectedHorizon={selectedHotspotHorizon}
            />
          )}

          {activeTab === 'planner' && (
            <PlannerView
              stations={stations}
              capabilities={capabilities}
            />
          )}

          {activeTab === 'health' && (
            <HealthView
              advisories={advisories}
              selectedPollutant={selectedPollutant}
              onSelectPollutant={setSelectedPollutant}
            />
          )}

          {activeTab === 'history' && (
            <ExplorerView
              stations={stations}
              selectedStation={selectedStation}
              onSelectStation={setSelectedStation}
            />
          )}

          {activeTab === 'coverage' && selectedCity && (
            <CoverageView
              selectedCity={selectedCity}
              capabilities={capabilities}
            />
          )}

          {activeTab === 'saved-places' && (
            <SavedPlacesView
              stations={stations}
              places={places}
              alertRules={alertRules}
              identity={identity}
              isAuthenticated={Boolean(sessionToken && identity)}
              isDemoMode={isDemoMode}
              onRefreshPlacesAndRules={loadPlacesAndRules}
              onAuthenticate={handleAuthenticate}
              onSignOut={handleSignOut}
              onSelectStationById={handleSelectStationById}
            />
          )}

          {activeTab === 'model-audit' && (
            <ModelAuditView capabilities={capabilities} />
          )}

          {activeTab === 'routes' && (
            <RouteCompareView />
          )}

          {activeTab === 'scenarios' && (
            <WeatherScenarioView
              stations={stations}
              capabilities={capabilities}
            />
          )}
        </div>
      </main>

      {/* 6. Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">BreatheWise India</span>
            <span>•</span>
            <span>National CAAQMS Ingestion & Multi-Horizon LightGBM Pipeline</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>CPCB / DPCC / SPCB</span>
            <span>•</span>
            <span>ECMWF CAMS Aerosols</span>
            <span>•</span>
            <span>NASA FIRMS VIIRS</span>
            <span>•</span>
            <span>JRC GHSL Population</span>
          </div>
        </div>
      </footer>

      {/* 7. Notification Center Drawer */}
      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkRead={handleMarkNotificationRead}
      />

      {/* 8. Quick Save Place Modal */}
      <Dialog
        isOpen={Boolean(savePlaceModalStation)}
        onClose={() => setSavePlaceModalStation(null)}
        title="Save Pinned Location"
        description={`Associate this location with ${savePlaceModalStation?.name}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setSavePlaceModalStation(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSavePlaceSubmit}>
              Save Place
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Place Name</label>
            <input
              type="text"
              value={savePlaceLabel}
              onChange={e => setSavePlaceLabel(e.target.value)}
              placeholder="e.g. My Home, Office, Campus"
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <p className="text-slate-500 text-[11px]">
            Nearest CAAQMS Monitor: <strong>{savePlaceModalStation?.name}</strong>
          </p>
        </div>
      </Dialog>
    </div>
  );
};

export default App;
