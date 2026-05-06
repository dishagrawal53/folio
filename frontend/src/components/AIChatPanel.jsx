import React, { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api.js'
import { useStore } from '../lib/store.js'

export default function AIChatPanel({ onClose }) {
  const { pdfName, currentPage, pages } = useStore()
  const currentPageText = pages[currentPage - 1]?.text || ''

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Load chat history
  useEffect(() => {
    if (!pdfName) return
    api.ai.chatHistory(pdfName)
      .then(data => {
        setMessages((data.history || []).map(m => ({
          role: m.role,
          content: m.content,
          id: m._id || Math.random().toString(36),
        })))
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [pdfName])

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { role: 'user', content: text, id: Date.now().toString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const history = messages.slice(-12)
      const data = await api.ai.chat(pdfName, text, currentPageText, history)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.result,
        id: Date.now().toString() + '-r',
      }])
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ ${e.message}`,
        id: Date.now().toString() + '-err',
        isError: true,
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, loading, messages, pdfName, currentPageText])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const SUGGESTIONS = [
    'What are the key concepts on this page?',
    'Can you quiz me on what I just read?',
    'Explain this in simpler terms',
    'What should I focus on for an exam?',
  ]

  return (
    <div style={cs.panel} className="anim-panel">
      {/* Header */}
      <div style={cs.header}>
        <div style={cs.headerLeft}>
          <div style={cs.aiDot} />
          <div>
            <p style={cs.title}>Folio AI</p>
            <p style={cs.subtitle}>Ask anything about your document</p>
          </div>
        </div>
        <button onClick={onClose} style={cs.closeBtn} aria-label="Close chat">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Context pill */}
      <div style={cs.contextPill}>
        <span style={cs.contextIcon}>📄</span>
        <span style={cs.contextText}>
          {pdfName?.slice(0, 30)}{pdfName?.length > 30 ? '…' : ''} · Page {currentPage}
        </span>
      </div>

      {/* Messages */}
      <div style={cs.messages}>
        {loadingHistory ? (
          <div style={cs.loadingWrap}>
            <div style={cs.spinner} />
          </div>
        ) : messages.length === 0 ? (
          <div style={cs.emptyState}>
            <div style={cs.emptyIcon}>✨</div>
            <p style={cs.emptyTitle}>Ask me anything</p>
            <p style={cs.emptySubtitle}>I know your document and current page</p>
            <div style={cs.suggestions}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => setInput(s)} style={cs.suggestionBtn}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <div key={msg.id} style={{ ...cs.message, ...(msg.role === 'user' ? cs.userMessage : cs.aiMessage) }}>
                {msg.role === 'assistant' && (
                  <div style={cs.aiAvatar}>F</div>
                )}
                <div style={{
                  ...cs.bubble,
                  ...(msg.role === 'user' ? cs.userBubble : cs.aiBubble),
                  ...(msg.isError ? cs.errorBubble : {}),
                }}>
                  {msg.content.split('\n').map((line, i) => (
                    <span key={i}>
                      {line}
                      {i < msg.content.split('\n').length - 1 && <br />}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ ...cs.message, ...cs.aiMessage }}>
                <div style={cs.aiAvatar}>F</div>
                <div style={{ ...cs.bubble, ...cs.aiBubble }}>
                  <div style={cs.typingDots}>
                    <span style={{ ...cs.dot, animationDelay: '0s' }} />
                    <span style={{ ...cs.dot, animationDelay: '0.2s' }} />
                    <span style={{ ...cs.dot, animationDelay: '0.4s' }} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={cs.inputArea}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about this document… (Enter to send)"
          style={cs.textarea}
          rows={2}
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          style={{ ...cs.sendBtn, opacity: (!input.trim() || loading) ? 0.4 : 1 }}
          aria-label="Send message"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M14 8L2 2L5 8L2 14L14 8Z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

const cs = {
  panel: {
    width: '360px',
    height: '100vh',
    background: 'var(--panel-bg)',
    borderLeft: '1px solid var(--panel-border)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflow: 'hidden',
  },
  header: {
    padding: '16px 16px 12px',
    borderBottom: '1px solid var(--panel-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  aiDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'var(--panel-accent)',
    boxShadow: '0 0 6px var(--panel-accent)',
    flexShrink: 0,
  },
  title: {
    fontFamily: 'var(--font-ui)',
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--panel-ink)',
  },
  subtitle: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--panel-ink-2)',
    marginTop: '1px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--panel-ink-2)',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  contextPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 16px',
    borderBottom: '1px solid var(--panel-border)',
    flexShrink: 0,
  },
  contextIcon: { fontSize: '11px' },
  contextText: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--panel-ink-2)',
    letterSpacing: '0.03em',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  loadingWrap: { display: 'flex', justifyContent: 'center', padding: '40px' },
  spinner: {
    width: '20px', height: '20px',
    border: '2px solid var(--panel-border)',
    borderTopColor: 'var(--panel-accent)',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '24px 8px',
    textAlign: 'center',
  },
  emptyIcon: { fontSize: '28px', marginBottom: '4px' },
  emptyTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '16px',
    fontStyle: 'italic',
    color: 'var(--panel-ink)',
  },
  emptySubtitle: {
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    color: 'var(--panel-ink-2)',
    marginBottom: '8px',
  },
  suggestions: { display: 'flex', flexDirection: 'column', gap: '5px', width: '100%' },
  suggestionBtn: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--panel-border)',
    borderRadius: '6px',
    padding: '8px 12px',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    color: 'var(--panel-ink-2)',
    textAlign: 'left',
    transition: 'all 0.15s',
  },
  message: { display: 'flex', gap: '8px', alignItems: 'flex-end' },
  userMessage: { flexDirection: 'row-reverse' },
  aiMessage: { flexDirection: 'row' },
  aiAvatar: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: 'var(--panel-accent)',
    color: 'white',
    fontFamily: 'var(--font-display)',
    fontSize: '12px',
    fontWeight: '700',
    fontStyle: 'italic',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '80%',
    padding: '10px 13px',
    borderRadius: '12px',
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    lineHeight: 1.6,
  },
  userBubble: {
    background: 'var(--panel-accent)',
    color: 'white',
    borderBottomRightRadius: '3px',
  },
  aiBubble: {
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--panel-ink)',
    border: '1px solid var(--panel-border)',
    borderBottomLeftRadius: '3px',
  },
  errorBubble: { borderColor: 'rgba(255,100,100,0.3)', color: 'rgba(255,150,150,0.9)' },
  typingDots: { display: 'flex', gap: '4px', alignItems: 'center', padding: '2px 0' },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--panel-accent)',
    animation: 'pulse 1s ease-in-out infinite',
    display: 'inline-block',
  },
  inputArea: {
    padding: '12px',
    borderTop: '1px solid var(--panel-border)',
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--panel-border)',
    borderRadius: '8px',
    padding: '8px 12px',
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    color: 'var(--panel-ink)',
    resize: 'none',
    outline: 'none',
    lineHeight: 1.5,
  },
  sendBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    background: 'var(--panel-accent)',
    border: 'none',
    cursor: 'pointer',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity 0.15s',
  },
}
