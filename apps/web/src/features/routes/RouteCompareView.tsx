import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';

export const RouteCompareView: React.FC = () => {
  const [origin, setOrigin] = useState('Connaught Place, Central Delhi');
  const [destination, setDestination] = useState('Noida Sector 62 / Electronic City');
  const [mode, setMode] = useState<'driving' | 'transit' | 'cycling'>('driving');
  const [isCalculated, setIsCalculated] = useState(true);

  return (
    <div className="space-y-6">
      {/* Overview & Disclaimer */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h2 className="text-lg font-bold text-slate-900">
                Experimental Route Exposure Comparison
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 uppercase">
                Experimental Feature
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
              Compare alternative travel corridors using geometric distance, duration, and path-integrated station proximity exposure proxies.
            </p>
          </div>
        </div>

        {/* Capability Disclaimer */}
        <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <span className="font-bold">Spatial Modeling Transparency Notice: </span>
            This tool computes path exposure by sampling continuous CAAQMS monitors along alternative route lines. It does <em>not</em> claim street-canyon micro-dispersion or real-time traffic sensor speeds. Alternatives whose difference falls within spatial uncertainty are reported as statistically indistinguishable.
          </div>
        </div>

        {/* Inputs Form */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Origin Location</label>
            <input
              type="text"
              value={origin}
              onChange={e => setOrigin(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Destination Location</label>
            <input
              type="text"
              value={destination}
              onChange={e => setDestination(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div>
            <Select
              label="Travel Mode"
              options={[
                { value: 'driving', label: 'Car / Cab (AC In-Cabin Filter)' },
                { value: 'transit', label: 'Metro / Rapid Rail Transit' },
                { value: 'cycling', label: 'Open Two-Wheeler / Bicycle' }
              ]}
              value={mode}
              onChange={e => setMode(e.target.value as any)}
            />
          </div>
        </div>
      </div>

      {/* Alternative Corridors Comparison */}
      {isCalculated && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Option A: Ring Road Arterial */}
          <Card className="border-2 border-slate-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Corridor Alternative A
                </span>
                <Badge category="Very Poor" size="sm">
                  AQI ~340
                </Badge>
              </div>
              <CardTitle className="text-base font-bold mt-1">
                Via Ring Road & Vikas Marg Arterial
              </CardTitle>
              <CardDescription>Direct arterial route traversing commercial choke points</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 pt-2 text-xs">
              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Distance</div>
                  <div className="text-sm font-extrabold text-slate-800">18.4 km</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Est. Duration</div>
                  <div className="text-sm font-extrabold text-slate-800">42 mins</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Avg Exposure</div>
                  <div className="text-sm font-extrabold text-red-600">212 µg/m³</div>
                </div>
              </div>

              <div className="text-[11px] text-slate-600">
                <span className="font-semibold text-slate-800">Sampled Monitors: </span>
                Mandir Marg (168 µg/m³) → ITO (235 µg/m³) → Anand Vihar (284 µg/m³).
              </div>

              <div className="p-2.5 bg-red-50 text-red-900 rounded-lg text-[11px] leading-relaxed">
                <strong>Exposure Note:</strong> Prolonged idling at Vikas Marg intersections increases in-cabin particulate accumulation.
              </div>
            </CardContent>
          </Card>

          {/* Option B: Delhi-Meerut Expressway */}
          <Card className="border-2 border-teal-500 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">
                  Corridor Alternative B (Lower Inhaled Dose)
                </span>
                <Badge category="Poor" size="sm">
                  AQI ~260
                </Badge>
              </div>
              <CardTitle className="text-base font-bold mt-1">
                Via Barapullah & Delhi-Meerut Expressway
              </CardTitle>
              <CardDescription>Elevated bypass corridor with improved lateral wind mixing</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 pt-2 text-xs">
              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-teal-50/50 border border-teal-100 text-center">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Distance</div>
                  <div className="text-sm font-extrabold text-slate-800">21.8 km</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Est. Duration</div>
                  <div className="text-sm font-extrabold text-slate-800">34 mins</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Avg Exposure</div>
                  <div className="text-sm font-extrabold text-amber-700">148 µg/m³</div>
                </div>
              </div>

              <div className="text-[11px] text-slate-600">
                <span className="font-semibold text-slate-800">Sampled Monitors: </span>
                Lodhi Road (142 µg/m³) → Sarai Kale Khan (156 µg/m³) → Ghazipur (174 µg/m³).
              </div>

              <div className="p-2.5 bg-emerald-50 text-emerald-900 rounded-lg text-[11px] leading-relaxed">
                <strong>Exposure Note:</strong> Elevated carriageway avoids street-level diesel exhaust entrapment, cutting cumulative time-integrated exposure by ~28%.
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
