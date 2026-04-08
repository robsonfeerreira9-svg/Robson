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
          bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg
          ${hover ? 'hover:border-gold transition-colors duration-150 cursor-pointer' : ''}
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
