import Sidebar from '@/components/layout/Sidebar'

export default function SocioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#0D0D0D]">
      <Sidebar />
      <main className="flex-1 min-w-0 md:ml-[220px] pt-[60px] md:pt-0">
        {children}
      </main>
    </div>
  )
}
