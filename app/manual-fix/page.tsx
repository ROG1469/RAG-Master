'use client'

import { useState } from 'react'

export default function ManualFixPage() {
  const [copied, setCopied] = useState(false)

  const sqlScript = `-- Manual SQL to fix database constraints
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. Fix document status constraint to allow 'chunks_created'
ALTER TABLE public.documents
DROP CONSTRAINT IF EXISTS documents_status_check;

ALTER TABLE public.documents
ADD CONSTRAINT documents_status_check
CHECK (status IN ('processing', 'chunks_created', 'completed', 'failed'));

-- 2. Fix user role constraint to allow all roles
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
ADD CONSTRAINT users_role_check
CHECK (role IN ('business_owner', 'employee', 'customer', 'user', 'admin'));

-- 3. Update your role to business_owner (replace YOUR_USER_ID with your actual user ID)
-- You can find your user ID in the browser console or from the auth.users table
-- UPDATE public.users SET role = 'business_owner' WHERE id = 'YOUR_USER_ID';`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlScript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Manual Database Fix</h1>

      <div className="mb-6 p-4 bg-blue-100 border border-blue-400 rounded text-blue-900">
        <p className="font-bold mb-2">Steps to fix the database:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Go to your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline text-blue-700">Supabase Dashboard</a></li>
          <li>Navigate to your project (RAG2025)</li>
          <li>Go to SQL Editor</li>
          <li>Copy and paste the SQL below</li>
          <li>Click &quot;Run&quot; to execute</li>
          <li>Then try uploading a document again</li>
        </ol>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">SQL Script:</h2>
          <button
            onClick={copyToClipboard}
            className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 text-sm"
          >
            {copied ? 'Copied!' : 'Copy SQL'}
          </button>
        </div>
        <pre className="bg-gray-100 p-4 rounded border overflow-auto max-h-96 text-sm">
          {sqlScript}
        </pre>
      </div>

      <div className="p-4 bg-yellow-100 border border-yellow-400 rounded text-yellow-900">
        <p className="font-bold">Important:</p>
        <p>After running the SQL, your role will be updated to &apos;business_owner&apos; and you can upload documents.</p>
      </div>
    </div>
  )
}