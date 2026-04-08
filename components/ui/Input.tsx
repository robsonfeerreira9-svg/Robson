'use client'

import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[#F0F0F0]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full bg-[#0D0D0D] border rounded-md px-3 py-2.5 text-sm text-[#F0F0F0]
            placeholder:text-[#888888]
            transition-colors duration-150
            ${error
              ? 'border-[#FF4444] focus:border-[#FF4444]'
              : 'border-[#2A2A2A] focus:border-gold'
            }
            focus:outline-none
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-xs text-[#FF4444]">{error}</p>}
        {hint && !error && <p className="text-xs text-[#888888]">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

export default Input
