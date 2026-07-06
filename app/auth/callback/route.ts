import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function sanitizeNext(next: string | null, requestUrl: string): string {
  if (next) {
    try {
      const resolved = new URL(next, requestUrl)
      if (resolved.origin === new URL(requestUrl).origin) {
        return resolved.pathname + resolved.search + resolved.hash
      }
    } catch {
      // invalid URL, fall through to default
    }
  }
  return '/dashboard'
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const next = sanitizeNext(request.nextUrl.searchParams.get('next'), request.url)

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  return NextResponse.redirect(new URL('/esqueci-senha?erro=link-invalido', request.url))
}
