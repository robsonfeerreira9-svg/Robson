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
      'inline-flex items-center justify-center gap-2 font-bold uppercase tracking-wide rounded-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-50 disabled:cursor-not-allowed text-sm px-4 py-2.5'

    const variants: Record<string, string> = {
      primary: 'bg-gold text-[#0D0D0D] hover:bg-yellow-400 active:scale-95',
      ghost:   'bg-transparent border border-[#2A2A2A] text-[#F0F0F0] hover:border-gold hover:text-gold active:scale-95',
      danger:  'bg-transparent border border-[#FF4444] text-[#FF4444] hover:bg-[#FF4444] hover:text-white active:scale-95',
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
