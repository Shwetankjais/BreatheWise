import React, { useState } from 'react';
import { Advisory, Pollutant } from '../../lib/api/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';

interface HealthViewProps {
  advisories: Advisory[];
  selectedPollutant: Pollutant;
  onSelectPollutant: (pollutant: Pollutant) => void;
}

export const HealthView: React.FC<HealthViewProps> = ({
  advisories,
  selectedPollutant,
  onSelectPollutant
}) => {
  const currentAdvisory = advisories.find(a => a.pollutant === selectedPollutant) || advisories[0];

  return (
    <div className="space-y-6">
      {/* Top Advisory Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Ambient Air Pollution Health Education
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
              Educational facts sourced from World Health Organization (WHO) guidance documents.
            </p>
          </div>

          {/* Pollutant Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
            {(['pm25', 'pm10', 'no2', 'so2', 'o3', 'co'] as Pollutant[]).map(p => (
              <button
                key={p}
                onClick={() => onSelectPollutant(p)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                  selectedPollutant === p
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p === 'pm25' ? 'PM2.5' : p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Clinical Disclaimer Box */}
        <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <span className="font-bold">Medical & Non-Clinical Notice: </span>
            Educational population-level information; no diagnosis or personal risk estimate. This content does not assign an official CPCB AQI category or prescribe a safe activity window. Consult licensed medical professionals for diagnosis and treatment plans.
          </div>
        </div>
      </div>

      {/* Advisory Content Card */}
      {currentAdvisory ? (
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-800 uppercase bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200">
                Pollutant: {currentAdvisory.pollutant.toUpperCase()}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Version: {currentAdvisory.content_version}
              </span>
            </div>
            <CardTitle className="text-base font-bold mt-2">
              {currentAdvisory.title}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Source: <a href={currentAdvisory.source_url} target="_blank" rel="noopener noreferrer" className="text-teal-700 underline">{currentAdvisory.source_title}</a> • Scope: {currentAdvisory.scope}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-2 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 leading-relaxed">
              <div className="font-bold text-slate-900 mb-1">Educational Summary</div>
              <p>{currentAdvisory.summary}</p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 leading-relaxed">
              <div className="font-bold text-slate-900 mb-1">Content Review & Scientific Scope</div>
              <p className="font-mono text-slate-600">{currentAdvisory.review_scope}</p>
              <div className="text-[11px] text-slate-400 mt-1">Reviewed At: {currentAdvisory.reviewed_at}</div>
            </div>

            {currentAdvisory.limitations && currentAdvisory.limitations.length > 0 && (
              <div className="p-3.5 bg-amber-50/60 rounded-lg border border-amber-200/80 text-amber-950">
                <div className="font-bold mb-1.5 uppercase text-[11px] tracking-wider">
                  Documented Content Limitations:
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-700">
                  {currentAdvisory.limitations.map((lim, idx) => (
                    <li key={idx}>{lim}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
          Loading health advisory content...
        </div>
      )}
    </div>
  );
};
