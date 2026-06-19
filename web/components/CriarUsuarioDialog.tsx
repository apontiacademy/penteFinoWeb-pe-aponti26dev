'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { UserPlus } from 'lucide-react'
import { CriarUsuarioForm } from './CriarUsuarioForm'

export function CriarUsuarioDialog() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <UserPlus className="w-4 h-4" />
        Novo usuário
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <p className="text-xs text-muted-foreground">
              O usuário receberá acesso imediato — não é necessário confirmar email.
            </p>
          </DialogHeader>
          <CriarUsuarioForm onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}
