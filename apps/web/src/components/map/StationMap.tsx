import React, { useState } from 'react';
import { StationView, Measurement } from '../../lib/api/types';
import { calculateSubIndex, getAQICategory, AQI_THEMES } from '../../lib/aqi';

interface StationMapProps {
  stations: StationView[];
  latestMap: Record<string, Measurement | null>;
  selectedStationId: string | null;
  onSelectStation: (station: StationView) => void;
  centerLat: number;
  centerLon: number;
  cityName: string;
}

export const StationMap: React.FC<StationMapProps> = ({
  stations,
  latestMap,
  selectedStationId,
  onSelectStation,
  centerLat,
  centerLon,
  cityName
}) => {
  const [hoveredStation, setHoveredStation] = useState<StationView | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Compute bounding box from actual station coordinates
  const lats = stations.map(s => s.latitude);
  const lons = stations.map(s => s.longitude);
  const minLat = lats.length > 0 ? Math.min(...lats) - 0.08 : centerLat - 0.2;
  const maxLat = lats.length > 0 ? Math.max(...lats) + 0.08 : centerLat + 0.2;
  const minLon = lons.length > 0 ? Math.min(...lons) - 0.08 : centerLon - 0.2;
  const maxLon = lons.length > 0 ? Math.max(...lons) + 0.08 : centerLon + 0.2;

  // Convert lat/lon to SVG coordinate space [0, 800] x [0, 600]
  const toSvgX = (lon: number) => {
    return ((lon - minLon) / (maxLon - minLon)) * 740 + 30;
  };

  const toSvgY = (lat: number) => {
    return (1 - (lat - minLat) / (maxLat - minLat)) * 540 + 30;
  };

  return (
    <div className="relative w-full h-[450px] sm:h-[550px] bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-inner select-none">
      {/* Map Header Overlay */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2">
        <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-white flex items-center gap-2 shadow-md">
          <span className="w-2 h-2 rounded-full bg-teal-400" />
          <span className="font-semibold">{cityName} Sensor Grid</span>
          <span className="text-slate-400">({stations.length} stations)</span>
        </div>

        <div className="bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] text-slate-300 hidden md:block">
          Schematic coordinate grid; not a calibrated GIS dispersion model
        </div>
      </div>

      {/* Map Controls */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
        <button
          onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 2))}
          className="w-8 h-8 rounded-lg bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white hover:bg-slate-800 flex items-center justify-center font-bold text-sm shadow-md cursor-pointer transition-colors"
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.75))}
          className="w-8 h-8 rounded-lg bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white hover:bg-slate-800 flex items-center justify-center font-bold text-sm shadow-md cursor-pointer transition-colors"
          title="Zoom out"
          aria-label="Zoom out"
        >
          -
        </button>
        <button
          onClick={() => setZoomLevel(1)}
          className="w-8 h-8 rounded-lg bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white hover:bg-slate-800 flex items-center justify-center text-xs shadow-md cursor-pointer transition-colors"
          title="Reset Zoom"
          aria-label="Reset Zoom"
        >
          ↺
        </button>
      </div>

      {/* SVG Map Canvas */}
      <svg
        viewBox="0 0 800 600"
        className="w-full h-full cursor-grab active:cursor-grabbing transition-transform duration-300 ease-out"
        style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
        role="region"
        aria-label={`${cityName} schematic monitoring grid`}
      >
        <defs>
          <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1E293B" strokeWidth="0.8" />
          </pattern>
        </defs>

        {/* Base Grid */}
        <rect width="800" height="600" fill="#0B132B" />
        <rect width="800" height="600" fill="url(#gridPattern)" opacity="0.6" />

        {/* Station Markers */}
        {stations.map(station => {
          const x = toSvgX(station.longitude);
          const y = toSvgY(station.latitude);
          const isSelected = station.id === selectedStationId;
          const measurement = latestMap[station.id];
          const val = measurement?.value ?? null;
          const subIndex = val !== null ? calculateSubIndex(measurement?.pollutant || 'pm25', val) : 0;
          const cat = val !== null ? getAQICategory(subIndex) : 'Moderate';
          const theme = AQI_THEMES[cat];

          return (
            <g
              key={station.id}
              transform={`translate(${x}, ${y})`}
              className="cursor-pointer transition-transform duration-150 focus:outline-none"
              onClick={() => onSelectStation(station)}
              onMouseEnter={() => setHoveredStation(station)}
              onMouseLeave={() => setHoveredStation(null)}
              tabIndex={0}
              role="button"
              aria-label={`Select CAAQMS station ${station.name}`}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectStation(station);
                }
              }}
            >
              {/* Distinct Selected-Marker Emphasis */}
              {isSelected && (
                <>
                  <circle
                    r="18"
                    fill="none"
                    stroke="#14B8A6"
                    strokeWidth="2"
                    strokeDasharray="3 3"
                    className="animate-spin motion-reduce:animate-none"
                  />
                  <circle
                    r="13"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                </>
              )}

              {/* Station Dot */}
              <circle
                r={isSelected ? 9 : 7}
                fill={val !== null ? theme.accent : '#64748B'}
                stroke="#FFFFFF"
                strokeWidth={isSelected ? 2.5 : 1.5}
                className="shadow-lg"
              />

              {/* Station Name Label */}
              <text
                x="12"
                y="4"
                fill="#FFFFFF"
                fontSize={isSelected ? '11' : '10'}
                fontWeight={isSelected ? '700' : '500'}
                className="pointer-events-none drop-shadow-md select-none"
              >
                {station.name.split(',')[0]}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating Hover Card */}
      {hoveredStation && (
        <div className="absolute bottom-12 left-4 z-30 bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border border-slate-700 shadow-xl text-white max-w-xs animate-fadeIn pointer-events-none">
          <div className="text-xs font-bold text-teal-400">{hoveredStation.name}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Source: {hoveredStation.source}</div>
          {latestMap[hoveredStation.id] ? (
            <div className="mt-2 pt-2 border-t border-slate-700 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase text-slate-400">
                  Observed {latestMap[hoveredStation.id]?.pollutant.toUpperCase()}
                </div>
                <div className="text-sm font-bold text-amber-400">
                  {latestMap[hoveredStation.id]?.value.toFixed(1)} {latestMap[hoveredStation.id]?.unit}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase text-slate-400">Age</div>
                <div className="text-xs text-slate-300">
                  {latestMap[hoveredStation.id]?.observation_age_minutes}m ago
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-2 pt-2 border-t border-slate-700 text-[11px] text-slate-400">
              No observation reported for selected pollutant
            </div>
          )}
          <div className="text-[10px] text-teal-300 mt-1.5 font-medium">Click or press Enter to inspect station</div>
        </div>
      )}

      {/* Truthful Attribution Footer */}
      <div className="absolute bottom-2 right-3 z-20 text-[10px] text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded backdrop-blur-xs border border-slate-800">
        Schematic CAAQMS Monitor Grid (Relative Coordinates) | Telemetry: CAAQMS / DPCC / SPCB
      </div>
    </div>
  );
};
