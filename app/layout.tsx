import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HG GRIFES — ERP',
  description: 'Sistema de Gestão HG Grifes',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-background text-text-primary antialiased">
        {children}
      </body>
    </html>
  )
}
