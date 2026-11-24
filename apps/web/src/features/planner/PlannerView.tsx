import React from 'react';
import { ReplayPlanner } from './ReplayPlanner';
import { StationView, Capabilities } from '../../lib/api/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';

interface PlannerViewProps {
  stations: StationView[];
  capabilities: Capabilities | null;
}

export const PlannerView: React.FC<PlannerViewProps> = ({
  capabilities
}) => {
  const isSupported = capabilities?.continuous_hourly_trajectory?.supported ?? false;
  const missing = capabilities?.continuous_hourly_trajectory?.requirements_missing || [
    'validated continuous hourly forecast trajectory (24 consecutive hours)'
  ];

  return (
    <div className="space-y-6">
      <ReplayPlanner supportedVersions={capabilities?.replay_activity_planning?.supported_scope || []} />
      <details open className="rounded-xl border border-[#E5DFD3] bg-white p-4">
        <summary className="cursor-pointer font-bold text-[#1C1E24] hover:text-[#0D9488] transition-colors">Why future activity planning is not available yet</summary>
        <div className="mt-4 space-y-4">
      {/* Planner Header */}
      <div className="bg-[#FAF8F5] p-5 rounded-xl border border-[#E5DFD3] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <h2 className="text-lg font-bold text-[#1C1E24]">
                Personal Exposure & Outdoor Activity Planner
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#555C68] mt-1 max-w-2xl">
              Comparative outdoor window ranking based on concentration-time exposure proxies.
            </p>
          </div>

          <div className="text-xs font-semibold px-2.5 py-1 rounded bg-[#F5F1EA] text-[#555C68] border border-[#E5DFD3]">
            Status: {isSupported ? 'Operational' : 'Unavailable (Gated)'}
          </div>
        </div>
      </div>

      {/* Honest Trajectory Gating Card */}
      <Card className="border-amber-300 bg-amber-50/30">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-800 font-bold text-sm">
              409
            </div>
            <div>
              <CardTitle className="text-base font-bold text-amber-950">
                TRAJECTORY_UNAVAILABLE — Complete Hourly Curve Unverified
              </CardTitle>
              <CardDescription className="text-amber-900 mt-0.5">
                Duration-integrated planning requires a validated complete hourly trajectory.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 text-xs text-amber-950">
          <p className="leading-relaxed">
            The national LightGBM model artifact outputs predictions at only five discrete horizons: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">[+1h, +3h, +6h, +12h, +24h]</code>.
            Because continuous hourly and sub-hourly predictions are not runtime-verified, BreatheWise strictly refuses to interpolate five sparse points into a fictitious 24-hour continuous trajectory or generate fabricated recommendation scores.
          </p>

          <div className="bg-white p-3 rounded-lg border border-amber-200">
            <div className="font-bold text-slate-900 mb-1.5 uppercase text-[11px] tracking-wider">
              Prerequisite Required from Model Integration:
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-700">
              {missing.map((req, idx) => (
                <li key={idx} className="font-medium">
                  {req}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-3 bg-amber-100/60 rounded-lg text-[11px] leading-relaxed text-amber-950">
            <strong>Exposure Science Constraint:</strong> A concentration-time comparison (in microgram-minutes) requires integrating the area under the curve across the user's intended activity duration. Mathematical smoothing across 6-hour or 12-hour gaps obscures rapid diurnal boundary layer transitions, creating false confidence during dangerous inversion spikes.
          </div>
        </CardContent>
      </Card>
        </div>
      </details>
    </div>
  );
};
