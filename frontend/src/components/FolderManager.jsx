import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api.js'

const FOLDER_COLORS = ['#b5451b','#1a56db','#2d6a4f','#7c3aed','#b45309','#be185d','#0f766e']
const FOLDER_ICONS  = ['📚','📁','🗂','📖','🔬','💡','🧪','📐','🌍','🎓','✏️','🔭']

// ─── Creative Bookmark Card ────────────────────────────────────
export function BookmarkCard({ bookmark, onGoTo, onDelete, onEdit, onFolderAssign, folders }) {
  const [hovered, setHovered] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const percent = bookmark.percentRead || 0
  const folderName = folders.find(f => f._id === bookmark.folderId)?.name

  return (
    <div
      style={{
        ...bcs.card,
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered
          ? '0 8px 24px var(--shadow-lg)'
          : '0 2px 8px var(--shadow)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowMenu(false) }}
    >
      {/* Bookmark ribbon */}
      <div style={bcs.ribbon}>
        <div style={bcs.ribbonBody} />
        <div style={bcs.ribbonTip} />
      </div>

      {/* Page badge */}
      <div style={bcs.pageBadge} onClick={() => onGoTo(bookmark.page)}>
        <span style={bcs.pageNum}>p.{bookmark.page}</span>
      </div>

      {/* Content */}
      <div style={bcs.content} onClick={() => onGoTo(bookmark.page)}>
        <p style={bcs.label}>{bookmark.label}</p>
        {bookmark.snippet && (
          <p style={bcs.snippet}>"{bookmark.snippet.slice(0, 80)}{bookmark.snippet.length > 80 ? '…' : ''}"</p>
        )}
        {folderName && (
          <span style={bcs.folderTag}>📁 {folderName}</span>
        )}
      </div>

      {/* Progress bar */}
      {percent > 0 && (
        <div style={bcs.progressBar}>
          <div style={{ ...bcs.progressFill, width: `${percent}%` }} />
        </div>
      )}

      {/* Actions */}
      <div style={{ ...bcs.actions, opacity: hovered ? 1 : 0 }}>
        <button onClick={() => onEdit(bookmark)} style={bcs.actionBtn} title="Edit label">✏️</button>
        <button onClick={() => setShowMenu(!showMenu)} style={bcs.actionBtn} title="Move to folder">📁</button>
        <button onClick={() => onDelete(bookmark._id)} style={{ ...bcs.actionBtn, color: '#c0392b' }} title="Delete">✕</button>
      </div>

      {/* Folder dropdown */}
      {showMenu && (
        <div style={bcs.dropdown}>
          <p style={bcs.dropdownTitle}>Move to folder</p>
          {folders.map(f => (
            <button
              key={f._id}
              onClick={() => { onFolderAssign(bookmark._id, f._id); setShowMenu(false) }}
              style={{ ...bcs.dropdownItem, color: f.color }}
            >
              {f.icon} {f.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Folder Panel ──────────────────────────────────────────────
export default function FolderManager({ onClose, onGoToPage, pdfName }) {
  const [folders, setFolders] = useState([])
  const [bookmarks, setBookmarks] = useState([])
  const [activeFolder, setActiveFolder] = useState('all')
  const [creating, setCreating] = useState(false)
  const [newFolder, setNewFolder] = useState({ name: '', color: FOLDER_COLORS[0], icon: FOLDER_ICONS[0] })
  const [editingBookmark, setEditingBookmark] = useState(null)
  const [loading, setLoading] = useState(true)

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
  }, [pdfName])

  useEffect(() => { load() }, [load])

  const createFolder = async () => {
    if (!newFolder.name.trim()) return
    await api.folders.create(newFolder)
    setNewFolder({ name: '', color: FOLDER_COLORS[0], icon: FOLDER_ICONS[0] })
    setCreating(false)
    load()
  }

  const deleteFolder = async (id) => {
    await api.folders.delete(id)
    load()
  }

  const deleteBookmark = async (id) => {
    await api.bookmarks.delete(id)
    setBookmarks(prev => prev.filter(b => b._id !== id))
  }

  const assignFolder = async (bookmarkId, folderId) => {
    await api.bookmarks.update(bookmarkId, { folderId })
    setBookmarks(prev => prev.map(b => b._id === bookmarkId ? { ...b, folderId } : b))
  }

  const saveBookmarkLabel = async () => {
    if (!editingBookmark) return
    await api.bookmarks.update(editingBookmark._id, { label: editingBookmark.label })
    setBookmarks(prev => prev.map(b => b._id === editingBookmark._id ? editingBookmark : b))
    setEditingBookmark(null)
  }

  const filteredBookmarks = activeFolder === 'all'
    ? bookmarks
    : bookmarks.filter(b => b.folderId === activeFolder)

  return (
    <div style={fs.panel} className="anim-slide-left">
      {/* Header */}
      <div style={fs.header}>
        <div>
          <p style={fs.headerLabel}>LIBRARY</p>
          <p style={fs.headerTitle}>Folders & Bookmarks</p>
        </div>
        <button onClick={onClose} style={fs.closeBtn}>✕</button>
      </div>

      {/* Folder list */}
      <div style={fs.folderSection}>
        <div style={fs.sectionRow}>
          <p style={fs.sectionLabel}>FOLDERS</p>
          <button onClick={() => setCreating(!creating)} style={fs.addFolderBtn}>+ New</button>
        </div>

        {/* Create folder form */}
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
                  ...fs.colorDot,
                  background: c,
                  transform: newFolder.color === c ? 'scale(1.3)' : 'scale(1)',
                  outline: newFolder.color === c ? `2px solid ${c}` : 'none',
                  outlineOffset: '2px',
                }} />
              ))}
            </div>
            <div style={fs.iconRow}>
              {FOLDER_ICONS.slice(0, 6).map(ic => (
                <button key={ic} onClick={() => setNewFolder(f => ({ ...f, icon: ic }))} style={{
                  ...fs.iconBtn,
                  background: newFolder.icon === ic ? 'var(--accent-bg)' : 'transparent',
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
          {/* All bookmarks */}
          <button
            onClick={() => setActiveFolder('all')}
            style={{ ...fs.folderItem, ...(activeFolder === 'all' ? fs.folderActive : {}) }}
          >
            <span>🔖</span>
            <span style={fs.folderName}>All Bookmarks</span>
            <span style={fs.folderCount}>{bookmarks.length}</span>
          </button>

          {folders.map(folder => (
            <div key={folder._id} style={fs.folderRow}>
              <button
                onClick={() => setActiveFolder(folder._id)}
                style={{ ...fs.folderItem, ...(activeFolder === folder._id ? { ...fs.folderActive, borderColor: folder.color } : {}) }}
              >
                <span>{folder.icon}</span>
                <span style={{ ...fs.folderName, color: activeFolder === folder._id ? folder.color : 'inherit' }}>
                  {folder.name}
                </span>
                <span style={fs.folderCount}>
                  {bookmarks.filter(b => b.folderId === folder._id).length}
                </span>
              </button>
              {!folder.isDefault && (
                <button onClick={() => deleteFolder(folder._id)} style={fs.folderDel}>✕</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={fs.divider} />

      {/* Bookmarks grid */}
      <div style={fs.bookmarksSection}>
        <p style={fs.sectionLabel}>
          {activeFolder === 'all' ? 'ALL BOOKMARKS' : folders.find(f => f._id === activeFolder)?.name?.toUpperCase()}
          <span style={fs.countBadge}>{filteredBookmarks.length}</span>
        </p>

        {loading ? (
          <div style={fs.loadingWrap}><div style={fs.spinner} /></div>
        ) : filteredBookmarks.length === 0 ? (
          <p style={fs.empty}>
            {bookmarks.length === 0
              ? 'No bookmarks yet. Click 🔖 or dog-ear a page corner.'
              : 'No bookmarks in this folder yet.'}
          </p>
        ) : (
          <div style={fs.bookmarkGrid}>
            {filteredBookmarks.map(b => (
              <BookmarkCard
                key={b._id}
                bookmark={b}
                folders={folders}
                onGoTo={onGoToPage}
                onDelete={deleteBookmark}
                onEdit={setEditingBookmark}
                onFolderAssign={assignFolder}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit label modal */}
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

// ─── Bookmark card styles ──────────────────────────────────────
const bcs = {
  card: {
    position: 'relative',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-light)',
    borderRadius: '6px',
    padding: '14px 14px 10px',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    overflow: 'hidden',
    minHeight: '90px',
  },
  ribbon: {
    position: 'absolute',
    top: 0,
    right: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 2,
  },
  ribbonBody: {
    width: '14px',
    height: '22px',
    background: 'var(--accent)',
    borderRadius: '0 0 0 0',
  },
  ribbonTip: {
    width: 0,
    height: 0,
    borderLeft: '7px solid var(--accent)',
    borderRight: '7px solid var(--accent)',
    borderBottom: '6px solid transparent',
  },
  pageBadge: {
    position: 'absolute',
    top: '8px',
    left: '10px',
    background: 'var(--accent-bg)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '1px 6px',
  },
  pageNum: {
    fontFamily: 'var(--font-mono)',
    fontSize: '9px',
    color: 'var(--accent)',
    letterSpacing: '0.06em',
    fontWeight: '600',
  },
  content: {
    marginTop: '22px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--ink)',
    lineHeight: 1.3,
  },
  snippet: {
    fontFamily: 'var(--font-body)',
    fontSize: '11px',
    fontStyle: 'italic',
    color: 'var(--ink-3)',
    lineHeight: 1.4,
  },
  folderTag: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--ink-4)',
    marginTop: '2px',
  },
  progressBar: {
    marginTop: '8px',
    height: '2px',
    background: 'var(--border)',
    borderRadius: '1px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'var(--accent)',
    borderRadius: '1px',
  },
  actions: {
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    display: 'flex',
    gap: '4px',
    transition: 'opacity 0.15s',
  },
  actionBtn: {
    background: 'var(--tag-bg)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    cursor: 'pointer',
    padding: '2px 6px',
    fontSize: '11px',
    color: 'var(--ink-3)',
  },
  dropdown: {
    position: 'absolute',
    bottom: '36px',
    right: '8px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '6px',
    boxShadow: '0 4px 16px var(--shadow-lg)',
    zIndex: 50,
    minWidth: '140px',
  },
  dropdownTitle: {
    fontFamily: 'var(--font-mono)',
    fontSize: '9px',
    color: 'var(--ink-4)',
    letterSpacing: '0.1em',
    padding: '2px 6px 6px',
    textTransform: 'uppercase',
  },
  dropdownItem: {
    display: 'flex',
    gap: '6px',
    width: '100%',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '5px 8px',
    borderRadius: '4px',
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    textAlign: 'left',
  },
}

// ─── Folder panel styles ───────────────────────────────────────
const fs = {
  panel: {
    width: '320px',
    height: '100vh',
    background: 'var(--bg-alt)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 50,
    overflow: 'hidden',
  },
  header: {
    padding: '16px 16px 12px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexShrink: 0,
  },
  headerLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: '9px',
    color: 'var(--ink-4)',
    letterSpacing: '0.15em',
    marginBottom: '2px',
  },
  headerTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '16px',
    fontStyle: 'italic',
    color: 'var(--ink)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--ink-4)',
    fontSize: '14px',
    padding: '4px',
  },
  folderSection: {
    padding: '12px',
    flexShrink: 0,
  },
  sectionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  sectionLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: '9px',
    color: 'var(--ink-4)',
    letterSpacing: '0.15em',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  countBadge: {
    background: 'var(--accent-bg)',
    color: 'var(--accent)',
    borderRadius: '10px',
    padding: '1px 6px',
    fontSize: '10px',
    fontWeight: '600',
  },
  addFolderBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--ink-3)',
    padding: '2px 8px',
  },
  createForm: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '10px',
    marginBottom: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  folderInput: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '7px 10px',
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    color: 'var(--ink)',
    outline: 'none',
    width: '100%',
  },
  colorRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  colorDot: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    transition: 'transform 0.15s',
  },
  iconRow: { display: 'flex', gap: '4px', flexWrap: 'wrap' },
  iconBtn: {
    border: '1px solid var(--border)',
    borderRadius: '4px',
    cursor: 'pointer',
    padding: '3px 5px',
    fontSize: '14px',
    lineHeight: 1,
  },
  createBtns: { display: 'flex', justifyContent: 'flex-end', gap: '6px' },
  cancelBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    color: 'var(--ink-3)',
    padding: '4px 10px',
    borderRadius: '4px',
  },
  saveBtn: {
    background: 'var(--accent)',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    color: 'white',
    padding: '4px 12px',
    borderRadius: '4px',
    fontWeight: '600',
  },
  folderList: { display: 'flex', flexDirection: 'column', gap: '3px' },
  folderRow: { display: 'flex', alignItems: 'center', gap: '2px' },
  folderItem: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 10px',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    color: 'var(--ink-2)',
    textAlign: 'left',
    transition: 'all 0.15s',
  },
  folderActive: {
    background: 'var(--bg-card)',
    borderColor: 'var(--border)',
    color: 'var(--ink)',
    fontWeight: '600',
  },
  folderName: { flex: 1 },
  folderCount: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--ink-4)',
    background: 'var(--tag-bg)',
    borderRadius: '10px',
    padding: '1px 6px',
  },
  folderDel: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--ink-4)',
    fontSize: '11px',
    padding: '4px',
    flexShrink: 0,
  },
  divider: { height: '1px', background: 'var(--border)', flexShrink: 0 },
  bookmarksSection: { flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
  loadingWrap: { display: 'flex', justifyContent: 'center', padding: '24px' },
  spinner: {
    width: '20px', height: '20px',
    border: '2px solid var(--border)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  empty: {
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    color: 'var(--ink-4)',
    textAlign: 'center',
    padding: '24px 12px',
    lineHeight: 1.6,
  },
  bookmarkGrid: { display: 'flex', flexDirection: 'column', gap: '8px' },
  modal: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modalCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '20px',
    width: '260px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  modalTitle: {
    fontFamily: 'var(--font-ui)',
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--ink)',
  },
}
