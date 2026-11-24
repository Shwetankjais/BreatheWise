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
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Main Header Row */}
        <div className="flex items-center justify-between min-h-[3.5rem] sm:h-16 py-1.5 sm:py-0 gap-2 sm:gap-4">
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-teal-600 to-amber-600 flex items-center justify-center shadow-md text-white font-bold text-base sm:text-lg shrink-0">
              BW
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                  BreatheWise
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 hidden xs:inline-block">
                  India
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden md:block">
                National CAAQMS Telemetry & ML Forecasts
              </p>
            </div>
          </div>

          {/* Desktop Center: City Switcher (Hidden on mobile row, shown on dedicated mobile bar below) */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 cursor-pointer"
              aria-expanded={isCityDropdownOpen}
              aria-label="Select target Indian city"
            >
              <svg className="w-4 h-4 text-teal-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{selectedCity.name}</span>
              <span className="text-[10px] text-slate-500 font-normal hidden md:inline">
                ({selectedCity.observed_station_count} stations)
              </span>
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isCityDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setIsCityDropdownOpen(false)}
                />
                <div className="absolute left-0 mt-2 w-72 max-h-80 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 z-30 p-2">
                  <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
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
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs sm:text-sm flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-teal-50 text-teal-900 font-semibold'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <div className="font-medium">{city.name}</div>
                            <div className="text-[11px] text-slate-400 capitalize">{city.availability}</div>
                          </div>
                          <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
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
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div>
              <DataModeBadge mode={dataMode} />
            </div>

            <button
              onClick={() => onToggleDemoMode(!isDemoMode)}
              className={`text-xs px-2 sm:px-2.5 py-1 rounded-lg font-semibold border transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                isDemoMode
                  ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
              title={isDemoMode ? 'Exit Demo Preview and return to live telemetry' : 'Switch to Demo Preview mode'}
            >
              {isDemoMode ? 'Exit Demo' : 'Demo Preview'}
            </button>

            {/* Notification Bell */}
            <button
              onClick={onOpenNotifications}
              className="relative p-1.5 sm:p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 cursor-pointer shrink-0"
              aria-label="View notifications and alert triggers"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile City Selector Bar (< sm) */}
        <div className="sm:hidden py-1.5 border-t border-slate-100 flex items-center justify-between">
          <div className="relative w-full">
            <button
              onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
              className="w-full flex items-center justify-between px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold"
              aria-expanded={isCityDropdownOpen}
              aria-label="Select target Indian city"
            >
              <div className="flex items-center gap-1.5 truncate">
                <svg className="w-3.5 h-3.5 text-teal-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="truncate">{selectedCity.name}</span>
                <span className="text-[10px] text-slate-400 font-normal">({selectedCity.observed_station_count} stns)</span>
              </div>
              <svg className="w-3 h-3 text-slate-400 shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isCityDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setIsCityDropdownOpen(false)}
                />
                <div className="absolute left-0 right-0 mt-1 w-full max-h-60 overflow-y-auto bg-white rounded-lg shadow-xl border border-slate-200 z-30 p-1.5">
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Supported Cities ({cities.length})
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
                          className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between ${
                            isSelected
                              ? 'bg-teal-50 text-teal-900 font-semibold'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <div className="font-medium">{city.name}</div>
                            <div className="text-[10px] text-slate-400 capitalize">{city.availability}</div>
                          </div>
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
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
        </div>
      </div>
    </header>
  );
};
