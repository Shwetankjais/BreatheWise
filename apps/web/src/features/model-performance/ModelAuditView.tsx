import React, { useState, useEffect, useMemo } from 'react';
import {
  Capabilities,
  ModelCatalogue,
  ModelSummary,
  ModelEvaluation,
  PredictionPage,
  HeldoutPrediction,
  HorizonEvaluation
} from '../../lib/api/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { apiClient } from '../../lib/api/client';

interface ModelAuditViewProps {
  capabilities: Capabilities | null;
}

type ModelTier = 'recovered' | 'experimental' | 'operational';

export const ModelAuditView: React.FC<ModelAuditViewProps> = ({ capabilities }) => {
  const [selectedTier, setSelectedTier] = useState<ModelTier>('experimental');
  const [modelCatalogue, setModelCatalogue] = useState<ModelCatalogue | null>(null);
  const [isLoadingCatalogue, setIsLoadingCatalogue] = useState(false);

  // Tier 2: Experimental Evaluation & Predictions State
  const [evaluation, setEvaluation] = useState<ModelEvaluation | null>(null);
  const [isLoadingEvaluation, setIsLoadingEvaluation] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [selectedHorizon, setSelectedHorizon] = useState<number>(1);
  const [predictionsPage, setPredictionsPage] = useState<PredictionPage | null>(null);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const [predictionsError, setPredictionsError] = useState<string | null>(null);

  const isOperationalSupported = capabilities?.model_forecast?.supported ?? false;

  // 1. Load Model Registry
  useEffect(() => {
    let isMounted = true;
    setIsLoadingCatalogue(true);

    apiClient.getModels().then(res => {
      if (!isMounted) return;
      setIsLoadingCatalogue(false);
      if (res.ok) {
        setModelCatalogue(res.data);
      } else {
        setModelCatalogue(null);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Load Evaluation for delhi-recorded-pm25-v1
  useEffect(() => {
    if (selectedTier !== 'experimental') return;
    let isMounted = true;
    setIsLoadingEvaluation(true);
    setEvaluationError(null);

    apiClient.getModelEvaluation('delhi-recorded-pm25-v1').then(res => {
      if (!isMounted) return;
      setIsLoadingEvaluation(false);
      if (res.ok) {
        setEvaluation(res.data);
        setEvaluationError(null);
      } else {
        setEvaluation(null);
        setEvaluationError(res.error?.message || 'Evaluation metrics unavailable.');
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedTier]);

  // 3. Load Predictions for selected horizon
  useEffect(() => {
    if (selectedTier !== 'experimental') return;
    let isMounted = true;
    setIsLoadingPredictions(true);
    setPredictionsError(null);

    apiClient
      .getModelPredictions('delhi-recorded-pm25-v1', selectedHorizon, 'test', 25)
      .then(res => {
        if (!isMounted) return;
        setIsLoadingPredictions(false);
        if (res.ok) {
          setPredictionsPage(res.data);
          setPredictionsError(null);
        } else {
          setPredictionsPage(null);
          setPredictionsError(res.error?.message || 'Held-out predictions unavailable.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedTier, selectedHorizon]);

  const recoveredModelSummary = useMemo(() => {
    return (
      modelCatalogue?.models.find(
        m => m.model_version === 'supplied-native-75-v1' || m.kind === 'native_diagnostic'
      ) || null
    );
  }, [modelCatalogue]);

  const experimentalModelSummary = useMemo(() => {
    return (
      modelCatalogue?.models.find(
        m => m.model_version === 'delhi-recorded-pm25-v1' || m.kind === 'retrospective_forecast'
      ) || null
    );
  }, [modelCatalogue]);

  return (
    <div className="space-y-6">
      {/* Header & Model Version Tier Switcher */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
              <h2 className="text-lg font-bold text-slate-900">
                Atmospheric Model Tiers & Verification Audit
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
              Transparent, evidence-based accounting of supplied artifacts, independent archive experiments, and operational readiness.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">Active State:</span>
            <span className="font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
              Diagnostic & Retrospective Mode
            </span>
          </div>
        </div>

        {/* Tier Selector Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={() => setSelectedTier('recovered')}
            className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
              selectedTier === 'recovered'
                ? 'bg-amber-50/80 border-amber-400 text-amber-950 shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs">Tier 1: Recovered Model</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 uppercase">
                Diagnostic
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Supplied native adapter (supplied-native-75-v1) & reconstructed feature schema
            </p>
          </button>

          <button
            onClick={() => setSelectedTier('experimental')}
            className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
              selectedTier === 'experimental'
                ? 'bg-teal-50/80 border-teal-500 text-teal-950 shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs">Tier 2: Experimental Model</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-teal-200 text-teal-900 uppercase">
                Retrospective
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              delhi-recorded-pm25-v1 evaluated on frozen chronological test split
            </p>
          </button>

          <button
            onClick={() => setSelectedTier('operational')}
            className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
              selectedTier === 'operational'
                ? 'bg-slate-100 border-slate-400 text-slate-900 shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs">Tier 3: Operational Pipeline</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 uppercase">
                {isOperationalSupported ? 'Active' : 'Disabled (Gated)'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Production inference triggered on live CAAQMS telemetry
            </p>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tier 1 Details: Supplied Recovered Model                           */}
      {/* ------------------------------------------------------------------ */}
      {selectedTier === 'recovered' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">
                    Supplied LightGBM Booster ({recoveredModelSummary?.model_version || 'supplied-native-75-v1'}) — Static Provenance
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Reconstructed feature order, target transformation, and booster hash
                  </CardDescription>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                  Status: {recoveredModelSummary?.status || 'available'} (Diagnostic Only)
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Booster Binary Hash</div>
                  <div className="font-mono text-[10px] text-slate-800 break-all mt-1">
                    {recoveredModelSummary?.artifact_hashes?.model || '2891830caddcb09e651ba382caca4e957569de165c323942be8f04492777fef8'}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Target Transform</div>
                  <div className="text-xs font-bold text-slate-900 mt-1">
                    <code className="font-mono">log1p(PM2.5)</code> with <code className="font-mono">expm1</code> inversion
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Input Feature Count</div>
                  <div className="text-xs font-bold text-slate-900 mt-1">
                    {recoveredModelSummary?.feature_count ?? 75} Ordered Atmospheric Features
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Declared Horizons</div>
                  <div className="text-xs font-bold text-slate-900 mt-1">
                    {recoveredModelSummary?.supported_horizons ? `[${recoveredModelSummary.supported_horizons.map(h => `+${h}h`).join(', ')}]` : '[+1h, +3h, +6h, +12h, +24h]'}
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-950 space-y-1.5 leading-relaxed">
                <div className="font-bold text-xs uppercase tracking-wider text-amber-900">
                  Operational Inference Gate (503 MODEL_UNAVAILABLE)
                </div>
                <p>
                  The supplied model was serialized without class source code or golden test fixtures. Although native booster loading runs in diagnostics tests, end-to-end inference on live telemetry is gated until the teammate pipeline class (<code className="font-mono font-bold">HyperlocalAQPipeline</code>) and inversion parity are supplied.
                </p>
                {recoveredModelSummary?.limitations && (
                  <ul className="list-disc list-inside pt-1 text-[11px] text-amber-900 space-y-0.5">
                    {recoveredModelSummary.limitations.map((lim, idx) => (
                      <li key={idx}>{lim}</li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Tier 2 Details: Independent Experimental Model (Contract 1.2.0)    */}
      {/* ------------------------------------------------------------------ */}
      {selectedTier === 'experimental' && (
        <div className="space-y-5">
          {/* Provenance & Registry Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">
                    {experimentalModelSummary?.model_version || 'delhi-recorded-pm25-v1'} — Retrospective Chronological Experiment
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Single-station retrospective recorded-clock experiment (Anand Vihar source site_301, {experimentalModelSummary?.feature_count ?? 39} causal features). Not live forecasting or 54-station validation.
                  </CardDescription>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-teal-100 text-teal-900 border border-teal-200">
                  Status: Retrospective Evaluation ({experimentalModelSummary?.status || 'available'})
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Dataset Mode</div>
                  <div className="text-xs font-mono font-bold text-slate-900 mt-1">
                    {evaluation?.dataset_mode || 'recorded_clock'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Unverified logger clock</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Dataset Checksum (SHA256)</div>
                  <div className="text-[10px] font-mono text-slate-800 truncate mt-1" title={evaluation?.dataset_sha256}>
                    {evaluation?.dataset_sha256 ? `${evaluation.dataset_sha256.substring(0, 16)}...` : 'Audited DuckDB Parquet'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Frozen archive fingerprint</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Experiment Horizons</div>
                  <div className="text-xs font-bold text-teal-800 mt-1">
                    {evaluation?.supported_horizons ? `[${evaluation.supported_horizons.map(h => `+${h}h`).join(', ')}]` : '[+1h, +3h, +6h, +12h, +24h]'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Discrete test evaluations</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Causal Input Assumption</div>
                  <div className="text-[11px] font-bold text-slate-800 mt-1">
                    {evaluation?.input_availability_assumption || 'same_recorded_clock_causal_lags_only'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">No lookahead leakage</div>
                </div>
              </div>

              {/* Chronological Splits Summary */}
              {evaluation?.splits && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-800 text-[11px]">Chronological Training & Test Splits:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {evaluation.splits.map(s => (
                      <div key={s.name} className="p-2 rounded bg-white border border-slate-200 text-[11px]">
                        <span className="font-bold uppercase text-slate-700 block">{s.name} Split</span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {s.start_recorded_at} → {s.end_recorded_at_exclusive}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scientific Disclaimer */}
              <div className="p-3.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-950 space-y-1.5 leading-relaxed">
                <div className="font-bold text-xs uppercase tracking-wider text-amber-900">
                  Retrospective Evaluation Caveats & Limitations:
                </div>
                <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-0.5">
                  <li>Single-station retrospective recorded-clock experiment (Anand Vihar source <code className="font-mono">site_301</code>); not live forecasting or 54-station validation.</li>
                  <li>Evaluation is conducted on naive recorded device clocks; live CAAQMS issue times remain unverified.</li>
                  <li>Target transform: <code className="font-mono">{evaluation?.target_transform || 'identity'}</code> with target unit <code className="font-mono">{evaluation?.target_unit || 'µg/m³'}</code>.</li>
                  <li>Baseline persistence is strictly evaluated on the matched observed hour cohort; no synthetic imputation is performed.</li>
                  <li>High-pollution subset (target &ge; 150 µg/m³) has unequal available sample counts across methods; high-target model underprediction is substantial, so do not claim paired high-subset superiority.</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Frozen Evaluation Metrics Table by Horizon */}
          <Card>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">
                    Test Split Performance Across Evaluation Horizons
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Comparison of LightGBM regressor vs naive lag-1h persistence & same-hour previous day baseline
                  </CardDescription>
                </div>
                <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                  Target: PM2.5 (µg/m³)
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingEvaluation ? (
                <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
                  Loading frozen evaluation metrics...
                </div>
              ) : evaluation?.horizons && evaluation.horizons.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">Horizon</th>
                        <th className="p-2.5">Test Count</th>
                        <th className="p-2.5">LightGBM MAE</th>
                        <th className="p-2.5">LightGBM RMSE</th>
                        <th className="p-2.5">Persistence MAE</th>
                        <th className="p-2.5">Prev Day Same Hr MAE</th>
                        <th className="p-2.5">Relative Gain vs Baseline</th>
                        <th className="p-2.5">High Pollution MAE (&ge;150)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {evaluation.horizons.map((h: HorizonEvaluation) => {
                        const testGroup = h.splits['test'];
                        const commonCohort = testGroup?.common_baseline_cohort;
                        const lgb = commonCohort?.['lightgbm'] || testGroup?.all_available?.['lightgbm'];
                        const pers = commonCohort?.['persistence'] || testGroup?.all_available?.['persistence'];
                        const prevDay = commonCohort?.['previous_day_same_hour'] || testGroup?.all_available?.['previous_day_same_hour'];
                        const highPollLgb = testGroup?.high_pollution_observed_target_ge_150?.['lightgbm'];

                        const gainPct =
                          pers?.mae && lgb?.mae
                            ? (((pers.mae - lgb.mae) / pers.mae) * 100).toFixed(1)
                            : null;

                        return (
                          <tr key={h.horizon_h} className="hover:bg-slate-50 transition-colors">
                            <td className="p-2.5 font-bold text-slate-900">+{h.horizon_h}h</td>
                            <td className="p-2.5 text-slate-500 font-mono">{lgb?.count ?? '—'}</td>
                            <td className="p-2.5 font-extrabold text-teal-800">
                              {lgb?.mae !== undefined && lgb?.mae !== null ? `${lgb.mae.toFixed(1)} µg/m³` : '—'}
                            </td>
                            <td className="p-2.5 text-slate-600">
                              {lgb?.rmse !== undefined && lgb?.rmse !== null ? `${lgb.rmse.toFixed(1)} µg/m³` : '—'}
                            </td>
                            <td className="p-2.5 text-slate-600">
                              {pers?.mae !== undefined && pers?.mae !== null ? `${pers.mae.toFixed(1)} µg/m³` : '—'}
                            </td>
                            <td className="p-2.5 text-slate-500">
                              {prevDay?.mae !== undefined && prevDay?.mae !== null ? `${prevDay.mae.toFixed(1)} µg/m³` : '—'}
                            </td>
                            <td className="p-2.5">
                              {gainPct !== null ? (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  Number(gainPct) > 0 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {Number(gainPct) > 0 ? `+${gainPct}%` : `${gainPct}%`}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="p-2.5 text-amber-900 font-semibold">
                              {highPollLgb?.mae !== undefined && highPollLgb?.mae !== null
                                ? `${highPollLgb.mae.toFixed(1)} µg/m³ (N=${highPollLgb.count})`
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 font-medium bg-slate-50/50">
                  {evaluationError || 'Evaluation metrics unavailable for this model.'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Held-Out Predictions Viewer */}
          <Card>
            <CardHeader className="py-3 px-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-bold">
                    Held-Out Test Split Prediction Rows
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Inspect individual test prediction rows comparing model predictions against observed targets
                  </CardDescription>
                </div>

                {/* Horizon Switcher */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 font-semibold mr-1">Horizon:</span>
                  {[1, 3, 6, 12, 24].map(h => (
                    <button
                      key={h}
                      onClick={() => setSelectedHorizon(h)}
                      className={`px-2.5 py-1 text-xs font-bold rounded transition-colors cursor-pointer ${
                        selectedHorizon === h
                          ? 'bg-teal-700 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      +{h}h
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingPredictions ? (
                <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
                  Loading +{selectedHorizon}h test prediction samples...
                </div>
              ) : predictionsPage?.points && predictionsPage.points.length > 0 ? (
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] sticky top-0">
                      <tr>
                        <th className="p-2.5">Station</th>
                        <th className="p-2.5">Issue Time (Recorded)</th>
                        <th className="p-2.5">Target Time (Recorded)</th>
                        <th className="p-2.5">Observed Target</th>
                        <th className="p-2.5">LightGBM Prediction</th>
                        <th className="p-2.5">Persistence Baseline</th>
                        <th className="p-2.5">Absolute Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {predictionsPage.points.map((row: HeldoutPrediction, idx: number) => {
                        const err = row.lightgbm !== null ? Math.abs(row.observed - row.lightgbm) : null;
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-2.5 font-bold text-slate-800">{row.station_id}</td>
                            <td className="p-2.5 font-mono text-[11px] text-slate-500">{row.issue_at_recorded}</td>
                            <td className="p-2.5 font-mono text-[11px] text-slate-700">{row.target_at_recorded}</td>
                            <td className="p-2.5 font-bold text-slate-900">
                              {row.observed.toFixed(1)} µg/m³
                            </td>
                            <td className="p-2.5 font-extrabold text-teal-800">
                              {row.lightgbm !== null ? `${row.lightgbm.toFixed(1)} µg/m³` : '—'}
                            </td>
                            <td className="p-2.5 text-slate-600">
                              {row.persistence !== null ? `${row.persistence.toFixed(1)} µg/m³` : '—'}
                            </td>
                            <td className="p-2.5 font-mono font-semibold text-slate-700">
                              {err !== null ? `${err.toFixed(1)} µg/m³` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 font-medium bg-slate-50/50">
                  {predictionsError || `No prediction rows found for horizon +${selectedHorizon}h.`}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Tier 3 Details: Operational Production Model                       */}
      {/* ------------------------------------------------------------------ */}
      {selectedTier === 'operational' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">
                    Operational Production Inference
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Real-time automated multi-horizon inference on live CAAQMS telemetry feeds
                  </CardDescription>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300">
                  Gated: Capability Disabled
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-slate-700 leading-relaxed">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  <span className="font-bold text-slate-900 text-sm">Operational Pipeline Gated</span>
                </div>
                <p>
                  In accordance with the project PRD and scientific honesty directives, production inference is disabled until the following prerequisites pass continuous automated checks:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1">
                  <li>Continuous real-time intake with clock alignment verified (no naive UTC/IST timestamp shifting).</li>
                  <li>Verified end-to-end feature pipeline reproducing the exact 75 input features without zeros or synthetic filling.</li>
                  <li>Audited inversion parity (<code className="font-mono">expm1</code>) verified against golden prediction test suites.</li>
                  <li>Model evaluation metrics (<code className="font-mono">/model-performance</code>) validated against chronological held-out splits.</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
