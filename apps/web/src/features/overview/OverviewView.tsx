import React, { useState, useMemo, useEffect } from 'react';
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
  CatalogueStation
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
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  selectedCity,
  stations,
  selectedStation,
  onSelectStation,
  latestMap,
  currentMeasurement,
  forecastResult,
  capabilities,
  isDemoMode,
  isLoadingForecast,
  isLoadingLatest,
  selectedPollutant,
  onSelectPollutant,
  onOpenSavePlaceModal,
  onOpenAlertModal
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'has_pollutant' | 'fresh_only'>('all');
  const [mobileTab, setMobileTab] = useState<'map' | 'list'>('map');
  const [compareStationIds, setCompareStationIds] = useState<string[]>([]);
  const [directoryTab, setDirectoryTab] = useState<'directory' | 'rankings'>('directory');
  const [observedRankings, setObservedRankings] = useState<ObservedRankings | null>(null);
  const [isLoadingRankings, setIsLoadingRankings] = useState(false);
  const [stationCatalogue, setStationCatalogue] = useState<StationCatalogue | null>(null);

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

  const catalogueStation = useMemo(() => {
    if (!selectedStation || !stationCatalogue) return null;
    return stationCatalogue.stations.find(s => s.id === selectedStation.id) || null;
  }, [selectedStation, stationCatalogue]);

  // Filter stations based on search query and active filter mode
  const filteredStations = useMemo(() => {
    return stations.filter(station => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery = station.name.toLowerCase().includes(q) || station.id.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }

      // Filter mode
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
      {/* Parameter Selection Ribbon */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <span>Observed Parameter:</span>
            <span className="text-teal-700 font-extrabold uppercase">{selectedPollutant}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Select a pollutant to query latest station observations and forecast horizons.
          </p>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['pm25', 'pm10', 'no2', 'so2', 'o3', 'co'] as Pollutant[]).map(p => (
            <button
              key={p}
              onClick={() => onSelectPollutant(p)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0 ${
                selectedPollutant === p
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {p === 'pm25' ? 'PM2.5' : p === 'pm10' ? 'PM10' : p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Tab Switcher */}
      <div className="sm:hidden flex rounded-lg bg-slate-200/80 p-1">
        <button
          onClick={() => setMobileTab('map')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            mobileTab === 'map' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
          }`}
        >
          Geospatial Map
        </button>
        <button
          onClick={() => setMobileTab('list')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            mobileTab === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
          }`}
        >
          Station Directory ({stations.length})
        </button>
      </div>

      {/* Multi-Station Side-by-Side Comparison Drawer (When 2+ stations selected) */}
      {comparedStations.length > 0 && (
        <Card className="border-2 border-teal-600/40 bg-teal-50/20">
          <CardHeader className="py-3 px-4 bg-white/80 border-b border-teal-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Side-by-Side Station Comparison ({comparedStations.length} / 3 selected)
              </CardTitle>
              <CardDescription className="text-xs">
                Comparing current observed {selectedPollutant.toUpperCase()} telemetry across selected monitoring sites
              </CardDescription>
            </div>
            <button
              onClick={() => setCompareStationIds([])}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold underline cursor-pointer"
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
                  <div key={stn.id} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                          {stn.source}
                        </span>
                        <h4 className="font-bold text-xs text-slate-900 mt-1">{stn.name}</h4>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {stn.latitude.toFixed(3)}° N, {stn.longitude.toFixed(3)}° E
                        </div>
                      </div>
                      <button
                        onClick={e => handleToggleCompare(stn.id, e)}
                        className="text-slate-400 hover:text-red-500 text-xs p-1 cursor-pointer"
                        title="Remove from comparison"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-[10px] font-semibold text-slate-500 uppercase">
                        Hourly {selectedPollutant.toUpperCase()}
                      </div>
                      {val !== null && m ? (
                        <>
                          <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                            {val.toFixed(1)} <span className="text-xs font-semibold text-slate-600">{m.unit}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Observed {formatTimeAgo(m.measured_at)} ({formatToIST(m.measured_at)})
                          </div>
                          <div className={`text-[10px] font-semibold mt-0.5 ${m.stale ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {m.stale ? '⚠️ Stale Reading' : '✓ Fresh Reading'}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-slate-400 italic mt-1">
                          No {selectedPollutant.toUpperCase()} data
                        </div>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectStation(stn)}
                      className="w-full text-xs"
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

      {/* Main Grid: Left Map/List, Right Detail & Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Map and Station List */}
        <div className="lg:col-span-7 space-y-4">
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

          {/* Station Directory & Observed Rankings */}
          <Card className={`${mobileTab === 'list' ? 'block' : 'hidden sm:block'}`}>
            <CardHeader className="py-3 px-4">
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDirectoryTab('directory')}
                      className={`text-sm font-bold pb-0.5 border-b-2 transition-colors cursor-pointer ${
                        directoryTab === 'directory'
                          ? 'border-teal-600 text-slate-900'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Active CAAQMS Stations ({filteredStations.length} / {stations.length})
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => setDirectoryTab('rankings')}
                      className={`text-sm font-bold pb-0.5 border-b-2 transition-colors cursor-pointer ${
                        directoryTab === 'rankings'
                          ? 'border-teal-600 text-slate-900'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
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
                        placeholder="Search by station name..."
                        className="w-full text-xs rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                  )}
                </div>

                {directoryTab === 'directory' ? (
                  /* Filter Pills */
                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 text-xs">
                    <span className="text-[11px] text-slate-500 font-semibold mr-1">Filter:</span>
                    <button
                      onClick={() => setFilterMode('all')}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                        filterMode === 'all'
                          ? 'bg-slate-800 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      All Stations
                    </button>
                    <button
                      onClick={() => setFilterMode('has_pollutant')}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                        filterMode === 'has_pollutant'
                          ? 'bg-teal-700 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Has {selectedPollutant.toUpperCase()}
                    </button>
                    <button
                      onClick={() => setFilterMode('fresh_only')}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                        filterMode === 'fresh_only'
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Fresh Only (&lt;2h)
                    </button>
                  </div>
                ) : (
                  <div className="pt-1 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>
                      Observed {selectedPollutant.toUpperCase()} rankings • Cutoff: {observedRankings?.input_cutoff_at ? formatToIST(observedRankings.input_cutoff_at) : 'Current'}
                    </span>
                    <span className="text-teal-700 font-semibold text-[10px] uppercase">
                      Observed Concentration Ranking
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            {directoryTab === 'rankings' ? (
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {isLoadingRankings ? (
                  <div className="p-4 text-center text-xs text-slate-400">Loading observed concentration rankings...</div>
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
                        className={`w-full p-3 text-left flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected ? 'bg-teal-50/70 border-l-4 border-teal-600' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                            #{row.rank}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-slate-900">{row.station.name}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Observed {formatTimeAgo(row.measurement.measured_at)} ({formatToIST(row.measurement.measured_at)})
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-xs font-extrabold text-slate-900">
                              {row.measurement.value.toFixed(1)} {row.measurement.unit}
                            </div>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                              row.coverage_state === 'reported_complete'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {row.coverage_state}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No reported rankings available for {selectedPollutant.toUpperCase()} in {selectedCity.name}.
                  </div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
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
                      className={`w-full p-3 text-left flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected ? 'bg-teal-50/70 border-l-4 border-teal-600' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900">{station.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {station.source} • Lat: {station.latitude.toFixed(3)}, Lon: {station.longitude.toFixed(3)}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {hasMatchingMeasurement && m ? (
                            <>
                              <div className="text-xs font-bold text-slate-800">
                                {m.value.toFixed(1)} {m.unit}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {m.observation_age_minutes}m ago
                              </div>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No {selectedPollutant.toUpperCase()}</span>
                          )}
                        </div>

                        {hasMatchingMeasurement && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            Idx {stnSubIndex}
                          </span>
                        )}

                        <button
                          onClick={e => handleToggleCompare(station.id, e)}
                          className={`text-[10px] font-bold px-2 py-1 rounded transition-colors cursor-pointer ${
                            isCompared
                              ? 'bg-teal-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
            <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed">
              <strong>Ranking Distinction Notice: </strong>
              {directoryTab === 'rankings'
                ? 'Observed rankings sort monitors strictly by latest reported concentration. These are NOT predicted hotspots, forecasts, area-wide concentration or a common-time city average.'
                : 'Station directory sorts and filters monitors by actual observational intake. Emerging hotspot ranking requires verified operational multi-horizon inference (currently gated).'}
            </div>
          </Card>
        </div>

        {/* Right Column (5 cols): Selected Station Detail & Forecast */}
        <div className="lg:col-span-5 space-y-5">
          {selectedStation ? (
            <>
              {/* Station Detail Card */}
              <Card className="border-t-4 border-teal-600">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        {selectedCity.name.toUpperCase()} • {selectedStation.source}
                      </span>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                        {selectedStation.name}
                      </h2>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Coordinates: {selectedStation.latitude.toFixed(4)}° N, {selectedStation.longitude.toFixed(4)}° E
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Tooltip content="Save this location to your account">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenSavePlaceModal(selectedStation)}
                          className="h-8 px-2 text-slate-600 hover:text-teal-700"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        </Button>
                      </Tooltip>

                      <Tooltip content="Configure threshold alert rule">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenAlertModal(selectedStation)}
                          className="h-8 px-2 text-slate-600 hover:text-amber-700"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                        </Button>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Observed Concentration Display */}
                  {isLoadingLatest ? (
                    <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center animate-pulse">
                      Retrieving latest {selectedPollutant.toUpperCase()} observation...
                    </div>
                  ) : measurementToDisplay ? (
                    <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
                          Reported Hourly {selectedPollutant.toUpperCase()} Concentration
                        </div>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                            {measurementToDisplay.value.toFixed(1)}
                          </span>
                          <span className="text-sm font-semibold text-slate-600">
                            {measurementToDisplay.unit}
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 border border-slate-300">
                            Indicative Sub-Index: {subIndex}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          Averaging: 1-Hour reported sample ({measurementToDisplay.original_value} {measurementToDisplay.original_unit})
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-slate-500">
                        <div className="font-semibold text-slate-700">Observed {formatTimeAgo(measurementToDisplay.measured_at)}</div>
                        <div>{formatToIST(measurementToDisplay.measured_at)}</div>
                        <div className="text-[10px] text-slate-600 mt-0.5">Source: {measurementToDisplay.source}</div>
                        <div className={`text-[10px] font-semibold mt-0.5 ${measurementToDisplay.stale ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {measurementToDisplay.stale ? '⚠️ Stale Reading' : 'Fresh Intake'}
                          {measurementToDisplay.quality_flags.length > 0 && ` • [${measurementToDisplay.quality_flags.join(', ')}]`}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                      No latest {selectedPollutant.toUpperCase()} observation reported for {selectedStation.name} in current telemetry.
                    </div>
                  )}

                  {/* Single-Pollutant Sub-Index Clarification */}
                  <div className="mt-3 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                    <span className="font-bold">Standard Notice: </span>
                    Reported hourly sub-index ({subIndex}) evaluates single-pollutant 1-hour concentration against CPCB NAQI breakpoint tables. Official CPCB AQI requires defined averaging (24-hour for PM2.5, PM10, NO2, SO2, NH3, Pb; 8-hour for CO and O3; 1-hour for O3 peak) with at least three monitored pollutants including one particulate parameter, plus data sufficiency thresholds (at least 16 hours of 24h period). Single-hour categories are indicative only and do not constitute an official CPCB AQI.
                  </div>

                  {/* Verified Station Catalogue Sensor Availability Breakdown (Contract 1.2.0) */}
                  {catalogueStation && (
                    <div className="mt-3 p-3 rounded-lg border border-slate-200 bg-white space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-800">Verified Station Catalogue Sensor Intake</span>
                        <span className="text-slate-500 font-mono text-[10px]">
                          Cutoff: {stationCatalogue?.input_cutoff_at ? formatToIST(stationCatalogue.input_cutoff_at) : 'Current'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {catalogueStation.pollutants.map(p => (
                          <span
                            key={p.pollutant}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded border flex items-center gap-1 ${
                              p.status === 'available'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            <span>{p.pollutant.toUpperCase()}</span>
                            <span className="text-[9px] opacity-75">[{p.coverage_state}]</span>
                          </span>
                        ))}
                      </div>
                      {catalogueStation.provider_revision_pending && (
                        <div className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                          ⚠️ Provider revision pending for recent sensor readings.
                        </div>
                      )}
                    </div>
                  )}
                </CardHeader>
              </Card>

              {/* Multi-Horizon ML Forecast Trajectory Panel */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold">
                        Multi-Horizon Forecast Trajectory
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Declared horizons: [+1h, +3h, +6h, +12h, +24h]
                      </CardDescription>
                    </div>

                    <div className="text-right text-[11px] text-slate-400">
                      <div>Target: <span className="font-semibold text-slate-700">{selectedPollutant.toUpperCase()}</span></div>
                      <div>Transform: <span className="font-mono text-[10px]">log1p / expm1</span></div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {isLoadingForecast ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      Checking forecast endpoint for {selectedPollutant.toUpperCase()}...
                    </div>
                  ) : isDemoMode && forecastData && forecastData.points ? (
                    <>
                      {/* Discrete Forecast Horizons Steps in Demo Mode */}
                      <div className="grid grid-cols-5 gap-2">
                        {forecastData.points.map((pt: ForecastPoint) => {
                          const ptSubIndex = calculateSubIndex(selectedPollutant, pt.predicted_concentration);

                          return (
                            <div
                              key={pt.horizon_h}
                              className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-center flex flex-col justify-between"
                            >
                              <div className="text-[11px] font-bold text-slate-500">
                                +{pt.horizon_h}h
                              </div>
                              <div className="my-1.5">
                                <div className="text-sm sm:text-base font-extrabold text-slate-900">
                                  {pt.predicted_concentration.toFixed(1)}
                                </div>
                                <div className="text-[10px] text-slate-500">µg/m³</div>
                              </div>
                              <div className="text-[10px] font-semibold px-1 py-0.5 rounded bg-slate-200 text-slate-700 truncate">
                                Idx: {ptSubIndex}
                              </div>
                              <div className="text-[9px] text-slate-400 mt-1">
                                {new Date(pt.valid_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                        <span className="font-bold">Demo Fixture Disclosure: </span>
                        Synthetic demonstration points at declared horizons [1, 3, 6, 12, 24h]. Operational model inference is not evaluated.
                      </div>
                    </>
                  ) : (
                    /* Live Mode: Truthfully report 503 MODEL_UNAVAILABLE */
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-950 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-900">503 MODEL_UNAVAILABLE</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                          Inference Gated
                        </span>
                      </div>
                      <p className="leading-relaxed">
                        Preprocessing and golden predictions are not verified. Machine learning predictions are not currently generated on live observation feeds.
                      </p>
                      <div className="text-[11px] text-slate-600 pt-1 border-t border-amber-200">
                        Prerequisites: teammate HyperlocalAQPipeline class source & golden parity test.
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
              Select a monitoring station on the map or directory to inspect observations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
