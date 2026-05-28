import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_dev')
    .eq('id', user.id)
    .single()

  if (!profile?.is_dev) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: { users }, error } = await admin.auth.admin.listUsers()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(users.map(u => ({ id: u.id, email: u.email ?? null })))
}
