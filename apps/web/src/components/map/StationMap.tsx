import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { StationView, Measurement, Pollutant } from '../../lib/api/types';
import { calculateSubIndex, getAQICategory, AQI_THEMES, formatToIST, formatTimeAgo } from '../../lib/aqi';
import { escapeHtmlAttr } from '../../lib/sanitize';

export { escapeHtmlAttr };

// CPCB Breakpoint Bands for Documented Concentration Legends
const BREAKPOINT_LEGENDS: Record<Pollutant, { label: string; bands: { range: string; color: string; desc: string }[] }> = {
  pm25: {
    label: 'PM2.5 (µg/m³)',
    bands: [
      { range: '0–30', color: '#16a34a', desc: 'Good' },
      { range: '31–60', color: '#65a30d', desc: 'Satisfactory' },
      { range: '61–90', color: '#d97706', desc: 'Moderate' },
      { range: '91–120', color: '#ea580c', desc: 'Poor' },
      { range: '121–250', color: '#dc2626', desc: 'Very Poor' },
      { range: '>250', color: '#7c3aed', desc: 'Severe' }
    ]
  },
  pm10: {
    label: 'PM10 (µg/m³)',
    bands: [
      { range: '0–50', color: '#16a34a', desc: 'Good' },
      { range: '51–100', color: '#65a30d', desc: 'Satisfactory' },
      { range: '101–250', color: '#d97706', desc: 'Moderate' },
      { range: '251–350', color: '#ea580c', desc: 'Poor' },
      { range: '351–430', color: '#dc2626', desc: 'Very Poor' },
      { range: '>430', color: '#7c3aed', desc: 'Severe' }
    ]
  },
  no2: {
    label: 'NO2 (µg/m³)',
    bands: [
      { range: '0–40', color: '#16a34a', desc: 'Good' },
      { range: '41–80', color: '#65a30d', desc: 'Satisfactory' },
      { range: '81–180', color: '#d97706', desc: 'Moderate' },
      { range: '181–280', color: '#ea580c', desc: 'Poor' },
      { range: '281–400', color: '#dc2626', desc: 'Very Poor' },
      { range: '>400', color: '#7c3aed', desc: 'Severe' }
    ]
  },
  so2: {
    label: 'SO2 (µg/m³)',
    bands: [
      { range: '0–40', color: '#16a34a', desc: 'Good' },
      { range: '41–80', color: '#65a30d', desc: 'Satisfactory' },
      { range: '81–380', color: '#d97706', desc: 'Moderate' },
      { range: '381–800', color: '#ea580c', desc: 'Poor' },
      { range: '801–1600', color: '#dc2626', desc: 'Very Poor' },
      { range: '>1600', color: '#7c3aed', desc: 'Severe' }
    ]
  },
  co: {
    label: 'CO (µg/m³)',
    bands: [
      { range: '0–1000', color: '#16a34a', desc: 'Good' },
      { range: '1001–2000', color: '#65a30d', desc: 'Satisfactory' },
      { range: '2001–10000', color: '#d97706', desc: 'Moderate' },
      { range: '10001–17000', color: '#ea580c', desc: 'Poor' },
      { range: '17001–34000', color: '#dc2626', desc: 'Very Poor' },
      { range: '>34000', color: '#7c3aed', desc: 'Severe' }
    ]
  },
  o3: {
    label: 'O3 (µg/m³)',
    bands: [
      { range: '0–50', color: '#16a34a', desc: 'Good' },
      { range: '51–100', color: '#65a30d', desc: 'Satisfactory' },
      { range: '101–168', color: '#d97706', desc: 'Moderate' },
      { range: '169–208', color: '#ea580c', desc: 'Poor' },
      { range: '209–748', color: '#dc2626', desc: 'Very Poor' },
      { range: '>748', color: '#7c3aed', desc: 'Severe' }
    ]
  }
};

// Map Camera Controller for Gentle Auto-Fit and Station Focus
const MapCameraController: React.FC<{
  stations: StationView[];
  selectedStationId: string | null;
  centerLat: number;
  centerLon: number;
}> = ({ stations, selectedStationId, centerLat, centerLon }) => {
  const map = useMap();
  const prevSelectedId = useRef<string | null>(null);

  // Fit bounds when station collection changes
  useEffect(() => {
    const isReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (stations.length === 0) {
      map.setView([centerLat, centerLon], 11, { animate: !isReducedMotion });
      return;
    }

    if (stations.length === 1) {
      map.setView([stations[0].latitude, stations[0].longitude], 13, { animate: !isReducedMotion });
      return;
    }

    const bounds = L.latLngBounds(stations.map(s => [s.latitude, s.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: !isReducedMotion });
  }, [stations, centerLat, centerLon, map]);

  // Gentle center on selected station when selection changes
  useEffect(() => {
    if (!selectedStationId || selectedStationId === prevSelectedId.current) return;
    prevSelectedId.current = selectedStationId;
    const target = stations.find(s => s.id === selectedStationId);
    if (target) {
      const isReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      map.setView([target.latitude, target.longitude], Math.max(map.getZoom(), 13), { animate: !isReducedMotion });
    }
  }, [selectedStationId, stations, map]);

  return null;
};


// Map Reset Bounds Control Component: Attached directly to the visible MapContainer
export const ResetBoundsControl: React.FC<{ stations: StationView[]; centerLat: number; centerLon: number }> = ({
  stations,
  centerLat,
  centerLon
}) => {
  const map = useMap();

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    const isReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (stations.length > 1) {
      const bounds = L.latLngBounds(stations.map(s => [s.latitude, s.longitude]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: !isReducedMotion });
    } else if (stations.length === 1) {
      map.setView([stations[0].latitude, stations[0].longitude], 13, { animate: !isReducedMotion });
    } else {
      map.setView([centerLat, centerLon], 11, { animate: !isReducedMotion });
    }
  };

  return (
    <div className="leaflet-bottom leaflet-left" style={{ pointerEvents: 'auto', marginBottom: '28px', marginLeft: '12px', zIndex: 1000 }}>
      <div className="leaflet-control">
        <button
          onClick={handleReset}
          className="w-8 h-8 rounded-lg bg-white/95 backdrop-blur-md border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center justify-center text-xs shadow-md cursor-pointer transition-colors"
          title="Reset view to fit all stations"
          aria-label="Reset map bounds"
        >
          ↺
        </button>
      </div>
    </div>
  );
};

interface StationMapProps {
  stations: StationView[];
  latestMap: Record<string, Measurement | null>;
  selectedStationId: string | null;
  onSelectStation: (station: StationView) => void;
  centerLat: number;
  centerLon: number;
  cityName: string;
  selectedPollutant?: Pollutant;
}

export const StationMap: React.FC<StationMapProps> = ({
  stations,
  latestMap,
  selectedStationId,
  onSelectStation,
  centerLat,
  centerLon,
  cityName,
  selectedPollutant = 'pm25'
}) => {
  const [isLegendExpanded, setIsLegendExpanded] = useState(false);

  // Generate accessible custom divIcon for each station marker
  const markerIcons = useMemo(() => {
    const icons: Record<string, L.DivIcon> = {};

    stations.forEach(station => {
      const isSelected = station.id === selectedStationId;
      const measurement = latestMap[station.id];
      const hasValue = measurement && measurement.pollutant === selectedPollutant && measurement.value !== null;
      const val = hasValue ? measurement.value : null;
      const isStale = Boolean(measurement?.stale);

      const subIndex = val !== null ? calculateSubIndex(selectedPollutant, val) : 0;
      const cat = val !== null ? getAQICategory(subIndex) : 'Moderate';
      const theme = AQI_THEMES[cat];

      const bgColor = val !== null ? theme.accent : '#64748b';
      const labelText = val !== null ? (val >= 100 ? Math.round(val).toString() : val.toFixed(1)) : '—';
      const staleBadge = isStale
        ? '<span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-900" title="Stale reading"></span>'
        : '';

      const borderClass = isSelected
        ? 'ring-4 ring-teal-500 ring-offset-2 ring-offset-white border-2 border-white'
        : isStale
        ? 'border-2 border-dashed border-amber-300'
        : 'border-2 border-white';

      const escapedName = escapeHtmlAttr(station.name);
      const escapedValText = val !== null ? `${val} µg/m³` : 'No data';
      const escapedLabel = escapeHtmlAttr(labelText);

      icons[station.id] = L.divIcon({
        className: 'custom-station-marker',
        html: `
          <div class="relative flex items-center justify-center w-8 h-8 rounded-full shadow-md text-white font-extrabold text-[10px] cursor-pointer transition-transform hover:scale-110 ${borderClass}" style="background-color: ${bgColor};" role="button" aria-label="${escapedName}: ${escapedValText}">
            <span>${escapedLabel}</span>
            ${staleBadge}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18]
      });
    });

    return icons;
  }, [stations, latestMap, selectedStationId, selectedPollutant]);

  const legend = BREAKPOINT_LEGENDS[selectedPollutant] || BREAKPOINT_LEGENDS.pm25;

  return (
    <div className="relative w-full h-[450px] sm:h-[550px] rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900">
      {/* Map Header Status Overlay */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-900 flex items-center gap-2 shadow-md pointer-events-auto">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-600 animate-pulse-subtle" />
          <span className="font-bold truncate max-w-[200px] sm:max-w-xs">
            {selectedStationId ? (stations.find(s => s.id === selectedStationId)?.name || `${cityName} Grid`) : `${cityName} Grid`}
          </span>
          <span className="text-slate-500">({stations.length} stations)</span>
        </div>

        <div className="bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] text-slate-600 shadow-xs hidden md:block pointer-events-auto">
          Parameter: <span className="font-bold uppercase text-teal-700">{selectedPollutant}</span> • Verified Station Coordinates
        </div>
      </div>

      {/* Real Geographic Map */}
      <MapContainer
        center={[centerLat, centerLon]}
        zoom={11}
        scrollWheelZoom={false}
        className="w-full h-full"
        zoomControl={true}
      >
        {/* CartoDB Positron Geographic Tiles with OpenStreetMap Attribution */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />

        {/* Dynamic Fit-Bounds and Selection Camera Controller */}
        <MapCameraController
          stations={stations}
          selectedStationId={selectedStationId}
          centerLat={centerLat}
          centerLon={centerLon}
        />

        {/* Map Control: Reset Bounds Button attached to actual visible map */}
        <ResetBoundsControl
          stations={stations}
          centerLat={centerLat}
          centerLon={centerLon}
        />

        {/* Geographic Station Markers */}
        {stations.map(station => {
          const measurement = latestMap[station.id];
          const hasValue = measurement && measurement.pollutant === selectedPollutant && measurement.value !== null;
          const val = hasValue ? measurement.value : null;
          const isStale = Boolean(measurement?.stale);
          const icon = markerIcons[station.id];

          return (
            <Marker
              key={station.id}
              position={[station.latitude, station.longitude]}
              icon={icon}
              eventHandlers={{
                click: () => onSelectStation(station)
              }}
            >
              <Popup className="station-leaflet-popup">
                <div className="p-1 space-y-2 text-xs min-w-[210px]">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                      {station.source}
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 mt-1">{station.name}</h3>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {station.latitude.toFixed(4)}° N, {station.longitude.toFixed(4)}° E
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Reported {selectedPollutant.toUpperCase()} Concentration
                    </div>
                    {val !== null && measurement ? (
                      <>
                        <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                          {val.toFixed(1)} <span className="text-xs font-semibold text-slate-600">{measurement.unit || 'µg/m³'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Observed {formatTimeAgo(measurement.measured_at)} ({formatToIST(measurement.measured_at)})
                        </div>
                        <div className={`text-[10px] font-semibold mt-1 ${isStale ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {isStale ? '⚠️ Stale Reading (> 2 hours)' : '✓ Fresh Intake'}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-slate-400 italic mt-1">
                        No {selectedPollutant.toUpperCase()} observation reported
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => onSelectStation(station)}
                    className="w-full py-1 px-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-bold transition-colors cursor-pointer text-center"
                  >
                    Select Station
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>



      {/* Documented Concentration Scale Legend */}
      <div className="absolute bottom-6 right-3 z-20 max-w-xs">
        <div className="bg-white/95 backdrop-blur-md rounded-xl border border-slate-200 shadow-lg p-2.5 text-xs">
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
              {legend.label} Concentration Scale
            </span>
            <button
              onClick={() => setIsLegendExpanded(!isLegendExpanded)}
              className="text-[10px] text-teal-700 hover:underline font-semibold cursor-pointer"
            >
              {isLegendExpanded ? 'Collapse' : 'Details'}
            </button>
          </div>

          {/* Color swatch scale bar */}
          <div className="grid grid-cols-6 gap-1 mb-1.5">
            {legend.bands.map(b => (
              <div key={b.range} className="text-center">
                <div className="h-2 rounded-sm" style={{ backgroundColor: b.color }} />
                <div className="text-[9px] font-semibold text-slate-700 mt-0.5 truncate">{b.range}</div>
              </div>
            ))}
          </div>

          {isLegendExpanded && (
            <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[10px] text-slate-600">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full border-2 border-dashed border-amber-400 bg-slate-100" />
                  <span>Stale (&gt;2h)</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-slate-400 text-white flex items-center justify-center text-[8px]">
                    —
                  </span>
                  <span>Missing</span>
                </span>
              </div>
              <p className="leading-tight text-slate-400 italic">
                Raw concentration scale (µg/m³) referencing CPCB breakpoint tiers. Single-hour measurements are indicative and do not represent official 24-hour NAQI.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
