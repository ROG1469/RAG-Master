'use client'

import { useState } from 'react'
import { diagnosUserRole, fixUserRole } from '@/app/actions/diagnose-role'
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react'

interface DiagnosisResult {
  success: boolean
  error?: string
  user?: {
    id: string
    email: string
    authRole?: string
    databaseRole?: string
    profileExists: boolean
  }
  recommendations?: string[]
}

export default function RoleDiagnosticsPage() {
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null)
  const [fixing, setFixing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runDiagnosis() {
    setLoading(true)
    setError(null)
    try {
      const result = await diagnosUserRole() as DiagnosisResult
      setDiagnosisResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Diagnosis failed')
    } finally {
      setLoading(false)
    }
  }

  async function fixRole() {
    setFixing(true)
    setError(null)
    try {
      const result = await fixUserRole('business_owner') as DiagnosisResult
      if (result.success) {
        // Re-run diagnosis to show the fix
        await runDiagnosis()
      } else {
        setError(result.error || 'Fix failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fix failed')
    } finally {
      setFixing(false)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">🔍 User Role Diagnostics</h1>

        <div className="bg-slate-700 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Diagnostic Report</h2>

          <div className="space-y-4">
            {!diagnosisResult && !loading && (
              <p className="text-slate-300">
                Click the button below to diagnose your user role settings.
              </p>
            )}

            {loading && (
              <div className="flex items-center gap-2 text-slate-300">
                <RefreshCw className="animate-spin w-5 h-5" />
                Running diagnosis...
              </div>
            )}

            {diagnosisResult && (
              <>
                {diagnosisResult.success ? (
                  <div className="space-y-4">
                    {diagnosisResult.user && (
                      <>
                        <div className="bg-slate-600 p-4 rounded">
                          <h3 className="text-lg font-semibold text-white mb-3">User Information</h3>
                          <div className="space-y-2 text-slate-200">
                            <p><strong>ID:</strong> {diagnosisResult.user.id}</p>
                            <p><strong>Email:</strong> {diagnosisResult.user.email}</p>
                            <p><strong>Auth Role:</strong> {diagnosisResult.user.authRole || 'Not set'}</p>
                            <p><strong>Database Role:</strong> {diagnosisResult.user.databaseRole || 'Not set'}</p>
                            <p><strong>Profile Exists:</strong> {diagnosisResult.user.profileExists ? '✅ Yes' : '❌ No'}</p>
                          </div>
                        </div>

                        <div className={`p-4 rounded ${diagnosisResult.user.databaseRole === 'business_owner' ? 'bg-green-600' : 'bg-red-600'}`}>
                          <h3 className="text-lg font-semibold text-white mb-3">Status</h3>
                          {diagnosisResult.user.databaseRole === 'business_owner' ? (
                            <div className="flex items-center gap-2 text-white">
                              <CheckCircle2 className="w-5 h-5" />
                              <span>✅ Your role is correctly set to business_owner</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-white">
                              <AlertCircle className="w-5 h-5" />
                              <span>❌ Your role is NOT set to business_owner</span>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {diagnosisResult.recommendations && diagnosisResult.recommendations.length > 0 && (
                      <div className="bg-slate-600 p-4 rounded">
                        <h3 className="text-lg font-semibold text-white mb-3">Recommendations</h3>
                        <ul className="space-y-2">
                          {diagnosisResult.recommendations.map((rec: string, i: number) => (
                            <li key={i} className="text-slate-200 text-sm">{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-red-600 p-4 rounded text-white">
                    <p><strong>Error:</strong> {diagnosisResult.error}</p>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="bg-red-600 p-4 rounded text-white">
                <p><strong>Error:</strong> {error}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={runDiagnosis}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-3 rounded-lg transition"
          >
            {loading ? 'Running...' : 'Run Diagnosis'}
          </button>

          {diagnosisResult && diagnosisResult.success && diagnosisResult.user && diagnosisResult.user.databaseRole !== 'business_owner' && (
            <button
              onClick={fixRole}
              disabled={fixing}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white font-semibold py-3 rounded-lg transition"
            >
              {fixing ? 'Fixing...' : 'Fix Role (Set to business_owner)'}
            </button>
          )}
        </div>

        {diagnosisResult && diagnosisResult.success && diagnosisResult.user && diagnosisResult.user.databaseRole === 'business_owner' && (
          <div className="mt-6 p-4 bg-green-600 text-white rounded-lg">
            <h3 className="font-semibold mb-2">✅ Ready to Upload!</h3>
            <p>Your role is correctly set. Go to <strong>Dashboard → Documents</strong> to upload files.</p>
          </div>
        )}
      </div>
    </div>
  )
}
