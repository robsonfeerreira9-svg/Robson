'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  loading?: boolean
  fullWidth?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', loading = false, fullWidth = false, children, disabled, className = '', ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center gap-2 font-bold uppercase tracking-wide rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-40 disabled:cursor-not-allowed text-sm px-4 py-2.5 select-none'

    const variants: Record<string, string> = {
      primary: 'bg-gold text-[#0D0D0D] hover:bg-yellow-400 hover:shadow-[0_0_16px_rgba(245,197,24,0.35)] active:scale-95 active:shadow-none',
      ghost:   'bg-transparent border border-[#2A2A2A] text-[#888888] hover:border-gold/60 hover:text-gold hover:bg-gold/5 active:scale-95',
      danger:  'bg-transparent border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-400 active:scale-95',
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
