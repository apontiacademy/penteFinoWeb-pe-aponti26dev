'use client'

import { useLinkStatus } from 'next/link'
import { Spinner } from '@/components/ui/spinner'

export function LinkPendingIndicator() {
  const { pending } = useLinkStatus()

  if (!pending) return null

  return (
    <span className="inline-flex">
      <Spinner aria-hidden="true" role={undefined} className="size-3.5" />
      <span role="status" className="sr-only">
        Carregando página…
      </span>
    </span>
  )
}
