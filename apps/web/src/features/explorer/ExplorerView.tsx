import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StationView,
  Pollutant,
  History,
  HistoryPoint,
  ArchiveCatalogue,
  ArchiveExplore,
  ArchiveCompare,
  ArchiveStation,
  ArchiveBucket,
  ArchiveComparisonBucket
} from '../../lib/api/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../lib/api/client';
import { formatToIST, calculateSubIndex } from '../../lib/aqi';

interface ExplorerViewProps {
  stations: StationView[];
  selectedStation: StationView | null;
  onSelectStation: (station: StationView) => void;
}

type RangePreset = '24h' | '48h' | '7d';

export const ExplorerView: React.FC<ExplorerViewProps> = ({
  stations,
  selectedStation,
  onSelectStation
}) => {
  // Top-Level Mode: Live UTC Intake vs Audited Recorded-Clock Archive (Contract 1.2.0)
  const [datasetSource, setDatasetSource] = useState<'live_telemetry' | 'recorded_clock_archive'>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('source') === 'archive') return 'recorded_clock_archive';
    }
    return 'live_telemetry';
  });

  // -------------------------------------------------------------------------
  // LIVE TELEMETRY STATE
  // -------------------------------------------------------------------------
  const [pollutant, setPollutant] = useState<Pollutant>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const val = p.get('pollutant') as Pollutant;
      if (['pm25', 'pm10', 'no2', 'so2', 'co', 'o3'].includes(val)) return val;
    }
    return 'pm25';
  });
  const [rangePreset, setRangePreset] = useState<RangePreset>('48h');
  const [aggregation, setAggregation] = useState<'hourly' | 'daily'>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const agg = p.get('agg');
      if (agg === 'hourly' || agg === 'daily') return agg;
    }
    return 'hourly';
  });
  const [historyData, setHistoryData] = useState<History | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Live Station Comparison Mode
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareStationId, setCompareStationId] = useState<string>(
    stations.find(s => s.id !== selectedStation?.id)?.id || ''
  );
  const [compareHistoryData, setCompareHistoryData] = useState<History | null>(null);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);

  // View Mode: Line Chart vs Accessible Data Table
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [hoveredPoint, setHoveredPoint] = useState<{ measured_at: string; value: number; stationName?: string } | null>(null);

  // Request Sequence Tokens (Prevent out-of-order stale responses)
  const liveHistoryReqIdRef = useRef<number>(0);
  const archiveExploreReqIdRef = useRef<number>(0);
  const archiveCompareReqIdRef = useRef<number>(0);

  // -------------------------------------------------------------------------
  // RECORDED-CLOCK ARCHIVE STATE (Contract 1.2.0)
  // -------------------------------------------------------------------------
  const [archiveCatalogue, setArchiveCatalogue] = useState<ArchiveCatalogue | null>(null);
  const [isLoadingArchiveCatalogue, setIsLoadingArchiveCatalogue] = useState(false);
  const [archiveSubMode, setArchiveSubMode] = useState<'explore' | 'compare'>('explore');

  // Archive Explore State
  const [archiveStationId, setArchiveStationId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.get('archive_station') || 'site_301';
    }
    return 'site_301';
  });
  const [archivePollutant, setArchivePollutant] = useState<Pollutant>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const val = p.get('pollutant') as Pollutant;
      if (['pm25', 'pm10', 'no2', 'so2', 'co', 'o3'].includes(val)) return val;
    }
    return 'pm25';
  });
  const [archiveStart, setArchiveStart] = useState<string>('2023-11-01T00:00:00');
  const [archiveEnd, setArchiveEnd] = useState<string>('2023-11-08T00:00:00');
  const [archiveAggregation, setArchiveAggregation] = useState<'daily' | 'monthly'>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const agg = p.get('agg');
      if (agg === 'daily' || agg === 'monthly') return agg;
    }
    return 'daily';
  });
  const [archiveExploreData, setArchiveExploreData] = useState<ArchiveExplore | null>(null);
  const [isLoadingArchiveExplore, setIsLoadingArchiveExplore] = useState(false);
  const [archiveExploreError, setArchiveExploreError] = useState<string | null>(null);
  const [hoveredBucketIndex, setHoveredBucketIndex] = useState<number | null>(null);

  // Archive Compare State (Requires clock_assumption=same_recorded_clock)
  const [archiveCompareIds, setArchiveCompareIds] = useState<string[]>(['site_301', 'site_113']);
  const [archiveCompareData, setArchiveCompareData] = useState<ArchiveCompare | null>(null);
  const [isLoadingArchiveCompare, setIsLoadingArchiveCompare] = useState(false);
  const [archiveCompareError, setArchiveCompareError] = useState<string | null>(null);

  // URL Query Parameters 2-Way Synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    if (datasetSource === 'recorded_clock_archive') {
      p.set('source', 'archive');
      p.set('archive_station', archiveStationId);
      p.set('pollutant', archivePollutant);
      p.set('agg', archiveAggregation);
    } else {
      p.delete('source');
      p.delete('archive_station');
      p.set('pollutant', pollutant);
      p.set('agg', aggregation);
    }
    const newUrl = `${window.location.pathname}?${p.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [datasetSource, archiveStationId, archivePollutant, archiveAggregation, pollutant, aggregation]);

  // Compute aligned UTC range bounds
  const { startIso, endIso, hoursCount } = useMemo(() => {
    const hours = rangePreset === '24h' ? 24 : rangePreset === '7d' ? 168 : 48;
    const now = new Date();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), 0, 0, 0));
    const start = new Date(end.getTime() - hours * 3600000);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      hoursCount: hours
    };
  }, [rangePreset]);

  // Load Primary Live Station History (with sequence token to prevent race conditions)
  const fetchLiveHistory = () => {
    if (datasetSource !== 'live_telemetry' || !selectedStation) return;
    const reqId = ++liveHistoryReqIdRef.current;
    setIsLoading(true);
    setErrorMessage(null);

    apiClient.getHistory(selectedStation.id, startIso, endIso, pollutant).then(res => {
      if (reqId !== liveHistoryReqIdRef.current) return;
      setIsLoading(false);
      if (res.ok) {
        setHistoryData(res.data);
      } else {
        setHistoryData(null);
        setErrorMessage(`${res.error.code}: ${res.error.message}`);
      }
    });
  };

  useEffect(() => {
    fetchLiveHistory();
  }, [datasetSource, selectedStation, pollutant, startIso, endIso]);

  // Load Secondary Station History in Comparison Mode (with sequence token)
  useEffect(() => {
    if (datasetSource !== 'live_telemetry' || !isCompareMode || !compareStationId) {
      setCompareHistoryData(null);
      return;
    }
    const reqId = ++liveHistoryReqIdRef.current;
    setIsLoadingCompare(true);

    apiClient.getHistory(compareStationId, startIso, endIso, pollutant).then(res => {
      if (reqId !== liveHistoryReqIdRef.current) return;
      setIsLoadingCompare(false);
      if (res.ok) {
        setCompareHistoryData(res.data);
      } else {
        setCompareHistoryData(null);
      }
    });
  }, [datasetSource, isCompareMode, compareStationId, pollutant, startIso, endIso]);
  useEffect(() => {
    if (datasetSource !== 'recorded_clock_archive') return;
    let isMounted = true;
    setIsLoadingArchiveCatalogue(true);

    apiClient.getArchiveCatalogue().then(res => {
      if (!isMounted) return;
      setIsLoadingArchiveCatalogue(false);
      if (res.ok) {
        setArchiveCatalogue(res.data);
        if (res.data.stations.length > 0) {
          if (!res.data.stations.some(s => s.station_id === archiveStationId)) {
            setArchiveStationId(res.data.stations[0].station_id);
          }
          if (archiveCompareIds.length < 2 && res.data.stations.length >= 2) {
            setArchiveCompareIds([res.data.stations[0].station_id, res.data.stations[1].station_id]);
          }
        }
      } else {
        setArchiveCatalogue(null);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [datasetSource]);

  // Fetch Archive Explore Data (with sequence token)
  const fetchArchiveExplore = () => {
    if (datasetSource !== 'recorded_clock_archive' || archiveSubMode !== 'explore' || !archiveStationId) {
      return;
    }
    const reqId = ++archiveExploreReqIdRef.current;
    setIsLoadingArchiveExplore(true);
    setArchiveExploreError(null);

    apiClient
      .getArchiveExplore(archiveStationId, archivePollutant, archiveStart, archiveEnd, archiveAggregation)
      .then(res => {
        if (reqId !== archiveExploreReqIdRef.current) return;
        setIsLoadingArchiveExplore(false);
        if (res.ok) {
          setArchiveExploreData(res.data);
        } else {
          setArchiveExploreData(null);
          setArchiveExploreError(`${res.error.code}: ${res.error.message}`);
        }
      });
  };

  useEffect(() => {
    fetchArchiveExplore();
  }, [datasetSource, archiveSubMode, archiveStationId, archivePollutant, archiveStart, archiveEnd, archiveAggregation]);

  // Fetch Archive Compare Data (Requires clock_assumption=same_recorded_clock, with sequence token)
  const fetchArchiveCompare = () => {
    if (
      datasetSource !== 'recorded_clock_archive' ||
      archiveSubMode !== 'compare' ||
      archiveCompareIds.length < 2
    ) {
      return;
    }
    const reqId = ++archiveCompareReqIdRef.current;
    setIsLoadingArchiveCompare(true);
    setArchiveCompareError(null);

    // Guaranteed clock_assumption: 'same_recorded_clock'
    apiClient
      .getArchiveCompare(
        archiveCompareIds,
        archivePollutant,
        archiveStart,
        archiveEnd,
        archiveAggregation,
        'same_recorded_clock'
      )
      .then(res => {
        if (reqId !== archiveCompareReqIdRef.current) return;
        setIsLoadingArchiveCompare(false);
        if (res.ok) {
          setArchiveCompareData(res.data);
        } else {
          setArchiveCompareData(null);
          setArchiveCompareError(`${res.error.code}: ${res.error.message}`);
        }
      });
  };

  useEffect(() => {
    fetchArchiveCompare();
  }, [datasetSource, archiveSubMode, archiveCompareIds, archivePollutant, archiveStart, archiveEnd, archiveAggregation]);

  // Dynamically compute available pollutants from the selected archive station(s)
  const availableArchivePollutants = useMemo(() => {
    if (archiveSubMode === 'explore') {
      const stn = archiveCatalogue?.stations.find(s => s.station_id === archiveStationId);
      if (stn && stn.pollutants && stn.pollutants.length > 0) {
        return stn.pollutants.map(p => ({
          pollutant: p.pollutant,
          unit: p.unit,
          label: `${p.pollutant.toUpperCase()} (${p.unit})`
        }));
      }
    } else {
      const compareStns = archiveCatalogue?.stations.filter(s => archiveCompareIds.includes(s.station_id)) || [];
      if (compareStns.length > 0) {
        const commonPollutants = compareStns[0].pollutants.filter(p =>
          compareStns.every(cs => cs.pollutants.some(cp => cp.pollutant === p.pollutant))
        );
        if (commonPollutants.length > 0) {
          return commonPollutants.map(p => ({
            pollutant: p.pollutant,
            unit: p.unit,
            label: `${p.pollutant.toUpperCase()} (${p.unit})`
          }));
        }
      }
    }
    return [
      { pollutant: 'pm25' as Pollutant, unit: 'µg/m³', label: 'PM2.5 (µg/m³)' },
      { pollutant: 'pm10' as Pollutant, unit: 'µg/m³', label: 'PM10 (µg/m³)' },
      { pollutant: 'no2' as Pollutant, unit: 'µg/m³', label: 'NO2 (µg/m³)' },
      { pollutant: 'so2' as Pollutant, unit: 'µg/m³', label: 'SO2 (µg/m³)' },
      { pollutant: 'co' as Pollutant, unit: 'mg/m³', label: 'CO (mg/m³)' },
      { pollutant: 'o3' as Pollutant, unit: 'µg/m³', label: 'O3 (µg/m³)' }
    ];
  }, [archiveSubMode, archiveCatalogue, archiveStationId, archiveCompareIds]);

  // URL Filter Synchronization (Non-destructive)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (datasetSource === 'recorded_clock_archive') {
      url.searchParams.set('source', 'archive');
      url.searchParams.set('archive_station', archiveStationId);
      url.searchParams.set('pollutant', archivePollutant);
      url.searchParams.set('agg', archiveAggregation);
    } else {
      url.searchParams.delete('source');
      url.searchParams.delete('archive_station');
      url.searchParams.set('pollutant', pollutant);
      url.searchParams.set('preset', rangePreset);
    }
    window.history.replaceState({}, '', url.toString());
  }, [datasetSource, archiveStationId, archivePollutant, archiveAggregation, pollutant, rangePreset]);

  // Reset incompatible pollutant selection if selected station doesn't support it
  useEffect(() => {
    if (availableArchivePollutants.length > 0) {
      if (!availableArchivePollutants.some(p => p.pollutant === archivePollutant)) {
        setArchivePollutant(availableArchivePollutants[0].pollutant);
      }
    }
  }, [availableArchivePollutants, archivePollutant]);

  // -------------------------------------------------------------------------
  // COMPUTED METRICS & SVG HELPERS (Live Mode)
  // -------------------------------------------------------------------------
  const livePoints = useMemo(() => historyData?.points || [], [historyData]);
  const primaryValues = useMemo(() => livePoints.map(p => p.value), [livePoints]);

  const primaryStats = useMemo(() => {
    if (primaryValues.length === 0) return { min: 0, max: 0, mean: 0 };
    const min = Math.min(...primaryValues);
    const max = Math.max(...primaryValues);
    const mean = primaryValues.reduce((a, b) => a + b, 0) / primaryValues.length;
    return { min, max, mean };
  }, [primaryValues]);

  const comparePoints = useMemo(() => compareHistoryData?.points || [], [compareHistoryData]);
  const compareValues = useMemo(() => comparePoints.map(p => p.value), [comparePoints]);
  const compareStation = useMemo(() => stations.find(s => s.id === compareStationId), [stations, compareStationId]);

  const compareStats = useMemo(() => {
    if (compareValues.length === 0) return { min: 0, max: 0, mean: 0 };
    const min = Math.min(...compareValues);
    const max = Math.max(...compareValues);
    const mean = compareValues.reduce((a, b) => a + b, 0) / compareValues.length;
    return { min, max, mean };
  }, [compareValues]);

  const displayPoints = useMemo(() => {
    if (aggregation === 'hourly') return livePoints;
    const grouped: Record<string, { sum: number; count: number; dateStr: string }> = {};
    livePoints.forEach(pt => {
      const istDate = new Date(pt.measured_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      if (!grouped[istDate]) grouped[istDate] = { sum: 0, count: 0, dateStr: pt.measured_at };
      grouped[istDate].sum += pt.value;
      grouped[istDate].count += 1;
    });
    return Object.entries(grouped).map(([_, data]) => ({
      measured_at: data.dateStr,
      value: Number((data.sum / data.count).toFixed(1)),
      source: `Daily Mean (${data.count} hrs)`
    }));
  }, [livePoints, aggregation]);

  const handleDownloadCsv = () => {
    if (!historyData || livePoints.length === 0) return;
    const headers = ['Measured_At_UTC', 'Measured_At_IST', 'Station_ID', 'Station_Name', 'Pollutant', 'Value', 'Unit', 'Source'];
    const rows = livePoints.map(pt => [
      pt.measured_at,
      formatToIST(pt.measured_at).replace(',', ''),
      historyData.station_id,
      `"${selectedStation?.name || historyData.station_id}"`,
      historyData.pollutant.toUpperCase(),
      pt.value,
      historyData.unit,
      `"${(pt as any).source || 'CAAQMS'}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `breathewise_${historyData.station_id}_${pollutant}_${rangePreset}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // SVG Chart Dimensions
  const chartWidth = 740;
  const chartHeight = 270;
  const padding = { top: 25, right: 30, bottom: 40, left: 55 };

  const allVals = [...primaryValues, ...(isCompareMode ? compareValues : [])];
  const maxVal = allVals.length > 0 ? Math.max(...allVals, 60) * 1.15 : 200;
  const minVal = 0;

  const toX = (idx: number, total: number) => {
    if (total <= 1) return padding.left;
    return padding.left + (idx / (total - 1)) * (chartWidth - padding.left - padding.right);
  };

  const toY = (val: number) => {
    return chartHeight - padding.bottom - ((val - minVal) / (maxVal - minVal)) * (chartHeight - padding.top - padding.bottom);
  };

  const primaryPolyline = displayPoints.map((p, idx) => `${toX(idx, displayPoints.length)},${toY(p.value)}`).join(' ');
  const comparePolyline = comparePoints.map((p, idx) => `${toX(idx, comparePoints.length)},${toY(p.value)}`).join(' ');

  return (
    <div className="space-y-6">
      {/* 1. Top-Level Source Mode Switcher */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${datasetSource === 'recorded_clock_archive' ? 'bg-amber-500' : 'bg-teal-600'}`} />
            <h2 className="text-lg font-bold text-slate-900">
              Observational Telemetry & Historical Archive Explorer
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Toggle between live UTC monitoring feeds and audited multi-year recorded-clock archive series.
          </p>
        </div>

        <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200">
          <button
            onClick={() => setDatasetSource('live_telemetry')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              datasetSource === 'live_telemetry'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Live CAAQMS Intake (UTC)
          </button>
          <button
            onClick={() => setDatasetSource('recorded_clock_archive')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              datasetSource === 'recorded_clock_archive'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Audited Archive (Recorded Clock)
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* RECORDED-CLOCK ARCHIVE EXPLORER WORKSPACE (Contract 1.2.0)        */}
      {/* ------------------------------------------------------------------ */}
      {datasetSource === 'recorded_clock_archive' ? (
        <div className="space-y-6">
          {/* Persistent Recorded-Clock Provenance Disclaimer */}
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs text-amber-950 space-y-1.5 shadow-xs">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <span>⚠️ PROVENANCE DISCLAIMER:</span>
              <span className="font-mono bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded text-[11px]">
                dataset_mode: recorded_clock • timezone: null • interval_semantics: unverified • publication_time_known: false
              </span>
            </div>
            <p className="leading-relaxed">
              Timestamps in this archive represent naive local data-logger clocks without timezone confirmation or verified issue times. Comparison requires explicit acknowledgement of <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">clock_assumption: same_recorded_clock</code>. Pair agreement reflects record divergences between monitoring sites, NOT forecast evaluation. Naive archive timestamps are never merged with live UTC telemetry.
            </p>
          </div>

          {/* Archive Controls Ribbon */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setArchiveSubMode('explore')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    archiveSubMode === 'explore'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Single Station Explorer
                </button>
                <button
                  onClick={() => setArchiveSubMode('compare')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    archiveSubMode === 'compare'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Matched Station Comparison (2–4 Sites)
                </button>
              </div>

              <div className="text-[11px] text-slate-400">
                Dataset: <span className="font-mono font-semibold text-slate-700">{archiveCatalogue?.dataset_id || 'delhi_observed_archive_v1'}</span>
              </div>
            </div>

            {/* Parameter & Filter Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {archiveSubMode === 'explore' ? (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Archive Station</label>
                  <select
                    value={archiveStationId}
                    onChange={e => setArchiveStationId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    {archiveCatalogue?.stations.map(stn => (
                      <option key={stn.station_id} value={stn.station_id}>
                        {stn.station_id} — {stn.labels[0] || 'Monitoring Station'}
                      </option>
                    )) || <option value="site_301">site_301 (Anand Vihar)</option>}
                  </select>
                </div>
              ) : (
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Select Matched Stations (2 to 4)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {archiveCatalogue?.stations.map(stn => {
                      const isChecked = archiveCompareIds.includes(stn.station_id);
                      return (
                        <button
                          key={stn.station_id}
                          onClick={() => {
                            if (isChecked) {
                              if (archiveCompareIds.length > 2) {
                                setArchiveCompareIds(prev => prev.filter(id => id !== stn.station_id));
                              }
                            } else {
                              if (archiveCompareIds.length < 4) {
                                setArchiveCompareIds(prev => [...prev, stn.station_id]);
                              }
                            }
                          }}
                          className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors cursor-pointer ${
                            isChecked
                              ? 'bg-amber-600 text-white border-amber-700'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {isChecked ? '✓ ' : '+ '}
                          {stn.station_id} ({stn.labels[0]?.split(',')[0] || stn.station_id})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Pollutant</label>
                <select
                  value={archivePollutant}
                  onChange={e => setArchivePollutant(e.target.value as Pollutant)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  {availableArchivePollutants.map(p => (
                    <option key={p.pollutant} value={p.pollutant}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Recorded Date Window</label>
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  <input
                    type="text"
                    value={archiveStart}
                    onChange={e => setArchiveStart(e.target.value)}
                    placeholder="YYYY-MM-DDTHH:MM:SS"
                    className="p-1.5 border border-slate-300 rounded font-mono text-[10px]"
                  />
                  <input
                    type="text"
                    value={archiveEnd}
                    onChange={e => setArchiveEnd(e.target.value)}
                    placeholder="YYYY-MM-DDTHH:MM:SS"
                    className="p-1.5 border border-slate-300 rounded font-mono text-[10px]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Aggregation</label>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => setArchiveAggregation('daily')}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                      archiveAggregation === 'daily'
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Daily Buckets
                  </button>
                  <button
                    onClick={() => setArchiveAggregation('monthly')}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                      archiveAggregation === 'monthly'
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Monthly Buckets
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Mode 1: Single Station Archive Explorer View */}
          {archiveSubMode === 'explore' && (
            <>
              {/* Coverage & Missingness Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Expected Hours</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {archiveExploreData?.expected_count ?? 0} slots
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Recorded clock slots in window</div>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Valid Intake</div>
                  <div className="text-xl font-bold text-emerald-700 mt-1">
                    {archiveExploreData?.valid_count ?? 0} points
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Non-null recorded values</div>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Missing Hours</div>
                  <div className="text-xl font-bold text-amber-700 mt-1">
                    {archiveExploreData?.missing_count ?? 0} gaps
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Device nulls / unrecorded slots</div>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Coverage Ratio</div>
                  <div className="text-xl font-bold text-teal-800 mt-1">
                    {archiveExploreData ? `${(archiveExploreData.coverage_fraction * 100).toFixed(1)}%` : '0.0%'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Archive completeness fraction</div>
                </div>
              </div>

              {/* Statistical Distribution Box */}
              {archiveExploreData?.distribution && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>Quantile Distribution Analysis ({archiveExploreData.pollutant.toUpperCase()} • {archiveExploreData.unit})</span>
                    <span className="text-[11px] font-normal text-slate-400">Total Valid Samples: {archiveExploreData.distribution.count}</span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-9 gap-2 pt-1 text-center">
                    <div className="p-2 rounded bg-slate-50 border border-slate-100">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">Min</div>
                      <div className="font-bold text-xs text-slate-800 mt-0.5">{archiveExploreData.distribution.minimum?.toFixed(1) ?? '—'}</div>
                    </div>
                    <div className="p-2 rounded bg-slate-50 border border-slate-100">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">P05</div>
                      <div className="font-bold text-xs text-slate-800 mt-0.5">{archiveExploreData.distribution.p05?.toFixed(1) ?? '—'}</div>
                    </div>
                    <div className="p-2 rounded bg-slate-50 border border-slate-100">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">P25</div>
                      <div className="font-bold text-xs text-slate-800 mt-0.5">{archiveExploreData.distribution.p25?.toFixed(1) ?? '—'}</div>
                    </div>
                    <div className="p-2 rounded bg-teal-50 border border-teal-200">
                      <div className="text-[10px] font-bold text-teal-800 uppercase">Median</div>
                      <div className="font-bold text-xs text-teal-900 mt-0.5">{archiveExploreData.distribution.median?.toFixed(1) ?? '—'}</div>
                    </div>
                    <div className="p-2 rounded bg-teal-50 border border-teal-200">
                      <div className="text-[10px] font-bold text-teal-800 uppercase">Mean</div>
                      <div className="font-bold text-xs text-teal-900 mt-0.5">{archiveExploreData.distribution.mean?.toFixed(1) ?? '—'}</div>
                    </div>
                    <div className="p-2 rounded bg-slate-50 border border-slate-100">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">P75</div>
                      <div className="font-bold text-xs text-slate-800 mt-0.5">{archiveExploreData.distribution.p75?.toFixed(1) ?? '—'}</div>
                    </div>
                    <div className="p-2 rounded bg-slate-50 border border-slate-100">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">P95</div>
                      <div className="font-bold text-xs text-slate-800 mt-0.5">{archiveExploreData.distribution.p95?.toFixed(1) ?? '—'}</div>
                    </div>
                    <div className="p-2 rounded bg-slate-50 border border-slate-100">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">Max</div>
                      <div className="font-bold text-xs text-slate-800 mt-0.5">{archiveExploreData.distribution.maximum?.toFixed(1) ?? '—'}</div>
                    </div>
                    <div className="p-2 rounded bg-slate-50 border border-slate-100">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">StdDev</div>
                      <div className="font-bold text-xs text-slate-800 mt-0.5">{archiveExploreData.distribution.stddev?.toFixed(1) ?? '—'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bucket Points Table */}
              <Card>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">
                        Archive Bucket Sequence ({archiveExploreData?.points.length ?? 0} Periods)
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Station: {archiveStationId} • Aggregation: {archiveAggregation} • Dataset: {archiveExploreData?.dataset_id}
                      </CardDescription>
                    </div>
                    <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                      Clock Basis: source_naive_clock_unverified
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoadingArchiveExplore ? (
                    <div className="p-12 text-center text-xs text-slate-500">
                      Retrieving audited archive bucket telemetry...
                    </div>
                  ) : archiveExploreError ? (
                    <div className="p-6 text-center text-xs text-amber-900 bg-amber-50 m-4 rounded-lg border border-amber-200 space-y-2">
                      <p className="font-semibold">{archiveExploreError}</p>
                      <button
                        onClick={fetchArchiveExplore}
                        className="px-3 py-1 bg-amber-600 text-white rounded text-xs font-semibold hover:bg-amber-700 cursor-pointer transition-colors"
                      >
                        Retry Query
                      </button>
                    </div>
                  ) : archiveExploreData && archiveExploreData.points.length > 0 ? (
                    <>
                      {/* Visual Bucket Trend Chart */}
                      <div className="p-4 bg-slate-900 border-b border-slate-800 text-white space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-slate-200">
                            Bucket Aggregation Trend ({archiveExploreData.points.length} Periods • {archiveExploreData.unit})
                          </span>
                          <div className="flex items-center gap-3 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded bg-teal-500" />
                              <span className="text-slate-300">Sufficient (&ge;75%)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded bg-amber-500" />
                              <span className="text-amber-300">Partial (&lt;75%)</span>
                            </div>
                          </div>
                        </div>

                        <div className="relative w-full h-36 sm:h-40">
                          {(() => {
                            const pts = archiveExploreData.points;
                            const maxVal = Math.max(...pts.map(p => p.value ?? 0), 20) * 1.15;
                            const chartW = 740;
                            const chartH = 110;
                            const padL = 40;
                            const padT = 15;

                            const barWidth = Math.max(4, Math.min(24, ((chartW - padL) / pts.length) * 0.7));
                            const step = (chartW - padL) / Math.max(1, pts.length);

                            return (
                              <svg viewBox="0 0 760 145" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                                {[0, 0.5, 1].map((lvl, idx) => {
                                  const yPos = padT + chartH - lvl * chartH;
                                  return (
                                    <g key={idx}>
                                      <line x1={padL} y1={yPos} x2={chartW} y2={yPos} stroke="#334155" strokeWidth="0.8" strokeDasharray="3,3" />
                                      <text x={padL - 6} y={yPos + 3} textAnchor="end" fill="#94a3b8" fontSize="8" fontFamily="monospace">
                                        {Math.round(lvl * maxVal)}
                                      </text>
                                    </g>
                                  );
                                })}

                                {pts.map((pt, i) => {
                                  const x = padL + i * step + step / 2 - barWidth / 2;
                                  const val = pt.value ?? 0;
                                  const barH = (val / maxVal) * chartH;
                                  const y = padT + chartH - barH;
                                  const isHovered = hoveredBucketIndex === i;
                                  const isSufficient = pt.coverage_fraction >= 0.75;

                                  return (
                                    <g key={i}>
                                      {pt.value !== null ? (
                                        <rect
                                          x={x}
                                          y={y}
                                          width={barWidth}
                                          height={Math.max(2, barH)}
                                          fill={isSufficient ? '#14b8a6' : '#f59e0b'}
                                          opacity={isHovered ? 1 : 0.85}
                                          rx={1.5}
                                        />
                                      ) : (
                                        <line
                                          x1={x}
                                          y1={padT + chartH - 4}
                                          x2={x + barWidth}
                                          y2={padT + chartH - 4}
                                          stroke="#94a3b8"
                                          strokeWidth="2"
                                          strokeDasharray="2,2"
                                        />
                                      )}
                                      <rect
                                        x={padL + i * step}
                                        y={padT}
                                        width={step}
                                        height={chartH}
                                        fill="transparent"
                                        className="cursor-pointer"
                                        onMouseEnter={() => setHoveredBucketIndex(i)}
                                        onMouseLeave={() => setHoveredBucketIndex(null)}
                                      />
                                    </g>
                                  );
                                })}
                              </svg>
                            );
                          })()}
                        </div>

                        {hoveredBucketIndex !== null && archiveExploreData.points[hoveredBucketIndex] && (
                          <div className="bg-slate-800 border border-slate-700 rounded p-2 text-xs flex flex-wrap items-center justify-between gap-2 text-slate-200">
                            <span className="font-mono text-[11px] text-teal-400">
                              {archiveExploreData.points[hoveredBucketIndex].period_start} → {archiveExploreData.points[hoveredBucketIndex].period_end}
                            </span>
                            <div className="flex items-center gap-3 text-xs">
                              <span>
                                Mean: <strong className="text-white">{archiveExploreData.points[hoveredBucketIndex].value !== null ? `${archiveExploreData.points[hoveredBucketIndex].value!.toFixed(1)} ${archiveExploreData.unit}` : 'Missing'}</strong>
                              </span>
                              <span>
                                Valid: {archiveExploreData.points[hoveredBucketIndex].valid_count} / {archiveExploreData.points[hoveredBucketIndex].expected_count} ({(archiveExploreData.points[hoveredBucketIndex].coverage_fraction * 100).toFixed(0)}%)
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="overflow-x-auto max-h-80">
                        <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] sticky top-0">
                          <tr>
                            <th className="p-2.5">Bucket Start</th>
                            <th className="p-2.5">Bucket End</th>
                            <th className="p-2.5">Mean Value</th>
                            <th className="p-2.5">Valid / Expected</th>
                            <th className="p-2.5">Coverage Ratio</th>
                            <th className="p-2.5">Sufficiency State</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {archiveExploreData.points.map((pt, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2.5 font-mono text-slate-700">{pt.period_start}</td>
                              <td className="p-2.5 font-mono text-slate-500">{pt.period_end}</td>
                              <td className="p-2.5 font-bold text-slate-900">
                                {pt.value !== null ? `${pt.value.toFixed(1)} ${archiveExploreData.unit}` : 'Missing'}
                              </td>
                              <td className="p-2.5 text-slate-600">
                                {pt.valid_count} / {pt.expected_count}
                              </td>
                              <td className="p-2.5">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  pt.coverage_fraction >= 0.75 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                }`}>
                                  {(pt.coverage_fraction * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  pt.meets_requested_sufficiency
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {pt.meets_requested_sufficiency ? 'Sufficient' : 'Insufficient'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No archive records found for selected station and bounds.
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Sub-Mode 2: Matched Station Comparison View */}
          {archiveSubMode === 'compare' && (
            <div className="space-y-4">
              {/* Pair Agreement Analysis Table (Contract 1.2.0) */}
              <Card>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">
                        Matched Recorded-Clock Station Pair Agreement
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Strict requirement: clock_assumption=same_recorded_clock • No imputation
                      </CardDescription>
                    </div>
                    <span className="font-mono text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                      Matched Hours: {archiveCompareData?.matched_hour_count ?? 0}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoadingArchiveCompare ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      Computing matched-clock pair agreement across {archiveCompareIds.length} stations...
                    </div>
                  ) : archiveCompareError ? (
                    <div className="p-4 text-center text-xs text-amber-900 bg-amber-50 m-4 rounded border border-amber-200 space-y-2">
                      <p className="font-semibold">{archiveCompareError}</p>
                      <button
                        onClick={fetchArchiveCompare}
                        className="px-3 py-1 bg-amber-600 text-white rounded text-xs font-semibold hover:bg-amber-700 cursor-pointer transition-colors"
                      >
                        Retry Comparison
                      </button>
                    </div>
                  ) : archiveCompareData?.pair_agreement && archiveCompareData.pair_agreement.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {archiveCompareData.pair_agreement.map((pa, idx) => (
                        <div key={idx} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              {pa.station_a} ↔ {pa.station_b}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {pa.interpretation}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400 block">Matched Hours</span>
                              <span className="font-bold text-slate-800">{pa.count}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Mean Difference</span>
                              <span className="font-bold text-slate-800">
                                {pa.mean_difference !== null ? `${pa.mean_difference.toFixed(2)} ${archiveCompareData.unit}` : '—'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Mean Absolute Diff (MAD)</span>
                              <span className="font-extrabold text-teal-800">
                                {pa.mean_absolute_difference !== null ? `${pa.mean_absolute_difference.toFixed(2)} ${archiveCompareData.unit}` : '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-400">
                      Select at least 2 archive stations to compute matched pair agreement.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Matched Periods Comparison Table */}
              {archiveCompareData && archiveCompareData.points.length > 0 && (
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm">
                      Side-by-Side Bucket Means ({archiveCompareData.aggregation} Aggregation)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto max-h-80">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] sticky top-0">
                        <tr>
                          <th className="p-2.5">Period Start</th>
                          <th className="p-2.5">Period End</th>
                          {archiveCompareIds.map(id => (
                            <th key={id} className="p-2.5 font-bold">{id}</th>
                          ))}
                          <th className="p-2.5">Paired Hours</th>
                          <th className="p-2.5">Coverage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {archiveCompareData.points.map((pt, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-2.5 font-mono text-slate-700">{pt.period_start}</td>
                            <td className="p-2.5 font-mono text-slate-500">{pt.period_end}</td>
                            {archiveCompareIds.map(id => {
                              const val = pt.means[id];
                              return (
                                <td key={id} className="p-2.5 font-bold text-slate-900">
                                  {val !== undefined && val !== null ? `${val.toFixed(1)} ${archiveCompareData.unit}` : '—'}
                                </td>
                              );
                            })}
                            <td className="p-2.5 text-slate-600">{pt.paired_hour_count} / {pt.expected_count}</td>
                            <td className="p-2.5">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                                {(pt.paired_coverage_fraction * 100).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ------------------------------------------------------------------ */
        /* LIVE CAAQMS TELEMETRY WORKSPACE (Existing)                         */
        /* ------------------------------------------------------------------ */
        <div className="space-y-6">
          {/* Controls & Export Header */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-800">Live Intake Parameters:</span>
              <span className="text-slate-500">Querying live CAAQMS hourly ingest database</span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                <button
                  onClick={() => setViewMode('chart')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    viewMode === 'chart' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Line Chart
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Data Table
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadCsv}
                disabled={!historyData || livePoints.length === 0}
                className="flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </Button>
            </div>
          </div>

          {/* Filter Ribbon: Station, Pollutant, Range, Aggregation, Comparison */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Select
                label="Target Monitoring Station"
                options={stations.map(s => ({ value: s.id, label: s.name }))}
                value={selectedStation?.id || ''}
                onChange={e => {
                  const match = stations.find(s => s.id === e.target.value);
                  if (match) onSelectStation(match);
                }}
              />

              <Select
                label="Monitored Parameter"
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

              {/* Time Range Preset */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Time Horizon Window</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['24h', '48h', '7d'] as RangePreset[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setRangePreset(r)}
                      className={`py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                        rangePreset === r
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {r === '24h' ? '24 Hours' : r === '48h' ? '48 Hours' : '7 Days'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aggregation Mode */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Aggregation Level</label>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => setAggregation('hourly')}
                    className={`py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                      aggregation === 'hourly'
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Hourly (Source)
                  </button>
                  <button
                    onClick={() => setAggregation('daily')}
                    className={`py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                      aggregation === 'daily'
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Daily Mean
                  </button>
                </div>
              </div>
            </div>

            {/* Station Comparison Toggle & Secondary Station Selector */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="compareStationToggle"
                  checked={isCompareMode}
                  onChange={e => setIsCompareMode(e.target.checked)}
                  className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                />
                <label htmlFor="compareStationToggle" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Compare with a secondary station over the exact same time window
                </label>
              </div>

              {isCompareMode && (
                <div className="flex items-center gap-2 w-full sm:w-72">
                  <span className="text-xs text-slate-500 whitespace-nowrap">Compare vs:</span>
                  <select
                    value={compareStationId}
                    onChange={e => setCompareStationId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    {stations
                      .filter(s => s.id !== selectedStation?.id)
                      .map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Coverage, Missingness & Provenance Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Expected Hours</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {historyData ? historyData.expected_count : hoursCount} slots
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Strict 1-hour interval phase</div>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Valid Intake</div>
              <div className="text-xl font-bold text-emerald-700 mt-1">
                {historyData ? historyData.valid_count : 0} points
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Reported non-null values</div>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Missing Hours</div>
              <div className="text-xl font-bold text-amber-700 mt-1">
                {historyData ? historyData.missing_count : 0} gaps
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Sensor offline / null packets</div>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Completeness</div>
              <div className="text-xl font-bold text-teal-800 mt-1">
                {historyData && historyData.expected_count > 0
                  ? `${((historyData.valid_count / historyData.expected_count) * 100).toFixed(1)}%`
                  : '0.0%'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Audit completeness ratio</div>
            </div>
          </div>

          {/* Primary Historical Display: Chart or Table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold">
                    {selectedStation?.name} — {pollutant.toUpperCase()} Historical Telemetry
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {aggregation === 'hourly'
                      ? 'Continuous hourly observations aligned to UTC issue-time availability'
                      : 'Client-computed daily mean based on valid hourly samples (min 16h)'}
                    {isCompareMode && compareStation && ` • Comparing against ${compareStation.name}`}
                  </CardDescription>
                </div>

                <div className="text-right text-[11px] text-slate-500">
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-600 border border-slate-200">
                    Clock: UTC Intake • Display: IST (UTC+5:30)
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {isLoading ? (
                <div className="py-24 text-center text-slate-500 text-xs">
                  Retrieving historical time-series telemetry from database...
                </div>
              ) : errorMessage ? (
                <div className="py-16 text-center text-xs text-amber-900 bg-amber-50 rounded-lg border border-amber-200 p-4 space-y-2">
                  <div className="font-bold text-sm">Historical Observation Notice</div>
                  <p>{errorMessage}</p>
                  <p className="text-[11px] text-slate-500 pt-1">
                    Historical query requires an aligned UTC hourly boundary and existing audited records.
                  </p>
                  <button
                    onClick={fetchLiveHistory}
                    className="px-3 py-1 bg-teal-600 text-white rounded text-xs font-semibold hover:bg-teal-700 cursor-pointer transition-colors"
                  >
                    Retry Live Query
                  </button>
                </div>
              ) : displayPoints.length > 0 ? (
                viewMode === 'chart' ? (
                  <div className="relative">
                    {/* SVG Time-Series Chart */}
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-72 overflow-visible">
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
                              fontFamily="monospace"
                            >
                              {yVal.toFixed(0)}
                            </text>
                          </g>
                        );
                      })}

                      {/* CPCB 24-hr Standard Line for PM2.5 (60 µg/m³) */}
                      {pollutant === 'pm25' && maxVal >= 60 && (
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
                            CPCB 24h Ref: 60 µg/m³
                          </text>
                        </g>
                      )}

                      {/* Comparison Station Polyline (Amber) */}
                      {isCompareMode && comparePolyline && (
                        <polyline
                          points={comparePolyline}
                          fill="none"
                          stroke="#D97706"
                          strokeWidth="2"
                          strokeDasharray="3 3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Primary Station Polyline (Teal) */}
                      <polyline
                        points={primaryPolyline}
                        fill="none"
                        stroke="#0D9488"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Data Points */}
                      {displayPoints.map((p, idx) => (
                        <circle
                          key={idx}
                          cx={toX(idx, displayPoints.length)}
                          cy={toY(p.value)}
                          r="3.5"
                          fill="#0D9488"
                          className="hover:r-5 cursor-pointer transition-all"
                          onMouseEnter={() =>
                            setHoveredPoint({
                              measured_at: p.measured_at,
                              value: p.value,
                              stationName: selectedStation?.name
                            })
                          }
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      ))}
                    </svg>

                    {/* Chart Legend */}
                    <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 font-semibold text-teal-800">
                          <span className="w-3 h-0.5 bg-teal-600 rounded" />
                          {selectedStation?.name} (Mean: {primaryStats.mean.toFixed(1)} {historyData?.unit})
                        </span>

                        {isCompareMode && compareStation && (
                          <span className="flex items-center gap-1.5 font-semibold text-amber-800">
                            <span className="w-3 h-0.5 bg-amber-600 rounded border-dashed" />
                            {compareStation.name} (Mean: {compareStats.mean.toFixed(1)} {historyData?.unit})
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] text-slate-400">
                        Units: {historyData?.unit || 'µg/m³'}
                      </span>
                    </div>

                    {/* Hover Tooltip */}
                    {hoveredPoint && (
                      <div className="absolute top-2 right-4 bg-slate-900 text-white p-2.5 rounded-lg text-xs shadow-lg pointer-events-none">
                        <div className="text-[10px] text-slate-400">{hoveredPoint.stationName}</div>
                        <div className="font-bold text-teal-400 text-sm mt-0.5">
                          {hoveredPoint.value.toFixed(1)} {historyData?.unit || 'µg/m³'}
                        </div>
                        <div className="text-[10px] text-slate-300 mt-0.5">{formatToIST(hoveredPoint.measured_at)}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Accessible Data Table Alternative */
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] sticky top-0">
                        <tr>
                          <th className="p-2.5">Slot #</th>
                          <th className="p-2.5">Observed Time (IST)</th>
                          <th className="p-2.5">UTC Recorded Timestamp</th>
                          <th className="p-2.5">Station Name</th>
                          <th className="p-2.5">Concentration</th>
                          <th className="p-2.5">Indicative Sub-Index</th>
                          <th className="p-2.5">Intake Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {displayPoints.map((pt, idx) => {
                          const idxVal = calculateSubIndex(pollutant, pt.value);
                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>
                              <td className="p-2.5 font-semibold text-slate-900">{formatToIST(pt.measured_at)}</td>
                              <td className="p-2.5 font-mono text-[11px] text-slate-500">{pt.measured_at}</td>
                              <td className="p-2.5 text-slate-700">{selectedStation?.name}</td>
                              <td className="p-2.5 font-extrabold text-slate-900">
                                {pt.value.toFixed(1)} {historyData?.unit || 'µg/m³'}
                              </td>
                              <td className="p-2.5">
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200">
                                  Idx {idxVal}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-500 text-[11px]">{(pt as any).source || 'CAAQMS Ingestion'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <div className="py-16 text-center text-slate-400 text-xs">
                  No historical observations recorded in this window.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
