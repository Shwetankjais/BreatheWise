import React from 'react';
import { StationView, Capabilities } from '../../lib/api/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';

interface WeatherScenarioViewProps {
  stations: StationView[];
  capabilities: Capabilities | null;
}

export const WeatherScenarioView: React.FC<WeatherScenarioViewProps> = ({
  capabilities
}) => {
  const isSupported = capabilities?.weather_scenarios?.supported ?? false;
  const missing = capabilities?.weather_scenarios?.requirements_missing || [
    'original HyperlocalAQPipeline class source',
    'exact feature builder and meteorological preprocessing',
    'golden input/output parity test'
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <h2 className="text-lg font-bold text-slate-900">
                Atmospheric Meteorological Sensitivity & What-If Scenarios
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
              Counterfactual simulation of meteorological perturbations across forecast horizons.
            </p>
          </div>

          <div className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
            Status: {isSupported ? 'Operational' : 'Unavailable (Gated)'}
          </div>
        </div>
      </div>

      {/* Honest Capability Gating Card */}
      <Card className="border-amber-300 bg-amber-50/30">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-800 font-bold text-sm">
              409
            </div>
            <div>
              <CardTitle className="text-base font-bold text-amber-950">
                SCENARIO_UNAVAILABLE — Model Feature Parity Unverified
              </CardTitle>
              <CardDescription className="text-amber-900 mt-0.5">
                Dependent feature recomputation and target inversion are not verified.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 text-xs text-amber-950">
          <p className="leading-relaxed">
            In accordance with project integrity standards, BreatheWise does not compute fabricated regression coefficients or claim sensitivity metrics derived from model splits without authentic verification. Counterfactual weather perturbation requires:
          </p>

          <div className="bg-white p-3 rounded-lg border border-amber-200">
            <div className="font-bold text-slate-900 mb-1.5 uppercase text-[11px] tracking-wider">
              Prerequisites Missing from Teammate Input:
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
            <strong>Scientific Boundary:</strong> Counterfactual adjustments to ambient wind, humidity, or boundary layer height cannot be reliably simulated by modifying isolated input scalars without recalculating dependent atmospheric interaction terms (e.g. advective lag vectors, friction velocity, and aerosol hygroscopic growth factors).
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
