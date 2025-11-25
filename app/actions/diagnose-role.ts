'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Diagnostic and fix function for user role issues
 * This helps debug why users can't upload despite being business owners
 */

export async function diagnosUserRole() {
  const supabase = await createClient()
  
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return {
        success: false,
        error: 'Not authenticated',
        details: { authError: authError?.message }
      }
    }

    console.log('🔍 Diagnosing user:', user.id, user.email)

    // Check auth metadata
    const authRole = user.user_metadata?.role
    console.log('📋 Auth metadata role:', authRole)

    // Check database profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', user.id)
      .single()

    console.log('📋 Database profile:', profile)
    if (profileError) {
      console.log('❌ Profile fetch error:', profileError)
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        authRole: authRole,
        databaseRole: profile?.role,
        profileExists: !!profile,
        mismatch: authRole !== profile?.role
      },
      recommendations: generateRecommendations(authRole, profile?.role, !!profile)
    }
  } catch (error) {
    console.error('Diagnosis error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }
  }
}

/**
 * Fix user role by updating database to match auth metadata
 */
export async function fixUserRole(roleToSet: 'business_owner' | 'employee' | 'customer' = 'business_owner') {
  const supabase = await createClient()
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return {
        success: false,
        error: 'Not authenticated'
      }
    }

    console.log('🔧 Fixing user role to:', roleToSet)
    console.log('   User ID:', user.id)
    console.log('   Email:', user.email)

    // First try to get existing profile
    const { data: existingProfile } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    let data, error

    if (existingProfile) {
      // Update existing profile
      console.log('   Updating existing profile...')
      const result = await supabase
        .from('users')
        .update({
          role: roleToSet,
          full_name: user.user_metadata?.full_name || user.email
        })
        .eq('id', user.id)
        .select()
        .single()
      data = result.data
      error = result.error
    } else {
      // Create new profile
      console.log('   Creating new profile...')
      const result = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email,
          role: roleToSet
        })
        .select()
        .single()
      data = result.data
      error = result.error
    }

    if (error) {
      console.error('❌ Update failed:', error)
      return {
        success: false,
        error: error.message,
        code: error.code
      }
    }

    console.log('✅ User role updated:', data)

    return {
      success: true,
      message: `User role set to ${roleToSet}`,
      user: data
    }
  } catch (error) {
    console.error('Fix error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Generate recommendations based on role mismatch
 */
function generateRecommendations(
  authRole: string | undefined,
  dbRole: string | undefined,
  profileExists: boolean
): string[] {
  const recommendations: string[] = []

  if (!profileExists) {
    recommendations.push('❌ User profile does not exist in database')
    recommendations.push('✅ Fix: Call fixUserRole() to create profile with correct role')
  }

  if (authRole && dbRole && authRole !== dbRole) {
    recommendations.push(`⚠️ Role mismatch: Auth has "${authRole}" but DB has "${dbRole}"`)
    recommendations.push(`✅ Fix: Call fixUserRole("${authRole}") to sync roles`)
  }

  if (!authRole && !dbRole) {
    recommendations.push('⚠️ No role set anywhere')
    recommendations.push('✅ Fix: Call fixUserRole("business_owner") to set role')
  }

  if (!authRole && dbRole) {
    recommendations.push('⚠️ Auth has no role but DB has role')
    recommendations.push('✅ This is okay - use DB role for permissions')
  }

  if (dbRole && dbRole !== 'business_owner') {
    recommendations.push(`⚠️ User role is "${dbRole}" but needs to be "business_owner" to upload`)
    recommendations.push('✅ Fix: Call fixUserRole("business_owner")')
  }

  return recommendations
}
