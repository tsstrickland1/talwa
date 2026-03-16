import { PublicNav } from '@/components/layout/PublicNav'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PublicNav />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
