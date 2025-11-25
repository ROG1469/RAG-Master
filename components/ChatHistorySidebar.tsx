'use client'

import { useEffect, useState } from 'react'
import { getChatHistory } from '@/app/actions/rag'
import { MessageSquare, Clock, ChevronRight } from 'lucide-react'

interface ChatHistoryItem {
  id: string
  question: string
  answer: string
  sources: Array<{
    document_id: string
    filename: string
    chunk_content: string
    relevance_score: number
  }>
  created_at: string
}

interface ChatSession {
  id: string
  title: string
  created_at: string
  items: ChatHistoryItem[]
}

interface ChatHistorySidebarProps {
  onQuestionClick?: (item: ChatHistoryItem) => void
  refreshTrigger?: number // When this changes, refresh the history
}

export default function ChatHistorySidebar({ onQuestionClick, refreshTrigger }: ChatHistorySidebarProps) {
  const [history, setHistory] = useState<ChatHistoryItem[]>([])
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function loadHistory() {
      setLoading(true)
      const result = await getChatHistory()
      if (result.data) {
        const items = result.data as ChatHistoryItem[]
        setHistory(items)
        const groupedSessions = groupIntoSessions(items)
        setSessions(groupedSessions)
      }
      setLoading(false)
    }
    loadHistory()
  }, [refreshTrigger])

  function groupIntoSessions(items: ChatHistoryItem[]): ChatSession[] {
    if (items.length === 0) return []
    
    const sessions: ChatSession[] = []
    let currentSession: ChatHistoryItem[] = []
    let lastTime = new Date(items[items.length - 1].created_at).getTime()
    const SESSION_GAP_MS = 30 * 60 * 1000 // 30 minutes
    
    // Process items in reverse chronological order
    for (let i = items.length - 1; i >= 0; i--) {
      const itemTime = new Date(items[i].created_at).getTime()
      const timeDiff = lastTime - itemTime
      
      if (timeDiff > SESSION_GAP_MS && currentSession.length > 0) {
        const firstItem = currentSession[0]
        const sessionTitle = firstItem.question.substring(0, 40) + (firstItem.question.length > 40 ? '...' : '')
        sessions.push({
          id: `session-${currentSession[0].id}`,
          title: sessionTitle,
          created_at: firstItem.created_at,
          items: currentSession
        })
        currentSession = []
      }
      
      currentSession.unshift(items[i])
      lastTime = itemTime
    }
    
    // Add the last session
    if (currentSession.length > 0) {
      const firstItem = currentSession[0]
      const sessionTitle = firstItem.question.substring(0, 40) + (firstItem.question.length > 40 ? '...' : '')
      sessions.unshift({
        id: `session-${firstItem.id}`,
        title: sessionTitle,
        created_at: firstItem.created_at,
        items: currentSession
      })
    }
    
    return sessions
  }

  async function refreshHistory() {
    setLoading(true)
    const result = await getChatHistory()
    if (result.data) {
      const items = result.data as ChatHistoryItem[]
      setHistory(items)
      const groupedSessions = groupIntoSessions(items)
      setSessions(groupedSessions)
    }
    setLoading(false)
  }

  function toggleSession(sessionId: string) {
    const newExpanded = new Set(expandedSessions)
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId)
    } else {
      newExpanded.add(sessionId)
    }
    setExpandedSessions(newExpanded)
  }

  function handleQuestionClick(item: ChatHistoryItem) {
    setSelectedId(item.id)
    if (onQuestionClick) {
      onQuestionClick(item)
    }
  }

  function formatTimestamp(timestamp: string) {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  function truncateText(text: string, maxLength: number = 60) {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  return (
    <div className="h-full bg-gray-800 border-r border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Chat History
          </h2>
          <button
            onClick={refreshHistory}
            disabled={loading}
            className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
        <p className="text-xs text-gray-400">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-400 text-sm">
            Loading history...
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-30" />
            No chat history yet
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {sessions.map((session) => (
              <div key={session.id}>
                {/* Session Header */}
                <button
                  onClick={() => toggleSession(session.id)}
                  className="w-full p-3 text-left hover:bg-gray-700/50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <MessageSquare className="h-4 w-4 text-gray-400 mt-1 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 font-medium wrap-break-word">
                        {truncateText(session.title)}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(session.created_at)} • {session.items.length} message{session.items.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${expandedSessions.has(session.id) ? 'rotate-90' : ''}`} />
                </button>
                
                {/* Session Items */}
                {expandedSessions.has(session.id) && (
                  <div className="bg-gray-800/30 divide-y divide-gray-700">
                    {session.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleQuestionClick(item)}
                        className={`w-full p-2 pl-8 text-left hover:bg-gray-700/50 transition-colors text-xs ${
                          selectedId === item.id ? 'bg-gray-700' : ''
                        }`}
                      >
                        <p className="text-gray-300 font-medium">{truncateText(item.question, 40)}</p>
                        <p className="text-gray-500 text-xs mt-1">{formatTimestamp(item.created_at)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
