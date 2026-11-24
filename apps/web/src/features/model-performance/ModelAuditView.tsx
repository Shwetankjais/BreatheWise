import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Capabilities,
  ModelCatalogue,
  ModelSummary,
  ModelEvaluation,
  UtcModelEvaluation,
  PredictionPage,
  UtcPredictionPage,
  HeldoutPrediction,
  UtcHeldoutPrediction,
  HorizonEvaluation,
  ForecastRunPage,
  ForecastRunView,
  ForecastRunDetail,
  ShadowPoint,
  RecordedSplit,
  UtcSplit
} from '../../lib/api/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { apiClient } from '../../lib/api/client';
import { DEMO_MODELS } from '../../lib/api/demoData';

interface ModelAuditViewProps {
  capabilities: Capabilities | null;
}

type ModelTier = 'recovered' | 'experimental' | 'operational';

export const ModelAuditView: React.FC<ModelAuditViewProps> = ({ capabilities }) => {
  const [selectedTier, setSelectedTier] = useState<ModelTier>('experimental');
  const [modelCatalogue, setModelCatalogue] = useState<ModelCatalogue | null>(null);
  const [isLoadingCatalogue, setIsLoadingCatalogue] = useState(false);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [catalogueErrorCode, setCatalogueErrorCode] = useState<string | null>(null);

  // Tier 2: Experimental Evaluation & Predictions State
  const [selectedModelVersion, setSelectedModelVersion] = useState<string>('delhi-recorded-pm25-hourly-v2');
  const [evaluation, setEvaluation] = useState<ModelEvaluation | UtcModelEvaluation | null>(null);
  const [isLoadingEvaluation, setIsLoadingEvaluation] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [evaluationViewMode, setEvaluationViewMode] = useState<'primary' | 'target_only'>('primary');

  const [selectedHorizon, setSelectedHorizon] = useState<number>(1);
  const [selectedSplit, setSelectedSplit] = useState<string>('test');
  const [issueTimePurged, setIssueTimePurged] = useState<boolean>(true);
  const [predictionOffset, setPredictionOffset] = useState<number>(0);
  const predictionLimit = 25;
  const [predictionsPage, setPredictionsPage] = useState<PredictionPage | UtcPredictionPage | null>(null);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const [predictionsError, setPredictionsError] = useState<string | null>(null);

  // Playback Chart View State
  const [chartViewMode, setChartViewMode] = useState<'tracks' | 'residuals'>('tracks');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Race Condition / Sequence Tokens
  const evalReqIdRef = useRef<number>(0);
  const predictionReqIdRef = useRef<number>(0);

  // Tier 3: Operational & Shadow Forecasting State (Persisted Runs & Run Detail)
  const [shadowRunsPage, setShadowRunsPage] = useState<ForecastRunPage | null>(null);
  const [isLoadingShadowRuns, setIsLoadingShadowRuns] = useState(false);
  const [shadowRunsError, setShadowRunsError] = useState<string | null>(null);
  const [selectedRunDetail, setSelectedRunDetail] = useState<ForecastRunDetail | null>(null);
  const [isLoadingRunDetail, setIsLoadingRunDetail] = useState(false);
  const [runDetailError, setRunDetailError] = useState<string | null>(null);

  const isOperationalSupported = capabilities?.model_forecast?.supported ?? false;

  // 1. Load Model Registry
  const fetchCatalogue = () => {
    setIsLoadingCatalogue(true);
    setCatalogueError(null);
    setCatalogueErrorCode(null);

    apiClient.getModels().then(res => {
      setIsLoadingCatalogue(false);
      if (res.ok) {
        setModelCatalogue(res.data);
        setCatalogueError(null);
        setCatalogueErrorCode(null);
        const expModels = res.data.models.filter(m => m.kind === 'retrospective_forecast');
        if (expModels.length > 0) {
          setSelectedModelVersion(prev => {
            if (expModels.some(m => m.model_version === prev)) {
              return prev;
            }
            return expModels[0].model_version;
          });
        }
      } else {
        setModelCatalogue(null);
        const code = res.error?.code || (res.status ? `HTTP_${res.status}` : 'REGISTRY_DOWN');
        const msg = res.error?.message || 'Failed to retrieve model registry.';
        setCatalogueErrorCode(code);
        setCatalogueError(msg);
      }
    });
  };

  useEffect(() => {
    fetchCatalogue();
  }, []);

  // Filter experimental models from catalogue (strictly isolated to explicit demo mode or real catalogue)
  const experimentalModels = useMemo<ModelSummary[]>(() => {
    if (apiClient.getDemoMode()) {
      return DEMO_MODELS.models.filter(m => m.kind === 'retrospective_forecast');
    }
    if (!modelCatalogue) {
      return [];
    }
    return modelCatalogue.models.filter(m => m.kind === 'retrospective_forecast');
  }, [modelCatalogue]);

  const selectedModelSummary = useMemo<ModelSummary | null>(() => {
    return (
      modelCatalogue?.models.find(m => m.model_version === selectedModelVersion) ||
      experimentalModels.find(m => m.model_version === selectedModelVersion) ||
      null
    );
  }, [modelCatalogue, experimentalModels, selectedModelVersion]);

  const isUtcModel = useMemo(() => {
    return (
      selectedModelSummary?.dataset_mode === 'utc_provider_history' ||
      selectedModelSummary?.clock_basis === 'UTC_hour_ending' ||
      selectedModelSummary?.evaluation_path?.endsWith('utc-evaluation') === true
    );
  }, [selectedModelSummary]);

  const clockBasis = useMemo(() => {
    return (
      selectedModelSummary?.clock_basis ||
      (selectedModelSummary?.dataset_mode === 'utc_provider_history'
        ? 'UTC_hour_ending'
        : 'source_naive_clock_unverified')
    );
  }, [selectedModelSummary]);

  const supportedHorizons = useMemo<number[]>(() => {
    if (selectedModelSummary?.supported_horizons && selectedModelSummary.supported_horizons.length > 0) {
      return selectedModelSummary.supported_horizons;
    }
    if (evaluation?.supported_horizons && evaluation.supported_horizons.length > 0) {
      return evaluation.supported_horizons;
    }
    return [];
  }, [selectedModelSummary, evaluation]);

  const availableSplits = useMemo(() => {
    if (!evaluation) return [];
    const heldout = evaluation.splits.map(s => s.name).filter(name => name === 'test' || name === 'validation');
    return [...new Set([...heldout, ...Object.keys(evaluation.rolling_backtests)])];
  }, [evaluation]);

  // Synchronize horizon and split bounds when model changes
  useEffect(() => {
    if (supportedHorizons.length > 0 && !supportedHorizons.includes(selectedHorizon)) {
      setSelectedHorizon(supportedHorizons[0]);
    }
  }, [supportedHorizons, selectedHorizon]);

  useEffect(() => {
    if (!availableSplits.includes(selectedSplit)) {
      setSelectedSplit(availableSplits[0] ?? 'test');
    }
  }, [availableSplits, selectedSplit]);

  // Set default issueTimePurged policy strictly based on model cohort metadata
  useEffect(() => {
    if (selectedModelSummary?.evaluation_cohort === 'fixed_model_issue_time_purged') {
      setIssueTimePurged(true);
    } else if (selectedModelSummary?.evaluation_cohort === 'target_timestamp_split_only') {
      setIssueTimePurged(false);
    }
  }, [selectedModelSummary]);

  // 2. Load Evaluation for selectedModelVersion (with sequence token to prevent stale responses)
  useEffect(() => {
    if (selectedTier !== 'experimental') return;
    let isMounted = true;
    const reqId = ++evalReqIdRef.current;
    setIsLoadingEvaluation(true);
    setEvaluationError(null);

    apiClient
      .getModelEvaluation(selectedModelVersion, null, selectedModelSummary?.evaluation_path)
      .then(res => {
        if (!isMounted || reqId !== evalReqIdRef.current) return;
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
  }, [selectedTier, selectedModelVersion, selectedModelSummary?.evaluation_path]);

  // 3. Load Predictions for selected horizon, split, and offset (with sequence token)
  useEffect(() => {
    if (selectedTier !== 'experimental') return;
    if (supportedHorizons.length === 0) {
      setPredictionsPage(null);
      setIsLoadingPredictions(false);
      setPredictionsError('Horizons metadata unavailable for this model. Playback is disabled until verified horizons are declared.');
      return;
    }
    if (!supportedHorizons.includes(selectedHorizon)) return;

    let isMounted = true;
    const reqId = ++predictionReqIdRef.current;
    setIsLoadingPredictions(true);
    setPredictionsError(null);

    apiClient
      .getModelPredictions(
        selectedModelVersion,
        selectedHorizon,
        selectedSplit,
        predictionLimit,
        predictionOffset,
        {
          predictionsPath: selectedModelSummary?.predictions_path,
          issueTimePurged
        }
      )
      .then(res => {
        if (!isMounted || reqId !== predictionReqIdRef.current) return;
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
  }, [
    selectedTier,
    selectedModelVersion,
    selectedHorizon,
    selectedSplit,
    predictionOffset,
    issueTimePurged,
    selectedModelSummary?.predictions_path,
    supportedHorizons
  ]);

  // Manual trigger for planned shadow runs (avoids unprompted auto-fetch)
  const handleFetchShadowRuns = async () => {
    setIsLoadingShadowRuns(true);
    setShadowRunsError(null);
    setSelectedRunDetail(null);
    const res = await apiClient.getForecastRuns();
    setIsLoadingShadowRuns(false);
    if (res.ok) {
      setShadowRunsPage(res.data);
      setShadowRunsError(null);
    } else {
      setShadowRunsPage(null);
      setShadowRunsError(res.error?.message || 'Shadow forecast runs endpoint unavailable.');
    }
  };

  const handleViewRunDetail = async (runId: string) => {
    setIsLoadingRunDetail(true);
    setRunDetailError(null);
    const res = await apiClient.getForecastRun(runId);
    setIsLoadingRunDetail(false);
    if (res.ok) {
      setSelectedRunDetail(res.data);
      setRunDetailError(null);
    } else {
      setSelectedRunDetail(null);
      setRunDetailError(res.error?.message || 'Forecast run detail unavailable.');
    }
  };

  const handleExportPredictionsCsv = () => {
    if (!predictionsPage || predictionsPage.points.length === 0) return;
    const isUtc = 'timezone' in predictionsPage && predictionsPage.timezone === 'UTC';
    const headers = [
      'Station_ID',
      'Split',
      'Horizon_H',
      isUtc ? 'Issue_Time_UTC' : 'Issue_Time_Recorded',
      isUtc ? 'Target_Time_UTC' : 'Target_Time_Recorded',
      'Observed_Target',
      'LightGBM_Prediction',
      'Persistence_Baseline',
      'Prev_Day_Same_Hour_Baseline',
      'Absolute_Error_LightGBM',
      'Unit',
      'Dataset_Mode',
      'Evaluation_Cohort'
    ];
    const rows = predictionsPage.points.map((pt: HeldoutPrediction | UtcHeldoutPrediction) => {
      const err = pt.lightgbm !== null ? Math.abs(pt.observed - pt.lightgbm).toFixed(2) : '';
      const issueTime = 'issue_at_utc' in pt ? pt.issue_at_utc : (pt as HeldoutPrediction).issue_at_recorded;
      const targetTime = 'target_at_utc' in pt ? pt.target_at_utc : (pt as HeldoutPrediction).target_at_recorded;
      const horizon = 'horizon_h' in pt ? pt.horizon_h : selectedHorizon;
      return [
        pt.station_id,
        pt.split,
        horizon,
        issueTime,
        targetTime,
        pt.observed.toFixed(2),
        pt.lightgbm !== null ? pt.lightgbm.toFixed(2) : '',
        pt.persistence !== null ? pt.persistence.toFixed(2) : '',
        pt.previous_day_same_hour !== null ? pt.previous_day_same_hour.toFixed(2) : '',
        err,
        predictionsPage.unit,
        predictionsPage.dataset_mode,
        predictionsPage.evaluation_cohort
      ];
    });
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `breathewise_predictions_${selectedModelVersion}_h${selectedHorizon}_${selectedSplit}_offset${predictionOffset}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const recoveredModelSummary = useMemo(() => {
    if (modelCatalogue?.models) {
      const found = modelCatalogue.models.find(
        m => m.model_version === 'supplied-native-75-v1' || m.kind === 'native_diagnostic'
      );
      if (found) return found;
    }
    if (apiClient.getDemoMode()) {
      return DEMO_MODELS.models.find(m => m.kind === 'native_diagnostic') || null;
    }
    return null;
  }, [modelCatalogue]);

  // Select horizons for active view mode (primary issue-purged vs historical target-only)
  const activeHorizons = useMemo(() => {
    if (!evaluation) return [];
    if (evaluationViewMode === 'target_only' && evaluation.target_only_horizons && evaluation.target_only_horizons.length > 0) {
      return evaluation.target_only_horizons;
    }
    return evaluation.horizons;
  }, [evaluation, evaluationViewMode]);

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
              <span className="font-bold text-xs">Tier 1: Supplied Booster</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 uppercase">
                Diagnostic Only
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
              <span className="font-bold text-xs">Tier 2: Experimental Models</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-teal-200 text-teal-900 uppercase">
                Contract 1.3.0
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Retrospective hourly experiments (recorded-v2 & openaq-UTC-v1) with issue-purged cohorts
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
              Internal prospective shadow logging & real-time intake verification
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
                    {recoveredModelSummary?.supported_horizons && recoveredModelSummary.supported_horizons.length > 0
                      ? `[${recoveredModelSummary.supported_horizons.map(h => `+${h}h`).join(', ')}]`
                      : <span className="text-slate-400 italic">No verified horizons declared in registry metadata</span>}
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
      {/* Tier 2 Details: Independent Experimental Models (Contract 1.3.0)  */}
      {/* ------------------------------------------------------------------ */}
      {selectedTier === 'experimental' && (
        isLoadingCatalogue ? (
          <Card>
            <CardContent className="p-8 text-center text-xs text-slate-500">
              Loading model registry from API...
            </CardContent>
          </Card>
        ) : catalogueError ? (
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-sm font-bold text-red-900 flex items-center gap-2">
                  <span>⚠️ Model Registry Unavailable</span>
                  {catalogueErrorCode && (
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-red-200 text-red-900 font-bold">
                      {catalogueErrorCode}
                    </span>
                  )}
                </CardTitle>
                <span className="text-[10px] font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-200">
                  HTTP Error / Network Failure
                </span>
              </div>
              <CardDescription className="text-xs text-red-700 mt-1">
                {catalogueError}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <button
                onClick={fetchCatalogue}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-red-100 text-red-800 border border-red-200 hover:bg-red-200 cursor-pointer transition-colors"
              >
                Retry Registry Request
              </button>
            </CardContent>
          </Card>
        ) : experimentalModels.length === 0 ? (
          <Card className="border-slate-200 bg-slate-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-800">
                No Retrospective Models in Registry
              </CardTitle>
              <CardDescription className="text-xs text-slate-600">
                The connected API registry contains no retrospective forecast models. Connect to a live API with registered models, or enable Demo Preview for offline demonstration fixtures.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <button
                onClick={fetchCatalogue}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                Refresh Registry
              </button>
            </CardContent>
          </Card>
        ) : (
        <div className="space-y-5">
          {/* Provenance & Registry Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2 flex-wrap">
                    <span>{selectedModelVersion}</span>
                    <span className="text-xs font-normal text-slate-500">— Retrospective Experiment</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {isUtcModel
                      ? `UTC-native retrospective provider experiment (station openaq-235, 39 causal features). Bounded OpenAQ provider clock with :30 UTC phase.`
                      : `Single-station retrospective recorded-clock experiment (Anand Vihar source site_301, 39 causal features). Not live forecasting or 54-station validation.`}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {experimentalModels.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="model-version-selector" className="text-xs font-semibold text-slate-600">
                        Version:
                      </label>
                      <select
                        id="model-version-selector"
                        value={selectedModelVersion}
                        onChange={e => {
                          setSelectedModelVersion(e.target.value);
                          setPredictionOffset(0);
                        }}
                        className="text-xs font-mono font-bold bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      >
                        {experimentalModels.map(m => (
                          <option key={m.model_version} value={m.model_version}>
                            {m.model_version} ({m.dataset_mode === 'utc_provider_history' ? 'UTC Provider Clock' : 'Recorded Clock'} • {m.supported_horizons?.length ?? 0} horizons)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-teal-100 text-teal-900 border border-teal-200">
                    Status: Retrospective ({selectedModelSummary?.status || 'available'})
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Dataset Mode & Clock</div>
                  <div className="text-xs font-mono font-bold text-slate-900 mt-1">
                    {evaluation?.dataset_mode || selectedModelSummary?.dataset_mode || 'recorded_clock'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Basis: <code className="font-mono text-[10px] font-bold text-teal-800">{clockBasis}</code>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Dataset Checksum (SHA256)</div>
                  <div className="text-[10px] font-mono text-slate-800 truncate mt-1" title={evaluation?.dataset_sha256}>
                    {evaluation?.dataset_sha256 ? `${evaluation.dataset_sha256.substring(0, 16)}...` : 'Audited Parquet Archive'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Frozen archive fingerprint</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Experiment Horizons</div>
                  <div className="text-xs font-bold text-teal-800 mt-1">
                    {supportedHorizons.length === 24
                      ? 'All 24 Discrete Hourly Horizons (+1h ... +24h)'
                      : supportedHorizons.length > 0
                        ? `[${supportedHorizons.map(h => `+${h}h`).join(', ')}]`
                        : <span className="text-slate-400 italic">Horizons metadata unavailable for this model</span>}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {supportedHorizons.length > 0 ? `${supportedHorizons.length} evaluated target steps` : 'Target step count unavailable'}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Causal Input Assumption</div>
                  <div className="text-[11px] font-bold text-slate-800 mt-1">
                    {evaluation?.input_availability_assumption || (isUtcModel ? 'verified_openaq_utc_lags_only' : 'same_recorded_clock_causal_lags_only')}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Feature-time rules only; historical publication availability remains unverified</div>
                </div>
              </div>

              {/* Discovered Limitation for Legacy v1 Model */}
              {selectedModelVersion === 'delhi-recorded-pm25-v1' && (
                <div className="p-3.5 bg-amber-50 rounded-lg border border-amber-300 text-amber-950 space-y-1.5 leading-relaxed">
                  <div className="font-bold text-xs uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>Discovered Boundary-Availability Limitation in Legacy v1:</span>
                  </div>
                  <p className="text-[11px] text-amber-900">
                    Historical target-only evaluation in <code className="font-mono font-bold">delhi-recorded-pm25-v1</code> contains split-boundary availability overlaps. Original values are preserved in the catalogue as qualified historical evidence. For strict causal evaluation without lookahead leakage, inspect the issue-purged primary cohorts in <code className="font-mono font-bold">delhi-recorded-pm25-hourly-v2</code> and <code className="font-mono font-bold">delhi-openaq-pm25-hourly-v1</code>.
                  </p>
                </div>
              )}

              {/* Issue-Time Purge Summary for v2 and UTC Models */}
              {evaluation?.issue_time_purge && (
                <div className="p-3.5 bg-sky-50 rounded-lg border border-sky-200 text-sky-950 space-y-2 leading-relaxed">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-xs uppercase tracking-wider text-sky-900">
                      Issue-Time Purged Primary Cohort Summary
                    </span>
                    <span className="font-mono text-[10px] bg-sky-200 text-sky-900 px-2 py-0.5 rounded font-semibold">
                      sidecar: {evaluation.issue_time_purge.sidecar_sha256.slice(0, 16)}...
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-700">
                    Predeclared mechanical issue-time purging removed rows across split boundaries where the issue-time lagged input was not demonstrably available prior to the split cutoff. Frozen models and original predictions remain unchanged; this cohort represents the primary benchmark.
                  </p>
                  {evaluation.issue_time_purge.limitations && evaluation.issue_time_purge.limitations.length > 0 && (
                    <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-0.5">
                      {evaluation.issue_time_purge.limitations.map((lim, idx) => (
                        <li key={idx}>{lim}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Chronological Splits Summary */}
              {evaluation?.splits && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-800 text-[11px]">
                    Chronological Training & Test Splits ({isUtcModel ? 'UTC' : 'Recorded Clock'}):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
                    {evaluation.splits.map((s: RecordedSplit | UtcSplit) => {
                      const startStr = 'start_at_utc' in s ? s.start_at_utc : (s as RecordedSplit).start_recorded_at;
                      const endStr = 'end_at_utc_exclusive' in s ? s.end_at_utc_exclusive : (s as RecordedSplit).end_recorded_at_exclusive;
                      return (
                        <div key={s.name} className="p-2 rounded bg-white border border-slate-200 text-[11px]">
                          <span className="font-bold uppercase text-slate-700 block">{s.name} Split</span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {startStr} → {endStr}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Scientific Caveats List */}
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 space-y-1.5 leading-relaxed">
                <div className="font-bold text-xs uppercase tracking-wider text-slate-700">
                  Scientific Caveats & Model Limits:
                </div>
                <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-0.5">
                  <li>Single-station retrospective evaluation; not operational live forecasting or broad-city validation.</li>
                  <li>Target transform: <code className="font-mono">{evaluation?.target_transform || 'identity'}</code> with target unit <code className="font-mono">{evaluation?.target_unit || 'µg/m³'}</code>.</li>
                  <li>Naive persistence baseline repeats the issue-time concentration at every horizon; previous-day baseline repeats the concentration from the exact same hour 24 hours prior.</li>
                  <li>High-pollution subset (target &ge; 150 µg/m³) has unequal available sample counts across methods; high-target model underprediction is substantial, so do not claim paired high-subset superiority.</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Frozen Evaluation Metrics Table by Horizon */}
          <Card>
            <CardHeader className="py-3 px-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-sm font-bold">
                      Test Split Performance Across Evaluation Horizons
                    </CardTitle>
                    {evaluation?.target_only_horizons && evaluation.target_only_horizons.length > 0 && (
                      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
                        <button
                          onClick={() => setEvaluationViewMode('primary')}
                          className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                            evaluationViewMode === 'primary' ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Primary Purged ({evaluation.horizons.length}h)
                        </button>
                        <button
                          onClick={() => setEvaluationViewMode('target_only')}
                          className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                            evaluationViewMode === 'target_only' ? 'bg-white text-amber-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Target-Only Historical ({evaluation.target_only_horizons.length}h)
                        </button>
                      </div>
                    )}
                  </div>
                  <CardDescription className="text-xs mt-0.5">
                    Comparison of LightGBM regressor vs naive issue-time persistence & same-hour previous day baseline
                  </CardDescription>
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-700">Cohort:</span>
                    <code className="font-mono bg-teal-50 text-teal-800 px-1.5 py-0.5 rounded border border-teal-200">
                      {evaluationViewMode === 'primary'
                        ? (evaluation?.evaluation_cohort || 'fixed_model_issue_time_purged')
                        : 'target_timestamp_split_only'}
                    </code>
                    <span className="text-slate-400">•</span>
                    <span>Common-cohort test MAE strictly evaluated on matched non-null hours.</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 self-start sm:self-auto">
                  Target: PM2.5 (µg/m³)
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingEvaluation ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Loading frozen evaluation metrics...
                </div>
              ) : activeHorizons.length > 0 ? (
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] sticky top-0">
                      <tr>
                        <th className="p-2.5">Horizon</th>
                        <th className="p-2.5">Test Count (N)</th>
                        <th className="p-2.5">LightGBM MAE</th>
                        <th className="p-2.5">LightGBM RMSE</th>
                        <th className="p-2.5">Persistence MAE</th>
                        <th className="p-2.5">Prev Day Same Hr</th>
                        <th className="p-2.5">Relative Gain</th>
                        <th className="p-2.5">High Pollution MAE (&ge;150)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeHorizons.map((h: HorizonEvaluation) => {
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
            <CardHeader className="py-3 px-4 border-b border-slate-100">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-bold">
                      Historical Held-Out Prediction Playback
                    </CardTitle>
                    <span className="text-[10px] font-mono bg-teal-50 text-teal-800 border border-teal-200 px-1.5 py-0.2 rounded font-semibold">
                      Contract 1.3.0
                    </span>
                  </div>
                  <CardDescription className="text-xs mt-0.5">
                    Step-by-step playback of held-out prediction rows comparing LightGBM against actual observations and causal baselines
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Split Switcher */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs flex-wrap">
                    {availableSplits.map(s => (
                      <button
                        key={s}
                        disabled={supportedHorizons.length === 0}
                        onClick={() => {
                          setSelectedSplit(s);
                          setPredictionOffset(0);
                        }}
                        className={`px-2 py-1 text-[11px] font-bold rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          selectedSplit === s
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {s === 'test' ? 'Test Split' : s === 'validation' ? 'Val Split' : s}
                      </button>
                    ))}
                  </div>

                  {/* Issue-Time Purged Toggle */}
                  <label className={`flex items-center gap-1.5 text-xs text-slate-700 font-semibold select-none bg-slate-50 px-2 py-1 rounded border border-slate-200 ${supportedHorizons.length === 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      checked={issueTimePurged}
                      disabled={supportedHorizons.length === 0}
                      onChange={e => {
                        setIssueTimePurged(e.target.checked);
                        setPredictionOffset(0);
                      }}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <span className="text-[11px]">Purged Cohort</span>
                  </label>

                  {/* CSV Export Button */}
                  <button
                    onClick={handleExportPredictionsCsv}
                    disabled={!predictionsPage || predictionsPage.points.length === 0 || supportedHorizons.length === 0}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Export Batch (CSV)
                  </button>
                </div>
              </div>

              {/* Horizon Picker Bar */}
              <div className="pt-2 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-semibold">Horizon (+H h):</span>
                <div className="flex flex-wrap items-center gap-1">
                  {supportedHorizons.length > 0 ? (
                    supportedHorizons.map(h => (
                      <button
                        key={h}
                        onClick={() => {
                          setSelectedHorizon(h);
                          setPredictionOffset(0);
                        }}
                        className={`px-2 py-0.5 text-xs font-bold rounded transition-colors cursor-pointer ${
                          selectedHorizon === h
                            ? 'bg-teal-700 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        +{h}h
                      </button>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">
                      Horizons metadata unavailable for this model
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>

            {/* Provenance & Clock Banner */}
            <div className="p-3 bg-amber-50/80 border-b border-amber-200 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span>⚠️</span>
                <span>
                  <strong>{isUtcModel ? 'UTC Provider Clock Playback' : 'Recorded Clock Playback'}:</strong>{' '}
                  {isUtcModel
                    ? `Evaluated on OpenAQ provider clock with :30 UTC phase (station openaq-235). Issue cutoff: UTC; Target: +${selectedHorizon}h UTC.`
                    : `Evaluated on naive station clocks (site_301). Issue time = data-logger causal cutoff; Target: +${selectedHorizon}h.`}
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
                  dataset_mode: {predictionsPage?.dataset_mode || (isUtcModel ? 'utc_provider_history' : 'recorded_clock')}
                </span>
                <span className="bg-teal-100 text-teal-900 px-1.5 py-0.5 rounded font-semibold">
                  cohort: {predictionsPage?.evaluation_cohort || (issueTimePurged ? 'fixed_model_issue_time_purged' : 'target_timestamp_split_only')}
                </span>
              </div>
            </div>

            <CardContent className="p-0">
              {isLoadingPredictions ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Loading +{selectedHorizon}h {selectedSplit} prediction samples...
                </div>
              ) : predictionsPage?.points && predictionsPage.points.length > 0 ? (
                <>
                  {/* Interactive Observed vs Predicted Visualization */}
                  <div className="p-4 bg-slate-900 border-b border-slate-800 text-white space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-200">Prediction Sequence Visualizer</span>
                        <div className="flex rounded-md bg-slate-800 p-0.5 border border-slate-700">
                          <button
                            onClick={() => setChartViewMode('tracks')}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer transition-colors ${
                              chartViewMode === 'tracks' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Concentration Tracks
                          </button>
                          <button
                            onClick={() => setChartViewMode('residuals')}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer transition-colors ${
                              chartViewMode === 'residuals' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Residual Errors (Δ)
                          </button>
                        </div>
                      </div>

                      {/* Legend */}
                      <div className="flex items-center gap-3 text-[11px] flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                          <span className="text-slate-300">Observed</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-teal-400" />
                          <span className="text-teal-400 font-semibold">LightGBM</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                          <span className="text-amber-300">Persistence</span>
                        </div>
                      </div>
                    </div>

                    {/* SVG Chart */}
                    <div className="relative w-full h-48 sm:h-56">
                      {(() => {
                        const points = predictionsPage.points;
                        if (points.length === 0) return null;

                        const maxVal = Math.max(
                          ...points.map(p => p.observed),
                          ...points.map(p => p.lightgbm ?? 0),
                          ...points.map(p => p.persistence ?? 0),
                          50
                        ) * 1.15;

                        const chartW = 740;
                        const chartH = 170;
                        const padL = 40;
                        const padT = 15;

                        const getX = (idx: number) => padL + (idx / Math.max(1, points.length - 1)) * (chartW - padL);
                        const getY = (val: number) => padT + chartH - (val / maxVal) * chartH;

                        const gridLevels = [0, 0.25, 0.5, 0.75, 1];

                        if (chartViewMode === 'tracks') {
                          const obsPointsStr = points.map((p, i) => `${getX(i).toFixed(1)},${getY(p.observed).toFixed(1)}`).join(' ');
                          const lgbValid = points.map((p, i) => p.lightgbm !== null ? { x: getX(i), y: getY(p.lightgbm) } : null).filter(Boolean);
                          const lgbPointsStr = lgbValid.map(p => `${p!.x.toFixed(1)},${p!.y.toFixed(1)}`).join(' ');
                          const persValid = points.map((p, i) => p.persistence !== null ? { x: getX(i), y: getY(p.persistence) } : null).filter(Boolean);
                          const persPointsStr = persValid.map(p => `${p!.x.toFixed(1)},${p!.y.toFixed(1)}`).join(' ');

                          return (
                            <svg viewBox="0 0 760 210" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                              {gridLevels.map((lvl, idx) => {
                                const yPos = padT + chartH - lvl * chartH;
                                const valLabel = Math.round(lvl * maxVal);
                                return (
                                  <g key={idx}>
                                    <line x1={padL} y1={yPos} x2={chartW} y2={yPos} stroke="#334155" strokeWidth="0.8" strokeDasharray="3,3" />
                                    <text x={padL - 6} y={yPos + 3} textAnchor="end" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                                      {valLabel}
                                    </text>
                                  </g>
                                );
                              })}

                              {persPointsStr && (
                                <polyline
                                  fill="none"
                                  stroke="#f59e0b"
                                  strokeWidth="1.5"
                                  strokeDasharray="4,4"
                                  points={persPointsStr}
                                  opacity={0.85}
                                />
                              )}

                              {obsPointsStr && (
                                <polyline
                                  fill="none"
                                  stroke="#cbd5e1"
                                  strokeWidth="2"
                                  points={obsPointsStr}
                                />
                              )}

                              {lgbPointsStr && (
                                <polyline
                                  fill="none"
                                  stroke="#14b8a6"
                                  strokeWidth="2.5"
                                  points={lgbPointsStr}
                                />
                              )}

                              {points.map((p, i) => {
                                const px = getX(i);
                                const pyObs = getY(p.observed);
                                const pyLgb = p.lightgbm !== null ? getY(p.lightgbm) : null;
                                const isHovered = hoveredPointIndex === i;

                                return (
                                  <g key={i}>
                                    {isHovered && (
                                      <line x1={px} y1={padT} x2={px} y2={padT + chartH} stroke="#2dd4bf" strokeWidth="1" strokeDasharray="2,2" />
                                    )}
                                    <circle cx={px} cy={pyObs} r={isHovered ? 4.5 : 2.5} fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
                                    {pyLgb !== null && (
                                      <circle cx={px} cy={pyLgb} r={isHovered ? 5 : 3} fill="#14b8a6" stroke="#ffffff" strokeWidth="1.5" />
                                    )}
                                    <rect
                                      x={px - 14}
                                      y={padT}
                                      width={28}
                                      height={chartH}
                                      fill="transparent"
                                      className="cursor-pointer"
                                      onMouseEnter={() => setHoveredPointIndex(i)}
                                      onMouseLeave={() => setHoveredPointIndex(null)}
                                    />
                                  </g>
                                );
                              })}
                            </svg>
                          );
                        } else {
                          const residuals = points.map(p => ({
                            lgbRes: p.lightgbm !== null ? p.lightgbm - p.observed : null,
                            persRes: p.persistence !== null ? p.persistence - p.observed : null
                          }));
                          const maxAbsRes = Math.max(
                            ...residuals.map(r => Math.abs(r.lgbRes ?? 0)),
                            ...residuals.map(r => Math.abs(r.persRes ?? 0)),
                            15
                          ) * 1.2;

                          const yZero = padT + chartH / 2;
                          const getResY = (val: number) => yZero - (val / maxAbsRes) * (chartH / 2);

                          return (
                            <svg viewBox="0 0 760 210" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                              <line x1={padL} y1={yZero} x2={chartW} y2={yZero} stroke="#64748b" strokeWidth="1.5" />
                              <text x={padL - 6} y={yZero + 3} textAnchor="end" fill="#38bdf8" fontSize="9" fontFamily="monospace">
                                0
                              </text>
                              <text x={chartW} y={yZero - 6} textAnchor="end" fill="#94a3b8" fontSize="8">
                                + Over-prediction
                              </text>
                              <text x={chartW} y={yZero + 12} textAnchor="end" fill="#94a3b8" fontSize="8">
                                - Under-prediction
                              </text>

                              <line x1={padL} y1={getResY(maxAbsRes * 0.75)} x2={chartW} y2={getResY(maxAbsRes * 0.75)} stroke="#334155" strokeWidth="0.8" strokeDasharray="3,3" />
                              <text x={padL - 6} y={getResY(maxAbsRes * 0.75) + 3} textAnchor="end" fill="#94a3b8" fontSize="8" fontFamily="monospace">
                                +{Math.round(maxAbsRes * 0.75)}
                              </text>
                              <line x1={padL} y1={getResY(-maxAbsRes * 0.75)} x2={chartW} y2={getResY(-maxAbsRes * 0.75)} stroke="#334155" strokeWidth="0.8" strokeDasharray="3,3" />
                              <text x={padL - 6} y={getResY(-maxAbsRes * 0.75) + 3} textAnchor="end" fill="#94a3b8" fontSize="8" fontFamily="monospace">
                                -{Math.round(maxAbsRes * 0.75)}
                              </text>

                              {points.map((p, i) => {
                                const px = getX(i);
                                const lgbRes = residuals[i].lgbRes;
                                const isHovered = hoveredPointIndex === i;

                                if (lgbRes === null) return null;
                                const barY = lgbRes >= 0 ? getResY(lgbRes) : yZero;
                                const barH = Math.abs(getResY(lgbRes) - yZero);

                                return (
                                  <g key={i}>
                                    <rect
                                      x={px - 4}
                                      y={barY}
                                      width={8}
                                      height={Math.max(2, barH)}
                                      fill={lgbRes >= 0 ? '#14b8a6' : '#f43f5e'}
                                      opacity={isHovered ? 1 : 0.85}
                                      rx={1.5}
                                    />
                                    <rect
                                      x={px - 14}
                                      y={padT}
                                      width={28}
                                      height={chartH}
                                      fill="transparent"
                                      className="cursor-pointer"
                                      onMouseEnter={() => setHoveredPointIndex(i)}
                                      onMouseLeave={() => setHoveredPointIndex(null)}
                                    />
                                  </g>
                                );
                              })}
                            </svg>
                          );
                        }
                      })()}
                    </div>

                    {/* Active Hover Point Detail Readout */}
                    {hoveredPointIndex !== null && predictionsPage.points[hoveredPointIndex] && (
                      <div className="bg-slate-800/90 border border-slate-700 rounded-lg p-2.5 text-xs flex flex-wrap items-center justify-between gap-3 text-slate-200">
                        {(() => {
                          const pt = predictionsPage.points[hoveredPointIndex];
                          const targetTime = 'target_at_utc' in pt ? pt.target_at_utc : (pt as HeldoutPrediction).target_at_recorded;
                          return (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] text-teal-400 font-bold">
                                  Row #{predictionOffset + hoveredPointIndex + 1}:
                                </span>
                                <span className="font-mono text-[11px] text-slate-300">
                                  Target ({isUtcModel ? 'UTC' : 'Recorded'}): {targetTime}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-xs font-mono">
                                <div>
                                  <span className="text-slate-400 block text-[10px]">Observed</span>
                                  <span className="font-bold text-white">
                                    {pt.observed.toFixed(1)} µg/m³
                                  </span>
                                </div>
                                <div>
                                  <span className="text-teal-400 block text-[10px]">LightGBM</span>
                                  <span className="font-bold text-teal-300">
                                    {pt.lightgbm !== null
                                      ? `${pt.lightgbm.toFixed(1)} µg/m³`
                                      : 'Missing'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-amber-400 block text-[10px]">Persistence</span>
                                  <span className="font-bold text-amber-300">
                                    {pt.persistence !== null
                                      ? `${pt.persistence.toFixed(1)} µg/m³`
                                      : 'Unpaired'}
                                  </span>
                                </div>
                                {pt.lightgbm !== null && (
                                  <div>
                                    <span className="text-slate-400 block text-[10px]">Error</span>
                                    <span className="font-bold text-slate-100">
                                      {Math.abs(pt.observed - pt.lightgbm).toFixed(1)} µg/m³
                                    </span>
                                  </div>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] sticky top-0">
                        <tr>
                          <th className="p-2.5">Station</th>
                          <th className="p-2.5">Split</th>
                          <th className="p-2.5">Issue Time ({isUtcModel ? 'UTC' : 'Recorded'})</th>
                          <th className="p-2.5">Target Time ({isUtcModel ? 'UTC' : 'Recorded'})</th>
                          <th className="p-2.5">Observed Target</th>
                          <th className="p-2.5">LightGBM Prediction</th>
                          <th className="p-2.5">Persistence Baseline</th>
                          <th className="p-2.5">Prev Day Same Hr</th>
                          <th className="p-2.5">Absolute Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {predictionsPage.points.map((row: HeldoutPrediction | UtcHeldoutPrediction, idx: number) => {
                          const err = row.lightgbm !== null ? Math.abs(row.observed - row.lightgbm) : null;
                          const persErr = row.persistence !== null ? Math.abs(row.observed - row.persistence) : null;
                          const deltaVsPers = (err !== null && persErr !== null) ? err - persErr : null;
                          const issueTime = 'issue_at_utc' in row ? row.issue_at_utc : (row as HeldoutPrediction).issue_at_recorded;
                          const targetTime = 'target_at_utc' in row ? row.target_at_utc : (row as HeldoutPrediction).target_at_recorded;

                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2.5 font-bold text-slate-800">{row.station_id}</td>
                              <td className="p-2.5">
                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                  {row.split}
                                </span>
                              </td>
                              <td className="p-2.5 font-mono text-[11px] text-slate-500">{issueTime}</td>
                              <td className="p-2.5 font-mono text-[11px] text-slate-700">{targetTime}</td>
                              <td className="p-2.5 font-bold text-slate-900">
                                {row.observed.toFixed(1)} µg/m³
                              </td>
                              <td className="p-2.5 font-extrabold text-teal-800">
                                {row.lightgbm !== null ? `${row.lightgbm.toFixed(1)} µg/m³` : (
                                  <span className="text-slate-400 italic">Missing</span>
                                )}
                              </td>
                              <td className="p-2.5 text-slate-600">
                                {row.persistence !== null ? `${row.persistence.toFixed(1)} µg/m³` : (
                                  <span className="text-slate-400 italic">Unpaired</span>
                                )}
                              </td>
                              <td className="p-2.5 text-slate-500">
                                {row.previous_day_same_hour !== null ? `${row.previous_day_same_hour.toFixed(1)} µg/m³` : '—'}
                              </td>
                              <td className="p-2.5 font-mono font-semibold text-slate-700">
                                {err !== null ? (
                                  <span
                                    title={deltaVsPers !== null
                                      ? `LightGBM error: ${err.toFixed(1)} µg/m³ • Persistence error: ${persErr?.toFixed(1)} µg/m³ (${deltaVsPers < 0 ? 'LightGBM superior by ' + Math.abs(deltaVsPers).toFixed(1) : 'Persistence closer by ' + deltaVsPers.toFixed(1)} µg/m³)`
                                      : `Error: ${err.toFixed(1)} µg/m³`
                                    }
                                    className="cursor-help"
                                  >
                                    {err.toFixed(1)} µg/m³
                                    {deltaVsPers !== null && (
                                      <span className={`ml-1.5 text-[9px] px-1 py-0.2 rounded font-mono ${
                                        deltaVsPers < 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                                      }`}>
                                        {deltaVsPers < 0 ? `-${Math.abs(deltaVsPers).toFixed(1)}` : `+${deltaVsPers.toFixed(1)}`}
                                      </span>
                                    )}
                                  </span>
                                ) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Bounded Pagination Controls */}
                  <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                    <div>
                      Showing <span className="font-bold text-slate-900">{predictionsPage.points.length > 0 ? predictionOffset + 1 : 0}</span> – <span className="font-bold text-slate-900">{Math.min(predictionOffset + predictionLimit, predictionsPage.total_count)}</span> of <span className="font-bold text-slate-900">{predictionsPage.total_count}</span> recorded prediction rows
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPredictionOffset(prev => Math.max(0, prev - predictionLimit))}
                        disabled={predictionOffset === 0 || isLoadingPredictions || supportedHorizons.length === 0}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        ← Previous {predictionLimit}
                      </button>
                      <button
                        onClick={() => setPredictionOffset(prev => prev + predictionLimit)}
                        disabled={!predictionsPage || (predictionOffset + predictionLimit) >= predictionsPage.total_count || isLoadingPredictions || supportedHorizons.length === 0}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        Next {predictionLimit} →
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 font-medium bg-slate-50/50">
                  {predictionsError || (supportedHorizons.length === 0 ? 'Horizons metadata unavailable for this model. Playback sequence is disabled.' : `No prediction rows found for horizon +${selectedHorizon}h.`)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        )
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Tier 3 Details: Operational Production Model & Shadow Pipeline     */}
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

          {/* Card 2: Experimental UTC Shadow Forecasting Pipeline */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2 flex-wrap">
                    <span>Experimental UTC Shadow Forecasting</span>
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200">
                      utc-persistence-shadow-v1
                    </span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Prospective baseline execution and outcome pairing against live telemetry
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                    Shadow Operation (Internal Audit)
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                    Live Public: Gated
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="p-4 bg-sky-50/50 rounded-xl border border-sky-100 space-y-3 text-slate-700 leading-relaxed">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  <span className="font-bold text-slate-900 text-sm">Prospective Shadow Baseline Protocol</span>
                </div>
                <p>
                  Unlike retrospective evaluation on historical recorded clocks, this experimental pipeline operates with strict UTC hour-ending timestamps (:30 provider phase). It repeats the most recent eligible known PM2.5 observation at each of 24 hourly targets to collect prospective validation pairs against future telemetry.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                  <div className="bg-white p-2 rounded-lg border border-sky-200">
                    <span className="text-slate-500 block text-[10px]">operation</span>
                    <span className="font-bold text-slate-800">shadow</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-sky-200">
                    <span className="text-slate-500 block text-[10px]">clock_basis</span>
                    <span className="font-bold text-slate-800">UTC_hour_ending</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-sky-200">
                    <span className="text-slate-500 block text-[10px]">public_live_forecast_ready</span>
                    <span className="font-bold text-rose-700">false</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-sky-200">
                    <span className="text-slate-500 block text-[10px]">activity_planning_ready</span>
                    <span className="font-bold text-rose-700">false</span>
                  </div>
                </div>
              </div>

              {/* Shadow Runs List / Status */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                  <span>Persisted Shadow Runs (<code className="font-mono text-[11px] text-teal-800">GET /api/v1/forecast-runs</code>)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-mono text-[11px]">
                      Total: {shadowRunsPage?.total_count ?? 0}
                    </span>
                    <button
                      onClick={handleFetchShadowRuns}
                      disabled={isLoadingShadowRuns}
                      className="px-2 py-0.5 text-[10px] font-semibold rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      {isLoadingShadowRuns ? 'Querying...' : 'Query Runs'}
                    </button>
                  </div>
                </div>

                {isLoadingShadowRuns ? (
                  <div className="p-4 text-center text-xs text-slate-500 font-medium bg-slate-50 rounded-lg">
                    Loading persisted shadow runs...
                  </div>
                ) : shadowRunsPage && shadowRunsPage.runs.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                        <tr>
                          <th className="p-2">Station</th>
                          <th className="p-2">Model</th>
                          <th className="p-2">Scheduled Issue (UTC)</th>
                          <th className="p-2">Input Cutoff (UTC)</th>
                          <th className="p-2">Predictions</th>
                          <th className="p-2">Matched Outcomes</th>
                          <th className="p-2">Status</th>
                          <th className="p-2">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {shadowRunsPage.runs.map((run: ForecastRunView) => (
                          <tr key={run.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-2 font-bold text-slate-800">{run.station_id}</td>
                            <td className="p-2 font-mono text-[11px] text-slate-600">{run.model_version}</td>
                            <td className="p-2 font-mono text-[11px] text-slate-500">{run.issue_at}</td>
                            <td className="p-2 font-mono text-[11px] text-slate-500">{run.input_cutoff}</td>
                            <td className="p-2 font-semibold text-slate-700">{run.prediction_count}</td>
                            <td className="p-2 font-semibold text-teal-700">{run.matched_count}</td>
                            <td className="p-2">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                run.status === 'succeeded' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {run.status}
                                {run.error_code ? ` (${run.error_code})` : ''}
                              </span>
                            </td>
                            <td className="p-2">
                              <button
                                onClick={() => handleViewRunDetail(run.id)}
                                disabled={isLoadingRunDetail}
                                className="px-2 py-0.5 text-[10px] font-semibold rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                              >
                                View Detail
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500 font-medium bg-slate-50 rounded-lg space-y-1">
                    <p className="font-semibold text-slate-700">No shadow runs executed in current session</p>
                    <p className="text-[11px] text-slate-500">
                      Shadow runs are dispatched via administrator worker CLI (<code className="font-mono text-[10px] bg-slate-200 px-1 py-0.5 rounded">python scripts/shadow_forecasts.py</code>) using strict UTC cutoffs. Outcomes pair as future telemetry arrives.
                    </p>
                  </div>
                )}

                {shadowRunsError && (
                  <div className="p-2 text-center text-xs text-rose-600 bg-rose-50 rounded border border-rose-200">
                    {shadowRunsError}
                  </div>
                )}

                {/* Selected Shadow Run Detail Panel */}
                {selectedRunDetail && (
                  <div className="p-4 bg-white rounded-lg border border-sky-300 shadow-sm space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">Run Detail:</span>
                        <code className="font-mono text-xs text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                          {selectedRunDetail.run.id}
                        </code>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          selectedRunDetail.run.status === 'succeeded' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {selectedRunDetail.run.status}
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedRunDetail(null)}
                        className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                      >
                        ✕ Close Detail
                      </button>
                    </div>

                    {selectedRunDetail.run.error_code && (
                      <div className="p-2.5 bg-amber-50 rounded border border-amber-200 text-amber-950 text-xs space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <span>⚠️</span>
                          <span>Real Intake Rejection Code: <code className="font-mono text-amber-900">{selectedRunDetail.run.error_code}</code></span>
                        </div>
                        <p className="text-[11px] text-amber-900">
                          This run was rejected during scheduled evaluation (e.g. stale provider input or expired issue cutoff). Retaining rejected runs and zero forecast rows represents authentic real intake outcomes rather than artificial synthetic success.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                      <div className="bg-slate-50 p-2 rounded border border-slate-200">
                        <span className="text-slate-500 block text-[10px]">Model</span>
                        <span className="font-bold text-slate-800 truncate block">{selectedRunDetail.run.model_version}</span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded border border-slate-200">
                        <span className="text-slate-500 block text-[10px]">Scheduled Issue</span>
                        <span className="font-bold text-slate-800">{selectedRunDetail.run.issue_at}</span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded border border-slate-200">
                        <span className="text-slate-500 block text-[10px]">Input Cutoff</span>
                        <span className="font-bold text-slate-800">{selectedRunDetail.run.input_cutoff}</span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded border border-slate-200">
                        <span className="text-slate-500 block text-[10px]">Matched Outcomes</span>
                        <span className="font-bold text-teal-700">{selectedRunDetail.run.matched_count} of {selectedRunDetail.run.prediction_count}</span>
                      </div>
                    </div>

                    {selectedRunDetail.predictions.length > 0 ? (
                      <div className="overflow-x-auto border border-slate-200 rounded max-h-60">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] sticky top-0">
                            <tr>
                              <th className="p-2">Horizon</th>
                              <th className="p-2">Target (UTC)</th>
                              <th className="p-2">Forecast PM2.5</th>
                              <th className="p-2">Observed PM2.5</th>
                              <th className="p-2">Error</th>
                              <th className="p-2">Flags</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedRunDetail.predictions.map((pt: ShadowPoint, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-2 font-bold text-slate-800">+{pt.horizon_h}h</td>
                                <td className="p-2 font-mono text-[11px] text-slate-600">{pt.target_at}</td>
                                <td className="p-2 font-bold text-teal-800">{pt.concentration.toFixed(1)} µg/m³</td>
                                <td className="p-2 text-slate-700">
                                  {pt.observed !== null && pt.observed !== undefined ? `${pt.observed.toFixed(1)} µg/m³` : (
                                    <span className="text-slate-400 italic">Pending Telemetry</span>
                                  )}
                                </td>
                                <td className="p-2 font-mono">
                                  {pt.error !== null && pt.error !== undefined ? `${pt.error.toFixed(1)} µg/m³` : '—'}
                                </td>
                                <td className="p-2 text-[10px] text-slate-500">
                                  {pt.quality_flags && pt.quality_flags.length > 0 ? pt.quality_flags.join(', ') : 'none'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-3 text-center text-xs text-slate-500 bg-slate-50 rounded">
                        0 forecast rows generated for this run ({selectedRunDetail.run.error_code || 'No predictions generated'}).
                      </div>
                    )}
                  </div>
                )}
                {runDetailError && (
                  <div className="p-2 text-center text-xs text-rose-600 bg-rose-50 rounded border border-rose-200">
                    {runDetailError}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
