import React, { useState, useMemo } from 'react';
import {
  City,
  StationView,
  Measurement,
  Forecast,
  Capabilities,
  Pollutant,
  ForecastPoint,
  ApiResult
} from '../../lib/api/types';
import { calculateSubIndex, AQI_THEMES, formatToIST, formatTimeAgo } from '../../lib/aqi';
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
  const [mobileTab, setMobileTab] = useState<'map' | 'list'>('map');

  // Filter stations based on search query
  const filteredStations = useMemo(() => {
    if (!searchQuery.trim()) return stations;
    const q = searchQuery.toLowerCase();
    return stations.filter(
      s => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    );
  }, [stations, searchQuery]);

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
            />
          </div>

          {/* Station Directory */}
          <Card className={`${mobileTab === 'list' ? 'block' : 'hidden sm:block'}`}>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm">
                  Active CAAQMS Stations ({filteredStations.length})
                </CardTitle>
                <div className="relative w-48 sm:w-64">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search stations..."
                    className="w-full text-xs rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>
            </CardHeader>
            <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {filteredStations.map(station => {
                const isSelected = station.id === selectedStation?.id;
                const m = latestMap[station.id];
                const hasMatchingMeasurement = Boolean(m && m.pollutant === selectedPollutant);
                const stnVal = hasMatchingMeasurement && m ? m.value : null;
                const stnSubIndex = stnVal !== null ? calculateSubIndex(selectedPollutant, stnVal) : 0;

                return (
                  <button
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

                    <div className="flex items-center gap-2">
                      {hasMatchingMeasurement && m ? (
                        <div className="text-right">
                          <div className="text-xs font-bold text-slate-800">
                            {m.value.toFixed(1)} {m.unit}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {m.observation_age_minutes}m ago
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">No {selectedPollutant.toUpperCase()}</span>
                      )}
                      {hasMatchingMeasurement && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          Idx {stnSubIndex}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
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
