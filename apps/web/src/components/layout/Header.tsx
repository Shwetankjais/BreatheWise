import React, { useState } from 'react';
import { City, DataMode } from '../../lib/api/types';
import { DataModeBadge } from '../ui/DataModeBadge';

interface HeaderProps {
  cities: City[];
  selectedCity: City;
  onSelectCity: (city: City) => void;
  dataMode: DataMode;
  isDemoMode: boolean;
  onToggleDemoMode: (enabled: boolean) => void;
  onOpenNotifications: () => void;
  unreadCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  cities,
  selectedCity,
  onSelectCity,
  dataMode,
  isDemoMode,
  onToggleDemoMode,
  onOpenNotifications,
  unreadCount
}) => {
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-[#F7F3E9]/95 backdrop-blur-md border-b border-[#DDD3BC] w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Main Header Row */}
        <div className="flex items-center justify-between min-h-[44px] sm:min-h-[64px] py-1.5 sm:py-2 gap-2 sm:gap-4">
          {/* Logo & Brand Identity matching Reference Image 1 */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
            {/* Leaf & Wind Brand Mark */}
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#E29E2E] via-[#C88A2E] to-[#C3583C] flex items-center justify-center shadow-sm text-white font-black text-base sm:text-lg shrink-0">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-extrabold text-base sm:text-lg text-[#1C1A1F] tracking-tight">
                  BreatheWise India
                </span>
              </div>
              <p className="text-[11px] text-[#6E675D] font-medium hidden md:block">
                City monitoring pilot · ML research
              </p>
            </div>
          </div>

          {/* Desktop Center: City Switcher matching Reference */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
              className="min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-xl border border-[#DDD3BC] bg-[#FFFDF9] hover:bg-[#F2ECE0] text-[#1C1A1F] text-xs sm:text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E29E2E] cursor-pointer shadow-xs"
              aria-expanded={isCityDropdownOpen}
              aria-label="Select target Indian city"
            >
              <svg className="w-4 h-4 text-[#C88A2E] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{selectedCity.name}</span>
              <span className="text-[11px] text-[#7A7368] font-normal hidden md:inline">
                ({selectedCity.observed_station_count} stations)
              </span>
              <svg className="w-3.5 h-3.5 text-[#968F83] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isCityDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setIsCityDropdownOpen(false)}
                />
                <div className="absolute left-0 mt-2 w-72 max-h-80 overflow-y-auto bg-[#FFFDF9] rounded-2xl shadow-xl border border-[#DDD3BC] z-30 p-2">
                  <div className="px-3 py-2 text-xs font-bold text-[#7A7368] uppercase tracking-wider border-b border-[#EBE3D3]">
                    Supported Indian Cities ({cities.length})
                  </div>
                  <div className="py-1">
                    {cities.map(city => {
                      const isSelected = city.id === selectedCity.id;
                      return (
                        <button
                          key={city.id}
                          onClick={() => {
                            onSelectCity(city);
                            setIsCityDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm flex items-center justify-between transition-colors cursor-pointer min-h-[44px] ${
                            isSelected
                              ? 'bg-[#FBF4E6] text-[#8C5D14] font-bold border border-[#E8D1A0]'
                              : 'text-[#3D3934] hover:bg-[#F7F3E9]'
                          }`}
                        >
                          <div>
                            <div className="font-semibold">{city.name}</div>
                            <div className="text-[11px] text-[#7A7368] capitalize">{city.availability}</div>
                          </div>
                          <span className="text-[11px] text-[#4A453E] bg-[#EBE3D3] px-2 py-0.5 rounded-full font-medium">
                            {city.observed_station_count} stns
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right Controls: Data Mode & Notification Center */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Live Telemetry Pill */}
            <div>
              <DataModeBadge mode={dataMode} />
            </div>

            {/* ML Forensics Status Pill */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#FFFDF9] text-[#1C1A1F] border border-[#DDD3BC] shadow-xs">
              <span className="text-[#C88A2E]">✦</span>
              <span>ML Evaluation & Replay</span>
            </div>

            {/* Demo Toggle Button */}
            <button
              onClick={() => onToggleDemoMode(!isDemoMode)}
              className={`min-h-[38px] sm:min-h-[44px] text-xs px-3 sm:px-3.5 py-1.5 rounded-xl font-bold border transition-colors shrink-0 whitespace-nowrap cursor-pointer shadow-xs ${
                isDemoMode
                  ? 'bg-[#FEF3C7] text-[#78350F] border-[#FDE68A] hover:bg-[#FDE68A]'
                  : 'bg-[#FFFDF9] text-[#1C1A1F] border-[#DDD3BC] hover:bg-[#F2ECE0]'
              }`}
              title={isDemoMode ? 'Exit Demo Preview and return to live telemetry' : 'Switch to Demo Preview mode'}
            >
              {isDemoMode ? 'Exit Demo' : 'Demo Preview'}
            </button>

            {/* Notification Bell */}
            <button
              onClick={onOpenNotifications}
              className="relative min-h-[38px] min-w-[38px] sm:min-h-[44px] sm:min-w-[44px] p-2 text-[#4A453E] hover:text-[#1C1A1F] hover:bg-[#F2ECE0] rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E29E2E] cursor-pointer shrink-0 flex items-center justify-center border border-transparent hover:border-[#DDD3BC]"
              aria-label="View notifications and alert triggers"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#C3583C] text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile City Selector Row */}
        <div className="sm:hidden py-2 border-t border-[#DDD3BC] flex items-center justify-between">
          <div className="text-xs font-semibold text-[#4A453E] flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-[#C88A2E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <span>Target City:</span>
          </div>
          <select
            value={selectedCity.id}
            onChange={e => {
              const match = cities.find(c => c.id === e.target.value);
              if (match) onSelectCity(match);
            }}
            className="min-h-[44px] text-xs font-bold text-[#1C1A1F] bg-[#FFFDF9] border border-[#DDD3BC] rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#E29E2E]"
          >
            {cities.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.observed_station_count} stns)
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
};
