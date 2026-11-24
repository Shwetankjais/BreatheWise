import { BASEMAP_URL, BASEMAP_ATTRIBUTION } from '../../lib/basemap';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { GeometryResponse, RouteGeometry, Coordinates } from '../../lib/api/types';
import { apiClient } from '../../lib/api/client';

// Preset Corridor Coordinates across Delhi NCR
interface RoutePreset {
  id: string;
  name: string;
  originName: string;
  destName: string;
  originCoords: [number, number]; // [lat, lon]
  destCoords: [number, number];   // [lat, lon]
}

const PRESET_ROUTES: RoutePreset[] = [
  {
    id: 'cp-noida',
    name: 'Connaught Place ↔ Noida Sector 62',
    originName: 'Connaught Place, Central Delhi',
    destName: 'Noida Sector 62 / Electronic City',
    originCoords: [28.6328, 77.2197],
    destCoords: [28.6280, 77.3649]
  },
  {
    id: 'anand-vihar-igi',
    name: 'Anand Vihar ISBT ↔ IGI Airport T3',
    originName: 'Anand Vihar ISBT / Railway Station',
    destName: 'Indira Gandhi International Airport (T3)',
    originCoords: [28.6476, 77.3160],
    destCoords: [28.5562, 77.0999]
  },
  {
    id: 'rohini-nehru-place',
    name: 'Rohini Sector 16 ↔ Nehru Place',
    originName: 'Rohini Sector 16, North Delhi',
    destName: 'Nehru Place Commercial Hub, South Delhi',
    originCoords: [28.7325, 77.1235],
    destCoords: [28.5492, 77.2530]
  }
];

// Origin and Destination Pin Icons
const originIcon = L.divIcon({
  className: 'custom-station-marker',
  html: `
    <div class="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 border-2 border-white shadow-lg text-white font-bold text-xs" title="Origin">
      A
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const destIcon = L.divIcon({
  className: 'custom-station-marker',
  html: `
    <div class="flex items-center justify-center w-7 h-7 rounded-full bg-red-600 border-2 border-white shadow-lg text-white font-bold text-xs" title="Destination">
      B
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

// Map click handler component to place origin or destination pins
const MapClickHandler: React.FC<{
  settingTarget: 'origin' | 'destination' | null;
  onSetCoords: (coords: [number, number]) => void;
}> = ({ settingTarget, onSetCoords }) => {
  useMapEvents({
    click(e) {
      if (settingTarget) {
        onSetCoords([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
};

const ROUTE_COLORS = ['#0d9488', '#4f46e5', '#7c3aed', '#d97706'];

export const RouteCompareView: React.FC = () => {
  const [selectedPreset, setSelectedPreset] = useState<RoutePreset>(PRESET_ROUTES[0]);
  const [mode, setMode] = useState<'driving' | 'walking' | 'cycling'>('driving');
  const [customOrigin, setCustomOrigin] = useState<[number, number]>(PRESET_ROUTES[0].originCoords);
  const [customDest, setCustomDest] = useState<[number, number]>(PRESET_ROUTES[0].destCoords);
  const [settingTarget, setSettingTarget] = useState<'origin' | 'destination' | null>(null);

  // Live Route Geometry State (Contract 1.2.0)
  const [geometryResponse, setGeometryResponse] = useState<GeometryResponse | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [isLoadingGeometry, setIsLoadingGeometry] = useState(false);
  const [geometryError, setGeometryError] = useState<string | null>(null);
  const routeReqIdRef = useRef<number>(0);

  const handleSelectPreset = (presetId: string) => {
    const match = PRESET_ROUTES.find(p => p.id === presetId);
    if (match) {
      setSelectedPreset(match);
      setCustomOrigin(match.originCoords);
      setCustomDest(match.destCoords);
    }
  };

  // Fetch real route alternatives via POST /api/v1/routes/geometry (Contract 1.2.0, with sequence token)
  const fetchRouteGeometry = () => {
    const reqId = ++routeReqIdRef.current;
    setIsLoadingGeometry(true);
    setGeometryError(null);

    const origin: Coordinates = { latitude: customOrigin[0], longitude: customOrigin[1] };
    const destination: Coordinates = { latitude: customDest[0], longitude: customDest[1] };

    apiClient
      .getRouteGeometry(origin, destination, mode, 3)
      .then(res => {
        if (reqId !== routeReqIdRef.current) return;
        setIsLoadingGeometry(false);
        if (res.ok) {
          setGeometryResponse(res.data);
          if (res.data.routes.length > 0) {
            setSelectedRouteId(res.data.routes[0].id);
          }
        } else {
          setGeometryResponse(null);
          setGeometryError(`${res.error.code}: ${res.error.message}`);
        }
      });
  };

  useEffect(() => {
    fetchRouteGeometry();
  }, [customOrigin, customDest, mode]);

  const activeRoute = useMemo(() => {
    if (!geometryResponse || geometryResponse.routes.length === 0) return null;
    return geometryResponse.routes.find(r => r.id === selectedRouteId) || geometryResponse.routes[0];
  }, [geometryResponse, selectedRouteId]);

  return (
    <div className="space-y-6">
      {/* Overview & Disclaimer */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
              <h2 className="text-lg font-bold text-slate-900">
                Route Geometry & Navigation Corridor Workspace
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
              Inspect OSRM-generated road network paths, distance in metres, and duration estimates across Delhi NCR routes.
            </p>
          </div>

          <div className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
            Geometry Active • Exposure Gated (409)
          </div>
        </div>

        {/* Explicit Separation & Capability Notice */}
        <div className="p-3.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-950 space-y-1.5 leading-relaxed">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-900">ROUTE_COMPARISON_UNAVAILABLE Notice:</span>
            <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-amber-200 text-amber-900">
              409 Contract Gate
            </span>
          </div>
          <p>
            Route geometry and provider-estimated travel times are functional via the OSRM road network. However, path-integrated pollution exposure comparison (<code className="font-mono">/routes/compare</code>) remains gated and unavailable pending validated micro-dispersion and street-canyon models. BreatheWise does not invent cleaner-route percentages, live traffic sensor feeds, or synthetic air quality gradients along road lines.
          </p>
        </div>

        {/* Inputs Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Preset Corridor Route</label>
            <select
              value={selectedPreset.id}
              onChange={e => handleSelectPreset(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              {PRESET_ROUTES.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Select
              label="Travel Mode"
              options={[
                { value: 'driving', label: 'Driving (Motor Vehicle / Cab) — Supported' },
                { value: 'walking', label: 'Walking (Pedestrian Path) — Unsupported', disabled: true },
                { value: 'cycling', label: 'Cycling (Bicycle) — Unsupported', disabled: true }
              ]}
              value={mode}
              onChange={e => setMode(e.target.value as any)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Map Click Placement</label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setSettingTarget(settingTarget === 'origin' ? null : 'origin')}
                className={`py-2 px-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer text-center ${
                  settingTarget === 'origin'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {settingTarget === 'origin' ? 'Click Map for Pin A' : 'Set Pin A (Origin)'}
              </button>
              <button
                onClick={() => setSettingTarget(settingTarget === 'destination' ? null : 'destination')}
                className={`py-2 px-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer text-center ${
                  settingTarget === 'destination'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {settingTarget === 'destination' ? 'Click Map for Pin B' : 'Set Pin B (Dest)'}
              </button>
            </div>
          </div>
        </div>

        {/* Coordinate Input Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-bold text-emerald-800 text-[11px] whitespace-nowrap">Pin A (Origin):</span>
            <div className="flex items-center gap-1.5 w-full">
              <input
                type="number"
                step="0.0001"
                value={customOrigin[0]}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) setCustomOrigin([val, customOrigin[1]]);
                }}
                className="w-1/2 p-1.5 border border-slate-300 rounded font-mono text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                placeholder="Latitude"
                aria-label="Origin Latitude"
              />
              <input
                type="number"
                step="0.0001"
                value={customOrigin[1]}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) setCustomOrigin([customOrigin[0], val]);
                }}
                className="w-1/2 p-1.5 border border-slate-300 rounded font-mono text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                placeholder="Longitude"
                aria-label="Origin Longitude"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-bold text-red-800 text-[11px] whitespace-nowrap">Pin B (Dest):</span>
            <div className="flex items-center gap-1.5 w-full">
              <input
                type="number"
                step="0.0001"
                value={customDest[0]}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) setCustomDest([val, customDest[1]]);
                }}
                className="w-1/2 p-1.5 border border-slate-300 rounded font-mono text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                placeholder="Latitude"
                aria-label="Destination Latitude"
              />
              <input
                type="number"
                step="0.0001"
                value={customDest[1]}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) setCustomDest([customDest[0], val]);
                }}
                className="w-1/2 p-1.5 border border-slate-300 rounded font-mono text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                placeholder="Longitude"
                aria-label="Destination Longitude"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Route Map, Right Selectable Corridors */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left (7 cols): React Leaflet Route Map */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative w-full h-[420px] sm:h-[480px] rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900">
            <MapContainer
              center={customOrigin}
              zoom={12}
              scrollWheelZoom={false}
              className="w-full h-full"
            >
              <TileLayer
                attribution={BASEMAP_ATTRIBUTION}
                url={BASEMAP_URL}
                
                maxZoom={19}
              />

              <MapClickHandler
                settingTarget={settingTarget}
                onSetCoords={coords => {
                  if (settingTarget === 'origin') setCustomOrigin(coords);
                  if (settingTarget === 'destination') setCustomDest(coords);
                  setSettingTarget(null);
                }}
              />

              {/* Origin Marker */}
              <Marker position={customOrigin} icon={originIcon}>
                <Popup>
                  <div className="p-1 text-xs">
                    <span className="font-bold text-emerald-800">Origin Point (A)</span>
                    <p className="text-[11px] text-slate-600 mt-0.5">{selectedPreset.originName}</p>
                    <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                      {customOrigin[0].toFixed(4)}° N, {customOrigin[1].toFixed(4)}° E
                    </p>
                  </div>
                </Popup>
              </Marker>

              {/* Destination Marker */}
              <Marker position={customDest} icon={destIcon}>
                <Popup>
                  <div className="p-1 text-xs">
                    <span className="font-bold text-red-800">Destination Point (B)</span>
                    <p className="text-[11px] text-slate-600 mt-0.5">{selectedPreset.destName}</p>
                    <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                      {customDest[0].toFixed(4)}° N, {customDest[1].toFixed(4)}° E
                    </p>
                  </div>
                </Popup>
              </Marker>

              {/* Alternative Route Corridor Polylines from OSRM LineStrings (Contract 1.2.0) */}
              {geometryResponse?.routes.map((route: RouteGeometry, idx: number) => {
                const isSelected = route.id === selectedRouteId;
                const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
                // Convert GeoJSON [lon, lat] coordinates to Leaflet [lat, lon]
                const positions = route.geometry.coordinates.map(pt => [pt[1], pt[0]] as [number, number]);

                return (
                  <Polyline
                    key={route.id}
                    positions={positions}
                    pathOptions={{
                      color,
                      weight: isSelected ? 5 : 3,
                      opacity: isSelected ? 0.95 : 0.45
                    }}
                    eventHandlers={{
                      click: () => setSelectedRouteId(route.id)
                    }}
                  />
                );
              })}
            </MapContainer>

            {/* Map Legend & Active Route Bar */}
            {activeRoute && (
              <div className="absolute bottom-3 left-3 z-20 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200 text-xs shadow-md flex items-center gap-3">
                <span className="font-bold text-slate-800">Active Corridor:</span>
                <span className="font-semibold text-teal-800">{activeRoute.id}</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-600">{(activeRoute.distance_m / 1000).toFixed(1)} km</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-600">{Math.round(activeRoute.estimated_duration_s / 60)} mins</span>
              </div>
            )}
          </div>

          {/* Attribution & Method Footnote */}
          {geometryResponse && (
            <div className="text-[11px] text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
              <span>{geometryResponse.attribution}</span>
              <span className="italic">{geometryResponse.duration_method}</span>
            </div>
          )}
        </div>

        {/* Right (5 cols): Selectable Alternative Route Cards */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
            <span>Alternative Corridors ({geometryResponse?.routes.length ?? 0})</span>
            {geometryResponse?.cached && (
              <span className="text-[10px] font-mono text-slate-400">Cached Result</span>
            )}
          </div>

          {isLoadingGeometry ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
              Computing road network alternatives via routing engine...
            </div>
          ) : geometryError ? (
            <div className="p-4 text-center text-xs text-amber-900 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
              <div className="font-bold">Routing Notice / Engine Response</div>
              <p>{geometryError}</p>
              <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                <button
                  onClick={fetchRouteGeometry}
                  className="px-3 py-1 bg-teal-600 text-white rounded text-xs font-semibold hover:bg-teal-700 cursor-pointer transition-colors"
                >
                  Retry Route Query
                </button>
                <button
                  onClick={() => {
                    handleSelectPreset(PRESET_ROUTES[0].id);
                    setMode('driving');
                  }}
                  className="px-3 py-1 bg-slate-200 text-slate-800 rounded text-xs font-semibold hover:bg-slate-300 cursor-pointer transition-colors"
                >
                  Reset to Delhi Preset
                </button>
              </div>
            </div>
          ) : geometryResponse?.routes && geometryResponse.routes.length > 0 ? (
            geometryResponse.routes.map((route: RouteGeometry, idx: number) => {
              const isSelected = route.id === selectedRouteId;
              const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
              const distanceKm = (route.distance_m / 1000).toFixed(1);
              const durationMins = Math.round(route.estimated_duration_s / 60);

              return (
                <Card
                  key={route.id}
                  onClick={() => setSelectedRouteId(route.id)}
                  className={`transition-all cursor-pointer border-2 ${
                    isSelected
                      ? 'border-teal-600 bg-teal-50/10 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                        <CardTitle className="text-sm font-bold">
                          Alternative {idx + 1} ({route.id})
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          Exposure Unavailable
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800 uppercase">
                            Selected
                          </span>
                        )}
                      </div>
                    </div>
                    <CardDescription className="text-xs mt-1">
                      Provider road-network corridor connecting Point A to Point B
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-1">
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-slate-400">Distance: </span>
                        <strong className="text-slate-800">{distanceKm} km</strong>
                        <span className="text-[10px] text-slate-400 font-mono ml-1">({route.distance_m}m)</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Est. Time ({mode}): </span>
                        <strong className="text-slate-800">{durationMins} mins</strong>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
              No routes returned for selected origin and destination coordinates.
            </div>
          )}

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
            <strong>Exposure Comparison Note: </strong>
            Quantitative dose integration and comparative air quality scores remain disabled per capability contracts. Lines reflect physical road geometry from OSRM.
          </div>
        </div>
      </div>
    </div>
  );
};
