import React from 'react';
import { AQICategory } from '../../lib/api/types';
import { AQI_THEMES } from '../../lib/aqi';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  category?: AQICategory;
  variant?: 'outline' | 'filled' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  category,
  variant = 'filled',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const theme = category ? AQI_THEMES[category] : null;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs font-medium',
    md: 'px-2.5 py-1 text-xs font-semibold',
    lg: 'px-3 py-1.5 text-sm font-semibold'
  }[size];

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  if (theme) {
    if (variant === 'filled') {
      colorClasses = `${theme.badgeClass} border`;
    } else if (variant === 'outline') {
      colorClasses = `border-2 bg-transparent`;
    } else {
      colorClasses = `bg-opacity-20 border`;
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border transition-colors ${sizeClasses} ${colorClasses} ${className}`}
      style={
        theme && variant === 'outline'
          ? { borderColor: theme.accent, color: theme.accent }
          : undefined
      }
      {...props}
    >
      {category && theme && (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: theme.accent }}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
};
