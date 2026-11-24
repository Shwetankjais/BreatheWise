import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'pills' | 'charcoal';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'charcoal',
  className = ''
}) => {
  const containerClasses = {
    charcoal:
      'bg-[#1E1C21] text-[#A8A1B0] rounded-full p-1.5 border border-[#332F38] shadow-[0_8px_32px_rgba(10,8,14,0.35)]',
    pills: 'bg-[#F2ECE0] rounded-xl border border-[#DDD3BC] p-1.5',
    underline: 'border-b border-[#DDD3BC] p-1'
  }[variant];

  return (
    <div
      role="tablist"
      aria-label="Application views"
      className={`flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full ${containerClasses} ${className}`}
    >
      {tabs.map(tab => {
        const isActive = tab.id === activeTab;

        let itemClasses = '';
        if (variant === 'charcoal') {
          itemClasses = isActive
            ? 'bg-[#352E22] text-[#F3BC4C] border border-[#C88A2E]/60 shadow-xs rounded-full font-bold'
            : 'text-[#A8A1B0] hover:text-white hover:bg-white/10 rounded-full font-medium';
        } else if (variant === 'pills') {
          itemClasses = isActive
            ? 'bg-white text-[#1C1A1F] shadow-sm font-bold border border-[#DDD3BC] rounded-lg'
            : 'text-[#6E675D] hover:text-[#1C1A1F] hover:bg-white/60 rounded-lg';
        } else {
          itemClasses = isActive
            ? 'border-b-2 border-[#0D9488] text-[#0F766E] font-bold bg-white/40'
            : 'text-[#6E675D] hover:text-[#1C1A1F] hover:bg-white/60';
        }

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`min-h-[44px] flex items-center gap-2 px-4 py-2 text-xs sm:text-sm whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E29E2E] cursor-pointer ${itemClasses}`}
          >
            {tab.icon && <span className="opacity-80">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isActive
                    ? variant === 'charcoal'
                      ? 'bg-[#E29E2E] text-[#1C1A1F]'
                      : 'bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4]'
                    : variant === 'charcoal'
                    ? 'bg-[#332F38] text-[#A8A1B0]'
                    : 'bg-[#EBE3D3] text-[#6E675D]'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
