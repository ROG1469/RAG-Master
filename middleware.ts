import { NextResponse, type NextRequest } from 'next/server'

export default async function middleware(request: NextRequest) {
  // MVP: No authentication required - allow all requests
  // URL-based role selection is used instead
  
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  return response
}

export const config = {
  matcher: []  // Disabled: MVP uses URL-based role selection
}
