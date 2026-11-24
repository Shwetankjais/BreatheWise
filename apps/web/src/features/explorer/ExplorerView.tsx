import React, { useState, useEffect } from 'react';
import { StationView, Pollutant, History } from '../../lib/api/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../lib/api/client';
import { formatToIST } from '../../lib/aqi';

interface ExplorerViewProps {
  stations: StationView[];
  selectedStation: StationView | null;
  onSelectStation: (station: StationView) => void;
}

export const ExplorerView: React.FC<ExplorerViewProps> = ({
  stations,
  selectedStation,
  onSelectStation
}) => {
  const [pollutant, setPollutant] = useState<Pollutant>('pm25');
  const [historyData, setHistoryData] = useState<History | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ measured_at: string; value: number } | null>(null);

  useEffect(() => {
    if (!selectedStation) return;
    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    // Compute standard 48-hour window ISO strings
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 3600000);
    const startIso = fortyEightHoursAgo.toISOString();
    const endIso = now.toISOString();

    apiClient.getHistory(selectedStation.id, startIso, endIso, pollutant).then(res => {
      if (!isMounted) return;
      setIsLoading(false);
      if (res.ok) {
        setHistoryData(res.data);
      } else {
        setHistoryData(null);
        setErrorMessage(`${res.error.code}: ${res.error.message}`);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedStation, pollutant]);

  // Export to CSV
  const handleDownloadCsv = () => {
    if (!historyData || historyData.points.length === 0) return;

    const headers = ['Measured_At_UTC', 'Measured_At_IST', 'Station_ID', 'Pollutant', 'Value', 'Unit'];
    const rows = historyData.points.map(pt => [
      pt.measured_at,
      formatToIST(pt.measured_at).replace(',', ''),
      historyData.station_id,
      historyData.pollutant.toUpperCase(),
      pt.value,
      historyData.unit
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `breathewise_${historyData.station_id}_${pollutant}_history.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // SVG Chart Dimensions
  const chartWidth = 720;
  const chartHeight = 260;
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };

  const points = historyData?.points || [];
  const values = points.map(p => p.value);
  const maxVal = values.length > 0 ? Math.max(...values, 80) * 1.15 : 200;
  const minVal = 0;

  const toX = (idx: number) => {
    if (points.length <= 1) return padding.left;
    return padding.left + (idx / (points.length - 1)) * (chartWidth - padding.left - padding.right);
  };

  const toY = (val: number) => {
    return chartHeight - padding.bottom - ((val - minVal) / (maxVal - minVal)) * (chartHeight - padding.top - padding.bottom);
  };

  const polylinePoints = points.map((p, idx) => `${toX(idx)},${toY(p.value)}`).join(' ');

  return (
    <div className="space-y-6">
      {/* Controls & Export Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Historical Sensor Telemetry & Exploratory Data Analysis (EDA)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Audit continuous hourly observations with UTC issue-time availability and data completeness metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCsv}
            disabled={!historyData || points.length === 0}
            className="flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Select Station"
          options={stations.map(s => ({ value: s.id, label: s.name }))}
          value={selectedStation?.id || ''}
          onChange={e => {
            const match = stations.find(s => s.id === e.target.value);
            if (match) onSelectStation(match);
          }}
        />

        <Select
          label="Select Pollutant"
          options={[
            { value: 'pm25', label: 'PM2.5 (Fine Particulate)' },
            { value: 'pm10', label: 'PM10 (Coarse Particulate)' },
            { value: 'no2', label: 'NO2 (Nitrogen Dioxide)' },
            { value: 'so2', label: 'SO2 (Sulfur Dioxide)' },
            { value: 'o3', label: 'O3 (Ozone)' },
            { value: 'co', label: 'CO (Carbon Monoxide)' }
          ]}
          value={pollutant}
          onChange={e => setPollutant(e.target.value as any)}
        />
      </div>

      {/* Chart & Telemetry Summary */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold">
                {selectedStation?.name} — {pollutant.toUpperCase()} Observations
              </CardTitle>
              <CardDescription>
                Hourly observation values with CPCB single-pollutant 24h standard reference line
              </CardDescription>
            </div>

            {historyData && (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-500">
                  Valid Observations: <strong className="text-emerald-700">{historyData.valid_count}</strong> / {historyData.expected_count} expected (Missing: {historyData.missing_count})
                </span>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="py-24 text-center text-slate-400 text-xs">
              Loading hourly time-series observations...
            </div>
          ) : errorMessage ? (
            <div className="py-16 text-center text-xs text-amber-800 bg-amber-50 rounded-lg border border-amber-200 p-4">
              <div className="font-bold">Observation Feed Notice:</div>
              <p className="mt-1">{errorMessage}</p>
            </div>
          ) : points.length > 0 ? (
            <div className="relative">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-64 overflow-visible">
                {/* Horizontal Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                  const yVal = minVal + pct * (maxVal - minVal);
                  const y = toY(yVal);
                  return (
                    <g key={idx}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={chartWidth - padding.right}
                        y2={y}
                        stroke="#E2E8F0"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={padding.left - 8}
                        y={y + 4}
                        fill="#94A3B8"
                        fontSize="10"
                        textAnchor="end"
                      >
                        {Math.round(yVal)}
                      </text>
                    </g>
                  );
                })}

                {/* CPCB 24h Reference Standard Line (60 for PM2.5, 100 for PM10) */}
                {pollutant === 'pm25' && maxVal > 60 && (
                  <g>
                    <line
                      x1={padding.left}
                      y1={toY(60)}
                      x2={chartWidth - padding.right}
                      y2={toY(60)}
                      stroke="#EF4444"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={chartWidth - padding.right}
                      y={toY(60) - 5}
                      fill="#EF4444"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="end"
                    >
                      CPCB 24h Standard: 60 µg/m³
                    </text>
                  </g>
                )}

                {/* Polyline */}
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke="#0D9488"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data Points on Hover */}
                {points.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={toX(idx)}
                    cy={toY(p.value)}
                    r="3.5"
                    fill="#0D9488"
                    className="hover:r-5 cursor-pointer transition-all"
                    onMouseEnter={() => setHoveredPoint({ measured_at: p.measured_at, value: p.value })}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                ))}
              </svg>

              {/* Hover tooltip */}
              {hoveredPoint && (
                <div className="absolute top-2 right-4 bg-slate-900 text-white p-2.5 rounded-lg text-xs shadow-lg pointer-events-none">
                  <div className="font-bold text-teal-400">{hoveredPoint.value.toFixed(1)} {historyData?.unit || 'µg/m³'}</div>
                  <div className="text-[10px] text-slate-300 mt-0.5">{formatToIST(hoveredPoint.measured_at)}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-16 text-center text-slate-400 text-xs">
              No historical observations recorded for this station and pollutant.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
