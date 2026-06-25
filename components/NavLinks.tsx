'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, FileText, LayoutDashboard } from 'lucide-react'

const allLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/auditorias', label: 'Auditorias', icon: BarChart3 },
  { href: '/relatorios', label: 'Relatórios', icon: FileText, adminOnly: true },
]

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const links = allLinks.filter((l) => !l.adminOnly || isAdmin)

  return (
    <>
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition-colors ${
              active
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        )
      })}
    </>
  )
}
