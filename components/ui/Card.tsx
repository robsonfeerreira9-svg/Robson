'use client'

import { HTMLAttributes, forwardRef } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  padding?: 'sm' | 'md' | 'lg' | 'none'
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hover = false, padding = 'md', children, className = '', ...props }, ref) => {
    const paddings = {
      none: '',
      sm: 'p-3',
      md: 'p-5',
      lg: 'p-7',
    }

    return (
      <div
        ref={ref}
        className={`
          bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl
          shadow-[0_1px_3px_rgba(0,0,0,0.4)]
          ${hover ? 'hover:border-gold/60 hover:shadow-[0_4px_16px_rgba(0,0,0,0.5),0_0_0_1px_rgba(245,197,24,0.1)] cursor-pointer active:scale-[0.99]' : ''}
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
