'use server'

import { createClient } from '@/lib/supabase/server'
import type { RAGResponse } from '@/lib/types/database'

// MVP: No authentication required
// Queries work for all roles

export async function queryRAG(question: string, role?: string): Promise<{ data?: RAGResponse; error?: string }> {
  // Input validation
  if (!question || typeof question !== 'string') {
    return { error: 'Question must be a valid string' }
  }

  const trimmedQuestion = question.trim()
  
  if (trimmedQuestion.length === 0) {
    return { error: 'Question cannot be empty' }
  }

  if (trimmedQuestion.length > 5000) {
    return { error: 'Question is too long (maximum 5000 characters)' }
  }

  try {
    console.log('[QUERY] Calling query-rag Edge Function...')
    console.log('[QUERY] Question length:', trimmedQuestion.length, 'chars')
    console.log('[QUERY] Role:', role || 'not specified')
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[QUERY] Missing Supabase env')
      return { error: 'Server configuration error' }
    }

    const queryUrl = `${supabaseUrl}/functions/v1/Query-rag`
    console.log('[QUERY] Calling:', queryUrl)
    
    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        question: trimmedQuestion,
        // For MVP, pass role info for document access filtering
        customerMode: role === 'customer',
        employeeMode: role === 'employee',
      }),
    })

    console.log('[QUERY] Edge Function response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[QUERY] Edge Function error:', errorText)
      try {
        const errorData = JSON.parse(errorText)
        return { error: errorData.error || `Query failed (${response.status})` }
      } catch {
        return { error: `Query failed (${response.status}): ${errorText}` }
      }
    }

    const result = await response.json()
    console.log('[QUERY] ✅ Edge Function success')
    console.log('[QUERY] Answer length:', result.answer?.length || 0)
    console.log('[QUERY] Sources count:', result.sources?.length || 0)

    const ragResponse: RAGResponse = {
      answer: result.answer,
      sources: result.sources || []
    }

    return { data: ragResponse }

  } catch (error) {
    console.error('[QUERY] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to process query'
    return { error: errorMessage }
  }
}

export async function getChatHistory() {
  const supabase = await createClient()
  
  // MVP: Get all chat history (no user filter)
  console.log('[GET CHAT HISTORY] Fetching all history (MVP mode)')

  const { data, error } = await supabase
    .from('chat_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[GET CHAT HISTORY] Query error:', error)
    return { error: error.message }
  }

  console.log('[GET CHAT HISTORY] Found', data?.length || 0, 'items')
  return { data }
}

export async function saveChatHistory(question: string, answer: string, sources: string[] = []) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('chat_history')
    .insert({
      question,
      answer,
      sources,
    })

  if (error) {
    console.error('[SAVE CHAT HISTORY] Error:', error)
    return { error: error.message }
  }

  return { success: true }
}
