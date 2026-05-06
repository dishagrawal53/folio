import React, { useState } from 'react'
import { useWikipedia } from '../hooks/useWikipedia.js'
import { useOpenAI } from '../hooks/useOpenAI.js'
import { useStore } from '../lib/store.js'

function buildYouTubeUrl(q) { return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` }
function buildKhanUrl(q)    { return `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(q)}` }
function buildScholarUrl(q) { return `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}` }
function buildBritannicaUrl(q) { return `https://www.britannica.com/search?query=${encodeURIComponent(q)}` }

// ─── Flashcard Viewer ──────────────────────────────────────────
function FlashcardViewer({ cards }) {
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)

  if (!cards || !cards.length) return null
  const card = cards[idx]

  return (
    <div style={ps.flashcardWrap}>
      <div
        style={{ ...ps.flashcard, ...(flipped ? ps.flashcardFlipped : {}) }}
        onClick={() => setFlipped(!flipped)}
      >
        <div style={ps.flashcardInner}>
          {!flipped ? (
            <>
              <span style={ps.flashcardLabel}>Q</span>
              <p style={ps.flashcardText}>{card.q}</p>
            </>
          ) : (
            <>
              <span style={{ ...ps.flashcardLabel, color: 'var(--panel-accent)' }}>A</span>
              <p style={ps.flashcardText}>{card.a}</p>
            </>
          )}
        </div>
        <p style={ps.flashcardHint}>{flipped ? 'Click to flip back' : 'Click to reveal answer'}</p>
      </div>
      <div style={ps.flashcardNav}>
        <button onClick={() => { setIdx(Math.max(0, idx - 1)); setFlipped(false) }} disabled={idx === 0} style={ps.fcNavBtn}>←</button>
        <span style={ps.fcCount}>{idx + 1} / {cards.length}</span>
        <button onClick={() => { setIdx(Math.min(cards.length - 1, idx + 1)); setFlipped(false) }} disabled={idx === cards.length - 1} style={ps.fcNavBtn}>→</button>
      </div>
    </div>
  )
}

// ─── AI Section (now powered by OpenAI via Flask) ─────────────
function AISection({ selectedText, currentPageText, currentPage }) {
  const ai = useOpenAI()
  const [activeAction, setActiveAction] = useState(null)

  const run = (action) => {
    setActiveAction(action)
    if (action === 'explain')    ai.explain(selectedText)
    else if (action === 'summary')   ai.summarizePage(currentPageText, currentPage)
    else if (action === 'flashcards') ai.makeFlashcards(selectedText || currentPageText)
  }

  const actions = [
    { id: 'explain',    icon: '💡', label: 'Explain selection' },
    { id: 'summary',    icon: '📋', label: 'Page summary' },
    { id: 'flashcards', icon: '🃏', label: 'Make flashcards' },
  ]

  return (
    <div style={ps.aiSection}>
      <div style={ps.sectionLabel}>
        <AIIcon />
        <span>AI Study Tools</span>
        <span style={ps.aiPoweredBadge}>GPT-4o mini</span>
      </div>

      <div style={ps.aiActions}>
        {actions.map(a => (
          <button
            key={a.id}
            onClick={() => run(a.id)}
            disabled={ai.loading}
            style={{
              ...ps.aiBtn,
              ...(activeAction === a.id && !ai.loading ? ps.aiBtnActive : {}),
            }}
          >
            <span>{a.icon}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>

      {ai.loading && (
        <div style={ps.aiLoading}>
          <div style={ps.aiSpinner} />
          <span style={ps.aiLoadingText}>Thinking…</span>
        </div>
      )}

      {ai.error && !ai.loading && (
        <div style={ps.aiErrorBox}>
          <p style={ps.aiError}>{ai.error}</p>
          {(ai.error.includes('OPENAI') || ai.error.includes('key')) && (
            <p style={ps.aiSetupHint}>
              Add <code style={ps.code}>OPENAI_API_KEY</code> to your backend <code style={ps.code}>.env</code> file.
            </p>
          )}
        </div>
      )}

      {ai.result && !ai.loading && (
        <div style={ps.aiResult}>
          {ai.type === 'flashcards' ? (
            <FlashcardViewer cards={ai.cards} />
          ) : (
            <>
              <p style={ps.aiResultText}>
                {ai.result.split('\n').map((line, i) => (
                  <span key={i}>{line}{i < ai.result.split('\n').length - 1 && <br />}</span>
                ))}
              </p>
              <button onClick={ai.clear} style={ps.aiClear}>Clear ✕</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main ConceptPanel ─────────────────────────────────────────
export default function ConceptPanel() {
  const { selectedText, panelOpen, closePanel, currentPage } = useStore()
  const pages = useStore(s => s.pages)
  const currentPageText = pages[currentPage - 1]?.text || ''

  const wiki = useWikipedia(panelOpen ? selectedText : '')
  const [wikiCollapsed, setWikiCollapsed] = useState(false)

  if (!panelOpen) return null

  // Use NLP-derived keywords from backend (much more accurate)
  const searchQuery = wiki.keywords?.slice(0, 2).join(' ') || selectedText?.slice(0, 60) || ''

  return (
    <div style={ps.panel} className="anim-panel">

      {/* Header */}
      <div style={ps.header}>
        <div>
          <p style={ps.headerLabel}>CONCEPT LOOKUP</p>
          <div style={ps.headerAccent} />
        </div>
        <button onClick={closePanel} style={ps.closeBtn} aria-label="Close panel">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Selected text */}
      <div style={ps.selectedSection}>
        <p style={ps.sectionMicro}>SELECTED</p>
        <blockquote style={ps.selectedText}>
          "{selectedText?.length > 200 ? selectedText.slice(0, 200) + '…' : selectedText}"
        </blockquote>
      </div>

      {/* Keywords — from Flask NLP */}
      {wiki.keywords?.length > 0 && (
        <div style={ps.keywordsRow}>
          {wiki.keywords.map(k => (
            <span key={k} style={ps.keyword}>{k}</span>
          ))}
          {wiki.nlpMethod && (
            <span style={{ ...ps.keyword, opacity: 0.4, fontSize: '9px' }}>
              {wiki.nlpMethod}
            </span>
          )}
        </div>
      )}

      <div style={ps.rule} />

      {/* AI Section */}
      <AISection
        selectedText={selectedText}
        currentPageText={currentPageText}
        currentPage={currentPage}
      />

      <div style={ps.rule} />

      {/* Wikipedia */}
      <div style={ps.wikiSection}>
        <div style={ps.sectionHeaderRow} onClick={() => setWikiCollapsed(!wikiCollapsed)}>
          <div style={ps.sectionLabel}>
            <WikiIcon />
            <span>Wikipedia</span>
          </div>
          <button style={ps.collapseBtn}>{wikiCollapsed ? '▸' : '▾'}</button>
        </div>

        {!wikiCollapsed && (
          <>
            {wiki.loading && (
              <div style={ps.loadingRow}>
                {[0,1,2].map(i => (
                  <span key={i} style={{ ...ps.dot, animationDelay: `${i * 0.2}s` }} />
                ))}
                <span style={ps.loadingText}>Searching…</span>
              </div>
            )}

            {wiki.error && !wiki.loading && (
              <p style={ps.errorText}>{wiki.error}</p>
            )}

            {wiki.title && !wiki.loading && (
              <div style={ps.wikiResult}>
                {wiki.thumbnail && (
                  <img
                    src={wiki.thumbnail}
                    alt={wiki.title}
                    style={ps.thumbnail}
                    onError={e => { e.target.style.display = 'none' }}
                  />
                )}
                <a href={wiki.url} target="_blank" rel="noreferrer" style={ps.wikiTitle}>
                  {wiki.title}
                  <span style={ps.wikiArrow}> ↗</span>
                </a>
                <p style={ps.wikiSummary}>
                  {wiki.summary?.length > 360 ? wiki.summary.slice(0, 360) + '…' : wiki.summary}
                </p>
                <a href={wiki.url} target="_blank" rel="noreferrer" style={ps.readMore}>
                  Read full article →
                </a>
              </div>
            )}
          </>
        )}
      </div>

      <div style={ps.rule} />

      {/* Resources */}
      <div style={ps.resourcesSection}>
        <div style={ps.sectionLabel}>
          <span style={{ fontSize: '14px' }}>🔗</span>
          <span>More Resources</span>
        </div>
        <div style={ps.resourceList}>
          <ResourceLink href={buildYouTubeUrl(searchQuery)}    icon="▶" label="YouTube"        color="#ff4444" desc="Video explanations" />
          <ResourceLink href={buildKhanUrl(searchQuery)}        icon="🎓" label="Khan Academy"   color="#1ba94c" desc="Free lessons" />
          <ResourceLink href={buildScholarUrl(searchQuery)}     icon="📄" label="Google Scholar" color="#4a90d9" desc="Research papers" />
          <ResourceLink href={buildBritannicaUrl(searchQuery)}  icon="📚" label="Britannica"     color="#c8a020" desc="Encyclopedia" />
        </div>
      </div>

      <div style={ps.footer}>
        Select different text to look up a new concept
      </div>
    </div>
  )
}

function ResourceLink({ href, icon, label, desc, color }) {
  const [hovered, setHovered] = useState(false)
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{ ...ps.resourceLink, ...(hovered ? { background: 'var(--panel-alt)', borderColor: color } : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ fontSize: '14px', flexShrink: 0 }}>{icon}</span>
      <div style={ps.resourceText}>
        <span style={{ ...ps.resourceLabel, color }}>{label}</span>
        <span style={ps.resourceDesc}>{desc}</span>
      </div>
      <span style={ps.resourceArrow}>↗</span>
    </a>
  )
}

// ─── Icons ─────────────────────────────────────────────────────
function WikiIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1"/>
      <text x="7" y="10.5" textAnchor="middle" fontSize="8" fontFamily="serif" fontWeight="bold" fill="currentColor">W</text>
    </svg>
  )
}

function AIIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1L9 6L14 7L9 8L7 13L5 8L0 7L5 6Z" fill="var(--panel-accent)" opacity="0.8"/>
    </svg>
  )
}

// ─── Styles (identical to original ConceptPanel) ───────────────
const ps = {
  panel: { width: '380px', height: '100vh', background: 'var(--panel-bg)', borderLeft: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden', flexShrink: 0, boxShadow: '-12px 0 40px rgba(0,0,0,0.25)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 16px', borderBottom: '1px solid var(--panel-border)', flexShrink: 0 },
  headerLabel: { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.15em', color: 'var(--panel-ink-2)', marginBottom: '6px' },
  headerAccent: { width: '28px', height: '2px', background: 'var(--panel-accent)', borderRadius: '1px' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--panel-ink-2)', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center' },
  selectedSection: { padding: '14px 20px', borderBottom: '1px solid var(--panel-border)' },
  sectionMicro: { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.15em', color: 'var(--panel-ink-2)', marginBottom: '8px' },
  selectedText: { fontFamily: 'var(--font-body)', fontSize: '13px', fontStyle: 'italic', color: 'var(--panel-ink)', lineHeight: 1.65, borderLeft: '2px solid var(--panel-accent)', paddingLeft: '10px', opacity: 0.85 },
  keywordsRow: { display: 'flex', flexWrap: 'wrap', gap: '5px', padding: '10px 20px', borderBottom: '1px solid var(--panel-border)' },
  keyword: { fontFamily: 'var(--font-mono)', fontSize: '10px', background: 'rgba(255,255,255,0.05)', color: 'var(--panel-accent)', padding: '2px 8px', borderRadius: '20px', border: '1px solid var(--panel-border)', letterSpacing: '0.03em' },
  rule: { height: '1px', background: 'var(--panel-border)', flexShrink: 0 },
  aiSection: { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' },
  sectionLabel: { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em', color: 'var(--panel-ink-2)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' },
  aiPoweredBadge: { marginLeft: 'auto', background: 'rgba(232, 131, 74, 0.15)', color: 'var(--panel-accent)', fontFamily: 'var(--font-mono)', fontSize: '9px', padding: '1px 6px', borderRadius: '10px', border: '1px solid rgba(232, 131, 74, 0.3)', letterSpacing: '0.06em' },
  aiActions: { display: 'flex', flexDirection: 'column', gap: '5px' },
  aiBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--panel-border)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--panel-ink)', transition: 'all 0.15s', textAlign: 'left' },
  aiBtnActive: { borderColor: 'var(--panel-accent)', background: 'rgba(232, 131, 74, 0.08)', color: 'var(--panel-accent)' },
  aiLoading: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' },
  aiSpinner: { width: '14px', height: '14px', border: '2px solid var(--panel-border)', borderTopColor: 'var(--panel-accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 },
  aiLoadingText: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--panel-ink-2)', fontStyle: 'italic' },
  aiErrorBox: { display: 'flex', flexDirection: 'column', gap: '6px' },
  aiError: { fontFamily: 'var(--font-ui)', fontSize: '12px', color: '#e88', lineHeight: 1.5 },
  aiSetupHint: { fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--panel-ink-2)', lineHeight: 1.6 },
  code: { fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' },
  aiResult: { display: 'flex', flexDirection: 'column', gap: '8px' },
  aiResultText: { fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--panel-ink)', lineHeight: 1.7, borderLeft: '2px solid var(--panel-accent)', paddingLeft: '10px' },
  aiClear: { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--panel-ink-2)', alignSelf: 'flex-end' },
  flashcardWrap: { display: 'flex', flexDirection: 'column', gap: '8px' },
  flashcard: { background: 'rgba(255,255,255,0.05)', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '16px', cursor: 'pointer', transition: 'all 0.2s', minHeight: '100px', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  flashcardFlipped: { background: 'rgba(232, 131, 74, 0.06)', borderColor: 'rgba(232, 131, 74, 0.3)' },
  flashcardInner: { display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 },
  flashcardLabel: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--panel-ink-2)', letterSpacing: '0.1em' },
  flashcardText: { fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--panel-ink)', lineHeight: 1.6 },
  flashcardHint: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--panel-ink-2)', textAlign: 'center', marginTop: '8px' },
  flashcardNav: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' },
  fcNavBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid var(--panel-border)', cursor: 'pointer', color: 'var(--panel-ink)', width: '28px', height: '28px', borderRadius: '4px', fontFamily: 'var(--font-ui)', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  fcCount: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--panel-ink-2)' },
  wikiSection: { padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '10px' },
  sectionHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' },
  collapseBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--panel-ink-2)', fontSize: '12px', padding: '2px 4px' },
  loadingRow: { display: 'flex', alignItems: 'center', gap: '5px' },
  dot: { width: '5px', height: '5px', borderRadius: '50%', background: 'var(--panel-accent)', display: 'inline-block', animation: 'pulse 1.2s ease-in-out infinite' },
  loadingText: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--panel-ink-2)', marginLeft: '4px' },
  errorText: { fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--panel-ink-2)', fontStyle: 'italic', lineHeight: 1.5 },
  wikiResult: { display: 'flex', flexDirection: 'column', gap: '8px' },
  thumbnail: { width: '100%', height: '110px', objectFit: 'cover', borderRadius: '4px', opacity: 0.8 },
  wikiTitle: { fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: '600', color: 'var(--panel-ink)', textDecoration: 'none', lineHeight: 1.3 },
  wikiArrow: { color: 'var(--panel-accent)', fontSize: '13px' },
  wikiSummary: { fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--panel-ink-2)', lineHeight: 1.7 },
  readMore: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--panel-accent)', textDecoration: 'none', letterSpacing: '0.03em' },
  resourcesSection: { padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '8px' },
  resourceList: { display: 'flex', flexDirection: 'column', gap: '5px' },
  resourceLink: { display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '6px', textDecoration: 'none', transition: 'all 0.15s', cursor: 'pointer' },
  resourceText: { flex: 1, display: 'flex', flexDirection: 'column', gap: '1px' },
  resourceLabel: { fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: '600' },
  resourceDesc: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--panel-ink-2)' },
  resourceArrow: { color: 'var(--panel-ink-2)', fontSize: '11px' },
  footer: { padding: '14px 20px 24px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--panel-border)', textAlign: 'center', lineHeight: 1.5, letterSpacing: '0.04em' },
}
