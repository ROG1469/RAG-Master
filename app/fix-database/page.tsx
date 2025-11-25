'use client'

import { useState } from 'react'

export default function FixDatabasePage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fixDatabase = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/fix-database', {
        method: 'POST'
      })
      const data = await res.json()
      setResult(data)
      if (!res.ok) {
        setError(data.error || 'Unknown error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Fix Database Constraints & Role</h1>

      <div className="mb-4 p-4 bg-blue-100 border border-blue-400 rounded text-blue-900">
        <p className="font-bold">What this does:</p>
        <ul className="list-disc list-inside mt-2">
          <li>Updates your role from &apos;admin&apos; to &apos;business_owner&apos;</li>
          <li>Tests if document status constraint allows &apos;chunks_created&apos;</li>
          <li>Allows you to upload documents again</li>
        </ul>
      </div>

      <button
        onClick={fixDatabase}
        disabled={loading}
        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50"
      >
        {loading ? 'Fixing Database...' : 'Fix Database & Update Role'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 rounded text-red-900">
          <p className="font-bold">Error:</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-green-100 border border-green-400 rounded text-green-900">
          <p className="font-bold">Success!</p>
          <pre className="text-sm mt-2 overflow-auto max-h-96 text-green-800">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}