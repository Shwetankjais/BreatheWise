import React from 'react';
import { DataMode } from '../../lib/api/types';

interface DataModeBadgeProps {
  mode: DataMode;
  replayIssueTime?: string;
  className?: string;
}

export const DataModeBadge: React.FC<DataModeBadgeProps> = ({
  mode,
  replayIssueTime,
  className = ''
}) => {
  if (mode === 'live') {
    return (
      <span
        className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 ${className}`}
        title="Live CAAQMS telemetry intake feed"
      >
        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse-subtle shrink-0" />
        <span className="sm:hidden">LIVE</span>
        <span className="hidden sm:inline">LIVE SENSOR TELEMETRY</span>
      </span>
    );
  }

  if (mode === 'historical_replay') {
    return (
      <span
        className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-300 ${className}`}
        title={`Historical replay issued at: ${replayIssueTime || 'Pre-recorded event'}`}
      >
        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-indigo-500 shrink-0" />
        <span className="sm:hidden">REPLAY</span>
        <span className="hidden sm:inline">HISTORICAL REPLAY {replayIssueTime ? `(${replayIssueTime})` : ''}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 shadow-xs ${className}`}
      title="High-fidelity demo scenario for UI inspection"
    >
      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500 shrink-0" />
      <span className="sm:hidden">DEMO</span>
      <span className="hidden sm:inline">DEMO TEST FIXTURE (PREVIEW)</span>
    </span>
  );
};
