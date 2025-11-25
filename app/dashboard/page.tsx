import { getDocuments } from '@/app/actions/documents'
import DashboardContent from '@/components/DashboardContent'
import type { Document } from '@/lib/types/database'

interface PageProps {
  searchParams: Promise<{ role?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams
  const role = params.role || 'business_owner'

  let documents: Document[] = []
  try {
    const documentsResult = await getDocuments()
    documents = (documentsResult.data || []) as Document[]
  } catch (error) {
    console.error('Error fetching documents:', error)
    // Continue without documents on error
  }

  // MVP: Create mock user based on role from URL
  const user = {
    email: 'user@example.com',
    full_name: role === 'business_owner' ? 'Business Owner' : 
               role === 'employee' ? 'Employee' : 'Customer',
    role: role
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <main className="max-w-full h-screen flex flex-col">
        <DashboardContent
          documents={documents}
          user={user}
        />
      </main>
    </div>
  )
}
