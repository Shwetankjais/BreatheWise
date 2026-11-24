import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  City,
  StationView,
  Measurement,
  Forecast,
  Capabilities,
  Pollutant,
  ForecastPoint,
  ApiResult,
  StationCatalogue,
  ObservedRankings,
  LocationContext,
  PollutantReading
} from '../../lib/api/types';
import { apiClient } from '../../lib/api/client';
import { calculateSubIndex, formatToIST, formatTimeAgo } from '../../lib/aqi';
import { StationMap } from '../../components/map/StationMap';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Tooltip } from '../../components/ui/Tooltip';

interface OverviewViewProps {
  selectedCity: City;
  stations: StationView[];
  selectedStation: StationView | null;
  onSelectStation: (station: StationView) => void;
  latestMap: Record<string, Measurement | null>;
  currentMeasurement: Measurement | null;
  forecastResult: ApiResult<Forecast> | null;
  capabilities: Capabilities | null;
  isDemoMode: boolean;
  isLoadingForecast: boolean;
  isLoadingLatest: boolean;
  selectedPollutant: Pollutant;
  onSelectPollutant: (pollutant: Pollutant) => void;
  onOpenSavePlaceModal: (station: StationView) => void;
  onOpenAlertModal: (station: StationView) => void;
  onNavigateToTab?: (tabId: string) => void;
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// UI proximity guard only; this is not an air-pollution coverage radius.
const MAX_NEAREST_STATION_DISTANCE_KM = 50;

function formatToUTC(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toISOString().replace('.000Z', 'Z').replace('T', ' ');
  } catch {
    return isoString;
  }
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  selectedCity,
  stations,
  selectedStation,
  onSelectStation,
  latestMap,
  currentMeasurement: _currentMeasurement,
  forecastResult,
  capabilities: _capabilities,
  isDemoMode,
  isLoadingForecast,
  isLoadingLatest,
  selectedPollutant,
  onSelectPollutant,
  onOpenSavePlaceModal,
  onOpenAlertModal,
  onNavigateToTab
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'has_pollutant' | 'fresh_only'>('all');
  const [mobileTab, setMobileTab] = useState<'map' | 'list'>('map');
  const [compareStationIds, setCompareStationIds] = useState<string[]>([]);
  const [directoryTab, setDirectoryTab] = useState<'directory' | 'rankings'>('directory');
  const [observedRankings, setObservedRankings] = useState<ObservedRankings | null>(null);
  const [isLoadingRankings, setIsLoadingRankings] = useState(false);
  const [stationCatalogue, setStationCatalogue] = useState<StationCatalogue | null>(null);

  // Station Pollutants & Environmental Weather Context
  const [stationPollutants, setStationPollutants] = useState<Record<string, PollutantReading> | null>(null);
  const [isLoadingPollutants, setIsLoadingPollutants] = useState(false);
  const [locationContext, setLocationContext] = useState<LocationContext | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);

  // Geolocation state
  const [isLocating, setIsLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<{
    type: 'success' | 'denied' | 'error';
    message: string;
    distanceKm?: number;
  } | null>(null);
  const automaticLocationAttempted = useRef(false);

  // Fetch Station Catalogue (Contract 1.2.0)
  useEffect(() => {
    let isMounted = true;
    apiClient.getStationCatalogue(selectedCity.id).then(res => {
      if (!isMounted) return;
      if (res.ok) {
        setStationCatalogue(res.data);
      } else {
        setStationCatalogue(null);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [selectedCity.id, isDemoMode]);

  // Fetch Observed Rankings (Contract 1.2.0)
  useEffect(() => {
    let isMounted = true;
    setIsLoadingRankings(true);
    apiClient.getObservedRankings(selectedCity.id, selectedPollutant, 20).then(res => {
      if (!isMounted) return;
      setIsLoadingRankings(false);
      if (res.ok) {
        setObservedRankings(res.data);
      } else {
        setObservedRankings(null);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [selectedCity.id, selectedPollutant, isDemoMode]);

  // Fetch All Monitored Criteria Pollutants for selected station
  useEffect(() => {
    if (!selectedStation) {
      setStationPollutants(null);
      return;
    }
    let isMounted = true;
    setIsLoadingPollutants(true);
    apiClient.getStationPollutants(selectedStation.id).then(res => {
      if (!isMounted) return;
      setIsLoadingPollutants(false);
      if (res.ok) {
        setStationPollutants(res.data);
      } else {
        setStationPollutants(null);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [selectedStation?.id, isDemoMode]);

  // Fetch Environmental and Weather Context for selected station
  useEffect(() => {
    if (!selectedStation) {
      setLocationContext(null);
      return;
    }
    let isMounted = true;
    setIsLoadingContext(true);
    apiClient.getLocationContext(selectedStation.latitude, selectedStation.longitude, selectedCity.id).then(res => {
      if (!isMounted) return;
      setIsLoadingContext(false);
      if (res.ok) {
        setLocationContext(res.data);
      } else {
        setLocationContext(null);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [selectedStation?.id, selectedStation?.latitude, selectedStation?.longitude, selectedCity.id, isDemoMode]);

  const catalogueStation = useMemo(() => {
    if (!selectedStation || !stationCatalogue) return null;
    return stationCatalogue.stations.find(s => s.id === selectedStation.id) || null;
  }, [selectedStation, stationCatalogue]);

  // Geolocation Handler
  const handleLocateNearestStation = () => {
    if (!navigator.geolocation) {
      setLocationNotice({
        type: 'error',
        message: 'Geolocation is not supported by your browser. Please select a monitoring station from the directory.'
      });
      return;
    }
    setIsLocating(true);
    setLocationNotice(null);

    navigator.geolocation.getCurrentPosition(
      pos => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        if (!stations.length) return;

        let nearest = stations[0];
        let minDist = haversineDistanceKm(latitude, longitude, nearest.latitude, nearest.longitude);

        for (let i = 1; i < stations.length; i++) {
          const dist = haversineDistanceKm(latitude, longitude, stations[i].latitude, stations[i].longitude);
          if (dist < minDist) {
            minDist = dist;
            nearest = stations[i];
          }
        }

        apiClient.getLocationContext(latitude, longitude, selectedCity.id).then(res => {
          if (res.ok) {
            setLocationContext(res.data);
          }
        });

        if (minDist > MAX_NEAREST_STATION_DISTANCE_KM) {
          setLocationNotice({
            type: 'error',
            message: `Device position received (${latitude.toFixed(3)}°, ${longitude.toFixed(3)}°), but the nearest available ${selectedCity.name} monitor is ${minDist.toFixed(0)} km away. Choose a supported city or station; this reading does not represent your location.`,
            distanceKm: minDist
          });
          return;
        }
        onSelectStation(nearest);
        setLocationNotice({
          type: 'success',
          message: `Browser location (${latitude.toFixed(3)}°, ${longitude.toFixed(3)}°): nearest available monitor is ${nearest.name}, ${minDist.toFixed(1)} km away. This is the station reading, not pollution measured at your device.`,
          distanceKm: minDist
        });
      },
      err => {
        setIsLocating(false);
        let msg = 'Unable to retrieve location. Defaulting to station directory.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location permission was denied. Select a city or station manually; no IP location service is configured.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Location information is currently unavailable. Defaulting to station directory.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location request timed out. Defaulting to station directory.';
        }
        setLocationNotice({
          type: 'denied',
          message: msg
        });
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  // One browser-permission request per session. Coordinates stay in this page and are
  // used only to pick a nearby monitor; no unsupported reverse-geocode is implied.
  useEffect(() => {
    if (!stations.length || automaticLocationAttempted.current) return;
    automaticLocationAttempted.current = true;
    if (sessionStorage.getItem('breathewise_location_attempted') === '1') return;
    sessionStorage.setItem('breathewise_location_attempted', '1');
    handleLocateNearestStation();
  }, [stations]);

  // Filter stations based on search query and active filter mode
  const filteredStations = useMemo(() => {
    return stations.filter(station => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery = station.name.toLowerCase().includes(q) || station.id.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }

      const m = latestMap[station.id];
      if (filterMode === 'has_pollutant') {
        return Boolean(m && m.pollutant === selectedPollutant && m.value !== null);
      }
      if (filterMode === 'fresh_only') {
        return Boolean(m && !m.stale && m.value !== null);
      }

      return true;
    });
  }, [stations, searchQuery, filterMode, latestMap, selectedPollutant]);

  // Determine current measurement to display for selected pollutant
  const measurementToDisplay = useMemo(() => {
    if (!selectedStation) return null;
    const m = latestMap[selectedStation.id];
    if (m && m.pollutant === selectedPollutant) return m;
    return null;
  }, [selectedStation, latestMap, selectedPollutant]);

  const subIndex = useMemo(() => {
    if (!measurementToDisplay) return 0;
    return calculateSubIndex(selectedPollutant, measurementToDisplay.value);
  }, [measurementToDisplay, selectedPollutant]);

  const forecastData = forecastResult && forecastResult.ok ? forecastResult.data : null;

  // Multi-station comparison handlers
  const handleToggleCompare = (stationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompareStationIds(prev => {
      if (prev.includes(stationId)) {
        return prev.filter(id => id !== stationId);
      }
      if (prev.length >= 3) {
        alert('You can compare a maximum of 3 stations at a time.');
        return prev;
      }
      return [...prev, stationId];
    });
  };

  const comparedStations = useMemo(() => {
    return stations.filter(s => compareStationIds.includes(s.id));
  }, [stations, compareStationIds]);

  return (
    <div className="space-y-6">
      {/* Geolocation Notice Banner */}
      {locationNotice && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            locationNotice.type === 'success'
              ? 'bg-[#F0FDFA] border-[#99F6E4] text-[#0F766E]'
              : 'bg-[#FBF4E6] border-[#E8D1A0] text-[#78350F]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {locationNotice.type === 'success' ? (
              <svg className="w-4 h-4 shrink-0 text-[#0D9488]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 shrink-0 text-[#E29E2E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <span className="font-semibold">{locationNotice.message}</span>
          </div>
          <button
            onClick={() => setLocationNotice(null)}
            className="text-xs font-bold opacity-60 hover:opacity-100 p-1 cursor-pointer"
            aria-label="Dismiss notice"
          >
            ✕
          </button>
        </div>
      )}

      {/* Multi-Station Side-by-Side Comparison Drawer */}
      {comparedStations.length > 0 && (
        <Card className="border-2 border-[#0D9488]/40 bg-[#F0FDFA]/30">
          <CardHeader className="py-3 px-4 bg-[#FFFDF9] border-b border-[#CCFBF1] flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-[#1C1A1F]">
                Side-by-Side Station Comparison ({comparedStations.length} / 3 selected)
              </CardTitle>
              <CardDescription className="text-xs">
                Comparing current observed {selectedPollutant.toUpperCase()} telemetry across selected monitoring sites
              </CardDescription>
            </div>
            <button
              onClick={() => setCompareStationIds([])}
              className="text-xs text-[#6E675D] hover:text-[#1C1A1F] font-semibold underline cursor-pointer p-1"
            >
              Clear Comparison
            </button>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {comparedStations.map(stn => {
                const m = latestMap[stn.id];
                const hasValue = m && m.pollutant === selectedPollutant && m.value !== null;
                const val = hasValue ? m.value : null;

                return (
                  <div key={stn.id} className="p-3.5 bg-[#FFFDF9] rounded-xl border border-[#DDD3BC] shadow-xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-[#0D9488] bg-[#F0FDFA] px-1.5 py-0.5 rounded border border-[#99F6E4]">
                          {stn.source}
                        </span>
                        <h4 className="font-bold text-xs text-[#1C1A1F] mt-1">{stn.name}</h4>
                        <div className="text-[10px] text-[#968F83] font-mono">
                          {stn.latitude.toFixed(3)}° N, {stn.longitude.toFixed(3)}° E
                        </div>
                      </div>
                      <button
                        onClick={e => handleToggleCompare(stn.id, e)}
                        className="text-[#968F83] hover:text-[#C3583C] text-xs p-1 cursor-pointer"
                        title="Remove from comparison"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#F7F3E9] border border-[#DDD3BC]">
                      <div className="text-[10px] font-semibold text-[#6E675D] uppercase">
                        Hourly {selectedPollutant.toUpperCase()}
                      </div>
                      {val !== null && m ? (
                        <>
                          <div className="text-xl font-extrabold text-[#1C1A1F] mt-0.5">
                            {val.toFixed(1)} <span className="text-xs font-semibold text-[#6E675D]">{m.unit}</span>
                          </div>
                          <div className="text-[10px] text-[#6E675D] mt-0.5">
                            Observed {formatTimeAgo(m.measured_at)} ({formatToIST(m.measured_at)})
                          </div>
                          <div className={`text-[10px] font-semibold mt-0.5 ${m.stale ? 'text-[#C88A2E]' : 'text-[#16A34A]'}`}>
                            {m.stale ? '⚠️ Stale Reading' : '✓ Fresh Reading'}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-[#968F83] italic mt-1">
                          No {selectedPollutant.toUpperCase()} data
                        </div>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectStation(stn)}
                      className="w-full text-xs min-h-[38px]"
                    >
                      Focus on Map
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Map-Centered Dashboard Grid matching Reference Image 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (3 cols on lg): Parameters, Replay Insights & Sensor Health */}
        <div className="lg:col-span-3 space-y-4">
          {/* Card 1: Parameter Selection matching Reference */}
          <Card className="border-[#DDD3BC]">
            <CardHeader className="py-3 px-4 bg-[#FAF6EE] border-b border-[#DDD3BC]">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#1C1A1F]">
                Parameter
              </CardTitle>
              <CardDescription className="text-[11px] text-[#6E675D]">
                Select criteria pollutant for telemetry & model metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3.5">
              <div className="grid grid-cols-2 gap-2">
                {(['pm25', 'pm10', 'no2', 'so2', 'o3', 'co'] as Pollutant[]).map(p => {
                  const isSelected = selectedPollutant === p;
                  return (
                    <button
                      key={p}
                      onClick={() => onSelectPollutant(p)}
                      className={`min-h-[44px] px-3 py-2 text-xs font-extrabold rounded-xl border transition-all cursor-pointer text-center ${
                        isSelected
                          ? 'bg-[#FBF4E6] text-[#8C5D14] border-2 border-[#E29E2E] shadow-xs'
                          : 'bg-[#FFFDF9] text-[#4A453E] border-[#DDD3BC] hover:bg-[#F2ECE0]'
                      }`}
                    >
                      {p === 'pm25' ? 'PM2.5' : p === 'pm10' ? 'PM10' : p.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Low-Exposure Replay Windows matching Reference */}
          <Card className="border-[#DDD3BC]">
            <CardHeader className="py-3 px-4 bg-[#FAF6EE] border-b border-[#DDD3BC]">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#1C1A1F]">
                Low-Exposure Windows
              </CardTitle>
              <CardDescription className="text-[11px] text-[#6E675D]">
                Contract 1.4 historical replay ranking
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3.5 space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-[#DCFCE7] border border-[#86EFAC] text-[#14532D]">
                <div className="font-bold text-[11px] uppercase tracking-wider">Lowest Exposure Window</div>
                <div className="text-sm font-extrabold mt-0.5">12:00 PM – 2:00 PM</div>
                <div className="text-[10px] opacity-80 mt-0.5">Score: 373.0 µg·h/m³ (Rank #1)</div>
              </div>

              <div className="p-3 rounded-xl bg-[#FEE2E2] border border-[#FCA5A5] text-[#7F1D1D]">
                <div className="font-bold text-[11px] uppercase tracking-wider">Peak Vulnerability Warning</div>
                <div className="text-sm font-extrabold mt-0.5">7:00 AM – 9:00 AM</div>
                <div className="text-[10px] opacity-80 mt-0.5">Peak concentration: 197.3 µg/m³</div>
              </div>

              <p className="text-[10px] text-[#7A7368] italic leading-tight pt-1">
                Historical comparison only; not prospective health or activity advice.
              </p>

              {onNavigateToTab && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigateToTab('planner')}
                  className="w-full text-xs min-h-[38px] border-[#DDD3BC] hover:border-[#E29E2E]"
                >
                  Open Replay Planner →
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Card 3: ML Gaps & Insights matching Reference */}
          <Card className="border-[#DDD3BC]">
            <CardHeader className="py-3 px-4 bg-[#FAF6EE] border-b border-[#DDD3BC]">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#1C1A1F]">
                ML Gaps & Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 space-y-2.5 text-xs text-[#3D3934]">
              <div className="p-2.5 bg-[#FFFDF9] rounded-xl border border-[#DDD3BC]">
                <div className="font-bold text-[#1C1A1F] text-[11px]">Model Certainty</div>
                <div className="text-[11px] text-[#6E675D] mt-0.5">
                  Live serving model gated (`503 MODEL_UNAVAILABLE`). Evaluated on held-out test splits.
                </div>
              </div>

              <div className="p-2.5 bg-[#FFFDF9] rounded-xl border border-[#DDD3BC]">
                <div className="font-bold text-[#1C1A1F] text-[11px]">Sensor Coverage</div>
                <div className="text-[11px] text-[#6E675D] mt-0.5">
                  {selectedCity.observed_station_count} CAAQMS monitors active across {selectedCity.name}.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Meteorological Context (Open-Meteo NWP) */}
          <Card className="border-[#DDD3BC]" data-testid="meteorological-context">
            <CardHeader className="py-3 px-4 bg-[#FAF6EE] border-b border-[#DDD3BC]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#1C1A1F]">
                  Meteorological Context
                </CardTitle>
                <span className="text-[9px] font-mono px-2 py-0.5 bg-[#F0FDFA] text-[#0D9488] border border-[#99F6E4] rounded-full font-bold">
                  NWP Gridded
                </span>
              </div>
              <CardDescription className="text-[11px] text-[#6E675D]">
                Open-Meteo numerical weather prediction (modeled context)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3.5 space-y-2.5 text-xs">
              {isLoadingContext ? (
                <div className="py-4 text-center text-[#968F83] text-xs animate-pulse">
                  Retrieving weather context…
                </div>
              ) : locationContext?.weather?.available ? (
                <>
                  <div className="p-2.5 bg-[#FFFDF9] rounded-xl border border-[#DDD3BC] space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#6E675D] font-medium">Condition</span>
                      <span className="font-bold text-[#1C1A1F]">
                        {locationContext.weather.condition_description}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#EBE3D3] text-[11px]">
                      <div>
                        <span className="text-[#968F83] block">Temperature</span>
                        <span className="font-bold text-[#1C1A1F]">
                          {locationContext.weather.temperature_c !== null && locationContext.weather.temperature_c !== undefined
                            ? `${locationContext.weather.temperature_c.toFixed(1)} °C`
                            : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#968F83] block">Humidity</span>
                        <span className="font-bold text-[#1C1A1F]">
                          {locationContext.weather.relative_humidity_pct !== null && locationContext.weather.relative_humidity_pct !== undefined
                            ? `${locationContext.weather.relative_humidity_pct.toFixed(0)}%`
                            : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#968F83] block">Wind Speed</span>
                        <span className="font-bold text-[#1C1A1F]">
                          {locationContext.weather.wind_speed_kmh !== null && locationContext.weather.wind_speed_kmh !== undefined
                            ? `${locationContext.weather.wind_speed_kmh.toFixed(1)} km/h`
                            : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#968F83] block">Pressure</span>
                        <span className="font-bold text-[#1C1A1F]">
                          {locationContext.weather.surface_pressure_hpa !== null && locationContext.weather.surface_pressure_hpa !== undefined
                            ? `${locationContext.weather.surface_pressure_hpa.toFixed(0)} hPa`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#F0FDFA] border border-[#99F6E4] text-[10px] text-[#0F766E] leading-relaxed">
                    <strong className="block text-[#0D9488]">Model Estimate Attribution:</strong>
                    {locationContext.weather.disclaimer}
                  </div>
                </>
              ) : (
                <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#DDD3BC] text-center text-[#7A7368] text-xs">
                  Weather context is currently unavailable for this coordinate.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Center Column (6 cols on lg): Interactive AQ Map & Station Directory */}
        <div className="lg:col-span-6 space-y-4">
          {/* Map Header with Geolocation & Search */}
          <div className="bg-[#FFFDF9] p-3.5 rounded-2xl border border-[#DDD3BC] shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
              <h2 className="text-sm sm:text-base font-extrabold text-[#1C1A1F]">
                Interactive AQ Map
              </h2>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLocateNearestStation}
              isLoading={isLocating}
              className="min-h-[40px] px-3 text-xs border-[#DDD3BC] hover:border-[#E29E2E] text-[#1C1A1F]"
              title="Locate nearest station using browser geolocation"
            >
              <svg className="w-4 h-4 text-[#C88A2E] mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a8 8 0 00-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 00-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z" />
              </svg>
              <span>Find Nearest Monitor</span>
            </Button>
          </div>

          {/* Interactive Map */}
          <div className={`${mobileTab === 'map' ? 'block' : 'hidden sm:block'}`}>
            <StationMap
              stations={stations}
              latestMap={latestMap}
              selectedStationId={selectedStation?.id || null}
              onSelectStation={onSelectStation}
              centerLat={stations[0]?.latitude || 28.6139}
              centerLon={stations[0]?.longitude || 77.2090}
              cityName={selectedCity.name}
              selectedPollutant={selectedPollutant}
            />
          </div>

          {/* Mobile Switcher (Map vs List) */}
          <div className="sm:hidden flex rounded-xl bg-[#F2ECE0] p-1 border border-[#DDD3BC]">
            <button
              onClick={() => setMobileTab('map')}
              className={`flex-1 min-h-[44px] py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                mobileTab === 'map' ? 'bg-[#FFFDF9] text-[#1C1A1F] shadow-xs font-bold border border-[#DDD3BC]' : 'text-[#6E675D]'
              }`}
            >
              Geospatial Map
            </button>
            <button
              onClick={() => setMobileTab('list')}
              className={`flex-1 min-h-[44px] py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                mobileTab === 'list' ? 'bg-[#FFFDF9] text-[#1C1A1F] shadow-xs font-bold border border-[#DDD3BC]' : 'text-[#6E675D]'
              }`}
            >
              {selectedCity.name} Monitors ({stations.length})
            </button>
          </div>

          {/* Station Directory & Observed Rankings */}
          <Card className={`${mobileTab === 'list' ? 'block' : 'hidden sm:block'} border-[#DDD3BC]`}>
            <CardHeader className="py-3 px-4 bg-[#FAF6EE] border-b border-[#DDD3BC]">
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDirectoryTab('directory')}
                      className={`min-h-[44px] text-xs sm:text-sm font-bold pb-0.5 border-b-2 transition-colors cursor-pointer ${
                        directoryTab === 'directory'
                          ? 'border-[#E29E2E] text-[#1C1A1F]'
                          : 'border-transparent text-[#6E675D] hover:text-[#1C1A1F]'
                      }`}
                    >
                      {selectedCity.name} CAAQMS Monitors ({filteredStations.length} / {stations.length})
                    </button>
                    <span className="text-[#DDD3BC]">|</span>
                    <button
                      onClick={() => setDirectoryTab('rankings')}
                      className={`min-h-[44px] text-xs sm:text-sm font-bold pb-0.5 border-b-2 transition-colors cursor-pointer ${
                        directoryTab === 'rankings'
                          ? 'border-[#E29E2E] text-[#1C1A1F]'
                          : 'border-transparent text-[#6E675D] hover:text-[#1C1A1F]'
                      }`}
                    >
                      Observed Rankings ({observedRankings?.rows.length ?? 0})
                    </button>
                  </div>

                  {directoryTab === 'directory' && (
                    <div className="relative w-full sm:w-60">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search stations..."
                        className="w-full text-xs rounded-xl border border-[#DDD3BC] bg-[#FFFDF9] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#E29E2E]"
                      />
                    </div>
                  )}
                </div>

                {directoryTab === 'directory' ? (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#EBE3D3] text-xs">
                    <span className="text-[11px] text-[#6E675D] font-semibold mr-1">Filter:</span>
                    <button
                      onClick={() => setFilterMode('all')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer min-h-[36px] ${
                        filterMode === 'all'
                          ? 'bg-[#1C1A1F] text-white'
                          : 'bg-[#F2ECE0] text-[#4A453E] hover:bg-[#EBE3D3]'
                      }`}
                    >
                      All Stations
                    </button>
                    <button
                      onClick={() => setFilterMode('has_pollutant')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer min-h-[36px] ${
                        filterMode === 'has_pollutant'
                          ? 'bg-[#E29E2E] text-[#1C1A1F] font-bold'
                          : 'bg-[#F2ECE0] text-[#4A453E] hover:bg-[#EBE3D3]'
                      }`}
                    >
                      Has {selectedPollutant.toUpperCase()}
                    </button>
                    <button
                      onClick={() => setFilterMode('fresh_only')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer min-h-[36px] ${
                        filterMode === 'fresh_only'
                          ? 'bg-[#16A34A] text-white font-bold'
                          : 'bg-[#F2ECE0] text-[#4A453E] hover:bg-[#EBE3D3]'
                      }`}
                    >
                      Fresh Only (&lt;2h)
                    </button>
                  </div>
                ) : (
                  <div className="pt-1 border-t border-[#EBE3D3] text-[11px] text-[#6E675D] flex items-center justify-between">
                    <span>
                      Observed {selectedPollutant.toUpperCase()} rankings • Cutoff: {observedRankings?.input_cutoff_at ? formatToIST(observedRankings.input_cutoff_at) : 'Current'}
                    </span>
                    <span className="text-[#C88A2E] font-semibold text-[10px] uppercase">
                      Observed Concentration Ranking
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            {directoryTab === 'rankings' ? (
              <div className="divide-y divide-[#EBE3D3] max-h-72 overflow-y-auto">
                {isLoadingRankings ? (
                  <div className="p-4 text-center text-xs text-[#968F83]">Loading observed concentration rankings...</div>
                ) : observedRankings && observedRankings.rows.length > 0 ? (
                  observedRankings.rows.map(row => {
                    const isSelected = row.station.id === selectedStation?.id;
                    const stn = stations.find(s => s.id === row.station.id) || row.station;
                    return (
                      <div
                        key={row.rank}
                        onClick={() => {
                          onSelectStation(stn);
                          setMobileTab('map');
                        }}
                        className={`w-full p-3.5 text-left flex items-center justify-between transition-colors cursor-pointer min-h-[44px] ${
                          isSelected ? 'bg-[#FBF4E6] border-l-4 border-[#E29E2E]' : 'hover:bg-[#FAF6EE]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-[#EBE3D3] text-[#1C1A1F] font-bold text-xs flex items-center justify-center shrink-0">
                            #{row.rank}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-[#1C1A1F]">{row.station.name}</div>
                            <div className="max-w-full break-words text-xs text-[#6E675D] mt-0.5">
                              Observed {formatTimeAgo(row.measurement.measured_at)} ({formatToIST(row.measurement.measured_at)})
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-xs font-extrabold text-[#1C1A1F]">
                              {row.measurement.value.toFixed(1)} {row.measurement.unit}
                            </div>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              row.coverage_state === 'reported_complete'
                                ? 'bg-[#DCFCE7] text-[#14532D] border border-[#86EFAC]'
                                : 'bg-[#FEF3C7] text-[#78350F] border border-[#FDE68A]'
                            }`}>
                              {row.coverage_state}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-xs text-[#968F83]">
                    No reported rankings available for {selectedPollutant.toUpperCase()} in {selectedCity.name}.
                  </div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#EBE3D3] max-h-72 overflow-y-auto">
                {filteredStations.map(station => {
                  const isSelected = station.id === selectedStation?.id;
                  const isCompared = compareStationIds.includes(station.id);
                  const m = latestMap[station.id];
                  const hasMatchingMeasurement = Boolean(m && m.pollutant === selectedPollutant);
                  const stnVal = hasMatchingMeasurement && m ? m.value : null;
                  const stnSubIndex = stnVal !== null ? calculateSubIndex(selectedPollutant, stnVal) : 0;

                  return (
                    <div
                      key={station.id}
                      onClick={() => {
                        onSelectStation(station);
                        setMobileTab('map');
                      }}
                      className={`w-full p-3.5 text-left flex items-center justify-between transition-colors cursor-pointer min-h-[44px] ${
                        isSelected ? 'bg-[#FBF4E6] border-l-4 border-[#E29E2E]' : 'hover:bg-[#FAF6EE]'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-[#1C1A1F]">{station.name}</div>
                        <div className="max-w-full break-words text-xs text-[#6E675D] mt-0.5">
                          {station.source} • Lat: {station.latitude.toFixed(3)}, Lon: {station.longitude.toFixed(3)}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {hasMatchingMeasurement && m ? (
                            <>
                              <div className="text-xs font-bold text-[#1C1A1F]">
                                {m.value.toFixed(1)} {m.unit}
                              </div>
                              <div className="text-[10px] text-[#968F83]">
                                {formatTimeAgo(m.measured_at)}
                              </div>
                            </>
                          ) : (
                            <span className="text-[10px] text-[#968F83] italic">No {selectedPollutant.toUpperCase()}</span>
                          )}
                        </div>

                        {hasMatchingMeasurement && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#F2ECE0] text-[#3D3934] border border-[#DDD3BC]">
                            Idx {stnSubIndex}
                          </span>
                        )}

                        <button
                          onClick={e => handleToggleCompare(station.id, e)}
                          className={`min-h-[36px] text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                            isCompared
                              ? 'bg-[#E29E2E] text-[#1C1A1F]'
                              : 'bg-[#F2ECE0] text-[#6E675D] hover:bg-[#EBE3D3]'
                          }`}
                          title="Add to side-by-side comparison"
                        >
                          {isCompared ? '✓ Comparing' : '+ Compare'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column (3 cols on lg): Selected Station Detail & Predictive Trajectory */}
        <div className="lg:col-span-3 space-y-4">
          {selectedStation ? (
            <>
              {/* Station Detail Card matching Reference Image 2 */}
              <Card className="border-[#DDD3BC] border-t-4 border-t-[#C88A2E]">
                <CardHeader className="pb-3 bg-[#FAF6EE]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C5D14]">
                        {selectedCity.name} · {selectedStation.source}
                      </span>
                      <h2 className="text-base font-extrabold text-[#1C1A1F] mt-0.5">
                        {selectedStation.name}
                      </h2>
                    </div>

                    <div className="flex items-center gap-1">
                      <Tooltip content="Save location">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenSavePlaceModal(selectedStation)}
                          className="min-h-[36px] min-w-[36px] p-1.5 text-[#6E675D] hover:text-[#1C1A1F]"
                          aria-label="Save place"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        </Button>
                      </Tooltip>
                      <Tooltip content="Set threshold alert">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenAlertModal(selectedStation)}
                          className="min-h-[36px] min-w-[36px] p-1.5 text-[#6E675D] hover:text-[#C88A2E]"
                          aria-label="Set alert"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                        </Button>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Observed Concentration Display matching Reference Image 2 */}
                  {isLoadingLatest ? (
                    <div className="mt-3 p-4 rounded-xl bg-[#F7F3E9] border border-[#DDD3BC] text-xs text-[#6E675D] text-center animate-pulse">
                      Retrieving latest observation...
                    </div>
                  ) : measurementToDisplay ? (
                    <div className="mt-3 p-3.5 rounded-xl border border-[#DDD3BC] bg-[#FFFDF9] space-y-2.5">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#6E675D]">
                          Hourly {selectedPollutant.toUpperCase()} Concentration
                        </div>
                        <div className="flex flex-wrap items-baseline gap-2 mt-0.5">
                          <span className="text-3xl font-black text-[#1C1A1F] tracking-tight">
                            {measurementToDisplay.value.toFixed(1)}
                          </span>
                          <span className="text-xs font-semibold text-[#6E675D]">
                            {measurementToDisplay.unit}
                          </span>
                        </div>
                      </div>

                      {/* Sub-Index Badge in Terracotta/Category */}
                      <div>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#FFEDD5] text-[#C3583C] border border-[#FDBA74] inline-block">
                          Sub-Index: {subIndex} (Indicative)
                        </span>
                      </div>

                      <div className="text-xs text-[#4A453E] border-t border-[#EBE3D3] pt-2 space-y-0.5">
                        <div className="font-semibold text-[#1C1A1F]">Observed {formatTimeAgo(measurementToDisplay.measured_at)}</div>
                        <div className="text-[11px] text-[#3D3934]">IST: {formatToIST(measurementToDisplay.measured_at)}</div>
                        <div className="text-[10px] text-[#968F83] font-mono">UTC: {formatToUTC(measurementToDisplay.measured_at)}</div>
                        <div className={`text-[10px] font-semibold pt-1 ${measurementToDisplay.stale ? 'text-[#C88A2E]' : 'text-[#16A34A]'}`}>
                          {measurementToDisplay.stale ? '⚠️ Stale Reading' : '✓ Fresh Intake'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 p-4 rounded-xl bg-[#F7F3E9] border border-[#DDD3BC] text-xs text-[#6E675D] text-center">
                      No latest {selectedPollutant.toUpperCase()} observation reported for {selectedStation.name}.
                    </div>
                  )}
                </CardHeader>
              </Card>

              {/* All Criteria Pollutants for Station (Ground Sensors) */}
              <Card className="border-[#DDD3BC]" data-testid="station-pollutants-card">
                <CardHeader className="py-3 px-4 bg-[#FAF6EE] border-b border-[#DDD3BC]">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#1C1A1F]">
                      All Monitored Pollutants
                    </CardTitle>
                    <span className="text-[9px] font-mono px-2 py-0.5 bg-[#FFFDF9] text-[#1C1A1F] border border-[#DDD3BC] rounded-full font-bold">
                      Ground Sensors
                    </span>
                  </div>
                  <CardDescription className="text-[11px] text-[#6E675D]">
                    Continuous CAAQMS ground observations for {selectedStation.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3.5 space-y-3">
                  {isLoadingPollutants ? (
                    <div className="py-4 text-center text-[#968F83] text-xs animate-pulse">
                      Checking station sensors…
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'pm25', label: 'PM2.5' },
                        { key: 'pm10', label: 'PM10' },
                        { key: 'no2', label: 'NO₂' },
                        { key: 'so2', label: 'SO₂' },
                        { key: 'co', label: 'CO' },
                        { key: 'o3', label: 'O₃' }
                      ].map(({ key, label }) => {
                        const reading = stationPollutants?.[key];
                        const isAvail = reading && reading.available && reading.value !== null && reading.value !== undefined;
                        const isCurrentActive = selectedPollutant === key;

                        return (
                          <div
                            key={key}
                            onClick={() => onSelectPollutant(key as Pollutant)}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                              isCurrentActive
                                ? 'bg-[#FBF4E6] border-2 border-[#E29E2E] shadow-xs'
                                : 'bg-[#FFFDF9] border-[#DDD3BC] hover:bg-[#F2ECE0]'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-xs text-[#1C1A1F]">{label}</span>
                              <span className="text-[9px] text-[#968F83] font-mono">1-hr</span>
                            </div>

                            {isAvail ? (
                              <div className="mt-1">
                                <div className="text-sm font-extrabold text-[#1C1A1F]">
                                  {reading.value!.toFixed(1)}{' '}
                                  <span className="text-[10px] font-semibold text-[#6E675D]">{reading.unit}</span>
                                </div>
                                <div className="text-[9px] text-[#16A34A] font-semibold mt-0.5">
                                  {reading.stale ? '⚠️ Stale' : '✓ Available'}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-1">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#F2ECE0] text-[#7A7368] border border-[#DDD3BC]">
                                  Unavailable
                                </span>
                                <div className="text-[9px] text-[#968F83] mt-0.5">Sensor unverified</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Scientific Guidance: 1-hour readings vs 24-hour CPCB NAQI */}
                  <div className="p-2.5 rounded-xl bg-[#FAF6EE] border border-[#DDD3BC] text-[10px] text-[#6E675D] leading-relaxed">
                    <strong className="text-[#1C1A1F]">CPCB NAQI Guidance: </strong>
                    Official National Air Quality Index requires 24-hour averaging across at least three criteria pollutants with 16+ valid hours. Values displayed here are 1-hour indicative ground readings, not an official overall AQI.
                  </div>
                </CardContent>
              </Card>

              {/* Forecast / Replay Trajectory Card matching Reference */}
              <Card className="border-[#DDD3BC]">
                <CardHeader className="py-3 px-4 bg-[#FAF6EE] border-b border-[#DDD3BC]">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#1C1A1F]">
                    Forecast & Replay Trajectory
                  </CardTitle>
                  <CardDescription className="text-[11px] text-[#6E675D]">
                    Operational station forecast is unavailable; inspect actual held-out model predictions in Model Audit.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-3.5 space-y-3">
                  {isLoadingForecast ? (
                    <div className="py-6 text-center text-[#968F83] text-xs">
                      Checking forecast endpoint...
                    </div>
                  ) : isDemoMode && forecastData && forecastData.points ? (
                    <div className="grid grid-cols-5 gap-1.5">
                      {forecastData.points.map((pt: ForecastPoint) => (
                        <div
                          key={pt.horizon_h}
                          className="p-2 rounded-lg border border-[#DDD3BC] bg-[#F7F3E9] text-center"
                        >
                          <div className="text-[10px] font-bold text-[#6E675D]">+{pt.horizon_h}h</div>
                          <div className="text-xs font-extrabold text-[#1C1A1F] my-1">
                            {pt.predicted_concentration.toFixed(0)}
                          </div>
                          <div className="text-[8px] text-[#968F83]">µg/m³</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-[#FBF4E6] rounded-xl border border-[#E8D1A0] text-xs text-[#78350F] space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-[#8C5D14]">
                        <span>503 MODEL_UNAVAILABLE</span>
                        <span className="text-[9px] px-1.5 py-0.2 bg-[#FDE68A] text-[#78350F] rounded font-semibold">
                          Gated
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-[#4A453E]">
                        Operational forecasts require verified feature pipeline parity. For retrospective comparisons, inspect the Historical Replay Planner.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Scenario Simulator Gating Card matching Reference */}
              <Card className="border-[#DDD3BC]">
                <CardHeader className="py-3 px-4 bg-[#FAF6EE] border-b border-[#DDD3BC]">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#1C1A1F]">
                    ML Scenario Simulator
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3.5 space-y-3 text-xs text-[#6E675D]">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold text-[#1C1A1F]">
                      <span>Hypothetical Weather</span>
                      <span className="text-[#C88A2E]">Adjust Track (Gated)</span>
                    </div>
                    <div className="h-2 w-full bg-[#EBE3D3] rounded-full overflow-hidden">
                      <div className="h-full w-1/2 bg-[#E29E2E] rounded-full opacity-60" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold text-[#1C1A1F]">
                      <span>Traffic Flow Advection</span>
                      <span className="text-[#C88A2E]">Adjust Track (Gated)</span>
                    </div>
                    <div className="h-2 w-full bg-[#EBE3D3] rounded-full overflow-hidden">
                      <div className="h-full w-1/3 bg-[#E29E2E] rounded-full opacity-60" />
                    </div>
                  </div>

                  <div className="text-[10px] text-[#7A7368] italic pt-1">
                    409 SCENARIO_UNAVAILABLE: Weather simulation requires complete verified causal pipeline.
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="p-8 text-center text-[#968F83] text-xs bg-[#FFFDF9] rounded-2xl border border-[#DDD3BC]">
              Select a station on the map or directory to inspect observations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
