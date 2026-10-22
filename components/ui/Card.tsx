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
          bg-[#141414] border border-[#1E1E1E] rounded-2xl
          shadow-[0_2px_8px_rgba(0,0,0,0.5)]
          ${hover ? 'hover:border-[#F5C518]/30 hover:shadow-[0_4px_20px_rgba(0,0,0,0.6),0_0_0_1px_rgba(245,197,24,0.08)] cursor-pointer active:scale-[0.99] transition-all' : ''}
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
