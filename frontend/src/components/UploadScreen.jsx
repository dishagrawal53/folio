import React, { useCallback, useState, useEffect } from 'react'
import { useStore } from '../lib/store.js'
import { useAuth } from '../lib/auth.js'

const THEMES = [
  { id: 'parchment', label: 'Parchment', color: '#b5451b' },
  { id: 'dark',      label: 'Night',     color: '#e8834a' },
  { id: 'slate',     label: 'Slate',     color: '#1a56db' },
  { id: 'sage',      label: 'Sage',      color: '#2d6a4f' },
]

const FEATURES = [
  { icon: '📖', name: 'Beautiful Reading',   desc: 'Clean typography with adjustable size & spacing' },
  { icon: '🔖', name: 'Dog-ear Bookmarks',   desc: 'Fold page corners to save your place' },
  { icon: '🔍', name: 'Instant Search',       desc: 'Find any word across all pages instantly' },
  { icon: '🧠', name: 'AI Explanations',      desc: 'Gemini explains concepts in plain language' },
  { icon: '📝', name: 'Inline Notes',          desc: 'Attach colored sticky notes to any page' },
  { icon: '🌐', name: 'Wikipedia Panel',       desc: 'Highlight text to look it up instantly' },
]

// ─── User Menu ──────────────────────────────────────────────────
function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  if (!user) return null
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={s.avatarBtn}
        title={user.name || user.email}
      >
        {user.avatar || user.name?.[0]?.toUpperCase() || '?'}
      </button>
      {open && (
        <div style={s.userDropdown}>
          <p style={s.userName}>{user.name}</p>
          <p style={s.userEmail}>{user.email}</p>
          <div style={s.userDivider} />
          <button
            onClick={() => { logout(); setOpen(false) }}
            style={s.logoutBtn}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export default function UploadScreen() {
  const setPdf   = useStore(s => s.setPdf)
  const theme    = useStore(s => s.theme)
  const setTheme = useStore(s => s.setTheme)
  const bookmarks = useStore(s => s.bookmarks)
  const notes     = useStore(s => s.notes)

  const [dragging, setDragging] = useState(false)
  const [mounted,  setMounted]  = useState(false)

  useEffect(() => {
    setTimeout(() => setMounted(true), 50)
    document.documentElement.setAttribute('data-theme', theme)
  }, [])

  const handleFile = useCallback((file) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file.')
      return
    }
    setPdf(file, file.name)
  }, [setPdf])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const onInput = useCallback((e) => {
    handleFile(e.target.files[0])
  }, [handleFile])

  return (
    <div style={s.root}>
      {/* Ruled paper lines background */}
      <div style={s.paperBg} />

      {/* Left margin red line */}
      <div style={s.marginLine} />

      {/* Hole punches */}
      {[120, 280, 440].map(top => (
        <div key={top} style={{ ...s.holePunch, top }} />
      ))}

      {/* Top-right bar: theme switcher + user menu */}
      <div style={{ ...s.themeBar, opacity: mounted ? 1 : 0 }}>
        <span style={s.themeLabel}>Theme</span>
        {THEMES.map(t => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            style={{
              ...s.themeBtn,
              background: t.color,
              transform: theme === t.id ? 'scale(1.2)' : 'scale(1)',
              outline: theme === t.id ? `2px solid ${t.color}` : 'none',
              outlineOffset: '2px',
            }}
            data-tooltip={t.label}
            aria-label={t.label}
          />
        ))}
        <div style={s.themeDivider} />
        <UserMenu />
      </div>

      {/* Main content */}
      <div style={s.content}>

        {/* Header */}
        <div style={{ ...s.header, opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(20px)', transition: 'all 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
          <div style={s.titleRow}>
            <div style={s.logoMark}>F</div>
            <div>
              <h1 style={s.title}>Folio</h1>
              <p style={s.subtitle}>Your personal study companion</p>
            </div>
          </div>
        </div>

        {/* Drop zone */}
        <label
          style={{
            ...s.dropZone,
            ...(dragging ? s.dropZoneActive : {}),
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'none' : 'translateY(24px)',
            transition: 'opacity 0.5s 0.1s, transform 0.5s 0.1s cubic-bezier(0.16,1,0.3,1), border-color 0.2s, background 0.2s',
          }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={onInput} />

          <div style={{ ...s.dropIconWrap, background: dragging ? 'var(--accent)' : 'var(--tag-bg)' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M6 4C6 2.9 6.9 2 8 2H20L26 8V28C26 29.1 25.1 30 24 30H8C6.9 30 6 29.1 6 28V4Z"
                stroke={dragging ? 'white' : 'var(--accent)'} strokeWidth="1.5" fill="none"/>
              <path d="M20 2V8H26" stroke={dragging ? 'white' : 'var(--accent)'} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <line x1="11" y1="15" x2="21" y2="15" stroke={dragging ? 'white' : 'var(--ink-3)'} strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="11" y1="19" x2="21" y2="19" stroke={dragging ? 'white' : 'var(--ink-3)'} strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="11" y1="23" x2="17" y2="23" stroke={dragging ? 'white' : 'var(--ink-3)'} strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>

          <p style={s.dropTitle}>{dragging ? 'Release to open →' : 'Drop a PDF here'}</p>
          <p style={s.dropOr}>or click to browse</p>
          <p style={s.dropHint}>Textbooks · Papers · Notes · Articles</p>
        </label>

        {/* Stats if any saved data */}
        {(bookmarks.length > 0 || notes.length > 0) && (
          <div style={{ ...s.statsRow, opacity: mounted ? 1 : 0, transition: 'opacity 0.5s 0.2s' }}>
            {bookmarks.length > 0 && (
              <div style={s.statChip}>
                <span style={s.statIcon}>🔖</span>
                <span style={s.statText}>{bookmarks.length} saved bookmark{bookmarks.length !== 1 ? 's' : ''}</span>
              </div>
            )}
            {notes.length > 0 && (
              <div style={s.statChip}>
                <span style={s.statIcon}>📝</span>
                <span style={s.statText}>{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}

        {/* Features grid */}
        <div style={{ ...s.features, opacity: mounted ? 1 : 0, transition: 'opacity 0.5s 0.25s' }}>
          {FEATURES.map((f, i) => (
            <div
              key={f.name}
              style={{
                ...s.featureCard,
                animationDelay: `${0.3 + i * 0.06}s`,
              }}
              className="anim-fade-up"
            >
              <span style={s.featureIcon}>{f.icon}</span>
              <strong style={s.featureName}>{f.name}</strong>
              <span style={s.featureDesc}>{f.desc}</span>
            </div>
          ))}
        </div>

        <p style={{ ...s.footer, opacity: mounted ? 1 : 0, transition: 'opacity 0.5s 0.5s' }}>
          All processing happens in your browser — your files never leave your device.
        </p>
      </div>
    </div>
  )
}

const s = {
  root: {
    height: '100vh',
    width: '100%',
    background: 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  paperBg: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent calc(2rem - 1px), var(--ruler-color) calc(2rem - 1px), var(--ruler-color) 2rem)',
    pointerEvents: 'none',
  },
  marginLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '80px',
    width: '1px',
    background: 'rgba(200, 100, 80, 0.15)',
  },
  holePunch: {
    position: 'absolute',
    left: '28px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: 'var(--bg-alt)',
    border: '1.5px solid var(--border)',
  },
  themeBar: {
    position: 'absolute',
    top: '24px',
    right: '28px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'opacity 0.4s',
    zIndex: 10,
  },
  themeLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--ink-4)',
    letterSpacing: '0.08em',
    marginRight: '4px',
  },
  themeBtn: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  themeDivider: {
    width: '1px',
    height: '18px',
    background: 'var(--border)',
    marginLeft: '4px',
    marginRight: '4px',
  },

  // User menu
  avatarBtn: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  userDropdown: {
    position: 'absolute',
    top: '36px',
    right: 0,
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '12px',
    boxShadow: '0 8px 24px var(--shadow-lg)',
    minWidth: '180px',
    zIndex: 200,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  userName: {
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--ink)',
  },
  userEmail: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--ink-4)',
  },
  userDivider: {
    height: '1px',
    background: 'var(--border)',
    margin: '6px 0',
  },
  logoutBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    color: 'var(--ink-3)',
    padding: '5px 10px',
    borderRadius: '5px',
    textAlign: 'left',
  },

  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '28px',
    maxWidth: '600px',
    width: '100%',
    padding: '0 24px',
    position: 'relative',
    zIndex: 1,
  },
  header: {
    textAlign: 'center',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    justifyContent: 'center',
  },
  logoMark: {
    width: '52px',
    height: '52px',
    background: 'var(--accent)',
    color: 'white',
    fontFamily: 'var(--font-display)',
    fontSize: '28px',
    fontWeight: '700',
    fontStyle: 'italic',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    flexShrink: 0,
    boxShadow: '3px 3px 0 var(--border)',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '38px',
    fontWeight: '700',
    color: 'var(--ink)',
    lineHeight: 1.1,
    letterSpacing: '-0.01em',
  },
  subtitle: {
    fontFamily: 'var(--font-ui)',
    fontSize: '14px',
    color: 'var(--ink-3)',
    fontWeight: '400',
    marginTop: '2px',
  },
  dropZone: {
    width: '100%',
    border: '2px dashed var(--border)',
    borderRadius: '8px',
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    background: 'var(--bg-card)',
    cursor: 'pointer',
  },
  dropZoneActive: {
    border: '2px dashed var(--accent)',
    background: 'var(--accent-bg)',
  },
  dropIconWrap: {
    width: '64px',
    height: '64px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '8px',
    transition: 'background 0.2s',
  },
  dropTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '20px',
    fontStyle: 'italic',
    color: 'var(--ink)',
    fontWeight: '600',
  },
  dropOr: {
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    color: 'var(--ink-3)',
  },
  dropHint: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--ink-4)',
    letterSpacing: '0.05em',
    marginTop: '4px',
  },
  statsRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  statChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'var(--tag-bg)',
    border: '1px solid var(--border-light)',
    borderRadius: '20px',
    padding: '5px 12px',
  },
  statIcon: { fontSize: '13px' },
  statText: {
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    color: 'var(--ink-2)',
    fontWeight: '500',
  },
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
    width: '100%',
  },
  featureCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '14px 12px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-light)',
    borderRadius: '6px',
  },
  featureIcon: { fontSize: '18px', marginBottom: '2px' },
  featureName: {
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--ink)',
  },
  featureDesc: {
    fontFamily: 'var(--font-ui)',
    fontSize: '11px',
    color: 'var(--ink-3)',
    lineHeight: 1.45,
  },
  footer: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--ink-4)',
    letterSpacing: '0.04em',
    textAlign: 'center',
    transition: 'opacity 0.5s',
  }
}