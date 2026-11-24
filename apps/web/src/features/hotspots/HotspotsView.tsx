import React, { useState } from 'react';
import { City, ApiResult, Capabilities } from '../../lib/api/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

interface HotspotsViewProps {
  hotspotsResult: ApiResult<any> | null;
  selectedCity: City;
  capabilities: Capabilities | null;
  isDemoMode: boolean;
  onSelectStationById: (stationId: string) => void;
  onHorizonChange: (horizon: 1 | 3 | 6 | 24) => void;
  selectedHorizon: 1 | 3 | 6 | 24;
}

export const HotspotsView: React.FC<HotspotsViewProps> = ({
  hotspotsResult,
  selectedCity,
  capabilities,
  isDemoMode,
  onSelectStationById,
  onHorizonChange,
  selectedHorizon
}) => {
  const isModelSupported = capabilities?.model_forecast?.supported ?? false;
  const isOk = hotspotsResult?.ok ?? false;
  const hotspotsData = hotspotsResult && hotspotsResult.ok && Array.isArray(hotspotsResult.data) ? hotspotsResult.data : [];

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isModelSupported || isDemoMode ? 'bg-amber-500' : 'bg-slate-400'}`} />
            <h2 className="text-lg font-bold text-slate-900">
              Emerging Pollution Hotspots Watchlist
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Monitored locations in {selectedCity.name} evaluated for impending particulate spikes.
          </p>
        </div>

        {/* Horizon selector buttons */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 mr-1">Forecast Horizon:</span>
          {([1, 3, 6, 24] as const).map(h => (
            <button
              key={h}
              onClick={() => onHorizonChange(h)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedHorizon === h
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              +{h}h
            </button>
          ))}
        </div>
      </div>

      {/* Model Unavailable Banner in Live Mode */}
      {!isDemoMode && !isOk && (
        <Card className="border-amber-300 bg-amber-50/30">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-800 font-bold text-sm">
                503
              </div>
              <div>
                <CardTitle className="text-base font-bold text-amber-950">
                  MODEL_UNAVAILABLE — No Verified Forecasts for Location Ranking
                </CardTitle>
                <CardDescription className="text-amber-900 mt-0.5">
                  Multi-horizon predictions are unavailable pending model onboarding and golden parity tests.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 text-xs text-amber-950">
            <p className="leading-relaxed">
              The backend returns <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">503 MODEL_UNAVAILABLE</code> because machine learning inference is not operational on live data. BreatheWise does not invent fake station rankings when live model predictions are unavailable.
            </p>

            <div className="bg-white p-3 rounded-lg border border-amber-200">
              <div className="font-bold text-slate-900 mb-1 text-[11px] uppercase tracking-wider">
                Prerequisites Missing for Hotspot Ranking:
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-700">
                <li>teammate HyperlocalAQPipeline source & feature builder</li>
                <li>golden prediction parity verification</li>
                <li>calibrated exceedance probability post-processing</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Demo Fixtures View (when in explicit Demo mode) */}
      {isDemoMode && hotspotsData.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4 bg-amber-50/60 border-b border-amber-100">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-900">
                DEMO PREVIEW: Synthetic Ranking Interface (+{selectedHorizon}h)
              </span>
              <span className="text-slate-500 text-[11px]">
                Probabilities: <strong className="text-slate-700">Uncalibrated in v1</strong> (null)
              </span>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4 w-12">Rank</th>
                  <th className="py-3 px-4">Station</th>
                  <th className="py-3 px-4">Current Observed</th>
                  <th className="py-3 px-4">Projected (+{selectedHorizon}h)</th>
                  <th className="py-3 px-4">Predicted Delta</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {hotspotsData.map((item: any, idx: number) => (
                  <tr key={item.station_id || idx} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-bold text-slate-400">
                      #{idx + 1}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {item.station_name || item.station_id}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {item.current_concentration} µg/m³
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {item.forecast_concentration} µg/m³
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center font-bold px-2 py-0.5 rounded text-xs bg-red-50 text-red-700 border border-red-200">
                        ▲ +{item.delta} µg/m³
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectStationById(item.station_id)}
                        className="text-teal-700"
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
