'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'silver'
  loading?: boolean
  fullWidth?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', loading = false, fullWidth = false, children, disabled, className = '', ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 font-semibold uppercase tracking-wider rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A840] disabled:opacity-35 disabled:cursor-not-allowed text-xs px-4 py-2.5 select-none'
    const variants: Record<string, string> = {
      primary: 'bg-[#C9A840] text-[#080808] hover:bg-[#DEB84A] hover:shadow-[0_0_20px_rgba(201,168,64,0.4)] active:scale-95',
      ghost:   'bg-transparent border border-[#202020] text-[#606060] hover:border-[#C9A840]/50 hover:text-[#C9A840] hover:bg-[rgba(201,168,64,0.05)] active:scale-95',
      silver:  'bg-transparent border border-[#303030] text-[#A8A8A8] hover:border-[#A8A8A8]/60 hover:text-[#F0F0F0] hover:bg-[rgba(168,168,168,0.06)] active:scale-95',
      danger:  'bg-transparent border border-[#E53E3E]/35 text-[#E53E3E] hover:bg-[rgba(229,62,62,0.08)] hover:border-[#E53E3E]/60 active:scale-95',
    }
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${base} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
export default Button
