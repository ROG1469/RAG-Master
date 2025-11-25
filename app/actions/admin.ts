'use server'

import { createClient } from '@/lib/supabase/server'

// MVP: No authentication required for admin functions

export async function getAllDocuments() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export async function getSystemStats() {
  const supabase = await createClient()
  
  const [docsCount, chunksCount, queriesCount] = await Promise.all([
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('chunks').select('*', { count: 'exact', head: true }),
    supabase.from('chat_history').select('*', { count: 'exact', head: true }),
  ])

  return {
    data: {
      totalDocuments: docsCount.count || 0,
      totalChunks: chunksCount.count || 0,
      totalQueries: queriesCount.count || 0,
    }
  }
}
