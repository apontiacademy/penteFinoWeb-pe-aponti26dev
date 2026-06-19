'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun, LogOut, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type Props = {
  name: string
  email: string
}

export function UserMenu({ name, email }: Props) {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

  return (
    <>
      {/* Hidden form for signout — referenced by button below */}
      <form id="signout-form" action="/api/auth/signout" method="post" className="hidden" />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              className={cn(
                'flex h-8 items-center gap-2 rounded-md px-2 text-sm font-normal',
                'text-muted-foreground hover:text-foreground hover:bg-muted',
                'transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
            />
          }
        >
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0">
            {initials || '?'}
          </span>
          <span className="hidden sm:block max-w-[140px] truncate">{name}</span>
          <ChevronDown className="w-3 h-3 opacity-60 hidden sm:block" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <div className="px-3 py-2">
            <p className="text-sm font-medium truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={() => setTheme(isDark ? 'light' : 'dark')}
            className="gap-2 cursor-pointer"
          >
            {isDark ? (
              <>
                <Sun className="w-4 h-4" />
                Tema claro
              </>
            ) : (
              <>
                <Moon className="w-4 h-4" />
                Tema escuro
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            className="gap-2 cursor-pointer"
            render={
              <button type="submit" form="signout-form" className="w-full" />
            }
          >
            <LogOut className="w-4 h-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
