'use client'

import { useActionState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle2, Loader2, UserPlus } from 'lucide-react'
import { criarUsuario } from '@/app/(protected)/configuracoes/usuarios/actions'

export function CriarUsuarioForm() {
  const [state, action, pending] = useActionState(criarUsuario, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset()
    }
  }, [state?.success])

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="usuario@email.com"
            disabled={pending}
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="senha">Senha</Label>
          <Input
            id="senha"
            name="senha"
            type="password"
            required
            placeholder="mínimo 6 caracteres"
            disabled={pending}
            className="h-10"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Perfil</Label>
        <select
          id="role"
          name="role"
          required
          disabled={pending}
          defaultValue="user"
          className="flex h-10 w-full sm:w-[200px] items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="user">Usuário</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {state?.error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-200 px-3 py-2.5 rounded-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Usuário criado com sucesso!
        </div>
      )}

      <Button type="submit" disabled={pending} className="gap-2">
        {pending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Criando...
          </>
        ) : (
          <>
            <UserPlus className="w-4 h-4" />
            Criar usuário
          </>
        )}
      </Button>
    </form>
  )
}
