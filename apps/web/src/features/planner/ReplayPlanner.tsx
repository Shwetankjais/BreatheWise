import React, { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../lib/api/client';
import { formatReplayTimestamp } from '../../lib/replay';
import type { Schemas } from '../../lib/api/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';

type Props = { supportedVersions: string[] };
const describeClock = formatReplayTimestamp;

/** Historical forecast-only planning; never substitutes observations or demo forecasts. */
export function ReplayPlanner({ supportedVersions }: Props) {
  const [models, setModels] = useState<Schemas['ModelSummary'][]>([]);
  const [version, setVersion] = useState('');
  const [issues, setIssues] = useState<Schemas['ReplayIssuePage'] | null>(null);
  const [issue, setIssue] = useState('');
  const [offset, setOffset] = useState(0);
  const [duration, setDuration] = useState(120);
  const [earliest, setEarliest] = useState(0);
  const [latest, setLatest] = useState(24);
  const [sensitivity, setSensitivity] = useState<'general' | 'sensitive'>('general');
  const [ceiling, setCeiling] = useState('');
  const [result, setResult] = useState<Schemas['ReplayPlan'] | null>(null);
  const [activeWindowIndex, setActiveWindowIndex] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const requestId = useRef(0);
  const scope = supportedVersions.join('|');

  useEffect(() => {
    let current = true;
    setError('');
    apiClient.getModels().then(res => {
      if (!current) return;
      if (!res.ok) {
        setError(`${res.error.code}: ${res.error.message}`);
        return;
      }
      const eligible = res.data.models.filter(m => scope.split('|').includes(m.model_version));
      setModels(eligible);
      setVersion(v => (eligible.some(m => m.model_version === v) ? v : eligible[0]?.model_version || ''));
    });
    return () => {
      current = false;
    };
  }, [scope, retry]);

  useEffect(() => {
    let current = true;
    requestId.current += 1;
    setResult(null);
    setIssues(null);
    setIssue('');
    setError('');
    if (!version) return;
    setLoading(true);
    apiClient.getReplayIssues(version, offset).then(res => {
      if (!current) return;
      setLoading(false);
      if (!res.ok) {
        setError(`${res.error.code}: ${res.error.message}`);
        return;
      }
      setIssues(res.data);
      setIssue(res.data.issues[0]?.issue_at || '');
    });
    return () => {
      current = false;
    };
  }, [version, offset, retry]);

  const resetResult = () => {
    requestId.current += 1;
    setRunning(false);
    setResult(null);
    setActiveWindowIndex(0);
  };

  async function compare(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setResult(null);
    setActiveWindowIndex(0);
    const meanLimit = ceiling.trim() === '' ? null : Number(ceiling);
    if (meanLimit !== null && (!Number.isFinite(meanLimit) || meanLimit < 0)) {
      setError('Enter a finite, non-negative concentration ceiling.');
      return;
    }
    if (earliest >= latest || duration / 60 > latest - earliest) {
      setError('Your duration must fit inside the selected hour bounds.');
      return;
    }
    const id = ++requestId.current;
    setRunning(true);
    try {
      const res = await apiClient.planReplay({
        model_version: version,
        issue_at: issue,
        split: 'test',
        duration_minutes: duration,
        earliest_start_h: earliest,
        latest_end_h: latest,
        sensitivity,
        max_window_mean_ugm3: meanLimit,
        limit: 5
      });
      if (id !== requestId.current) return;
      if (res.ok) setResult(res.data);
      else setError(`${res.error.code}: ${res.error.message}`);
    } catch {
      if (id === requestId.current) setError('Request failed. Retry the historical comparison.');
    } finally {
      if (id === requestId.current) setRunning(false);
    }
  }

  const selectedModel = models.find(m => m.model_version === version);
  const activeWindow = result?.windows?.[activeWindowIndex] || result?.windows?.[0];

  return (
    <Card className="border-[#DDD3BC] shadow-md bg-[#FFFDF9]" data-testid="replay-planner">
      <CardHeader className="bg-[#FAF6EE] border-b border-[#DDD3BC] p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#FBF4E6] text-[#8C5D14] border border-[#E8D1A0] mb-2 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#E29E2E]" />
              <span>Contract 1.4 Retrospective Replay Engine</span>
            </div>
            <CardTitle className="text-lg sm:text-2xl font-black text-[#1C1A1F] tracking-tight">
              Historical Forecast Activity Planner
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm text-[#6E675D] mt-1 leading-relaxed">
              Compare outdoor windows using one complete saved ML forecast (horizons 1–24), without querying observed outcomes to rank them.
            </CardDescription>
          </div>
          {selectedModel && (
            <div className="text-right shrink-0">
              <span className="text-[11px] font-mono px-3 py-1.5 rounded-xl bg-white text-[#0F766E] border border-[#99F6E4] font-bold shadow-xs">
                {selectedModel.clock_basis || 'source_naive_clock_unverified'}
              </span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-5 sm:p-6">
        {/* Scientific Limitation Advisory Banner */}
        <div className="rounded-2xl border border-[#E8D1A0] bg-[#FBF4E6] p-4 text-xs text-[#78350F] leading-relaxed flex items-start gap-3 shadow-xs">
          <svg className="w-5 h-5 text-[#E29E2E] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <strong className="font-bold text-[#8C5D14]">Historical Retrospective Comparison Only: </strong>
            These rankings compare saved model predictions from past complete forecast runs. They do not constitute tomorrow's safe activity times, an operational forecast, or a personal health-risk prescription. Targets are not used to choose windows.
          </div>
        </div>

        {/* Actionable Error State */}
        {error && (
          <div role="alert" className="rounded-xl border border-[#FCA5A5] bg-[#FEE2E2] p-4 text-xs text-[#7F1D1D] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-bold">Error: </span>
              <span>{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setRetry(x => x + 1)} className="border-[#FCA5A5] text-[#7F1D1D] bg-white hover:bg-[#FEE2E2] shrink-0">
              Retry replay data
            </Button>
          </div>
        )}

        {!models.length && !error && (
          <p role="status" className="text-xs text-[#555C68] py-4 text-center bg-[#FAF8F5] rounded-xl border border-[#E5DFD3]">
            No supported replay models are available. Exit demo mode or check the model registry.
          </p>
        )}

        {/* Replay Configuration Form */}
        {!!models.length && (
          <form onSubmit={compare} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              {/* 1. Model Selector */}
              <Select
                label="Replay model"
                value={version}
                options={models.map(m => ({ value: m.model_version, label: m.model_version }))}
                onChange={e => {
                  resetResult();
                  setOffset(0);
                  setVersion(e.target.value);
                }}
              />

              {/* 2. Issue Selector */}
              <Select
                label="Complete forecast issue"
                value={issue}
                disabled={loading || !issues?.issues.length}
                options={
                  issues?.issues.length
                    ? issues.issues.map(i => ({
                        value: i.issue_at,
                        label: describeClock(i.issue_at, issues.clock_basis)
                      }))
                    : [{ value: '', label: loading ? 'Loading complete issues…' : 'No complete issues available' }]
                }
                onChange={e => {
                  resetResult();
                  setIssue(e.target.value);
                }}
              />

              {/* 3. Duration Selector */}
              <div>
                <Select
                  label="Activity duration"
                  value={duration}
                  options={[60, 120, 180, 240, 360, 720, 1440].map(n => ({
                    value: String(n),
                    label: `${n / 60} ${n === 60 ? 'hour' : 'hours'}`
                  }))}
                  onChange={e => {
                    resetResult();
                    setDuration(Number(e.target.value));
                  }}
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[60, 120, 180, 240, 360].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        resetResult();
                        setDuration(mins);
                      }}
                      className={`min-h-[38px] px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        duration === mins
                          ? 'bg-[#E29E2E] text-[#1C1A1F] border-2 border-[#1C1A1F] shadow-xs'
                          : 'bg-[#FFFDF9] text-[#4A453E] border-[#DDD3BC] hover:bg-[#F2ECE0]'
                      }`}
                    >
                      {mins / 60}h
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Sensitivity Selector */}
              <Select
                label="Ranking preference"
                value={sensitivity}
                options={[
                  { value: 'general', label: 'General: raw concentration-time' },
                  { value: 'sensitive', label: 'Sensitive: +0.25 × peak concentration' }
                ]}
                onChange={e => {
                  resetResult();
                  setSensitivity(e.target.value as 'general' | 'sensitive');
                }}
              />

              {/* 5. Earliest Start */}
              <label className="text-xs font-semibold text-[#1C1A1F]">
                Earliest start after issue (hours)
                <input
                  aria-label="Earliest start after issue"
                  className="mt-1 block w-full rounded-xl border border-[#DDD3BC] bg-[#FFFDF9] p-2.5 text-sm text-[#1C1A1F] focus:outline-none focus:ring-1 focus:ring-[#E29E2E]"
                  type="number"
                  min="0"
                  max="23"
                  value={earliest}
                  onChange={e => {
                    resetResult();
                    setEarliest(Number(e.target.value));
                  }}
                />
              </label>

              {/* 6. Latest End */}
              <label className="text-xs font-semibold text-[#1C1A1F]">
                Latest end after issue (hours)
                <input
                  aria-label="Latest end after issue"
                  className="mt-1 block w-full rounded-xl border border-[#DDD3BC] bg-[#FFFDF9] p-2.5 text-sm text-[#1C1A1F] focus:outline-none focus:ring-1 focus:ring-[#E29E2E]"
                  type="number"
                  min="1"
                  max="24"
                  value={latest}
                  onChange={e => {
                    resetResult();
                    setLatest(Number(e.target.value));
                  }}
                />
              </label>

              {/* 7. Optional Concentration Ceiling */}
              <label className="text-xs font-semibold text-[#1C1A1F] md:col-span-2">
                Optional mean concentration ceiling (µg/m³)
                <input
                  aria-label="Mean concentration ceiling"
                  className="mt-1 block w-full rounded-xl border border-[#DDD3BC] bg-[#FFFDF9] p-2.5 text-sm text-[#1C1A1F] focus:outline-none focus:ring-1 focus:ring-[#E29E2E]"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="No ceiling — enter an engineering limit if desired"
                  value={ceiling}
                  onChange={e => {
                    resetResult();
                    setCeiling(e.target.value);
                  }}
                />
                <span className="text-[11px] text-[#7A7368] mt-0.5 block">
                  Optional filter ceiling. This is an engineering preference, not a derived medical or clinical safety threshold.
                </span>
              </label>
            </div>

            {/* Complete Issue Pagination Ribbon */}
            {issues && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#FAF6EE] border border-[#DDD3BC] text-xs text-[#4A453E]">
                <span>
                  <strong>{issues.total_count.toLocaleString()}</strong> complete issues available · {issues.clock_basis} · test split
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading || !offset}
                    onClick={() => {
                      resetResult();
                      setOffset(x => Math.max(0, x - 25));
                    }}
                    className="border-[#DDD3BC] hover:border-[#E29E2E] bg-[#FFFDF9]"
                  >
                    Previous issues
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading || offset + issues.issues.length >= issues.total_count}
                    onClick={() => {
                      resetResult();
                      setOffset(x => x + 25);
                    }}
                    className="border-[#DDD3BC] hover:border-[#E29E2E] bg-[#FFFDF9]"
                  >
                    Next issues
                  </Button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!issue || loading}
              className="min-h-[44px] px-6 py-2.5 rounded-full font-extrabold text-sm bg-[#E29E2E] hover:bg-[#C88A2E] text-[#1C1A1F] border-2 border-[#1C1A1F] shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running ? 'Calculating Windows…' : 'Compare historical windows'}
            </button>
          </form>
        )}

        {/* Results Presentation & Trajectory Visualizer */}
        {result && (
          <section aria-live="polite" className="space-y-5 pt-4 border-t border-[#DDD3BC]" data-testid="replay-results">
            {/* Status Header */}
            <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
              result.status === 'available'
                ? 'bg-[#F0FDFA] border-[#99F6E4] text-[#0F766E]'
                : result.status === 'no_suitable_window'
                ? 'bg-[#FEF3C7] border-[#FDE68A] text-[#78350F]'
                : 'bg-[#FEE2E2] border-[#FCA5A5] text-[#7F1D1D]'
            }`}>
              <div>
                <h3 className="text-base sm:text-lg font-bold">
                  {result.status === 'available'
                    ? 'Ranked Historical Windows'
                    : result.status === 'no_suitable_window'
                    ? 'No Window Meets Your Criteria'
                    : 'Trajectory Unavailable'}
                </h3>
                <p className="text-xs mt-0.5 opacity-90">
                  {result.message} · Coverage {result.coverage_hours}/{result.required_hours} hours · {result.clock_basis}
                </p>
                <p className="text-[11px] font-mono mt-1 opacity-75">
                  Issue: {describeClock(result.issue_at, result.clock_basis)} · Model: {result.model_version}
                </p>
              </div>
              <div className="shrink-0">
                <span className="text-xs font-bold uppercase px-3 py-1 rounded-xl bg-white/90 border border-current shadow-xs">
                  {result.code}
                </span>
              </div>
            </div>

            {/* 24-Hour Horizon Trajectory Map */}
            {result.windows.length > 0 && (
              <div className="p-4 rounded-2xl border border-[#DDD3BC] bg-[#FAF6EE] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-[#1C1A1F]">24-Hour Forecast Trajectory Timeline</span>
                  <span className="text-[#6E675D] text-[11px]">
                    Active: Window #{activeWindow?.rank || 1} (Horizons +{activeWindow?.start_horizon_h}h → +{activeWindow?.end_horizon_h}h)
                  </span>
                </div>

                {/* 24-Hour Timeline Bar Grid */}
                <div className="grid grid-cols-24 gap-1 h-9 items-center">
                  {Array.from({ length: 24 }).map((_, idx) => {
                    const h = idx + 1;
                    const isWithinActive =
                      activeWindow &&
                      h > activeWindow.start_horizon_h &&
                      h <= activeWindow.end_horizon_h;

                    return (
                      <div
                        key={h}
                        className={`h-full rounded-md flex flex-col items-center justify-center text-[9px] font-bold transition-all ${
                          isWithinActive
                            ? 'bg-[#E29E2E] text-[#1C1A1F] border border-[#C88A2E] shadow-xs scale-105 z-10'
                            : 'bg-[#EBE3D3] text-[#7A7368] hover:bg-[#DDD3BC]'
                        }`}
                        title={`Horizon +${h}h`}
                      >
                        {h}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-[#7A7368] font-mono">
                  <span>+1h (Issue + 1)</span>
                  <span>+12h</span>
                  <span>+24h (Complete Trajectory)</span>
                </div>
              </div>
            )}

            {/* Ranked Windows Grid */}
            <div className="grid gap-4 lg:grid-cols-2">
              {result.windows.map((w, idx) => {
                const isSelected = idx === activeWindowIndex;
                return (
                  <article
                    key={w.rank}
                    onClick={() => setActiveWindowIndex(idx)}
                    className={`rounded-2xl border p-4 transition-all cursor-pointer shadow-xs ${
                      isSelected
                        ? 'border-2 border-[#E29E2E] bg-[#FBF4E6] ring-2 ring-[#E29E2E]/20'
                        : 'border-[#DDD3BC] bg-[#FFFDF9] hover:border-[#C4B99F] hover:bg-[#FAF6EE]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        w.rank === 1
                          ? 'bg-[#E29E2E] text-[#1C1A1F] border border-[#C88A2E]'
                          : 'bg-[#EBE3D3] text-[#1C1A1F]'
                      }`}>
                        Rank #{w.rank}
                      </span>
                      <span className="text-[11px] font-mono text-[#6E675D]">
                        Horizons +{w.start_horizon_h}h → +{w.end_horizon_h}h
                      </span>
                    </div>

                    <div className="mt-2.5">
                      <div className="text-sm font-bold text-[#1C1A1F]">
                        {describeClock(w.start_at, result.clock_basis)} → {describeClock(w.end_at, result.clock_basis)}
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-[#8C5D14]">
                          {w.concentration_time.toFixed(2)}
                        </span>
                        <span className="text-xs font-bold text-[#6E675D]">
                          {w.concentration_time_unit}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-[#DDD3BC]/80 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-[#7A7368] uppercase font-semibold block">Mean Concentration</span>
                        <span className="font-extrabold text-[#1C1A1F]">{w.mean_concentration.toFixed(1)} µg/m³</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#7A7368] uppercase font-semibold block">Peak Concentration</span>
                        <span className="font-extrabold text-[#C3583C]">{w.peak_concentration.toFixed(1)} µg/m³</span>
                      </div>
                    </div>

                    <div className="mt-2.5 text-[11px] text-[#6E675D] flex items-center justify-between">
                      <span>Ranking score: <strong className="text-[#1C1A1F]">{w.ranking_score.toFixed(2)}</strong></span>
                      {isSelected && <span className="text-[#8C5D14] font-bold text-[10px]">✓ Selected Window</span>}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Method & Scientific Limitations Disclosure */}
            <details className="rounded-2xl bg-[#FAF6EE] border border-[#DDD3BC] p-4 text-xs text-[#6E675D]">
              <summary className="cursor-pointer font-bold text-[#1C1A1F] hover:text-[#8C5D14] transition-colors">
                Replay Methodology & Scientific Limitations
              </summary>
              <div className="mt-3 space-y-2 pt-2 border-t border-[#DDD3BC] leading-relaxed">
                <p><strong>Evaluation Method: </strong>{result.method}</p>
                <p><strong>Sensitivity Rule: </strong>{result.sensitivity_rule}</p>
                <div className="font-bold text-[#1C1A1F] mt-2">Documented Operational Limitations:</div>
                <ul className="list-disc pl-5 space-y-1">
                  {result.limitations.map(x => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </details>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
