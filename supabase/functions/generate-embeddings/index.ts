// Supabase Edge Function: generate-embeddings
// ✅ ARCHITECTURE: Separation of concerns
// RESPONSIBILITY: Generate vector embeddings for document chunks using Gemini API
// Works on chunks created by process-document function
// Queries document by ID and embeds all unembedded chunks

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@^0.24.1'

console.log('✅ generate-embeddings initialized')

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const documentId = req.headers.get('X-Document-ID')

  try {
    if (!documentId) {
      console.error('❌ Missing document ID in header')
      return new Response(
        JSON.stringify({ error: 'Missing document ID in X-Document-ID header' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🤖 Generating embeddings for document: ${documentId}`)

    // Initialize Supabase and Gemini
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const geminiKey = Deno.env.get('GEMINI_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey)
    const genAI = new GoogleGenerativeAI(geminiKey)
    const model = genAI.getGenerativeModel({ model: 'models/text-embedding-004' })

    // ✅ NEW: Get all chunks for this specific document that DON'T have embeddings yet
    console.log('📦 Step 1: Fetching unembedded chunks from database...')
    const { data: chunks, error: fetchError } = await supabase
      .from('chunks')
      .select('id, content, chunk_index')
      .eq('document_id', documentId)
      .order('chunk_index')

    if (fetchError) {
      throw new Error(`Failed to fetch chunks: ${fetchError.message}`)
    }

    if (!chunks || chunks.length === 0) {
      console.warn(`⚠️  No chunks found for document ${documentId}`)
      throw new Error('No chunks found for this document')
    }

    console.log(`✅ Found ${chunks.length} chunks to embed`)

    // ✅ Step 2: Generate embeddings in batch
    console.log('🔢 Step 2: Generating embeddings from Gemini...')
    const embeddings: { chunk_id: string; embedding: number[] }[] = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      console.log(`  → Embedding chunk ${i + 1}/${chunks.length} (chunk_index: ${chunk.chunk_index})`)

      try {
        const result = await model.embedContent(chunk.content)
        const embedding = result.embedding.values

        embeddings.push({
          chunk_id: chunk.id,
          embedding: embedding,
        })
      } catch (embeddingError) {
        console.error(`  ❌ Failed to embed chunk ${chunk.id}:`, embeddingError)
        throw new Error(`Embedding generation failed for chunk ${i}: ${embeddingError}`)
      }
    }

    console.log(`✅ Generated ${embeddings.length} embeddings`)

    // ✅ Step 3: Store embeddings in database
    console.log('💾 Step 3: Storing embeddings in database...')
    for (let i = 0; i < embeddings.length; i++) {
      const { chunk_id, embedding } = embeddings[i]

      const { error: insertError } = await supabase
        .from('embeddings')
        .insert({
          chunk_id: chunk_id,
          embedding: JSON.stringify(embedding),
        })

      if (insertError) {
        console.error(`❌ Failed to store embedding for chunk ${chunk_id}:`, insertError)
        throw new Error(`Failed to store embedding: ${insertError.message}`)
      }
    }

    console.log(`✅ Successfully stored all ${embeddings.length} embeddings`)

    // ✅ Step 4: Update document status to completed
    console.log('📝 Step 4: Updating document status to completed...')
    const { error: updateError } = await supabase
      .from('documents')
      .update({ status: 'completed' })
      .eq('id', documentId)

    if (updateError) {
      throw new Error(`Status update failed: ${updateError.message}`)
    }

    console.log(`✅ Document ${documentId} embedding generation complete`)
    console.log('✅✅ Document is now ready for RAG queries!')

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        embeddingsGenerated: embeddings.length,
        status: 'completed',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Embedding generation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Update document status to failed
    try {
      if (documentId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        await supabase
          .from('documents')
          .update({ status: 'failed', error_message: errorMessage })
          .eq('id', documentId)
      }
    } catch {
      console.error('❌ Failed to update document status on error')
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
