import Sidebar from '@/components/layout/Sidebar'

export default function SocioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#080808]">
      <Sidebar />
      <main className="flex-1 min-w-0 md:ml-[220px] pt-[64px] pb-[68px] md:pt-0 md:pb-0">
        {children}
      </main>
    </div>
  )
}
