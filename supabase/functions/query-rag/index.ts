// Supabase Edge Function: query-rag
// RESPONSIBILITY: Handle RAG queries - embed question, search, generate answer
/* eslint-disable @typescript-eslint/no-explicit-any */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.24.1";

console.log("✅ query-rag initialized");

serve(async (req) => {
  console.log("📨 Received request:", {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers),
  });

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { question, customerMode, employeeMode } = await req.json()
    console.log(`💬 Query: "${question}" (customerMode: ${customerMode}, employeeMode: ${employeeMode})`)

    if (!question) {
      return new Response(
        JSON.stringify({ error: "Missing question" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    // Determine role
    const role = customerMode ? 'customer' : employeeMode ? 'employee' : 'business_owner'
    console.log(`🎯 Determined role: ${role}`)

    // Initialize clients
    console.log("🔐 Checking environment variables...");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    console.log("📋 Environment check:", {
      SUPABASE_URL: supabaseUrl ? `✅ ${supabaseUrl.substring(0, 30)}...` : "❌ MISSING",
      SUPABASE_SERVICE_ROLE_KEY: supabaseKey ? `✅ ${supabaseKey.substring(0, 10)}...` : "❌ MISSING",
      GEMINI_API_KEY: geminiKey ? `✅ ${geminiKey.substring(0, 10)}...` : "❌ MISSING",
    });

    if (!supabaseUrl || !supabaseKey || !geminiKey) {
      console.error("❌ Missing environment variables - Check Edge Function Settings → Secrets");
      return new Response(
        JSON.stringify({ error: "Server configuration error: missing environment variables. Check Edge Function secrets." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log("✅ All environment variables present");
    const supabase = createClient(supabaseUrl, supabaseKey);
    const genAI = new GoogleGenerativeAI(geminiKey);

    // STEP 0 — Check cache for similar queries
    console.log("💾 Checking query cache...");

    const embeddingModel = genAI.getGenerativeModel({
      model: "models/text-embedding-004",
    });

    const embedResult = await embeddingModel.embedContent(question);
    const questionEmbedding = embedResult.embedding.values;

    // Search cache for similar queries
    const { data: cachedResults } = await supabase.rpc('find_similar_cached_queries', {
      query_embedding: questionEmbedding,
      similarity_threshold: 0.85,
      role_filter: role,
      limit_count: 1
    });
    
    if (cachedResults && cachedResults.length > 0) {
      const cached = cachedResults[0];
      console.log(`✅ Cache hit! Similarity: ${cached.similarity.toFixed(3)}`);
      
      // Increment hit count
      await supabase.rpc('increment_query_cache_hit', {
        cache_id: cached.id
      });
      
      return new Response(
        JSON.stringify({
          success: true,
          answer: cached.answer,
          sources: cached.sources,
          cached: true,
          cacheHitSimilarity: cached.similarity.toFixed(3)
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    
    console.log("❌ Cache miss - proceeding with full RAG pipeline...");

    // STEP 2 — Get documents based on mode (MVP: all documents are accessible)
    let documentIds: string[] = [];

    if (customerMode) {
      // Customer mode: only accessible_by_customers documents
      const { data: customerDocs } = await supabase
        .from("documents")
        .select("id")
        .eq("accessible_by_customers", true)
        .eq("status", "completed");

      documentIds = customerDocs?.map((d: any) => d.id) || [];
      console.log(`🌍 Customer mode: Searching ${documentIds.length} customer-accessible documents`);
    } else if (employeeMode) {
      // Employee mode: accessible_by_employees documents
      const { data: employeeDocs } = await supabase
        .from("documents")
        .select("id")
        .eq("accessible_by_employees", true)
        .eq("status", "completed");

      documentIds = employeeDocs?.map((d: any) => d.id) || [];
      console.log(`👤 Employee mode: Searching ${documentIds.length} employee-accessible documents`);
    } else {
      // Business owner mode: all completed documents
      const { data: allDocs } = await supabase
        .from("documents")
        .select("id")
        .eq("status", "completed");

      documentIds = allDocs?.map((d: any) => d.id) || [];
      console.log(`🏢 Business owner mode: Searching ${documentIds.length} documents`);
    }

    if (documentIds.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No documents available. Upload and process documents first.",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // STEP 3 — Fetch chunks + embeddings with proper limit
    const { data: chunks } = await supabase
      .from("chunks")
      .select(
        `
      id,
      content,
      document_id,
      documents(filename),
      embeddings(embedding)
    `
      )
      .in("document_id", documentIds)
      .limit(1000); // Explicit limit to ensure we fetch all available chunks

    if (!chunks || chunks.length === 0) {
      return new Response(
        JSON.stringify({ error: "No processed chunks found." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`🔍 Found ${chunks.length} chunks to search`);

    // STEP 4 — Validate embeddings exist
    let validChunks = 0;
    let missingEmbeddingCount = 0;
    
    chunks.forEach((item: any) => {
      if (item.embeddings && item.embeddings.length > 0) {
        validChunks++;
      } else {
        missingEmbeddingCount++;
        console.warn(`⚠️ Chunk ${item.id} missing embedding!`);
      }
    });
    
    console.log(`📊 Valid chunks with embeddings: ${validChunks}/${chunks.length} (${missingEmbeddingCount} missing)`);

    if (validChunks === 0) {
      return new Response(
        JSON.stringify({
          error: "No embeddings found for document chunks. Documents may not have been processed correctly.",
          answer: "I cannot search the documents because they have not been properly processed with embeddings yet. Please re-upload your documents.",
          sources: []
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // STEP 5 — Analyze question: Semantic vs Keyword heavy
    console.log(`💬 Analyzing question for search strategy...`);
    const queryParts = parseMultiPartQuestion(question);
    console.log(`📋 Found ${queryParts.length} question part(s): ${queryParts.map(p => `"${p.substring(0, 30)}..."`).join(', ')}`);
    
    // Determine if question is more keyword or semantic heavy
    const hasNumerics = /\d+/.test(question);  // Has numbers (quarterly reports, dates)
    const hasQuotedTerms = /["'].*["']/.test(question);  // Has quoted strings
    const isKeywordHeavy = hasNumerics || hasQuotedTerms || question.length < 20;
    const semanticWeight = isKeywordHeavy ? 0.4 : 0.6;
    const keywordWeight = isKeywordHeavy ? 0.6 : 0.4;
    
    console.log(`🔍 Search strategy: ${isKeywordHeavy ? 'keyword-heavy' : 'semantic-heavy'} (semantic: ${semanticWeight}, keyword: ${keywordWeight})`);

    // Log document distribution for debugging
    const docTypes = chunks.reduce((acc: any, item: any) => {
      const filename = item.documents?.filename ?? "Unknown";
      acc[filename] = (acc[filename] || 0) + 1;
      return acc;
    }, {});
    console.log(`📂 Documents in search space:`, Object.entries(docTypes).map(([name, count]) => `${name} (${count} chunks)`).join(", "));

    let allHybridResults: any[] = [];
    const processedParts = new Set<string>();

    // STEP 6 — Hybrid Search (Semantic + Keyword)
    console.log(`🔄 Running hybrid search with semantic (${semanticWeight}) + keyword (${keywordWeight}) weights...`);

    for (const part of queryParts) {
      if (processedParts.has(part.toLowerCase())) continue;
      processedParts.has(part.toLowerCase()) ? null : processedParts.add(part.toLowerCase());

      console.log(`🔍 Hybrid search for: "${part}"`);
      
      // Generate embedding for semantic component
      const partEmbedResult = await embeddingModel.embedContent(part);
      const partEmbedding = partEmbedResult.embedding.values;

      // Call hybrid_search RPC function
      const { data: hybridResults, error: hybridError } = await supabase.rpc('hybrid_search', {
        p_question: part,
        p_question_embedding: partEmbedding,
        p_document_ids: documentIds,
        p_semantic_weight: semanticWeight,
        p_keyword_weight: keywordWeight,
        p_limit: 15
      });

      if (hybridError) {
        console.error(`❌ Hybrid search failed for "${part}":`, hybridError);
        // Fallback to semantic search if hybrid fails
        console.log(`⚠️ Falling back to semantic search for "${part}"...`);
        const scoredChunks = chunks
          .filter((item: any) => item.embeddings && item.embeddings.length > 0)
          .map((item: any) => {
            const rawEmbedding = item.embeddings[0].embedding;
            const embeddingArray = typeof rawEmbedding === "string"
              ? JSON.parse(rawEmbedding)
              : rawEmbedding;
            return {
              chunk_id: item.id,
              content: item.content,
              document_id: item.document_id,
              filename: item.documents?.filename ?? "Unknown",
              combined_score: cosineSimilarity(partEmbedding, embeddingArray),
              similarity: cosineSimilarity(partEmbedding, embeddingArray),
              search_type: 'semantic-fallback'
            };
          })
          .filter((item: any) => item.similarity >= 0.15)
          .sort((a: any, b: any) => b.similarity - a.similarity)
          .slice(0, 15);
        allHybridResults.push(...scoredChunks);
      } else if (hybridResults && hybridResults.length > 0) {
        console.log(`  ✅ Found ${hybridResults.length} results (top score: ${hybridResults[0].combined_score?.toFixed(3)})`);
        const resultsSummary = hybridResults.slice(0, 3).map((r: any) => 
          `${r.filename} (score: ${r.combined_score?.toFixed(3)}, sem: ${r.similarity?.toFixed(3)}, keyword: ${r.keyword_score?.toFixed(3)})`
        ).join('; ');
        console.log(`  📊 Top results: ${resultsSummary}`);
        
        // Map hybrid results back to expected format
        const mappedResults = hybridResults.map((r: any) => ({
          chunk_id: r.chunk_id,
          content: r.content,
          document_id: r.document_id,
          filename: r.filename,
          combined_score: r.combined_score,
          similarity: r.similarity || 0,
          keyword_score: r.keyword_score || 0,
          search_type: 'hybrid'
        }));
        allHybridResults.push(...mappedResults);
      }
    }

    // Remove duplicates, keep highest combined score
    const uniqueHybrid = Array.from(
      allHybridResults
        .reduce((map, item) => {
          const key = item.chunk_id;
          const existing = map.get(key);
          if (!existing || (item.combined_score || 0) > (existing.combined_score || 0)) {
            map.set(key, item);
          }
          return map;
        }, new Map<string, any>())
        .values()
    ).sort((a: any, b: any) => (b.combined_score || 0) - (a.combined_score || 0));

    console.log(`✅ Total unique hybrid results: ${uniqueHybrid.length}`);
    if (uniqueHybrid.length > 0) {
      const topItem = uniqueHybrid[0] as any;
      console.log(`  → Top score: ${topItem.combined_score?.toFixed(3)}`);
    }
    
    const scored = uniqueHybrid;

    if (scored.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No relevant information found in documents. Please try a different question or upload more documents.",
          answer: "I could not find any relevant information to answer your question in the available documents.",
          sources: []
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // STEP 6 — Generate answer using Gemini with improved prompt
    console.log("🤖 Generating answer...");

    const answerModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const context = scored.map((c: any) => c.content).join("\n\n---\n\n");

    // Build structured context with source info for transparency
    const contextWithSources = scored
      .map((c: any, i: number) => `[Source ${i + 1} - ${c.filename}]\n${c.content}`)
      .join("\n\n---\n\n");

    const prompt = `You are a professional business assistant that answers questions using provided context.

CRITICAL INSTRUCTIONS:
1. Answer ALL parts of multi-part questions separately if information exists in the context
2. For questions with multiple topics (e.g., "paydays AND contact details AND summary"), answer EACH topic separately
3. If you cannot find information for a specific part, explicitly state: "I do not have information about [that specific topic]"
4. Use PLAIN PROFESSIONAL TEXT ONLY - NO markdown, NO asterisks, NO special formatting
5. Structure your answer clearly with line breaks between different parts
6. Be concise, factual, and complete - address every part asked

FORMATTING RULES:
- Do NOT use ** or ** for emphasis
- Do NOT use # for headers
- Do NOT use - or * for lists
- Use plain text with numbered items: "1. ", "2. ", etc.
- Use line breaks to separate sections
- Keep formatting professional and simple

Provided Context:
${contextWithSources}

Question: ${question}

Answer (plain professional text, addressing ALL parts of the question):`;

    const result = await answerModel.generateContent(prompt);
    const answer = result.response.text();

    console.log(`✅ Answer generated (${answer.length} chars)`);
    console.log(`📝 Used ${scored.length} context chunks`);
    console.log(`🎯 Covered ${queryParts.length} question parts`);

    // STEP 7 — Save chat history (MVP: no user_id required)
    const sourceDocumentIds = [...new Set(scored.map((c: any) => c.document_id))];

    // Only save to chat history for business owner and employee modes (not customer)
    if (!customerMode) {
      await supabase.from("chat_history").insert({
        user_id: null, // MVP: no user authentication
        question,
        answer,
        sources: sourceDocumentIds,
      });
    }

    // STEP 8 — Save to cache for future similar queries
    console.log("💾 Saving answer to query cache...");
    const sourcesData = scored.map((c: any) => ({
      document_id: c.document_id,
      filename: c.filename,
      chunk_content: c.content.substring(0, 200) + "...",
      relevance_score: c.similarity,
    }));

    try {
      console.log(`📦 Cache params:`, {
        p_question: question.substring(0, 50),
        p_question_embedding: `vector(${questionEmbedding.length})`,
        p_answer: answer.substring(0, 50),
        p_sources: sourcesData,
        p_role: role
      });

      const { data: cacheResult, error: cacheErr } = await supabase.rpc('save_cached_query', {
        p_question: question,
        p_question_embedding: questionEmbedding,
        p_answer: answer,
        p_sources: sourcesData,  // Pass as object/array, NOT stringified - Supabase will handle JSON encoding
        p_role: role
      });
      
      if (cacheErr) {
        console.error(`❌ Cache RPC error: ${cacheErr.message}`);
        console.error(`   Error details:`, cacheErr);
      } else if (!cacheResult || cacheResult.length === 0) {
        console.warn(`⚠️ Cache RPC returned empty result`);
      } else {
        console.log(`✅ Query cached successfully (id: ${cacheResult[0]?.id})`);
      }
    } catch (cacheError) {
      console.error("❌ Cache exception:", (cacheError as Error)?.message);
      console.error("   Full error:", cacheError);
      // Don't fail the response if caching fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        answer,
        sources: sourcesData,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error:", error);

    return new Response(
      JSON.stringify({
        error: (error as Error)?.message ?? "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// Parse multi-part questions into individual search queries
function parseMultiPartQuestion(question: string): string[] {
  // Split by common separators
  const separators = [' and ', ' AND ', ' also ', ' ALSO ', '; ', ','];
  let parts = [question];

  for (const sep of separators) {
    parts = parts.flatMap(part => part.split(sep));
  }

  // Clean and filter
  return parts
    .map(p => p.trim())
    .filter(p => p.length > 3) // Ignore very short fragments
    .map(p => {
      // Remove question marks and extra whitespace
      return p.replace(/^\s*\?+\s*|\s*\?+\s*$/g, '').trim();
    })
    .filter(p => p.length > 0);
}

// Cosine similarity helper with validation
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b) {
    console.warn('⚠️ Cosine similarity: One or both vectors undefined');
    return 0;
  }

  if (a.length !== b.length) {
    console.warn(`⚠️ Cosine similarity: Vector length mismatch (${a.length} vs ${b.length})`);
    return 0;
  }

  let dot = 0,
    normA = 0,
    normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    console.warn('⚠️ Cosine similarity: Zero denominator');
    return 0;
  }

  return dot / denominator;
}
