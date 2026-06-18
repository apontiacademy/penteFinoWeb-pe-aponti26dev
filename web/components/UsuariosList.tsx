'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Loader2, Shield, Trash2, User } from 'lucide-react'
import { alterarRole, deletarUsuario } from '@/app/(protected)/configuracoes/usuarios/actions'

type UsuarioItem = {
  id: string
  email?: string
  created_at: string
  app_metadata?: Record<string, unknown>
}

export function UsuariosList({
  users,
  currentUserId,
}: {
  users: UsuarioItem[]
  currentUserId: string
}) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleRoleChange(userId: string, newRole: 'admin' | 'user') {
    setPendingId(userId)
    startTransition(async () => {
      try {
        await alterarRole(userId, newRole)
      } finally {
        setPendingId(null)
      }
    })
  }

  function handleDelete(userId: string) {
    setPendingId(userId)
    startTransition(async () => {
      try {
        await deletarUsuario(userId)
      } finally {
        setPendingId(null)
      }
    })
  }

  if (!users.length) {
    return <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
  }

  return (
    <ul className="space-y-2">
      {users.map((u) => {
        const role = (u.app_metadata?.role as string) ?? 'user'
        const isCurrentUser = u.id === currentUserId
        const isLoadingThis = pendingId === u.id && isPending

        return (
          <li
            key={u.id}
            className="flex items-center justify-between rounded-xl border border-border/60 p-3 gap-3 bg-card"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  role === 'admin'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {role === 'admin' ? (
                  <Shield className="w-4 h-4" />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{u.email ?? '—'}</p>
                <p className="text-xs text-muted-foreground">
                  desde {new Date(u.created_at).toLocaleDateString('pt-BR')}
                  {isCurrentUser && (
                    <span className="ml-2 text-primary font-medium">• você</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isLoadingThis ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <select
                    value={role}
                    disabled={isCurrentUser}
                    onChange={(e) =>
                      handleRoleChange(u.id, e.target.value as 'admin' | 'user')
                    }
                    className="text-xs rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="user">Usuário</option>
                    <option value="admin">Admin</option>
                  </select>

                  {!isCurrentUser && (
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          />
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Deletar usuário?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O usuário <strong>{u.email}</strong> será removido
                            permanentemente. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(u.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Deletar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
