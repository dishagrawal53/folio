import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react'
import { useStore } from '../lib/store.js'
import { useAuth } from '../lib/auth.js'
import { usePdfLoader } from '../hooks/usePdfLoader.js'
import { api } from '../lib/api.js'

// ─── Dog-ear Bookmark Component ────────────────────────────────
function DogEar({ active, onClick }) {
  return (
    <button
      onClick={onClick}
      title={active ? 'Remove bookmark' : 'Bookmark this page'}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '36px',
        height: '36px',
        cursor: 'pointer',
        background: 'none',
        border: 'none',
        padding: 0,
        zIndex: 10,
      }}
    >
      <svg width="36" height="36" viewBox="0 0 36 36">
        <path
          d="M0 0 L36 0 L36 36 Z"
          fill={active ? 'var(--accent)' : 'var(--border)'}
          style={{ transition: 'fill 0.2s' }}
        />
        {active && (
          <text x="26" y="12" fontSize="9" fill="white" textAnchor="middle" dominantBaseline="middle">🔖</text>
        )}
      </svg>
    </button>
  )
}

// ─── Inline Search Bar ─────────────────────────────────────────
function SearchBar({ onClose }) {
  const { searchQuery, searchResults, activeSearchResult, runSearch, nextSearchResult, prevSearchResult } = useStore()
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleKey = (e) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter') {
      if (e.shiftKey) prevSearchResult()
      else nextSearchResult()
    }
  }

  return (
    <div style={ss.searchBar} className="anim-fade-up">
      <span style={ss.searchIcon}>🔍</span>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search in document…"
        value={searchQuery}
        onChange={e => runSearch(e.target.value)}
        onKeyDown={handleKey}
        style={ss.searchInput}
      />
      {searchResults.length > 0 && (
        <span style={ss.searchCount}>{activeSearchResult + 1} / {searchResults.length}</span>
      )}
      {searchResults.length === 0 && searchQuery.length > 1 && (
        <span style={{ ...ss.searchCount, color: 'var(--accent)' }}>No results</span>
      )}
      <button onClick={prevSearchResult} disabled={searchResults.length === 0} style={ss.searchNav}>↑</button>
      <button onClick={nextSearchResult} disabled={searchResults.length === 0} style={ss.searchNav}>↓</button>
      <button onClick={onClose} style={ss.searchClose}>✕</button>
    </div>
  )
}

// ─── Settings Panel ────────────────────────────────────────────
function SettingsPanel({ onClose }) {
  const { fontSize, setFontSize, lineHeight, setLineHeight, showRulerLines, toggleRulerLines, theme, setTheme } = useStore()

  const THEMES = [
    { id: 'parchment', label: 'Parchment', color: '#b5451b' },
    { id: 'dark',      label: 'Night',     color: '#e8834a' },
    { id: 'slate',     label: 'Slate',     color: '#1a56db' },
    { id: 'sage',      label: 'Sage',      color: '#2d6a4f' },
  ]

  return (
    <div style={ss.settingsPanel} className="anim-bounce-in">
      <div style={ss.settingsHeader}>
        <span style={ss.settingsTitle}>Reading Settings</span>
        <button onClick={onClose} style={ss.settingsClose}>✕</button>
      </div>

      <div style={ss.settingsSection}>
        <label style={ss.settingsLabel}>Font Size — {fontSize}px</label>
        <div style={ss.sliderRow}>
          <button onClick={() => setFontSize(fontSize - 1)} style={ss.adjBtn}>−</button>
          <input type="range" min="13" max="24" value={fontSize}
            onChange={e => setFontSize(Number(e.target.value))} style={ss.slider} />
          <button onClick={() => setFontSize(fontSize + 1)} style={ss.adjBtn}>+</button>
        </div>
      </div>

      <div style={ss.settingsSection}>
        <label style={ss.settingsLabel}>Line Height — {lineHeight.toFixed(1)}</label>
        <div style={ss.sliderRow}>
          <button onClick={() => setLineHeight(+lineHeight - 0.1)} style={ss.adjBtn}>−</button>
          <input type="range" min="1.4" max="2.4" step="0.1" value={lineHeight}
            onChange={e => setLineHeight(Number(e.target.value))} style={ss.slider} />
          <button onClick={() => setLineHeight(+lineHeight + 0.1)} style={ss.adjBtn}>+</button>
        </div>
      </div>

      <div style={ss.settingsSection}>
        <label style={ss.settingsLabel}>Notebook Lines</label>
        <button
          onClick={toggleRulerLines}
          style={{ ...ss.toggleBtn, background: showRulerLines ? 'var(--accent)' : 'var(--tag-bg)', color: showRulerLines ? 'white' : 'var(--ink-3)' }}
        >
          {showRulerLines ? 'On' : 'Off'}
        </button>
      </div>

      <div style={ss.settingsSection}>
        <label style={ss.settingsLabel}>Theme</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {THEMES.map(t => (
            <button key={t.id} onClick={() => setTheme(t.id)} style={{
              ...ss.themeChip,
              background: theme === t.id ? t.color : 'var(--tag-bg)',
              color: theme === t.id ? 'white' : 'var(--ink-3)',
              borderColor: t.color,
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── User Menu (avatar + logout) ───────────────────────────────
function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)

  if (!user) return null

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={ss.avatarBtn}
        title={user.name || user.email}
      >
        {user.avatar || user.name?.[0]?.toUpperCase() || '?'}
      </button>
      {open && (
        <div style={ss.userDropdown} className="anim-fade-up">
          <p style={ss.userName}>{user.name}</p>
          <p style={ss.userEmail}>{user.email}</p>
          <div style={ss.userDivider} />
          <button onClick={() => { logout(); setOpen(false) }} style={ss.logoutBtn}>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Note Card ─────────────────────────────────────────────────
function NoteCard({ note, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(note.text)

  const NOTE_COLORS = { yellow: 'var(--note-yellow)', blue: 'var(--note-blue)', green: 'var(--note-green)', pink: 'var(--note-pink)' }

  const save = () => {
    onUpdate(note.id || note._id, text)
    setEditing(false)
  }

  return (
    <div style={{ ...ss.noteCard, background: NOTE_COLORS[note.color] || 'var(--note-yellow)' }} className="anim-fade-up">
      {note.selection && (
        <p style={ss.noteQuote}>"{note.selection.slice(0, 80)}{note.selection.length > 80 ? '…' : ''}"</p>
      )}
      {editing ? (
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          style={ss.noteTextarea}
          autoFocus
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) save() }}
        />
      ) : (
        <p style={ss.noteText} onClick={() => setEditing(true)}>
          {text || <em style={{ color: 'var(--ink-4)' }}>Click to add note…</em>}
        </p>
      )}
      <div style={ss.noteActions}>
        <span style={ss.noteTime}>{new Date(note.createdAt).toLocaleDateString()}</span>
        <button onClick={() => onDelete(note.id || note._id)} style={ss.noteDelete}>Delete</button>
      </div>
    </div>
  )
}

// ─── Page Text with highlights ─────────────────────────────────
function PageText({ text, searchQuery, searchResults, activeSearchResult, currentPage, fontSize, lineHeight, showRulerLines }) {
  const paragraphs = useMemo(() => {
    if (!text) return []
    return text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  }, [text])

  const getHighlighted = useCallback((para) => {
    if (!searchQuery || searchQuery.length < 2) return para
    const q = searchQuery.toLowerCase()
    const parts = []
    let idx = 0
    const lp = para.toLowerCase()
    while (idx < para.length) {
      const found = lp.indexOf(q, idx)
      if (found === -1) { parts.push({ text: para.slice(idx), match: false, active: false }); break }
      if (found > idx) parts.push({ text: para.slice(idx, found), match: false, active: false })
      const matchText = para.slice(found, found + q.length)
      const matchPos = searchResults.findIndex(r =>
        r.page === currentPage && r.text.toLowerCase().includes(q) && r === searchResults[activeSearchResult]
      )
      parts.push({ text: matchText, match: true, active: matchPos !== -1 })
      idx = found + q.length
    }
    return parts
  }, [searchQuery, searchResults, activeSearchResult, currentPage])

  const renderPara = (para, i) => {
    const isHeading = para.length < 80 && (
      para === para.toUpperCase() ||
      /^(Chapter|Section|Part|Unit|\d+[\.\)]\s)/i.test(para) ||
      (!para.endsWith('.') && !para.endsWith(',') && para.length < 60 && para.length > 4)
    )
    const highlighted = getHighlighted(para)
    const content = Array.isArray(highlighted) ? (
      <>{highlighted.map((p, j) =>
        p.match ? <mark key={j} className={`search-match${p.active ? ' active' : ''}`}>{p.text}</mark> : p.text
      )}</>
    ) : highlighted

    return isHeading
      ? <h2 key={i} style={{ ...ss.heading, fontSize: `${fontSize + 2}px` }}>{content}</h2>
      : <p key={i} style={{ ...ss.paragraph, fontSize: `${fontSize}px`, lineHeight }}>{content}</p>
  }

  return (
    <div style={{
      ...ss.pageContent,
      ...(showRulerLines ? {
        backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent calc(${lineHeight}em - 1px), var(--ruler-color) calc(${lineHeight}em - 1px), var(--ruler-color) ${lineHeight}em)`,
      } : {}),
    }}>
      {paragraphs.length === 0
        ? <p style={ss.emptyPage}>[ No extractable text on this page ]</p>
        : paragraphs.map(renderPara)
      }
    </div>
  )
}

// ─── Sidebar (notes + bookmarks) ───────────────────────────────
function Sidebar({ tab, setTab, onClose, bookmarks, notes, onGoToPage }) {
  const { removeBookmark, removeNote, updateBookmarkLabel } = useStore()
  const [editingId, setEditingId] = useState(null)
  const [editLabel, setEditLabel] = useState('')

  const startEdit = (b) => { setEditingId(b.id || b._id); setEditLabel(b.label) }
  const saveLabel = (id) => { updateBookmarkLabel(id, editLabel); setEditingId(null) }

  return (
    <div style={ss.sidebar} className="anim-slide-left">
      <div style={ss.sidebarHeader}>
        <div style={ss.sidebarTabs}>
          <button onClick={() => setTab('bookmarks')} style={{ ...ss.sidebarTab, ...(tab === 'bookmarks' ? ss.sidebarTabActive : {}) }}>
            🔖 Bookmarks
          </button>
          <button onClick={() => setTab('notes')} style={{ ...ss.sidebarTab, ...(tab === 'notes' ? ss.sidebarTabActive : {}) }}>
            📝 Notes
          </button>
        </div>
        <button onClick={onClose} style={ss.sidebarClose}>✕</button>
      </div>

      <div style={ss.sidebarContent}>
        {tab === 'bookmarks' && (
          bookmarks.length === 0
            ? <p style={ss.sidebarEmpty}>No bookmarks yet.<br />Click 🔖 or dog-ear a corner.</p>
            : bookmarks.map(b => (
              <div key={b.id || b._id} style={ss.sidebarItem} onClick={() => onGoToPage(b.page)}>
                <div style={ss.sidebarItemLeft}>
                  <span style={ss.sidebarItemPage}>p. {b.page}</span>
                  {editingId === (b.id || b._id) ? (
                    <input
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      onBlur={() => saveLabel(b.id || b._id)}
                      onKeyDown={e => { if (e.key === 'Enter') saveLabel(b.id || b._id) }}
                      onClick={e => e.stopPropagation()}
                      style={ss.sidebarEditInput}
                      autoFocus
                    />
                  ) : (
                    <span style={ss.sidebarItemLabel} onDoubleClick={e => { e.stopPropagation(); startEdit(b) }}>
                      {b.label}
                    </span>
                  )}
                  {b.snippet && <span style={ss.sidebarItemSnippet}>{b.snippet.slice(0, 60)}…</span>}
                </div>
                <button onClick={e => { e.stopPropagation(); removeBookmark(b.id || b._id) }} style={ss.sidebarItemDel}>✕</button>
              </div>
            ))
        )}

        {tab === 'notes' && (
          notes.length === 0
            ? <p style={ss.sidebarEmpty}>No notes yet.<br />Click 📝 to add one.</p>
            : notes.map(n => (
              <div key={n.id || n._id} style={ss.sidebarItem} onClick={() => onGoToPage(n.page)}>
                <div style={ss.sidebarItemLeft}>
                  <span style={ss.sidebarItemPage}>p. {n.page}</span>
                  <span style={ss.sidebarItemLabel}>{n.text.slice(0, 60)}{n.text.length > 60 ? '…' : ''}</span>
                  {n.selection && <span style={ss.sidebarItemSnippet}>"{n.selection.slice(0, 50)}…"</span>}
                </div>
                <button onClick={e => { e.stopPropagation(); removeNote(n.id || n._id) }} style={ss.sidebarItemDel}>✕</button>
              </div>
            ))
        )}
      </div>
    </div>
  )
}

// ─── Main BookReader ───────────────────────────────────────────
export default function BookReader({ onToggleChat, onToggleFolders, chatOpen, foldersOpen }) {
  usePdfLoader()

  const {
    pages, totalPages, currentPage, isLoading, loadError,
    setCurrentPage, setSelection, pdfName, reset, panelOpen,
    addBookmark, isPageBookmarked, bookmarks,
    addNote, getNotesForPage, updateNote, removeNote,
    fontSize, lineHeight, showRulerLines, pageDirection,
    searchQuery, searchResults, activeSearchResult,
    searchOpen, toggleSearch,
    sidebarOpen, sidebarTab, setSidebarTab, toggleSidebar, closeSidebar,
  } = useStore()

  const contentRef = useRef(null)
  const [showSettings, setShowSettings] = useState(false)
  const [addingNote, setAddingNote] = useState(false)
  const [noteColor, setNoteColor] = useState('yellow')
  const [noteText, setNoteText] = useState('')
  const [selectionForNote, setSelectionForNote] = useState('')

  const currentPageData = pages[currentPage - 1]
  const pageNotes = getNotesForPage(currentPage)
  const isBookmarked = isPageBookmarked(currentPage)

  // ── Save progress to backend when page changes ──────────────
  useEffect(() => {
    if (!pdfName || !totalPages) return
    const t = setTimeout(() => {
      api.progress.save(pdfName, currentPage, totalPages).catch(() => {})
    }, 800) // debounce — don't fire on every rapid keypress
    return () => clearTimeout(t)
  }, [currentPage, pdfName, totalPages])

  // ── Load saved progress on PDF open ─────────────────────────
  useEffect(() => {
    if (!pdfName || pages.length === 0) return
    api.progress.get(pdfName)
      .then(data => {
        const saved = data?.progress?.page
        if (saved && saved > 1 && saved <= totalPages) {
          setCurrentPage(saved)
        }
      })
      .catch(() => {})
  }, [pdfName, pages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const goNext = useCallback(() => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1)
  }, [currentPage, totalPages, setCurrentPage])

  const goPrev = useCallback(() => {
    if (currentPage > 1) setCurrentPage(currentPage - 1)
  }, [currentPage, setCurrentPage])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev()
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); toggleSearch() }
      if (e.key === 'Escape') { closeSidebar(); setShowSettings(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev, toggleSearch, closeSidebar])

  // Text selection → open concept panel
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = sel.toString().trim()
    if (text.length < 4) return
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    setSelectionForNote(text)
    setSelection(text, rect)
  }, [setSelection])

  // Add note — also sync to backend
  const submitNote = useCallback(async () => {
    if (noteText.trim() || selectionForNote) {
      const localId = addNote(currentPage, noteText.trim(), noteColor, selectionForNote)
      // Sync to backend
      try {
        await api.notes.create({
          pdfName,
          page: currentPage,
          text: noteText.trim(),
          color: noteColor,
          selection: selectionForNote,
        })
      } catch (e) {
        console.warn('Note sync failed (offline?):', e.message)
      }
      setNoteText('')
      setSelectionForNote('')
      setAddingNote(false)
    }
  }, [noteText, selectionForNote, currentPage, noteColor, noteText, pdfName, addNote])

  // Bookmark toggle — also sync to backend
  const handleBookmark = useCallback(async () => {
    addBookmark(currentPage, '', 'accent', currentPageData?.text?.slice(0, 120) || '')
    try {
      await api.bookmarks.upsert({
        pdfName,
        page: currentPage,
        label: `Page ${currentPage}`,
        snippet: currentPageData?.text?.slice(0, 120) || '',
      })
    } catch (e) {
      console.warn('Bookmark sync failed (offline?):', e.message)
    }
  }, [currentPage, pdfName, currentPageData, addBookmark])

  const NOTE_COLORS = ['yellow', 'blue', 'green', 'pink']
  const NOTE_COLOR_HEX = {
    yellow: 'var(--note-yellow)', blue: 'var(--note-blue)',
    green: 'var(--note-green)', pink: 'var(--note-pink)',
  }

  const progress = totalPages > 0 ? (currentPage / totalPages) * 100 : 0
  const animClass = pageDirection === 'next' ? 'anim-page-next' : 'anim-page-prev'

  return (
    <div style={ss.root}>

      {/* ── Top Bar ─────────────────────────────────────────── */}
      <div style={ss.topBar}>
        <div style={ss.topLeft}>
          <button onClick={reset} style={ss.iconBtn} title="Open new PDF">
            <HomeIcon />
          </button>
          <div style={ss.filePill}>
            <span style={ss.fileIcon}>📄</span>
            <span style={ss.fileName} title={pdfName}>
              {pdfName.length > 28 ? pdfName.slice(0, 25) + '…' : pdfName}
            </span>
          </div>
        </div>

        <div style={ss.topCenter}>
          <button onClick={goPrev} disabled={currentPage <= 1} style={{ ...ss.navBtnSmall, opacity: currentPage <= 1 ? 0.3 : 1 }}>‹</button>
          <div style={ss.pageIndicator}>
            <input
              type="number" min={1} max={totalPages} value={currentPage}
              onChange={e => setCurrentPage(Number(e.target.value))}
              style={ss.pageInput}
            />
            <span style={ss.pageOf}>/ {totalPages}</span>
          </div>
          <button onClick={goNext} disabled={currentPage >= totalPages} style={{ ...ss.navBtnSmall, opacity: currentPage >= totalPages ? 0.3 : 1 }}>›</button>
        </div>

        <div style={ss.topRight}>
          {/* Progress bar */}
          <div style={ss.progressWrap} title={`${Math.round(progress)}% read`}>
            <div style={{ ...ss.progressFill, width: `${progress}%` }} />
          </div>

          {/* Search */}
          <button onClick={toggleSearch}
            style={{ ...ss.iconBtn, background: searchOpen ? 'var(--accent-bg)' : 'none', color: searchOpen ? 'var(--accent)' : 'var(--ink-3)' }}
            title="Search (Ctrl+F)">
            <SearchIcon />
          </button>

          {/* Bookmark */}
          <button onClick={handleBookmark}
            style={{ ...ss.iconBtn, color: isBookmarked ? 'var(--accent)' : 'var(--ink-3)' }}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}>
            <BookmarkIcon filled={isBookmarked} />
          </button>

          {/* Add note */}
          <button onClick={() => { setAddingNote(true); setNoteText('') }}
            style={ss.iconBtn} title="Add note to this page">
            <NoteIcon />
          </button>

          {/* Notes & Bookmarks sidebar */}
          <button onClick={toggleSidebar}
            style={{ ...ss.iconBtn, background: sidebarOpen ? 'var(--accent-bg)' : 'none', color: sidebarOpen ? 'var(--accent)' : 'var(--ink-3)' }}
            title="Notes & Bookmarks">
            <SidebarIcon />
          </button>

          {/* ── NEW: Folder Manager ── */}
          {onToggleFolders && (
            <button onClick={onToggleFolders}
              style={{ ...ss.iconBtn, color: foldersOpen ? 'var(--accent)' : 'var(--ink-3)', background: foldersOpen ? 'var(--accent-bg)' : 'none' }}
              title="Folders & Library">
              <FolderIcon />
            </button>
          )}

          {/* ── NEW: AI Chat ── */}
          {onToggleChat && (
            <button onClick={onToggleChat}
              style={{ ...ss.iconBtn, color: chatOpen ? 'var(--accent)' : 'var(--ink-3)', background: chatOpen ? 'var(--accent-bg)' : 'none' }}
              title="AI Chat — ask about this PDF">
              <ChatIcon />
            </button>
          )}

          {/* Settings */}
          <button onClick={() => setShowSettings(!showSettings)} style={ss.iconBtn} title="Reading settings">
            <SettingsIcon />
          </button>

          {/* ── NEW: User avatar + logout ── */}
          <UserMenu />
        </div>
      </div>

      {/* ── Search Bar ──────────────────────────────────────── */}
      {searchOpen && <SearchBar onClose={() => { toggleSearch(); useStore.getState().setSearchQuery('') }} />}

      {/* ── Settings Popup ────────────────────────────────── */}
      {showSettings && (
        <div style={ss.settingsOverlay} onClick={() => setShowSettings(false)}>
          <div onClick={e => e.stopPropagation()}>
            <SettingsPanel onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}

      {/* ── Page Area ───────────────────────────────────────── */}
      <div style={ss.pageArea}>
        {/* Prev arrow */}
        <button onClick={goPrev} disabled={currentPage <= 1}
          style={{ ...ss.arrowBtn, opacity: currentPage <= 1 ? 0.15 : 0.6 }} aria-label="Previous page">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Page wrapper */}
        <div style={ss.pageWrapper}>
          {isLoading && (
            <div style={ss.stateBox}>
              <div style={ss.loadingSpinner} />
              <p style={ss.stateText}>Loading your PDF…</p>
              <p style={ss.stateSubText}>Extracting text from all pages</p>
            </div>
          )}

          {loadError && (
            <div style={ss.stateBox}>
              <p style={{ fontSize: '32px' }}>⚠️</p>
              <p style={ss.stateText}>Failed to load</p>
              <p style={ss.stateSubText}>{loadError}</p>
              <button onClick={reset} style={ss.retryBtn}>Try another file</button>
            </div>
          )}

          {!isLoading && !loadError && currentPageData && (
            <div style={ss.pageOuter}>
              {/* Dog-ear bookmark */}
              <DogEar active={isBookmarked} onClick={handleBookmark} />

              {/* Page number top */}
              <div style={ss.pageNum}>
                <div style={ss.pageNumLine} />
                <span style={ss.pageNumText}>— {currentPage} —</span>
                <div style={ss.pageNumLine} />
              </div>

              {/* Text content */}
              <div
                key={`${currentPage}-${pageDirection}`}
                ref={contentRef}
                onMouseUp={handleMouseUp}
                style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                className={animClass}
              >
                <PageText
                  text={currentPageData.text}
                  searchQuery={searchQuery}
                  searchResults={searchResults}
                  activeSearchResult={activeSearchResult}
                  currentPage={currentPage}
                  fontSize={fontSize}
                  lineHeight={lineHeight}
                  showRulerLines={showRulerLines}
                />
              </div>

              {/* Notes for this page */}
              {pageNotes.length > 0 && (
                <div style={ss.notesArea}>
                  <p style={ss.notesAreaLabel}>Notes for page {currentPage}</p>
                  {pageNotes.map(n => (
                    <NoteCard key={n.id || n._id} note={n} onDelete={removeNote} onUpdate={updateNote} />
                  ))}
                </div>
              )}

              {/* Add note form */}
              {addingNote && (
                <div style={ss.addNoteForm} className="anim-fade-up">
                  <div style={ss.addNoteHeader}>
                    <span style={ss.addNoteTitle}>📝 New Note</span>
                    <div style={ss.colorPicker}>
                      {NOTE_COLORS.map(c => (
                        <button key={c} onClick={() => setNoteColor(c)} style={{
                          ...ss.colorDot,
                          background: NOTE_COLOR_HEX[c],
                          transform: noteColor === c ? 'scale(1.3)' : 'scale(1)',
                          border: noteColor === c ? '2px solid var(--accent)' : '1px solid var(--border)',
                        }} />
                      ))}
                    </div>
                  </div>
                  {selectionForNote && (
                    <p style={ss.noteSelectionPreview}>
                      "{selectionForNote.slice(0, 100)}{selectionForNote.length > 100 ? '…' : ''}"
                    </p>
                  )}
                  <textarea
                    placeholder="Write your note…"
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    style={{ ...ss.noteTextarea, background: NOTE_COLOR_HEX[noteColor] }}
                    autoFocus
                    rows={3}
                  />
                  <div style={ss.addNoteFooter}>
                    <button onClick={() => setAddingNote(false)} style={ss.cancelBtn}>Cancel</button>
                    <button onClick={submitNote} style={ss.saveBtn}>Save Note</button>
                  </div>
                </div>
              )}

              {/* Page footer */}
              <div style={ss.pageFooter}>
                <div style={ss.pageNumLine} />
              </div>
            </div>
          )}
        </div>

        {/* Next arrow */}
        <button onClick={goNext} disabled={currentPage >= totalPages}
          style={{ ...ss.arrowBtn, opacity: currentPage >= totalPages ? 0.15 : 0.6 }} aria-label="Next page">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M8 4L14 10L8 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* ── Bottom Hint ─────────────────────────────────────── */}
      <div style={ss.bottomHint}>
        <span style={ss.hintText}>✦ Select text to look it up · ← → to navigate · Ctrl+F to search · AI Chat for questions</span>
      </div>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      {sidebarOpen && (
        <Sidebar
          tab={sidebarTab}
          setTab={setSidebarTab}
          onClose={closeSidebar}
          bookmarks={bookmarks}
          notes={useStore.getState().notes}
          onGoToPage={setCurrentPage}
        />
      )}
    </div>
  )
}

// ─── Icons ─────────────────────────────────────────────────────
const HomeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 7L8 2L14 7V14H10V10H6V14H2V7Z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>
  </svg>
)
const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
)
const BookmarkIcon = ({ filled }) => (
  <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
    <path d="M2 1H12V15L7 12L2 15V1Z" stroke="currentColor" strokeWidth="1.4" fill={filled ? 'currentColor' : 'none'} strokeLinejoin="round"/>
  </svg>
)
const NoteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" fill="none"/>
    <line x1="5" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="5" y1="9" x2="11" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="5" y1="12" x2="8" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
)
const SidebarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none"/>
    <line x1="5.5" y1="1.5" x2="5.5" y2="14.5" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
)
const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3" fill="none"/>
    <path d="M8 1.5V3M8 13V14.5M1.5 8H3M13 8H14.5M3.2 3.2L4.3 4.3M11.7 11.7L12.8 12.8M3.2 12.8L4.3 11.7M11.7 4.3L12.8 3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
)
// ── NEW icons ──────────────────────────────────────────────────
const FolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M1 3C1 2.4 1.4 2 2 2H6L7.5 4H14C14.6 4 15 4.4 15 5V13C15 13.6 14.6 14 14 14H2C1.4 14 1 13.6 1 13V3Z"
      stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/>
  </svg>
)
const ChatIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 2H14C14.6 2 15 2.4 15 3V10C15 10.6 14.6 11 14 11H5L2 14V3C2 2.4 2.4 2 3 2H2Z"
      stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/>
    <line x1="5" y1="5.5" x2="11" y2="5.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    <line x1="5" y1="7.5" x2="9" y2="7.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
  </svg>
)

// ─── Styles ────────────────────────────────────────────────────
const ss = {
  root: {
    height: '100vh',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg)',
    overflow: 'hidden',
    position: 'relative',
  },

  // Top bar
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-alt)',
    flexShrink: 0,
    gap: '12px',
    minHeight: '48px',
  },
  topLeft: { display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 },
  topCenter: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },
  topRight: { display: 'flex', alignItems: 'center', gap: '4px', flex: 1, justifyContent: 'flex-end' },

  filePill: {
    display: 'flex', alignItems: 'center', gap: '5px',
    background: 'var(--bg-card)', border: '1px solid var(--border-light)',
    borderRadius: '20px', padding: '3px 10px', minWidth: 0,
  },
  fileIcon: { fontSize: '12px', flexShrink: 0 },
  fileName: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)',
    width: '30px', height: '30px', display: 'flex', alignItems: 'center',
    justifyContent: 'center', borderRadius: '6px', transition: 'all 0.15s', flexShrink: 0,
  },

  navBtnSmall: {
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)',
    fontSize: '20px', lineHeight: 1, padding: '0 4px', transition: 'opacity 0.15s',
    fontFamily: 'var(--font-display)',
  },
  pageIndicator: { display: 'flex', alignItems: 'center', gap: '4px' },
  pageInput: {
    fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '600',
    color: 'var(--ink)', background: 'transparent', border: 'none',
    width: '44px', textAlign: 'center', cursor: 'text',
  },
  pageOf: { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-4)' },

  progressWrap: { width: '80px', height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden', margin: '0 8px' },
  progressFill: { height: '100%', background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.4s ease' },

  // User avatar
  avatarBtn: {
    width: '28px', height: '28px', borderRadius: '50%',
    background: 'var(--accent)', color: 'white',
    border: 'none', cursor: 'pointer',
    fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: '700',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginLeft: '4px',
  },
  userDropdown: {
    position: 'absolute', top: '36px', right: 0,
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '12px',
    boxShadow: '0 8px 24px var(--shadow-lg)',
    minWidth: '180px', zIndex: 200,
    display: 'flex', flexDirection: 'column', gap: '4px',
  },
  userName: { fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: '600', color: 'var(--ink)' },
  userEmail: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-4)' },
  userDivider: { height: '1px', background: 'var(--border)', margin: '6px 0' },
  logoutBtn: {
    background: 'none', border: '1px solid var(--border)', cursor: 'pointer',
    fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--ink-3)',
    padding: '5px 10px', borderRadius: '5px', textAlign: 'left',
  },

  // Search bar
  searchBar: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  searchIcon: { fontSize: '14px', flexShrink: 0 },
  searchInput: { flex: 1, background: 'transparent', border: 'none', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--ink)', outline: 'none' },
  searchCount: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-4)', flexShrink: 0 },
  searchNav: { background: 'var(--tag-bg)', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: '13px', width: '24px', height: '24px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  searchClose: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: '14px', padding: '2px 4px' },

  // Settings
  settingsOverlay: { position: 'absolute', top: '50px', right: '16px', zIndex: 200 },
  settingsPanel: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: '0 8px 32px var(--shadow-lg)', padding: '16px', width: '260px', display: 'flex', flexDirection: 'column', gap: '16px' },
  settingsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  settingsTitle: { fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: '600', color: 'var(--ink)' },
  settingsClose: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: '14px' },
  settingsSection: { display: 'flex', flexDirection: 'column', gap: '8px' },
  settingsLabel: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase' },
  sliderRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  adjBtn: { background: 'var(--tag-bg)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--ink-2)', width: '24px', height: '24px', borderRadius: '4px', fontFamily: 'var(--font-ui)', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  slider: { flex: 1, accentColor: 'var(--accent)' },
  toggleBtn: { border: 'none', cursor: 'pointer', padding: '4px 12px', borderRadius: '20px', fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: '500', transition: 'all 0.2s', alignSelf: 'flex-start' },
  themeChip: { border: '1px solid', cursor: 'pointer', padding: '4px 10px', borderRadius: '20px', fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: '500', transition: 'all 0.2s' },

  // Page area
  pageArea: { flex: 1, display: 'flex', alignItems: 'stretch', overflow: 'hidden' },
  arrowBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', padding: '0 14px', display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'opacity 0.2s' },
  pageWrapper: { flex: 1, overflow: 'hidden', display: 'flex', justifyContent: 'center', padding: '20px 0' },

  // Loading / error
  stateBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', height: '100%', padding: '40px' },
  loadingSpinner: { width: '36px', height: '36px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  stateText: { fontFamily: 'var(--font-display)', fontSize: '18px', fontStyle: 'italic', color: 'var(--ink)' },
  stateSubText: { fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-4)' },
  retryBtn: { fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'white', background: 'var(--accent)', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' },

  // Page card
  pageOuter: { maxWidth: '700px', width: '100%', height: '100%', background: 'var(--bg-card)', boxShadow: '0 2px 8px var(--shadow), 0 12px 40px var(--shadow-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-light)', borderRadius: '2px', userSelect: 'text', cursor: 'text', position: 'relative' },
  pageNum: { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 40px 0', flexShrink: 0 },
  pageNumLine: { flex: 1, height: '1px', background: 'var(--border-light)' },
  pageNumText: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-4)', letterSpacing: '0.12em', flexShrink: 0 },
  pageContent: { flex: 1, overflowY: 'auto', padding: '20px 48px 16px', display: 'flex', flexDirection: 'column', gap: 0 },
  emptyPage: { fontFamily: 'var(--font-body)', fontSize: '14px', fontStyle: 'italic', color: 'var(--ink-4)', textAlign: 'center', marginTop: '60px' },
  heading: { fontFamily: 'var(--font-display)', fontWeight: '700', color: 'var(--ink)', lineHeight: 1.35, marginTop: '28px', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid var(--border-light)' },
  paragraph: { fontFamily: 'var(--font-body)', color: 'var(--ink-2)', marginBottom: '0', textAlign: 'justify', hyphens: 'auto', paddingBottom: '1em' },
  pageFooter: { padding: '0 40px 12px', flexShrink: 0 },

  // Notes
  notesArea: { borderTop: '1px solid var(--border-light)', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', flexShrink: 0 },
  notesAreaLabel: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase' },
  noteCard: { borderRadius: '4px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid rgba(0,0,0,0.06)' },
  noteQuote: { fontFamily: 'var(--font-body)', fontSize: '11px', fontStyle: 'italic', color: 'var(--ink-3)', borderLeft: '2px solid var(--accent)', paddingLeft: '8px', lineHeight: 1.4 },
  noteText: { fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', lineHeight: 1.5, cursor: 'text' },
  noteTextarea: { fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', border: 'none', background: 'transparent', resize: 'vertical', width: '100%', lineHeight: 1.5, outline: 'none', padding: '4px 0' },
  noteActions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  noteTime: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-4)' },
  noteDelete: { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-4)' },

  // Add note form
  addNoteForm: { borderTop: '1px solid var(--border)', padding: '12px 20px', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 },
  addNoteHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  addNoteTitle: { fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: '600', color: 'var(--ink)' },
  colorPicker: { display: 'flex', gap: '6px', alignItems: 'center' },
  colorDot: { width: '18px', height: '18px', borderRadius: '50%', cursor: 'pointer', transition: 'transform 0.15s' },
  noteSelectionPreview: { fontFamily: 'var(--font-body)', fontSize: '11px', fontStyle: 'italic', color: 'var(--ink-3)', borderLeft: '2px solid var(--accent)', paddingLeft: '8px', lineHeight: 1.4 },
  addNoteFooter: { display: 'flex', justifyContent: 'flex-end', gap: '8px' },
  cancelBtn: { background: 'none', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--ink-3)', padding: '5px 12px', borderRadius: '6px' },
  saveBtn: { background: 'var(--accent)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'white', padding: '5px 12px', borderRadius: '6px', fontWeight: '500' },

  // Sidebar
  sidebar: { position: 'absolute', top: 0, left: 0, bottom: 0, width: '280px', background: 'var(--bg-alt)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', zIndex: 50, boxShadow: '4px 0 20px var(--shadow)' },
  sidebarHeader: { padding: '12px 12px 0', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  sidebarTabs: { display: 'flex', gap: '2px', marginBottom: '-1px' },
  sidebarTab: { flex: 1, background: 'none', border: '1px solid transparent', borderBottom: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--ink-3)', padding: '8px 6px', borderRadius: '4px 4px 0 0', transition: 'all 0.15s' },
  sidebarTabActive: { background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--ink)', fontWeight: '600' },
  sidebarClose: { position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: '14px', padding: '4px' },
  sidebarContent: { flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' },
  sidebarEmpty: { fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-4)', textAlign: 'center', padding: '32px 16px', lineHeight: 1.6 },
  sidebarItem: { display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer', transition: 'border-color 0.15s' },
  sidebarItemLeft: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
  sidebarItemPage: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', letterSpacing: '0.05em' },
  sidebarItemLabel: { fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--ink)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sidebarItemSnippet: { fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--ink-4)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sidebarEditInput: { fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--ink)', background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: '3px', padding: '2px 6px', width: '100%' },
  sidebarItemDel: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: '12px', flexShrink: 0, padding: '2px', lineHeight: 1 },

  // Bottom hint
  bottomHint: { padding: '5px 16px', borderTop: '1px solid var(--border-light)', background: 'var(--bg-alt)', flexShrink: 0, display: 'flex', justifyContent: 'center' },
  hintText: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-4)', letterSpacing: '0.04em' },
}