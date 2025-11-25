'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// MVP: No authentication required
// Documents are stored globally and accessible by all roles

export async function uploadDocument(formData: FormData) {
  const supabase = await createClient()
  
  console.log('[UPLOAD] Starting upload process (MVP - no auth)...')

  const file = formData.get('file') as File
  if (!file) {
    console.error('[UPLOAD] No file in form data')
    return { error: 'No file provided' }
  }

  console.log('[UPLOAD] File received:', file.name, file.type, file.size, 'bytes')

  if (file.size > MAX_FILE_SIZE) {
    return { error: 'File size must be less than 10MB' }
  }

  // Validate file type
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/plain',
    'text/csv'
  ]

  if (!allowedTypes.includes(file.type)) {
    return { error: 'Invalid file type. Supported: PDF, DOCX, XLSX, XLS, CSV, TXT' }
  }

  try {
    // Upload to Supabase Storage (using 'global' folder for MVP)
    const fileName = `global/${Date.now()}-${file.name}`
    console.log('[UPLOAD] Uploading to storage:', fileName)
    
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, buffer, {
        contentType: file.type,
      })

    if (uploadError) {
      console.error('[UPLOAD] Storage upload failed:', uploadError)
      throw new Error(`Storage upload failed: ${uploadError.message}`)
    }

    console.log('[UPLOAD] File uploaded to storage successfully')

    // Get permission settings from form data
    const permissions = {
      accessible_by_business_owners: true, // Always true
      accessible_by_employees: formData.get('accessible_by_employees') === 'true',
      accessible_by_customers: formData.get('accessible_by_customers') === 'true',
    }
    
    console.log('[UPLOAD] Document permissions:', permissions)

    // Create document record (no user_id for MVP)
    console.log('[UPLOAD] Creating document record...')
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        filename: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: fileName,
        status: 'processing',
        user_id: null,
        accessible_by_business_owners: permissions.accessible_by_business_owners,
        accessible_by_employees: permissions.accessible_by_employees,
        accessible_by_customers: permissions.accessible_by_customers,
      })
      .select()
      .single()

    if (docError) {
      console.error('[UPLOAD] Database insert failed:', docError)
      throw new Error(`Database error: ${docError.message}`)
    }

    console.log('[UPLOAD] Document record created:', document.id)

    // Call Edge Functions for processing
    console.log('[UPLOAD] Starting Edge Function processing pipeline...')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[UPLOAD] Missing Supabase env (URL or SERVICE_ROLE_KEY)')
      return { error: 'Server configuration error' }
    }

    try {
      // STEP 1: Process document (parse + chunk)
      const processUrl = `${supabaseUrl}/functions/v1/process-document`
      console.log('[UPLOAD] Step 1: Calling process-document:', processUrl)
      
      const processResponse = await fetch(processUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/octet-stream',
          'X-Document-ID': document.id,
          'X-File-Type': file.type,
        },
        body: buffer,
      })

      console.log('[UPLOAD] process-document response status:', processResponse.status)

      if (!processResponse.ok) {
        const errorText = await processResponse.text()
        console.error('[UPLOAD] process-document error:', errorText)
        throw new Error(`Document processing failed (${processResponse.status})`)
      }

      const processResult = await processResponse.json()
      console.log('[UPLOAD] ✅ Step 1 complete:', processResult)

      // STEP 2: Generate embeddings
      const embedUrl = `${supabaseUrl}/functions/v1/generate-embeddings`
      console.log('[UPLOAD] Step 2: Calling generate-embeddings:', embedUrl)
      
      const embedResponse = await fetch(embedUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'X-Document-ID': document.id,
        },
      })

      console.log('[UPLOAD] generate-embeddings response status:', embedResponse.status)

      if (!embedResponse.ok) {
        const errorText = await embedResponse.text()
        console.error('[UPLOAD] generate-embeddings error:', errorText)
        throw new Error(`Embedding generation failed (${embedResponse.status})`)
      }

      const embedResult = await embedResponse.json()
      console.log('[UPLOAD] ✅ Step 2 complete:', embedResult)
      console.log('[UPLOAD] ✅✅ Full pipeline complete!')
    } catch (edgeError) {
      console.error('[UPLOAD] Edge Function pipeline failed:', edgeError)
      // Update document status to failed
      await supabase
        .from('documents')
        .update({ status: 'failed' })
        .eq('id', document.id)
      throw edgeError
    }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/documents')
    return { success: true, data: document }

  } catch (error) {
    console.error('[UPLOAD] Upload error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return { error: `Upload failed: ${errorMessage}` }
  }
}

export async function getDocuments() {
  const supabase = await createClient()
  
  // MVP: Get all documents (no user filter)
  const { data, error, count } = await supabase
    .from('documents')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching documents:', error)
    return { error: error.message }
  }

  console.log(`[FETCH] Retrieved ${data?.length || 0} documents (total count: ${count})`)
  return { data, count }
}

export async function deleteDocument(documentId: string) {
  const supabase = await createClient()
  
  // Get document to get storage path
  const { data: document } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', documentId)
    .single()

  if (!document) {
    return { error: 'Document not found' }
  }

  // Delete from storage
  await supabase.storage
    .from('documents')
    .remove([document.storage_path])

  // Delete from database (cascades to chunks and embeddings)
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/documents')
  return { success: true }
}

export async function updateDocumentVisibility(documentId: string, field: 'employee' | 'customer', value: boolean) {
  const supabase = await createClient()
  
  const columnName = field === 'employee' ? 'accessible_by_employees' : 'accessible_by_customers'

  const { data, error } = await supabase
    .from('documents')
    .update({ [columnName]: value })
    .eq('id', documentId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/documents')
  return { success: true, data }
}
