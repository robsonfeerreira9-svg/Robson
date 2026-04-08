'use client'

interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'default' | 'gold'
  children: React.ReactNode
  className?: string
}

export default function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  const variants: Record<string, string> = {
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    danger:  'bg-red-500/20 text-red-400 border-red-500/30',
    default: 'bg-[#2A2A2A] text-[#888888] border-[#3A3A3A]',
    gold:    'bg-gold/20 text-gold border-gold/30',
  }

  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border
        ${variants[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  )
}
