import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', user.id)

    if (error || !profile || profile.length === 0) {
      return NextResponse.json({
        id: user.id,
        email: user.email,
        role: user.user_metadata?.role || 'unknown',
        note: 'Profile not found in database'
      })
    }

    return NextResponse.json(profile[0])
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}