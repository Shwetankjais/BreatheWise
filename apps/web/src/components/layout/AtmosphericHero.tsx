import React from 'react';
import { City } from '../../lib/api/types';

interface AtmosphericHeroProps {
  selectedCity: City;
  onExploreDashboard?: () => void;
}

export const AtmosphericHero: React.FC<AtmosphericHeroProps> = ({ selectedCity, onExploreDashboard }) => {
  return (
    <div className="relative overflow-hidden bg-[#F7F3E9] border-b border-[#DDD3BC] pt-6 pb-10 sm:pt-10 sm:pb-14">
      {/* Background Subtle Radial Glow */}
      <div
        className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-br from-[#E29E2E]/10 via-[#C3583C]/5 to-transparent rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Main Content Container */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column (7 cols): Hero Title, Description & Reference Feature Cards */}
          <div className="lg:col-span-7 space-y-5">
            {/* National Telemetry Header Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#FFFDF9] text-[#1C1A1F] border border-[#DDD3BC] shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse-subtle" />
              <span>National CAAQMS Telemetry & ML Forensics</span>
              <span className="text-[#968F83]">|</span>
              <span className="text-[#8C5D14] font-bold">{selectedCity.name}</span>
            </div>

            {/* Main Editorial Headline */}
            <h1 className="text-3xl sm:text-5xl font-extrabold text-[#1C1A1F] tracking-tight leading-[1.12]">
              Hyperlocal Atmospheric Intelligence & ML Forecasting for India’s Cities
            </h1>

            {/* Subtitle */}
            <p className="text-sm sm:text-base text-[#4A453E] leading-relaxed font-normal max-w-2xl">
              Integrating air quality observations, weather drivers, and geographic data to evaluate pollutant concentrations and map pollution episodes across historical and retrospective horizons.
            </p>

            {/* Three Conceptual Feature Cards matching Reference Image 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
              {/* Card 1: 24-Hour Forward Projection / Replay Trajectory */}
              <div className="bg-[#FFFDF9] p-3.5 rounded-xl border border-[#DDD3BC] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-bold text-[#1C1A1F] uppercase tracking-wider">
                    24-Hour Trajectory
                  </div>
                  <div className="text-[10px] text-[#6E675D] mt-0.5">
                    Saved forecast curve
                  </div>
                </div>

                {/* Mini SVG Trajectory Wave matching reference */}
                <div className="my-2.5 h-12 w-full">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 120 40" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="heroWaveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#C3583C" stopOpacity="0.45" />
                        <stop offset="50%" stopColor="#E29E2E" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#FFFDF9" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {/* Vertical histogram bars */}
                    <rect x="10" y="24" width="4" height="16" fill="#E29E2E" opacity="0.6" rx="1" />
                    <rect x="22" y="18" width="4" height="22" fill="#E29E2E" opacity="0.7" rx="1" />
                    <rect x="34" y="10" width="4" height="30" fill="#C3583C" opacity="0.8" rx="1" />
                    <rect x="46" y="8" width="4" height="32" fill="#C3583C" opacity="0.85" rx="1" />
                    <rect x="58" y="14" width="4" height="26" fill="#C3583C" opacity="0.75" rx="1" />
                    <rect x="70" y="20" width="4" height="20" fill="#E29E2E" opacity="0.65" rx="1" />
                    <rect x="82" y="26" width="4" height="14" fill="#E29E2E" opacity="0.5" rx="1" />
                    <rect x="94" y="16" width="4" height="24" fill="#C3583C" opacity="0.7" rx="1" />
                    <rect x="106" y="22" width="4" height="18" fill="#E29E2E" opacity="0.6" rx="1" />
                    {/* Continuous smoothed wave line */}
                    <path
                      d="M 0 28 Q 20 26 35 12 T 50 8 T 75 22 T 95 15 T 120 24"
                      fill="none"
                      stroke="#C3583C"
                      strokeWidth="2"
                    />
                    <path
                      d="M 0 28 Q 20 26 35 12 T 50 8 T 75 22 T 95 15 T 120 24 L 120 40 L 0 40 Z"
                      fill="url(#heroWaveGrad)"
                    />
                  </svg>
                </div>

                <div className="flex justify-between text-[9px] text-[#968F83] font-mono border-t border-[#EBE3D3] pt-1.5">
                  <span>+1h</span>
                  <span>+6h</span>
                  <span>+12h</span>
                  <span>+24h</span>
                </div>
              </div>

              {/* Card 2: ML-Driven Insights */}
              <div className="bg-[#FFFDF9] p-3.5 rounded-xl border border-[#DDD3BC] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-bold text-[#1C1A1F] uppercase tracking-wider">
                    ML-Driven Insights
                  </div>
                  <p className="text-[11px] text-[#4A453E] mt-1.5 leading-snug">
                    Highlights sensor grid coverage, data freshness, and held-out model error distributions.
                  </p>
                </div>
                <div className="mt-2 text-[10px] text-[#8C5D14] bg-[#FBF4E6] px-2 py-1 rounded border border-[#E8D1A0] font-semibold">
                  Independent LightGBM
                </div>
              </div>

              {/* Card 3: Replay Windows */}
              <div className="bg-[#FFFDF9] p-3.5 rounded-xl border border-[#DDD3BC] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-bold text-[#1C1A1F] uppercase tracking-wider">
                    Replay Windows
                  </div>
                  <div className="mt-1.5 space-y-1 text-[10px]">
                    <div className="flex items-center gap-1.5 text-[#14532D] font-medium bg-[#DCFCE7] px-1.5 py-0.5 rounded">
                      <span>●</span>
                      <span>Lowest: 12:00 – 14:00</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#7F1D1D] font-medium bg-[#FEE2E2] px-1.5 py-0.5 rounded">
                      <span>▲</span>
                      <span>Peak: 07:00 – 09:00</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-[9px] text-[#968F83] italic border-t border-[#EBE3D3] pt-1">
                  Historical comparison only
                </div>
              </div>
            </div>

            {/* Call to Action Button */}
            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={onExploreDashboard}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm bg-[#E29E2E] hover:bg-[#C88A2E] text-[#1C1A1F] border-2 border-[#1C1A1F] shadow-sm transition-all cursor-pointer"
              >
                <span>Enter Dashboard & Map</span>
                <span className="text-base leading-none">→</span>
              </button>
              <span className="text-xs text-[#6E675D]">
                {selectedCity.observed_station_count} CAAQMS stations monitored
              </span>
            </div>
          </div>

          {/* Right Column (5 cols): Isometric India Gate Plinth Artwork matching Reference Image 1 */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-[460px] aspect-[4/3] flex items-center justify-center">
              {/* Decorative Isometric SVG Canvas */}
              <svg
                viewBox="0 0 500 380"
                className="w-full h-full overflow-visible drop-shadow-[0_16px_32px_rgba(28,26,31,0.18)]"
                aria-label="Isometric illustration of India Gate plinth and Delhi atmospheric network"
                role="img"
              >
                <defs>
                  {/* Isometric Top Surface Gradient */}
                  <linearGradient id="plinthSurface" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFFDF9" />
                    <stop offset="50%" stopColor="#F7F1E3" />
                    <stop offset="100%" stopColor="#EFE5D0" />
                  </linearGradient>

                  {/* Isometric Side Extrusions */}
                  <linearGradient id="plinthSideLeft" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#8C6838" />
                    <stop offset="100%" stopColor="#5E4320" />
                  </linearGradient>
                  <linearGradient id="plinthSideRight" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#6E5028" />
                    <stop offset="100%" stopColor="#453116" />
                  </linearGradient>

                  {/* Radial Heat/Haze Glow */}
                  <radialGradient id="radialHazeGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#C3583C" stopOpacity="0.45" />
                    <stop offset="45%" stopColor="#E29E2E" stopOpacity="0.30" />
                    <stop offset="85%" stopColor="#FAF6EE" stopOpacity="0.0" />
                  </radialGradient>

                  {/* Monument Stone Color */}
                  <linearGradient id="monumentStone" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#D98A4A" />
                    <stop offset="50%" stopColor="#F5B272" />
                    <stop offset="100%" stopColor="#B36B34" />
                  </linearGradient>
                </defs>

                {/* 1. Isometric Block 3D Side Thickness */}
                {/* Left Side Extrusion */}
                <path d="M 50 190 L 250 310 L 250 335 L 50 215 Z" fill="url(#plinthSideLeft)" />
                {/* Right Side Extrusion */}
                <path d="M 250 310 L 450 190 L 450 215 L 250 335 Z" fill="url(#plinthSideRight)" />

                {/* 2. Top Isometric Surface (Diamond) */}
                <polygon
                  points="250,70 450,190 250,310 50,190"
                  fill="url(#plinthSurface)"
                  stroke="#DDD3BC"
                  strokeWidth="2"
                />

                {/* 3. Radial Street & Concentric Ring Network */}
                <g opacity="0.65" stroke="#C4B99F" strokeWidth="1.2">
                  {/* Concentric Ellipses on Isometric Plane */}
                  <ellipse cx="250" cy="190" rx="160" ry="85" fill="none" strokeDasharray="3,3" />
                  <ellipse cx="250" cy="190" rx="115" ry="60" fill="none" />
                  <ellipse cx="250" cy="190" rx="75" ry="40" fill="url(#radialHazeGlow)" stroke="#E29E2E" strokeWidth="1.5" />

                  {/* Radial Arterial Lines (Rajpath, Janpath, Barakhamba) */}
                  <line x1="250" y1="190" x2="250" y2="70" />
                  <line x1="250" y1="190" x2="250" y2="310" />
                  <line x1="250" y1="190" x2="50" y2="190" />
                  <line x1="250" y1="190" x2="450" y2="190" />
                  <line x1="250" y1="190" x2="110" y2="105" />
                  <line x1="250" y1="190" x2="390" y2="275" />
                  <line x1="250" y1="190" x2="390" y2="105" />
                  <line x1="250" y1="190" x2="110" y2="275" />
                </g>

                {/* 4. Atmospheric Advection Wind Streamlines */}
                <path
                  d="M 120 160 Q 200 130 280 165 T 410 180"
                  fill="none"
                  stroke="#1C1A1F"
                  strokeWidth="1.2"
                  opacity="0.45"
                />
                <path
                  d="M 100 200 Q 180 170 260 205 T 390 220"
                  fill="none"
                  stroke="#1C1A1F"
                  strokeWidth="1.2"
                  opacity="0.35"
                />

                {/* 5. Center Raised Monument Plinth (Cylinder Base) */}
                <ellipse cx="250" cy="205" rx="48" ry="24" fill="#B38A52" />
                <path d="M 202 205 L 202 195 A 48 24 0 0 1 298 195 L 298 205 Z" fill="#8C6534" />
                <ellipse cx="250" cy="195" rx="48" ry="24" fill="#E8BD80" stroke="#8C6534" strokeWidth="1" />

                {/* 6. India Gate Architectural Arch Vector */}
                <g id="indiaGateMonument">
                  {/* Monument Base Pedestal */}
                  <polygon points="228,190 272,190 268,182 232,182" fill="#B36B34" />

                  {/* Left Column Pylon */}
                  <polygon points="231,182 242,182 242,130 231,130" fill="url(#monumentStone)" />
                  {/* Right Column Pylon */}
                  <polygon points="258,182 269,182 269,130 258,130" fill="url(#monumentStone)" />

                  {/* Central Arch Opening */}
                  <path d="M 242 155 Q 250 148 258 155 L 258 182 L 242 182 Z" fill="#241B10" />

                  {/* Middle Entablature Block */}
                  <polygon points="228,130 272,130 270,120 230,120" fill="url(#monumentStone)" stroke="#8C4E20" strokeWidth="0.5" />

                  {/* Attic Level (Inscription Panel) */}
                  <polygon points="232,120 268,120 268,106 232,106" fill="#F5B272" stroke="#8C4E20" strokeWidth="0.5" />

                  {/* Top Cornice Domelet (Chattri Dome) */}
                  <ellipse cx="250" cy="106" rx="14" ry="4" fill="#D98A4A" />
                  <path d="M 240 106 Q 250 96 260 106 Z" fill="#B36B34" />
                  <circle cx="250" cy="95" r="2.5" fill="#E29E2E" />
                </g>

                {/* 7. Floating Location Pin: Anand Vihar */}
                <g transform="translate(385, 125)">
                  {/* Pin Drop Pin */}
                  <path
                    d="M 0 0 C -12 -12 -12 -28 0 -36 C 12 -28 12 -12 0 0 Z"
                    fill="#1C1A1F"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                  <circle cx="0" cy="-22" r="4.5" fill="#C3583C" />

                  {/* Pin Callout Card */}
                  <g transform="translate(-55, -80)">
                    <rect x="0" y="0" width="110" height="42" rx="8" fill="#1C1A1F" stroke="#332F38" strokeWidth="1" />
                    <text x="8" y="14" fill="#FFFFFF" fontSize="9" fontWeight="bold">Anand Vihar</text>
                    <text x="8" y="27" fill="#E29E2E" fontSize="11" fontWeight="800">147.0 µg/m³</text>
                    <text x="70" y="27" fill="#C3583C" fontSize="9" fontWeight="bold">PM2.5</text>
                    <text x="8" y="37" fill="#A8A1B0" fontSize="7.5">CAAQMS Monitor</text>
                  </g>
                </g>

                {/* 8. Pin 2: Central Delhi Pin */}
                <g transform="translate(145, 175)">
                  <path
                    d="M 0 0 C -8 -8 -8 -20 0 -26 C 8 -20 8 -8 0 0 Z"
                    fill="#E29E2E"
                    stroke="#1C1A1F"
                    strokeWidth="1"
                  />
                  <circle cx="0" cy="-15" r="3" fill="#FFFFFF" />
                </g>

                {/* 9. Pin 3: South Delhi Pin */}
                <g transform="translate(365, 230)">
                  <path
                    d="M 0 0 C -8 -8 -8 -20 0 -26 C 8 -20 8 -8 0 0 Z"
                    fill="#0D9488"
                    stroke="#FFFFFF"
                    strokeWidth="1"
                  />
                  <circle cx="0" cy="-15" r="3" fill="#FFFFFF" />
                </g>

                {/* 10. Vintage Badge Tag matching reference */}
                <g transform="translate(300, 280)">
                  <rect x="0" y="0" width="95" height="24" rx="12" fill="#FFFDF9" stroke="#DDD3BC" strokeWidth="1.5" />
                  <text x="47" y="16" textAnchor="middle" fill="#1C1A1F" fontSize="10" fontWeight="bold">
                    Delhi NCR
                  </text>
                </g>
              </svg>

              {/* Artwork Label Disclaimer */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-[#7A7368] font-mono bg-[#FFFDF9]/90 px-3 py-1 rounded-full border border-[#DDD3BC] shadow-xs">
                Original architectural artwork · decorative illustration, not a dispersion model
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
