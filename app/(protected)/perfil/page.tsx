import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PerfilForm } from '@/components/PerfilForm'
import { AlterarSenhaForm } from '@/components/AlterarSenhaForm'
import { User } from 'lucide-react'

export default async function PerfilPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const nome = (user.user_metadata?.nome as string | undefined) ?? ''
  const telefone = (user.user_metadata?.telefone as string | undefined) ?? ''

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Minha conta</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Gerencie seus dados pessoais e sua senha
          </p>
        </div>
      </div>

      <Card className="shadow-sm border-border/60">
        <CardHeader>
          <CardTitle>Dados pessoais</CardTitle>
          <CardDescription>Nome e telefone exibidos no seu perfil.</CardDescription>
        </CardHeader>
        <CardContent>
          <PerfilForm nome={nome} telefone={telefone} />
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border/60">
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
          <CardDescription>Informe sua senha atual para definir uma nova.</CardDescription>
        </CardHeader>
        <CardContent>
          <AlterarSenhaForm />
        </CardContent>
      </Card>
    </div>
  )
}
