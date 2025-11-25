import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // This endpoint will test and fix the database constraints and update user role
    // We need to use the service role key to bypass RLS

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      )
    }

    // Import Supabase client dynamically to avoid issues
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    console.log('🔧 Starting database fix...')

    // Step 1: Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    console.log('👤 User:', user.id, user.email)

    // Step 2: Update user role to business_owner (this will test if role constraint allows it)
    console.log('🔄 Step 2: Updating user role to business_owner...')
    const { error: updateError } = await supabase
      .from('users')
      .update({ role: 'business_owner' })
      .eq('id', user.id)

    if (updateError) {
      console.error('❌ Role update failed:', updateError)
      return NextResponse.json(
        { error: `Failed to update role: ${updateError.message}` },
        { status: 400 }
      )
    }

    console.log('✅ User role updated to business_owner')

    // Step 3: Test document status constraint by trying to update a document
    console.log('📝 Step 3: Testing document status constraint...')

    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('id, status')
      .eq('user_id', user.id)
      .limit(1)

    if (docError) {
      console.error('❌ Failed to fetch documents:', docError)
      return NextResponse.json(
        { error: `Failed to fetch documents: ${docError.message}` },
        { status: 400 }
      )
    }

    let documentStatusTest = 'Not tested'
    if (documents && documents.length > 0) {
      // Try to update the first document to test the constraint
      const { error: statusTestError } = await supabase
        .from('documents')
        .update({ status: 'chunks_created' })
        .eq('id', documents[0].id)

      if (statusTestError) {
        console.error('❌ Document status constraint issue:', statusTestError)
        documentStatusTest = `Failed: ${statusTestError.message}`
      } else {
        // Reset it back
        await supabase
          .from('documents')
          .update({ status: documents[0].status })
          .eq('id', documents[0].id)
        documentStatusTest = 'Working - chunks_created allowed'
      }
    } else {
      documentStatusTest = 'No documents to test with'
    }

    // Step 4: Verify the changes
    const { data: updatedUser, error: verifyError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', user.id)
      .single()

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError)
      return NextResponse.json(
        { error: `Verification failed: ${verifyError.message}` },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'User role updated to business_owner. Document status constraint tested.',
      user: updatedUser,
      documentStatusTest,
      note: 'If document status test failed, you may need to run a database migration manually.'
    })

  } catch (error) {
    console.error('❌ API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}