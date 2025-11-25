'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Direct fix for role constraint issue
 */
export async function fixRoleConstraintDirect() {
  const supabase = await createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    console.log('🔧 Attempting to set role to business_owner for:', user.id)

    const { data, error } = await supabase
      .from('users')
      .update({ 
        role: 'business_owner',
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('❌ Update failed:', error)
      return {
        success: false,
        error: error.message,
        code: error.code,
        details: error.details
      }
    }

    console.log('✅ Role updated successfully:', data)
    return {
      success: true,
      message: 'Role updated to business_owner',
      user: data
    }
  } catch (error) {
    console.error('❌ Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get current user role info
 */
export async function getUserRoleInfo() {
  const supabase = await createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile, error } = await supabase
      .from('users')
      .select('id, email, role, created_at, updated_at')
      .eq('id', user.id)
      .single()

    if (error) {
      return {
        success: false,
        error: error.message,
        authUser: {
          id: user.id,
          email: user.email,
          role: user.user_metadata?.role
        }
      }
    }

    return {
      success: true,
      profile: profile,
      authUser: {
        id: user.id,
        email: user.email,
        role: user.user_metadata?.role
      }
    }
  } catch (error) {
    console.error('Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
