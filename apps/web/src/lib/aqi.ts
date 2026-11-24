/**
 * CPCB Breakpoint Reference & Utilities
 * Single-pollutant hourly concentration sub-index evaluation based on CPCB NAQI breakpoint tables.
 *
 * NOTE: Official CPCB NAQI requires 24-hour averaging and a minimum of 3 monitored pollutants
 * (with at least PM10 or PM2.5). Individual 1-hour sensor observations provide indicative
 * single-pollutant sub-index references, not official 24-hour multi-pollutant NAQI.
 */

import { AQICategory, Pollutant } from './api/types';

export interface AQISubIndexBreakpoint {
  lowC: number;
  highC: number;
  lowI: number;
  highI: number;
}

// CPCB Breakpoint Tables in µg/m³
// All pollutants including CO are evaluated in canonical µg/m³ (1 mg/m³ = 1000 µg/m³)
// Breakpoint intervals are defined continuously to ensure fractional values (e.g. 30.5, 90.5) interpolate cleanly.
export const CPCB_BREAKPOINTS: Record<Pollutant, AQISubIndexBreakpoint[]> = {
  pm25: [
    { lowC: 0, highC: 30, lowI: 0, highI: 50 },         // Good
    { lowC: 30, highC: 60, lowI: 50, highI: 100 },      // Satisfactory
    { lowC: 60, highC: 90, lowI: 100, highI: 200 },     // Moderate
    { lowC: 90, highC: 120, lowI: 200, highI: 300 },    // Poor
    { lowC: 120, highC: 250, lowI: 300, highI: 400 },   // Very Poor
    { lowC: 250, highC: 500, lowI: 400, highI: 500 },   // Severe
  ],
  pm10: [
    { lowC: 0, highC: 50, lowI: 0, highI: 50 },
    { lowC: 50, highC: 100, lowI: 50, highI: 100 },
    { lowC: 100, highC: 250, lowI: 100, highI: 200 },
    { lowC: 250, highC: 350, lowI: 200, highI: 300 },
    { lowC: 350, highC: 430, lowI: 300, highI: 400 },
    { lowC: 430, highC: 600, lowI: 400, highI: 500 },
  ],
  no2: [
    { lowC: 0, highC: 40, lowI: 0, highI: 50 },
    { lowC: 40, highC: 80, lowI: 50, highI: 100 },
    { lowC: 80, highC: 180, lowI: 100, highI: 200 },
    { lowC: 180, highC: 280, lowI: 200, highI: 300 },
    { lowC: 280, highC: 400, lowI: 300, highI: 400 },
    { lowC: 400, highC: 500, lowI: 400, highI: 500 },
  ],
  so2: [
    { lowC: 0, highC: 40, lowI: 0, highI: 50 },
    { lowC: 40, highC: 80, lowI: 50, highI: 100 },
    { lowC: 80, highC: 380, lowI: 100, highI: 200 },
    { lowC: 380, highC: 800, lowI: 200, highI: 300 },
    { lowC: 800, highC: 1600, lowI: 300, highI: 400 },
    { lowC: 1600, highC: 2000, lowI: 400, highI: 500 },
  ],
  o3: [
    { lowC: 0, highC: 50, lowI: 0, highI: 50 },
    { lowC: 50, highC: 100, lowI: 50, highI: 100 },
    { lowC: 100, highC: 168, lowI: 100, highI: 200 },
    { lowC: 168, highC: 208, lowI: 200, highI: 300 },
    { lowC: 208, highC: 748, lowI: 300, highI: 400 },
    { lowC: 748, highC: 1000, lowI: 400, highI: 500 },
  ],
  // CO breakpoints in µg/m³ (CPCB defines 0-1.0, 1.1-2.0, 2.1-10.0, 10.1-17.0, 17.1-34.0, 34.1-50.0 mg/m³)
  co: [
    { lowC: 0, highC: 1000, lowI: 0, highI: 50 },
    { lowC: 1000, highC: 2000, lowI: 50, highI: 100 },
    { lowC: 2000, highC: 10000, lowI: 100, highI: 200 },
    { lowC: 10000, highC: 17000, lowI: 200, highI: 300 },
    { lowC: 17000, highC: 34000, lowI: 300, highI: 400 },
    { lowC: 34000, highC: 50000, lowI: 400, highI: 500 },
  ]
};

/**
 * Calculate CPCB Breakpoint Sub-Index for a single pollutant observation.
 * Note: Represents single-pollutant sub-index, not overall 24h NAQI.
 * Continuous interval evaluation ensures fractional values (e.g. 30.5, 90.5) interpolate cleanly.
 */
export function calculateSubIndex(pollutant: Pollutant, concentration: number): number {
  if (concentration < 0 || isNaN(concentration) || !isFinite(concentration)) return 0;
  const table = CPCB_BREAKPOINTS[pollutant];
  if (!table) return Math.round(concentration);

  // Check intervals
  for (let i = 0; i < table.length; i++) {
    const bp = table[i];
    // First interval includes lower bound 0; subsequent intervals are strictly greater than lower bound
    const inRange = i === 0
      ? concentration >= bp.lowC && concentration <= bp.highC
      : concentration > bp.lowC && concentration <= bp.highC;

    if (inRange) {
      if (bp.highC === bp.lowC) return bp.lowI;
      const subIndex = ((bp.highI - bp.lowI) / (bp.highC - bp.lowC)) * (concentration - bp.lowC) + bp.lowI;
      return Math.round(subIndex);
    }
  }

  // Above severe threshold: extrapolate up to 500
  const lastBp = table[table.length - 1];
  if (concentration > lastBp.highC) {
    return 500;
  }
  return 0;
}

/**
 * Determine breakpoint category from numerical sub-index
 */
export function getAQICategory(subIndex: number): AQICategory {
  if (subIndex <= 50) return 'Good';
  if (subIndex <= 100) return 'Satisfactory';
  if (subIndex <= 200) return 'Moderate';
  if (subIndex <= 300) return 'Poor';
  if (subIndex <= 400) return 'Very Poor';
  return 'Severe';
}

export interface AQITheme {
  category: AQICategory;
  bg: string;
  border: string;
  text: string;
  accent: string;
  badgeClass: string;
}

export const AQI_THEMES: Record<AQICategory, AQITheme> = {
  Good: {
    category: 'Good',
    bg: '#DCFCE7',
    border: '#86EFAC',
    text: '#166534',
    accent: '#16A34A',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  },
  Satisfactory: {
    category: 'Satisfactory',
    bg: '#ECFCCB',
    border: '#BEF264',
    text: '#3F6212',
    accent: '#65A30D',
    badgeClass: 'bg-lime-100 text-lime-800 border-lime-200'
  },
  Moderate: {
    category: 'Moderate',
    bg: '#FEF3C7',
    border: '#FDE68A',
    text: '#92400E',
    accent: '#D97706',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200'
  },
  Poor: {
    category: 'Poor',
    bg: '#FFEDD5',
    border: '#FDBA74',
    text: '#9A3412',
    accent: '#EA580C',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-200'
  },
  'Very Poor': {
    category: 'Very Poor',
    bg: '#FEE2E2',
    border: '#FCA5A5',
    text: '#991B1B',
    accent: '#DC2626',
    badgeClass: 'bg-red-100 text-red-800 border-red-200'
  },
  Severe: {
    category: 'Severe',
    bg: '#F3E8FF',
    border: '#D8B4FE',
    text: '#6B21A8',
    accent: '#7E22CE',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200'
  }
};

/**
 * Format UTC ISO date to Indian Standard Time (IST, UTC+05:30)
 */
export function formatToIST(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d) + ' IST';
  } catch {
    return isoString;
  }
}

/**
 * Human-readable relative time string
 */
export function formatTimeAgo(isoString: string): string {
  try {
    const d = new Date(isoString);
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 0) return 'Just now';
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return 'Unknown';
  }
}
