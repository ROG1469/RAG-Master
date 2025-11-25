'use client'

import { useEffect, useState } from 'react'

interface UserInfo {
  id: string
  email: string
  role: string
}

export default function DebugPage() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function getUserInfo() {
      try {
        const res = await fetch('/api/debug/user-info')
        const data = await res.json()
        setUserInfo(data)
      } catch (error) {
        console.error('Failed to get user info:', error)
      } finally {
        setLoading(false)
      }
    }

    getUserInfo()
  }, [])

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Debug Info</h1>

      {userInfo && (
        <div className="mb-6 p-4 bg-gray-100 border border-gray-400 rounded">
          <h2 className="text-lg font-bold mb-2">Your User Info:</h2>
          <p><strong>User ID:</strong> <code className="bg-white p-1 rounded">{userInfo.id}</code></p>
          <p><strong>Email:</strong> <code className="bg-white p-1 rounded">{userInfo.email}</code></p>
          <p><strong>Current Role:</strong> <code className="bg-white p-1 rounded">{userInfo.role}</code></p>
        </div>
      )}

      <div className="mb-6 p-4 bg-blue-100 border border-blue-400 rounded text-blue-900">
        <h2 className="text-lg font-bold mb-2">What You Need To Do:</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>Go to <a href="http://localhost:3000/manual-fix" className="underline">Manual Fix Page</a></li>
          <li>Copy the SQL script</li>
          <li>Go to <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline">Supabase Dashboard</a></li>
          <li>Open SQL Editor and run the SQL</li>
          <li>Come back and try uploading a document</li>
        </ol>
      </div>

      <div className="p-4 bg-yellow-100 border border-yellow-400 rounded text-yellow-900">
        <h2 className="text-lg font-bold mb-2">Why This Is Needed:</h2>
        <p>The database has conflicting constraints that prevent:</p>
        <ul className="list-disc list-inside mt-2 ml-2">
          <li>Your role from being updated to &apos;business_owner&apos;</li>
          <li>Documents from being marked as &apos;chunks_created&apos;</li>
        </ul>
        <p className="mt-2">Running the SQL fixes both issues.</p>
      </div>
    </div>
  )
}