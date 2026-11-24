import React from 'react';
import { Capabilities } from '../../lib/api/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';

interface ModelAuditViewProps {
  capabilities: Capabilities | null;
}

export const ModelAuditView: React.FC<ModelAuditViewProps> = ({ capabilities }) => {
  const isSupported = capabilities?.evaluation?.supported ?? false;
  const missing = capabilities?.evaluation?.requirements_missing || [
    'evaluation predictions and chronological split dates',
    'golden input/output parity test',
    'original HyperlocalAQPipeline class and preprocessing helpers'
  ];

  return (
    <div className="space-y-6">
      {/* Top Architecture Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <h2 className="text-lg font-bold text-slate-900">
                Model Architecture & Verification Audit
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
              Factual inspection of the national LightGBM atmospheric artifacts and runtime evaluation readiness.
            </p>
          </div>

          <div className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
            Runtime Evaluation: {isSupported ? 'Verified' : 'Unavailable (Gated)'}
          </div>
        </div>

        {/* Verified Static Findings (from MODEL_STATIC_AUDIT.json) */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-slate-200 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[10px] font-bold uppercase text-slate-400">Serialized Booster Hash</div>
            <div className="font-mono text-[10px] text-slate-800 break-all mt-0.5">
              2891830caddcb09e651ba382caca4e957569de165c323942be8f04492777fef8
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[10px] font-bold uppercase text-slate-400">Target Variable & Inversion</div>
            <div className="text-xs font-bold text-slate-900 mt-0.5">
              PM2.5 (µg/m³) with <code className="font-mono text-[11px]">log1p(y)</code> transform
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[10px] font-bold uppercase text-slate-400">Input Feature Count</div>
            <div className="text-xs font-bold text-slate-900 mt-0.5">
              75 Named Atmospheric Features
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[10px] font-bold uppercase text-slate-400">Declared Horizons</div>
            <div className="text-xs font-bold text-slate-900 mt-0.5">
              [+1h, +3h, +6h, +12h, +24h]
            </div>
          </div>
        </div>
      </div>

      {/* Honest Evaluation Gating Banner */}
      <Card className="border-amber-300 bg-amber-50/30">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-800 font-bold text-sm">
              503
            </div>
            <div>
              <CardTitle className="text-base font-bold text-amber-950">
                EVALUATION_UNAVAILABLE — No Out-of-Time Held-Out Split Provided
              </CardTitle>
              <CardDescription className="text-amber-900 mt-0.5">
                Baseline comparison and error metrics remain unavailable until evaluation evidence is supplied.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 text-xs text-amber-950">
          <p className="leading-relaxed">
            In accordance with project scientific integrity rules, BreatheWise does not fabricate arbitrary MAE, RMSE, or R² accuracy percentages. Although the LightGBM booster binary is present in the repository, operational inference and quantitative evaluation remain blocked awaiting teammate deliverables.
          </p>

          <div className="bg-white p-3 rounded-lg border border-amber-200">
            <div className="font-bold text-slate-900 mb-1.5 uppercase text-[11px] tracking-wider">
              Prerequisites Required to Verify Evaluation:
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
            <strong>Audit Disclosure:</strong> The full pipeline wrapper references an external <code className="font-mono">__main__.HyperlocalAQPipeline</code> class. Reliable deserialization requires the original teammate class and runtime dependencies. Until a golden parity test against held-out observations passes, model inference status is explicitly reported as unavailable.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
