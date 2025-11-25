import { createClient } from '@/lib/supabase/server'

/**
 * API Route: Diagnose and fix user role issues
 * GET /api/debug/user-role - Get role diagnosis
 * POST /api/debug/user-role - Fix user role to business_owner
 */

export async function GET(request: Request) {
  const supabase = await createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return Response.json({
        success: false,
        error: 'Not authenticated'
      }, { status: 401 })
    }

    // Get database profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', user.id)
      .single()

    return Response.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        authRole: user.user_metadata?.role,
        databaseRole: profile?.role,
        profileExists: !!profile && !profileError,
        error: profileError?.message
      }
    })
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return Response.json({
        success: false,
        error: 'Not authenticated'
      }, { status: 401 })
    }

    const { role } = await request.json()
    const targetRole = role || 'business_owner'

    // Update or insert user profile
    const { data, error } = await supabase
      .from('users')
      .upsert(
        {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email,
          role: targetRole
        },
        { onConflict: 'id' }
      )
      .select()
      .single()

    if (error) {
      return Response.json({
        success: false,
        error: error.message,
        code: error.code
      }, { status: 500 })
    }

    return Response.json({
      success: true,
      message: `User role set to ${targetRole}`,
      user: data
    })
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
