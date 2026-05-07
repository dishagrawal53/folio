import React, { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../lib/api.js'
import { useStore } from '../lib/store.js'

const FOLDER_COLORS = ['#b5451b','#1a56db','#2d6a4f','#7c3aed','#b45309','#be185d','#0f766e','#0369a1']
const FOLDER_ICONS  = ['📚','📁','🗂','📖','🔬','💡','🧪','📐','🌍','🎓','✏️','🔭']

// ── File store (IndexedDB-backed, per folder) ────────────────────
// We persist file metadata + base64 in localStorage keyed by folder
function getStoredFiles() {
  try { return JSON.parse(localStorage.getItem('folio_folder_files') || '{}') }
  catch { return {} }
}
function setStoredFiles(data) {
  localStorage.setItem('folio_folder_files', JSON.stringify(data))
}

// ── Bookmark Card ────────────────────────────────────────────────
function BookmarkCard({ bookmark, onGoTo, onDelete, onEdit, onFolderAssign, folders }) {
  const [hovered, setHovered] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const folderName = folders.find(f => f._id === bookmark.folderId)?.name

  return (
    <div
      style={{
        ...bcs.card,
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 8px 24px var(--shadow-lg)' : '0 2px 8px var(--shadow)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowMenu(false) }}
    >
      <div style={bcs.ribbon}>
        <div style={bcs.ribbonBody} />
        <div style={bcs.ribbonTip} />
      </div>
      <div style={bcs.pageBadge} onClick={() => onGoTo(bookmark.page)}>
        <span style={bcs.pageNum}>p.{bookmark.page}</span>
      </div>
      <div style={bcs.content} onClick={() => onGoTo(bookmark.page)}>
        <p style={bcs.label}>{bookmark.label}</p>
        {bookmark.snippet && (
          <p style={bcs.snippet}>"{bookmark.snippet.slice(0, 80)}{bookmark.snippet.length > 80 ? '…' : ''}"</p>
        )}
        {folderName && <span style={bcs.folderTag}>📁 {folderName}</span>}
      </div>
      <div style={{ ...bcs.actions, opacity: hovered ? 1 : 0 }}>
        <button onClick={() => onEdit(bookmark)} style={bcs.actionBtn} title="Edit label">✏️</button>
        <button onClick={() => setShowMenu(!showMenu)} style={bcs.actionBtn} title="Move to folder">📁</button>
        <button onClick={() => onDelete(bookmark._id)} style={{ ...bcs.actionBtn, color: '#c0392b' }} title="Delete">✕</button>
      </div>
      {showMenu && (
        <div style={bcs.dropdown}>
          <p style={bcs.dropdownTitle}>Move to folder</p>
          {folders.map(f => (
            <button key={f._id} onClick={() => { onFolderAssign(bookmark._id, f._id); setShowMenu(false) }}
              style={{ ...bcs.dropdownItem, color: f.color }}>
              {f.icon} {f.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── File Card ────────────────────────────────────────────────────
function FileCard({ file, onOpen, onDelete, onMove, folders }) {
  const [hovered, setHovered] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const sizeMb = (file.size / 1024 / 1024).toFixed(1)
  const addedDate = new Date(file.addedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <div
      style={{
        ...fc.card,
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 8px 24px var(--shadow-lg)' : '0 2px 8px var(--shadow)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowMenu(false) }}
    >
      {/* PDF icon */}
      <div style={fc.iconWrap}>
        <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
          <path d="M2 2C2 1.4 2.4 1 3 1H19L27 9V34C27 34.6 26.6 35 26 35H3C2.4 35 2 34.6 2 34V2Z"
            fill="var(--bg)" stroke="var(--accent)" strokeWidth="1.2"/>
          <path d="M19 1V9H27" stroke="var(--accent)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <text x="14" y="24" textAnchor="middle" fontSize="7" fontWeight="700"
            fontFamily="var(--font-mono)" fill="var(--accent)">PDF</text>
        </svg>
      </div>

      {/* Info */}
      <div style={fc.info} onClick={() => onOpen(file)}>
        <p style={fc.fileName} title={file.name}>
          {file.name.length > 24 ? file.name.slice(0, 22) + '…' : file.name}
        </p>
        <p style={fc.fileMeta}>{sizeMb} MB · {addedDate}</p>
        {file.lastPage && (
          <div style={fc.progressRow}>
            <div style={fc.progressBar}>
              <div style={{ ...fc.progressFill, width: `${Math.min(100, (file.lastPage / (file.totalPages || 1)) * 100)}%` }} />
            </div>
            <span style={fc.progressLabel}>p.{file.lastPage}{file.totalPages ? `/${file.totalPages}` : ''}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ ...fc.actions, opacity: hovered ? 1 : 0 }}>
        <button onClick={() => onOpen(file)} style={fc.openBtn} title="Open PDF">Open →</button>
        <button onClick={() => setShowMenu(v => !v)} style={fc.actionBtn} title="Move to folder">📁</button>
        <button onClick={() => onDelete(file.id)} style={{ ...fc.actionBtn, color: '#c0392b' }} title="Remove">✕</button>
      </div>

      {/* Move to folder dropdown */}
      {showMenu && (
        <div style={fc.dropdown}>
          <p style={fc.dropdownTitle}>Move to folder</p>
          {folders.map(f => (
            <button key={f._id} onClick={() => { onMove(file.id, f._id); setShowMenu(false) }}
              style={{ ...fc.dropdownItem, color: f.color }}>
              {f.icon} {f.name}
            </button>
          ))}
          <button onClick={() => { onMove(file.id, null); setShowMenu(false) }}
            style={{ ...fc.dropdownItem, color: 'var(--ink-3)' }}>
            🔖 Unfiled
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main FolderManager ───────────────────────────────────────────
export default function FolderManager({ onClose, onGoToPage, pdfName, onOpenFile }) {
  const setPdf = useStore(s => s.setPdf)

  const [folders, setFolders] = useState([])
  const [bookmarks, setBookmarks] = useState([])
  const [activeFolder, setActiveFolder] = useState('files') // 'files' | 'bookmarks' | folder._id
  const [creating, setCreating] = useState(false)
  const [newFolder, setNewFolder] = useState({ name: '', color: FOLDER_COLORS[0], icon: FOLDER_ICONS[0] })
  const [editingBookmark, setEditingBookmark] = useState(null)
  const [loading, setLoading] = useState(true)
  const [folderFiles, setFolderFiles] = useState({}) // { fileId: { ...file, folderId } }
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)

  // Load folders & bookmarks from backend, files from localStorage
  const load = useCallback(async () => {
    try {
      const [fd, bd] = await Promise.all([
        api.folders.list(),
        pdfName ? api.bookmarks.list(pdfName) : Promise.resolve({ bookmarks: [] }),
      ])
      setFolders(fd.folders || [])
      setBookmarks(bd.bookmarks || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
    // Load files from localStorage
    setFolderFiles(getStoredFiles())
  }, [pdfName])

  useEffect(() => { load() }, [load])

  // ── File operations ──────────────────────────────────────────

  const addFilesToFolder = useCallback((files, targetFolderId = null) => {
    const stored = getStoredFiles()
    Array.from(files).forEach(file => {
      if (file.type !== 'application/pdf') return
      const id = `${file.name}-${file.size}-${Date.now()}`
      stored[id] = {
        id,
        name: file.name,
        size: file.size,
        folderId: targetFolderId,
        addedAt: Date.now(),
        lastPage: null,
        totalPages: null,
        // Store the file object URL for opening
        // Note: object URLs are session-only; we store the file as base64 for persistence
        fileKey: id,
      }
      // Store file data in sessionStorage (for opening in same session)
      // For a real app you'd use IndexedDB; this keeps things simple
      const reader = new FileReader()
      reader.onload = (e) => {
        sessionStorage.setItem(`folio_file_${id}`, e.target.result)
      }
      reader.readAsDataURL(file)
    })
    setStoredFiles(stored)
    setFolderFiles({ ...stored })
  }, [])

  const deleteFile = useCallback((id) => {
    const stored = getStoredFiles()
    delete stored[id]
    sessionStorage.removeItem(`folio_file_${id}`)
    setStoredFiles(stored)
    setFolderFiles({ ...stored })
  }, [])

  const moveFile = useCallback((fileId, folderId) => {
    const stored = getStoredFiles()
    if (stored[fileId]) {
      stored[fileId].folderId = folderId
      setStoredFiles(stored)
      setFolderFiles({ ...stored })
    }
  }, [])

  const openFile = useCallback(async (fileEntry) => {
    const dataUrl = sessionStorage.getItem(`folio_file_${fileEntry.id}`)
    if (!dataUrl) {
      alert('File not available in this session. Please re-add the PDF.')
      return
    }
    // Convert dataURL back to File object
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const file = new File([blob], fileEntry.name, { type: 'application/pdf' })
    setPdf(file, fileEntry.name)
    onClose()
  }, [setPdf, onClose])

  // ── Drag-and-drop onto the panel ────────────────────────────

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const activeFolderId = activeFolder !== 'files' && activeFolder !== 'bookmarks' ? activeFolder : null
    addFilesToFolder(e.dataTransfer.files, activeFolderId)
  }, [activeFolder, addFilesToFolder])

  const handleFileInput = useCallback((e) => {
    const activeFolderId = activeFolder !== 'files' && activeFolder !== 'bookmarks' ? activeFolder : null
    addFilesToFolder(e.target.files, activeFolderId)
    e.target.value = ''
  }, [activeFolder, addFilesToFolder])

  // ── Folder operations ────────────────────────────────────────

  const createFolder = async () => {
    if (!newFolder.name.trim()) return
    await api.folders.create(newFolder)
    setNewFolder({ name: '', color: FOLDER_COLORS[0], icon: FOLDER_ICONS[0] })
    setCreating(false)
    load()
  }

  const deleteFolder = async (id) => {
    // Move files from deleted folder to unfiled
    const stored = getStoredFiles()
    Object.values(stored).forEach(f => {
      if (f.folderId === id) f.folderId = null
    })
    setStoredFiles(stored)
    setFolderFiles({ ...stored })

    await api.folders.delete(id)
    if (activeFolder === id) setActiveFolder('files')
    load()
  }

  const deleteBookmark = async (id) => {
    await api.bookmarks.delete(id)
    setBookmarks(prev => prev.filter(b => b._id !== id))
  }

  const assignBookmarkFolder = async (bookmarkId, folderId) => {
    await api.bookmarks.update(bookmarkId, { folderId })
    setBookmarks(prev => prev.map(b => b._id === bookmarkId ? { ...b, folderId } : b))
  }

  const saveBookmarkLabel = async () => {
    if (!editingBookmark) return
    await api.bookmarks.update(editingBookmark._id, { label: editingBookmark.label })
    setBookmarks(prev => prev.map(b => b._id === editingBookmark._id ? editingBookmark : b))
    setEditingBookmark(null)
  }

  // ── Derived lists ────────────────────────────────────────────

  const allFiles = Object.values(folderFiles)
  const isFileView = activeFolder === 'files'
  const isBookmarkView = activeFolder === 'bookmarks'
  const isFolderView = !isFileView && !isBookmarkView

  const visibleFiles = isFileView
    ? allFiles
    : isFolderView
      ? allFiles.filter(f => f.folderId === activeFolder)
      : []

  const visibleBookmarks = isBookmarkView
    ? bookmarks
    : isFolderView
      ? bookmarks.filter(b => b.folderId === activeFolder)
      : []

  const folderFileCount = (folderId) => allFiles.filter(f => f.folderId === folderId).length
  const folderBookmarkCount = (folderId) => bookmarks.filter(b => b.folderId === folderId).length

  return (
    <div
      style={fs.panel}
      className="anim-slide-left"
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragging && (
        <div style={fs.dragOverlay}>
          <div style={fs.dragOverlayInner}>
            <span style={{ fontSize: '32px' }}>📄</span>
            <p style={fs.dragOverlayText}>Drop PDFs here</p>
            {isFolderView && (
              <p style={fs.dragOverlaySubtext}>
                Adding to "{folders.find(f => f._id === activeFolder)?.name}"
              </p>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={fs.header}>
        <div>
          <p style={fs.headerLabel}>LIBRARY</p>
          <p style={fs.headerTitle}>Folders & Files</p>
        </div>
        <button onClick={onClose} style={fs.closeBtn}>✕</button>
      </div>

      {/* Folder list */}
      <div style={fs.folderSection}>
        <div style={fs.sectionRow}>
          <p style={fs.sectionLabel}>FOLDERS</p>
          <button onClick={() => setCreating(!creating)} style={fs.addFolderBtn}>+ New</button>
        </div>

        {creating && (
          <div style={fs.createForm}>
            <input
              autoFocus
              placeholder="Folder name…"
              value={newFolder.name}
              onChange={e => setNewFolder(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') createFolder() }}
              style={fs.folderInput}
            />
            <div style={fs.colorRow}>
              {FOLDER_COLORS.map(c => (
                <button key={c} onClick={() => setNewFolder(f => ({ ...f, color: c }))} style={{
                  ...fs.colorDot, background: c,
                  transform: newFolder.color === c ? 'scale(1.35)' : 'scale(1)',
                  outline: newFolder.color === c ? `2px solid ${c}` : 'none',
                  outlineOffset: '2px',
                }} />
              ))}
            </div>
            <div style={fs.iconRow}>
              {FOLDER_ICONS.slice(0, 8).map(ic => (
                <button key={ic} onClick={() => setNewFolder(f => ({ ...f, icon: ic }))} style={{
                  ...fs.iconBtn,
                  background: newFolder.icon === ic ? 'var(--accent-bg)' : 'transparent',
                  borderColor: newFolder.icon === ic ? 'var(--accent)' : 'var(--border)',
                }}>
                  {ic}
                </button>
              ))}
            </div>
            <div style={fs.createBtns}>
              <button onClick={() => setCreating(false)} style={fs.cancelBtn}>Cancel</button>
              <button onClick={createFolder} style={fs.saveBtn}>Create</button>
            </div>
          </div>
        )}

        <div style={fs.folderList}>
          {/* All Files */}
          <button onClick={() => setActiveFolder('files')}
            style={{ ...fs.folderItem, ...(activeFolder === 'files' ? fs.folderActive : {}) }}>
            <span>📄</span>
            <span style={fs.folderName}>All PDFs</span>
            <span style={fs.folderCount}>{allFiles.length}</span>
          </button>

          {/* All Bookmarks */}
          <button onClick={() => setActiveFolder('bookmarks')}
            style={{ ...fs.folderItem, ...(activeFolder === 'bookmarks' ? fs.folderActive : {}) }}>
            <span>🔖</span>
            <span style={fs.folderName}>All Bookmarks</span>
            <span style={fs.folderCount}>{bookmarks.length}</span>
          </button>

          {/* User folders */}
          {folders.map(folder => (
            <div key={folder._id} style={fs.folderRow}>
              <button onClick={() => setActiveFolder(folder._id)}
                style={{
                  ...fs.folderItem,
                  ...(activeFolder === folder._id ? { ...fs.folderActive, borderColor: folder.color } : {})
                }}>
                <span>{folder.icon}</span>
                <span style={{ ...fs.folderName, color: activeFolder === folder._id ? folder.color : 'inherit' }}>
                  {folder.name}
                </span>
                <span style={fs.folderCount}>
                  {folderFileCount(folder._id) + folderBookmarkCount(folder._id)}
                </span>
              </button>
              {!folder.isDefault && (
                <button onClick={() => deleteFolder(folder._id)} style={fs.folderDel} title="Delete folder">✕</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={fs.divider} />

      {/* Content area */}
      <div style={fs.contentSection}>

        {/* Section header */}
        <div style={fs.contentHeader}>
          <p style={fs.sectionLabel}>
            {isFileView ? 'ALL PDFs' : isBookmarkView ? 'BOOKMARKS' : folders.find(f => f._id === activeFolder)?.name?.toUpperCase()}
            <span style={fs.countBadge}>{isBookmarkView ? visibleBookmarks.length : visibleFiles.length + visibleBookmarks.length}</span>
          </p>

          {/* Add file button */}
          {!isBookmarkView && (
            <button onClick={() => fileInputRef.current?.click()} style={fs.addFileBtn} title="Add PDF files">
              + Add PDF
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
        </div>

        {/* Drop hint when empty */}
        {loading ? (
          <div style={fs.loadingWrap}><div style={fs.spinner} /></div>
        ) : (
          <div style={fs.scrollArea}>

            {/* Files section */}
            {!isBookmarkView && (
              <>
                {visibleFiles.length === 0 ? (
                  <div style={fs.emptyZone} onClick={() => fileInputRef.current?.click()}>
                    <span style={{ fontSize: '28px' }}>📂</span>
                    <p style={fs.emptyTitle}>
                      {isFolderView ? 'No PDFs in this folder' : 'No PDFs yet'}
                    </p>
                    <p style={fs.emptyHint}>Click or drag PDFs here to add them</p>
                  </div>
                ) : (
                  <div style={fs.fileGrid}>
                    {visibleFiles.map(file => (
                      <FileCard
                        key={file.id}
                        file={file}
                        folders={folders}
                        onOpen={openFile}
                        onDelete={deleteFile}
                        onMove={moveFile}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Bookmarks section (shown in bookmark view OR folder view) */}
            {(isBookmarkView || isFolderView) && visibleBookmarks.length > 0 && (
              <>
                {isFolderView && <p style={fs.subSectionLabel}>BOOKMARKS</p>}
                <div style={fs.bookmarkGrid}>
                  {visibleBookmarks.map(b => (
                    <BookmarkCard
                      key={b._id}
                      bookmark={b}
                      folders={folders}
                      onGoTo={onGoToPage}
                      onDelete={deleteBookmark}
                      onEdit={setEditingBookmark}
                      onFolderAssign={assignBookmarkFolder}
                    />
                  ))}
                </div>
              </>
            )}

            {isBookmarkView && visibleBookmarks.length === 0 && (
              <div style={fs.emptyZone}>
                <span style={{ fontSize: '28px' }}>🔖</span>
                <p style={fs.emptyTitle}>No bookmarks yet</p>
                <p style={fs.emptyHint}>Dog-ear a page corner or click 🔖 while reading</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit bookmark label modal */}
      {editingBookmark && (
        <div style={fs.modal}>
          <div style={fs.modalCard}>
            <p style={fs.modalTitle}>Edit bookmark label</p>
            <input
              autoFocus
              value={editingBookmark.label}
              onChange={e => setEditingBookmark(b => ({ ...b, label: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') saveBookmarkLabel() }}
              style={fs.folderInput}
            />
            <div style={fs.createBtns}>
              <button onClick={() => setEditingBookmark(null)} style={fs.cancelBtn}>Cancel</button>
              <button onClick={saveBookmarkLabel} style={fs.saveBtn}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Styles: Bookmark card ────────────────────────────────────────
const bcs = {
  card: { position: 'relative', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '14px 14px 10px', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', overflow: 'hidden', minHeight: '80px' },
  ribbon: { position: 'absolute', top: 0, right: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 },
  ribbonBody: { width: '14px', height: '22px', background: 'var(--accent)' },
  ribbonTip: { width: 0, height: 0, borderLeft: '7px solid var(--accent)', borderRight: '7px solid var(--accent)', borderBottom: '6px solid transparent' },
  pageBadge: { position: 'absolute', top: '8px', left: '10px', background: 'var(--accent-bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '1px 6px' },
  pageNum: { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent)', letterSpacing: '0.06em', fontWeight: '600' },
  content: { marginTop: '22px', display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: '600', color: 'var(--ink)', lineHeight: 1.3 },
  snippet: { fontFamily: 'var(--font-body)', fontSize: '11px', fontStyle: 'italic', color: 'var(--ink-3)', lineHeight: 1.4 },
  folderTag: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-4)', marginTop: '2px' },
  actions: { position: 'absolute', bottom: '8px', right: '8px', display: 'flex', gap: '4px', transition: 'opacity 0.15s' },
  actionBtn: { background: 'var(--tag-bg)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', fontSize: '11px', color: 'var(--ink-3)' },
  dropdown: { position: 'absolute', bottom: '36px', right: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px', boxShadow: '0 4px 16px var(--shadow-lg)', zIndex: 50, minWidth: '140px' },
  dropdownTitle: { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--ink-4)', letterSpacing: '0.1em', padding: '2px 6px 6px', textTransform: 'uppercase' },
  dropdownItem: { display: 'flex', gap: '6px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 8px', borderRadius: '4px', fontFamily: 'var(--font-ui)', fontSize: '12px', textAlign: 'left' },
}

// ── Styles: File card ────────────────────────────────────────────
const fc = {
  card: { position: 'relative', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start', transition: 'transform 0.2s, box-shadow 0.2s', overflow: 'hidden' },
  iconWrap: { flexShrink: 0, paddingTop: '2px' },
  info: { flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', cursor: 'pointer', minWidth: 0 },
  fileName: { fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: '600', color: 'var(--ink)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fileMeta: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-4)', letterSpacing: '0.04em' },
  progressRow: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' },
  progressBar: { flex: 1, height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' },
  progressFill: { height: '100%', background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.3s' },
  progressLabel: { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent)', flexShrink: 0 },
  actions: { position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px', transition: 'opacity 0.15s', alignItems: 'center' },
  openBtn: { background: 'var(--accent)', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '3px 8px', fontSize: '11px', color: 'white', fontFamily: 'var(--font-ui)', fontWeight: '600' },
  actionBtn: { background: 'var(--tag-bg)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', fontSize: '11px', color: 'var(--ink-3)' },
  dropdown: { position: 'absolute', top: '36px', right: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px', boxShadow: '0 4px 16px var(--shadow-lg)', zIndex: 50, minWidth: '150px' },
  dropdownTitle: { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--ink-4)', letterSpacing: '0.1em', padding: '2px 6px 6px', textTransform: 'uppercase' },
  dropdownItem: { display: 'flex', gap: '6px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 8px', borderRadius: '4px', fontFamily: 'var(--font-ui)', fontSize: '12px', textAlign: 'left' },
}

// ── Styles: Panel ────────────────────────────────────────────────
const fs = {
  panel: { width: '340px', height: '100vh', background: 'var(--bg-alt)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', zIndex: 50, overflow: 'hidden', position: 'relative' },
  dragOverlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' },
  dragOverlayInner: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', background: 'var(--bg-card)', border: '2px dashed var(--accent)', borderRadius: '12px', padding: '32px 40px' },
  dragOverlayText: { fontFamily: 'var(--font-display)', fontSize: '18px', fontStyle: 'italic', color: 'var(--ink)', fontWeight: '600' },
  dragOverlaySubtext: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' },
  header: { padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 },
  headerLabel: { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--ink-4)', letterSpacing: '0.15em', marginBottom: '2px' },
  headerTitle: { fontFamily: 'var(--font-display)', fontSize: '16px', fontStyle: 'italic', color: 'var(--ink)' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: '14px', padding: '4px' },
  folderSection: { padding: '12px', flexShrink: 0 },
  sectionRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  sectionLabel: { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--ink-4)', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: '6px' },
  countBadge: { background: 'var(--accent-bg)', color: 'var(--accent)', borderRadius: '10px', padding: '1px 6px', fontSize: '10px', fontWeight: '600' },
  addFolderBtn: { background: 'none', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-3)', padding: '2px 8px' },
  createForm: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '8px' },
  folderInput: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '7px 10px', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', outline: 'none', width: '100%' },
  colorRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  colorDot: { width: '16px', height: '16px', borderRadius: '50%', border: 'none', cursor: 'pointer', transition: 'transform 0.15s' },
  iconRow: { display: 'flex', gap: '4px', flexWrap: 'wrap' },
  iconBtn: { border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', padding: '3px 5px', fontSize: '14px', lineHeight: 1, background: 'transparent', transition: 'all 0.15s' },
  createBtns: { display: 'flex', justifyContent: 'flex-end', gap: '6px' },
  cancelBtn: { background: 'none', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--ink-3)', padding: '4px 10px', borderRadius: '4px' },
  saveBtn: { background: 'var(--accent)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'white', padding: '4px 12px', borderRadius: '4px', fontWeight: '600' },
  folderList: { display: 'flex', flexDirection: 'column', gap: '2px' },
  folderRow: { display: 'flex', alignItems: 'center', gap: '2px' },
  folderItem: { flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: 'transparent', border: '1px solid transparent', borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)', textAlign: 'left', transition: 'all 0.15s' },
  folderActive: { background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--ink)', fontWeight: '600' },
  folderName: { flex: 1 },
  folderCount: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-4)', background: 'var(--tag-bg)', borderRadius: '10px', padding: '1px 6px' },
  folderDel: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: '11px', padding: '4px', flexShrink: 0 },
  divider: { height: '1px', background: 'var(--border)', flexShrink: 0 },
  contentSection: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  contentHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 6px', flexShrink: 0 },
  addFileBtn: { background: 'var(--accent)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'white', padding: '3px 10px', fontWeight: '600' },
  scrollArea: { flex: 1, overflowY: 'auto', padding: '8px 12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' },
  subSectionLabel: { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--ink-4)', letterSpacing: '0.15em', marginTop: '4px' },
  fileGrid: { display: 'flex', flexDirection: 'column', gap: '6px' },
  bookmarkGrid: { display: 'flex', flexDirection: 'column', gap: '6px' },
  emptyZone: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '32px 12px', border: '2px dashed var(--border)', borderRadius: '8px', cursor: 'pointer', transition: 'border-color 0.2s', textAlign: 'center' },
  emptyTitle: { fontFamily: 'var(--font-display)', fontSize: '14px', fontStyle: 'italic', color: 'var(--ink-2)' },
  emptyHint: { fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--ink-4)', lineHeight: 1.5 },
  loadingWrap: { display: 'flex', justifyContent: 'center', padding: '24px' },
  spinner: { width: '20px', height: '20px', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
  modal: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modalCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px', width: '260px', display: 'flex', flexDirection: 'column', gap: '12px' },
  modalTitle: { fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: '600', color: 'var(--ink)' },
}