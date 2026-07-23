'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deveExibirBotaoTopo } from '@/lib/scroll'
import { cn } from '@/lib/utils'

export function ScrollToTopButton() {
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    function handleScroll() {
      setVisivel(deveExibirBotaoTopo(window.scrollY, window.innerHeight))
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  function handleClick() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <Button
      type="button"
      variant="default"
      size="icon-lg"
      aria-label="Voltar ao topo"
      onClick={handleClick}
      className={cn(
        'fixed bottom-6 left-6 z-40 rounded-full shadow-lg transition-opacity',
        visivel ? 'opacity-100' : 'pointer-events-none opacity-0'
      )}
    >
      <ArrowUp />
    </Button>
  )
}
