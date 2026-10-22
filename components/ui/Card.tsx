'use client'

import { HTMLAttributes, forwardRef } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  padding?: 'sm' | 'md' | 'lg' | 'none'
  glow?: boolean
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hover = false, padding = 'md', glow = false, children, className = '', ...props }, ref) => {
    const paddings = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-7' }
    return (
      <div
        ref={ref}
        className={`
          bg-[#0E0E0E] border border-[#1A1A1A] rounded-2xl
          shadow-[0_2px_12px_rgba(0,0,0,0.7)]
          ${hover ? 'hover:border-[#C9A840]/35 hover:shadow-[0_4px_24px_rgba(0,0,0,0.8),0_0_0_1px_rgba(201,168,64,0.1)] cursor-pointer active:scale-[0.99]' : ''}
          ${glow ? 'border-[#C9A840]/25 shadow-[0_0_24px_rgba(201,168,64,0.08)]' : ''}
          ${paddings[padding]}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Card.displayName = 'Card'
export default Card
