import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'ochre';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  className = '',
  children,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

  const sizeClasses = {
    sm: 'min-h-[36px] sm:min-h-[32px] px-3 text-xs gap-1.5',
    md: 'min-h-[44px] px-4 text-sm gap-2',
    lg: 'min-h-[48px] px-6 text-base gap-2.5'
  }[size];

  const variantClasses = {
    primary: 'bg-[#0D9488] text-white hover:bg-[#0F766E] shadow-sm',
    ochre: 'bg-[#C88A2E] text-white hover:bg-[#B27724] shadow-sm',
    secondary: 'bg-[#F5F1EA] text-[#1C1E24] hover:bg-[#EDE8DF] border border-[#E5DFD3]',
    outline: 'border border-[#D8CFBC] text-[#2D3139] bg-white hover:bg-[#FAF8F5] shadow-xs',
    ghost: 'text-[#555C68] hover:bg-[#F5F1EA] hover:text-[#1C1E24]',
    danger: 'bg-[#C3583C] text-white hover:bg-[#A8452D] shadow-sm'
  }[variant];

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
};
