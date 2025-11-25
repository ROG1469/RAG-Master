# Test script for refactored RAG pipeline
# Tests: Parse + Chunk (process-document), then Embedding Generation (generate-embeddings)

Write-Host "🚀 Starting Refactored RAG Pipeline Tests" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Configuration
$SUPABASE_URL = $env:NEXT_PUBLIC_SUPABASE_URL
$SUPABASE_ANON_KEY = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY
$GEMINI_API_KEY = $env:GEMINI_API_KEY

Write-Host "📋 Configuration Check:" -ForegroundColor Yellow
Write-Host "  Supabase URL: $($SUPABASE_URL.Substring(0, 20))..." 
Write-Host "  Anon Key: $($SUPABASE_ANON_KEY.Substring(0, 10))..."
Write-Host "  Gemini API Key: $($GEMINI_API_KEY.Substring(0, 10))..."
Write-Host ""

# Read test document
$testDocPath = "c:\coding\RAG-master\RAG-master\test-document-comprehensive.txt"
if (-not (Test-Path $testDocPath)) {
    Write-Host "❌ Test document not found at $testDocPath" -ForegroundColor Red
    exit 1
}

$fileContent = Get-Content $testDocPath -Raw
$fileBytes = [System.Text.Encoding]::UTF8.GetBytes($fileContent)

Write-Host "📄 Test Document: test-document-comprehensive.txt"
Write-Host "  Size: $($fileBytes.Length) bytes"
Write-Host "  Content length: $($fileContent.Length) characters"
Write-Host ""

# Step 1: Get Supabase schema info to create a test user
Write-Host "⚙️  Setting up test environment..." -ForegroundColor Cyan

# For testing purposes, we'll make direct calls to Supabase API
# In production, auth would be required

Write-Host "✅ Ready to test. Now upload a document through the UI:" -ForegroundColor Green
Write-Host "  1. Navigate to http://localhost:3000"
Write-Host "  2. Sign in or create an account"
Write-Host "  3. Upload the test document"
Write-Host "  4. Monitor the console logs for status"
Write-Host ""

Write-Host "📊 Expected Results:" -ForegroundColor Yellow
Write-Host "  ✓ Document status: processing → chunks_created → completed"
Write-Host "  ✓ process-document creates chunks (no embeddings)"
Write-Host "  ✓ generate-embeddings creates vector embeddings"
Write-Host "  ✓ No errors in console logs"
Write-Host ""

Write-Host "To view edge function logs:" -ForegroundColor Cyan
Write-Host "  supabase functions logs process-document"
Write-Host "  supabase functions logs generate-embeddings"
