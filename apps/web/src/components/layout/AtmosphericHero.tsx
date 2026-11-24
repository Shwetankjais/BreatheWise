import React from 'react';
import { City } from '../../lib/api/types';

interface AtmosphericHeroProps {
  selectedCity: City;
}

export const AtmosphericHero: React.FC<AtmosphericHeroProps> = ({ selectedCity }) => {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-[#FEF3C7]/40 via-[#FDF6E2]/50 to-[#FAF9F5] border-b border-slate-200/80 pt-6 pb-8 sm:pt-10 sm:pb-12">
      {/* Background Layer: India Gate Silhouette Artwork (Decorative) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25 sm:opacity-30 mix-blend-multiply bg-bottom bg-no-repeat bg-contain"
        style={{ backgroundImage: `url('/india-gate-silhouette.svg')` }}
        aria-hidden="true"
      />

      {/* Atmospheric Warm Dust/Mist Particle Overlay (Decorative) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30 animate-haze motion-reduce:animate-none bg-gradient-to-r from-transparent via-amber-200/20 to-transparent"
        aria-hidden="true"
      />

      {/* Content Container */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100/80 text-amber-900 border border-amber-300/60 mb-3 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse-subtle" />
            <span>National Ambient Air Quality Monitoring (CAAQMS) Telemetry</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Hyperlocal Atmospheric Intelligence & Monitoring for{' '}
            <span className="text-teal-700 underline decoration-amber-400 decoration-wavy decoration-2">
              {selectedCity.name}
            </span>
          </h1>

          <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
            Observed ambient air quality monitoring (CAAQMS) telemetry and multi-horizon atmospheric model diagnostics (+1h, +3h, +6h, +12h, +24h). Operational forecast inference is currently gated pending verified feature pipelines.
          </p>

          <p className="mt-2 text-[11px] text-slate-400 font-medium italic">
            Background silhouette and haze are decorative atmospheric artwork; not a spatial particle distribution visualization.
          </p>

          {/* Quick Metrics Bar */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-200/60">
            <div className="bg-white/80 backdrop-blur-xs p-3 rounded-lg border border-slate-200/60 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Target Metro</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5 truncate">{selectedCity.name}</div>
              <div className="text-[11px] text-teal-700 font-medium truncate">
                {selectedCity.availability === 'synthetic_demo'
                  ? 'Synthetic Demo'
                  : selectedCity.availability === 'eligible'
                  ? 'Monitored Grid'
                  : 'Pending Audit'}
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-xs p-3 rounded-lg border border-slate-200/60 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">CAAQMS Network</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">{selectedCity.observed_station_count} Monitored Stations</div>
              <div className="text-[11px] text-slate-500">{selectedCity.eligible_station_count} In Registry</div>
            </div>

            <div className="bg-white/80 backdrop-blur-xs p-3 rounded-lg border border-slate-200/60 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Forecast Horizons</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">+1h, +3h, +6h, +12h, +24h</div>
              <div className="text-[11px] text-slate-500">Declared Target Horizons</div>
            </div>

            <div className="bg-white/80 backdrop-blur-xs p-3 rounded-lg border border-slate-200/60 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">ML Architecture</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">LightGBM Booster</div>
              <div className="text-[11px] text-emerald-700 font-medium">75 Features (Diagnostic)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
