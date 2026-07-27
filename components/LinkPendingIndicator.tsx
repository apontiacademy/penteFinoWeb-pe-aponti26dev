'use client'

import { useLinkStatus } from 'next/link'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export function LinkPendingIndicator() {
  const { pending } = useLinkStatus()

  return (
    <span className="inline-flex">
      <Spinner
        aria-hidden="true"
        role={undefined}
        className={cn('size-3.5 ml-1.5 transition-opacity', pending ? 'opacity-100' : 'opacity-0')}
      />
      <span role="status" className="sr-only">
        {pending ? 'Carregando página…' : ''}
      </span>
    </span>
  )
}
