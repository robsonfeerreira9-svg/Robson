import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: '#C9A840',
        'gold-light': '#DEB84A',
        'gold-dim': 'rgba(201,168,64,0.12)',
        silver: '#A8A8A8',
        'silver-dim': 'rgba(168,168,168,0.08)',
        background: '#080808',
        surface: '#0E0E0E',
        'surface-2': '#141414',
        'surface-3': '#1C1C1C',
        'border-dark': '#202020',
        'border-subtle': '#161616',
        'text-primary': '#F0F0F0',
        'text-muted': '#606060',
        'text-dim': '#333333',
        danger: '#E53E3E',
        'danger-dim': 'rgba(229,62,62,0.1)',
        success: '#38A169',
        'success-dim': 'rgba(56,161,105,0.1)',
        warning: '#C9913A',
        'warning-dim': 'rgba(201,145,58,0.1)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        shimmer: 'shimmer 1.8s infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
