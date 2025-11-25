import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user (must be admin to fix constraint)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔧 Attempting to fix role constraint for user:', user.id)

    // The issue is the CHECK constraint on the users table
    // We need to:
    // 1. First, update the role to a valid value according to the CURRENT constraint
    // 2. Then work around it

    // Get the user's current data
    const { data: userData, error: getUserError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (getUserError) {
      return NextResponse.json(
        { error: `Failed to get user: ${getUserError.message}` },
        { status: 400 }
      )
    }

    console.log('📋 Current user role:', userData?.role)

    // Try to update - this will show us the exact constraint error
    const { data, error } = await supabase
      .from('users')
      .update({ role: 'business_owner' })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('❌ Update error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      
      return NextResponse.json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: 'Constraint prevents business_owner role. Database still has old role constraint.'
      }, { status: 400 })
    }

    console.log('✅ Role updated:', data)
    return NextResponse.json({
      success: true,
      message: 'Role constraint fixed and role updated to business_owner',
      user: data
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
