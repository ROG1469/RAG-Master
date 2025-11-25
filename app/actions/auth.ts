'use server'

import { redirect } from 'next/navigation'

// MVP: No authentication required
// Role is passed via URL query parameter

export async function signOut() {
  // No-op for MVP - no auth to sign out from
  // Just redirect to home
  redirect('/')
}

// Get user info based on role (no auth)
export async function getUser(role?: string) {
  // For MVP, return a mock user based on role
  const userRole = role || 'business_owner'
  
  return {
    id: 'mvp-user',
    email: 'user@example.com',
    full_name: userRole === 'business_owner' ? 'Business Owner' : 
               userRole === 'employee' ? 'Employee' : 'Customer',
    role: userRole,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}
