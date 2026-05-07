import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../lib/api.js'

/**
 * Returns a localStorage key scoped to the currently logged-in user.
 * Each user gets their own isolated storage bucket so bookmarks, notes,
 * and reading progress never bleed between accounts.
 * Falls back to 'folio-storage-guest' when no user is authenticated.
 */
function getStorageKey() {
  try {
    const raw = localStorage.getItem('folio-auth')
    if (!raw) return 'folio-storage-guest'
    const parsed = JSON.parse(raw)
    const userId = parsed?.state?.user?.id
    return userId ? `folio-storage-${userId}` : 'folio-storage-guest'
  } catch {
    return 'folio-storage-guest'
  }
}

export const useStore = create(
  persist(
    (set, get) => ({
      // ── PDF state ──────────────────────────────────────────
      pdfFile: null,
      pdfName: '',
      pages: [],
      totalPages: 0,
      currentPage: 1,
      isLoading: false,
      loadError: null,

      // ── Text selection ─────────────────────────────────────
      selectedText: '',
      selectionRect: null,
      panelOpen: false,

      // ── Bookmarks ──────────────────────────────────────────
      bookmarks: [],

      // ── Notes ──────────────────────────────────────────────
      notes: [],

      // ── Search ─────────────────────────────────────────────
      searchQuery: '',
      searchResults: [],
      activeSearchResult: 0,
      searchOpen: false,

      // ── Reading state ──────────────────────────────────────
      readingProgress: {},
      fontSize: 17,
      lineHeight: 1.9,
      showRulerLines: false,
      pageDirection: 'next',

      // ── Theme ──────────────────────────────────────────────
      theme: 'parchment',

      // ── Sidebar ────────────────────────────────────────────
      sidebarTab: 'notes',
      sidebarOpen: false,

      // ── PDF Actions ────────────────────────────────────────
      setPdf: (file, name) => set((state) => ({
        pdfFile: file,
        pdfName: name,
        currentPage: state.readingProgress[name]?.page || 1,
        pages: [],
        selectedText: '',
        panelOpen: false,
        searchOpen: false,
        searchQuery: '',
        searchResults: [],
      })),

      setPages: (pages, total) => set({ pages, totalPages: total, isLoading: false }),
      setLoading: (v) => set({ isLoading: v }),
      setLoadError: (e) => set({ loadError: e, isLoading: false }),

      setCurrentPage: (n) => {
        const { totalPages, currentPage, pdfName } = get()
        const clamped = Math.max(1, Math.min(n, totalPages))
        const direction = clamped >= currentPage ? 'next' : 'prev'
        set((state) => ({
          currentPage: clamped,
          pageDirection: direction,
          readingProgress: {
            ...state.readingProgress,
            [pdfName]: { page: clamped, timestamp: Date.now() }
          }
        }))
      },

      // ── Selection ──────────────────────────────────────────
      setSelection: (text, rect) => {
        if (text && text.trim().length > 3) {
          set({ selectedText: text.trim(), selectionRect: rect, panelOpen: true })
        }
      },
      clearSelection: () => set({ selectedText: '', selectionRect: null }),
      closePanel: () => set({ panelOpen: false, selectedText: '' }),

      // ── Bookmarks (WITH API) ───────────────────────────────
      addBookmark: async (page, label = '', color = 'accent', snippet = '') => {
        const { bookmarks, pdfName } = get()
        const existing = bookmarks.find(b => b.page === page)

        // REMOVE (toggle off)
        if (existing) {
          set({ bookmarks: bookmarks.filter(b => b.page !== page) })
          try {
            await api.bookmarks.upsert({ pdfName, page, removed: true })
          } catch {
            console.warn('Bookmark remove sync failed')
          }
          return
        }

        // ADD
        const bookmark = {
          id: Date.now().toString(),
          page,
          label: label || `Page ${page}`,
          color,
          snippet: snippet.slice(0, 120),
          createdAt: Date.now(),
        }
        set({ bookmarks: [...bookmarks, bookmark].sort((a, b) => a.page - b.page) })
        try {
          await api.bookmarks.upsert({ pdfName, ...bookmark })
        } catch {
          console.warn('Bookmark add sync failed')
        }
      },

      updateBookmarkLabel: async (id, label) => {
        const { bookmarks, pdfName } = get()
        const bookmark = bookmarks.find(b => b.id === id)
        set((state) => ({
          bookmarks: state.bookmarks.map(b => b.id === id ? { ...b, label } : b)
        }))
        if (!bookmark) return
        try {
          await api.bookmarks.upsert({ pdfName, ...bookmark, label })
        } catch {
          console.warn('Bookmark update sync failed')
        }
      },

      removeBookmark: async (id) => {
        const { bookmarks, pdfName } = get()
        const bookmark = bookmarks.find(b => b.id === id)
        set((state) => ({
          bookmarks: state.bookmarks.filter(b => b.id !== id)
        }))
        if (!bookmark) return
        try {
          await api.bookmarks.upsert({ pdfName, page: bookmark.page, removed: true })
        } catch {
          console.warn('Bookmark delete sync failed')
        }
      },

      isPageBookmarked: (page) => {
        return !!get().bookmarks.find(b => b.page === page)
      },

      // ── Notes (WITH API) ───────────────────────────────────
      addNote: async (page, text, color = 'yellow', selection = '') => {
        const { pdfName } = get()
        const note = {
          id: Date.now().toString(),
          page,
          text,
          color,
          selection: selection.slice(0, 200),
          createdAt: Date.now(),
        }
        set((state) => ({ notes: [...state.notes, note] }))
        try {
          await api.notes.create({ pdfName, ...note })
        } catch {
          console.warn('Note sync failed')
        }
        return note.id
      },

      updateNote: (id, text) => {
        set((state) => ({
          notes: state.notes.map(n => n.id === id ? { ...n, text } : n)
        }))
      },

      removeNote: async (id) => {
        const { pdfName } = get()
        set((state) => ({
          notes: state.notes.filter(n => n.id !== id)
        }))
        try {
          await api.notes.delete({ pdfName, id })
        } catch {
          console.warn('Note delete sync failed')
        }
      },

      getNotesForPage: (page) => {
        return get().notes.filter(n => n.page === page)
      },

      // ── Search ─────────────────────────────────────────────
      setSearchQuery: (q) => set({ searchQuery: q }),

      runSearch: (query) => {
        const { pages } = get()
        if (!query || query.trim().length < 2) {
          set({ searchResults: [], activeSearchResult: 0, searchQuery: query })
          return
        }
        const q = query.toLowerCase()
        const results = []
        pages.forEach((page) => {
          const text = page.text.toLowerCase()
          let idx = 0
          while ((idx = text.indexOf(q, idx)) !== -1) {
            results.push({
              page: page.pageNum,
              matchIndex: idx,
              text: page.text.slice(Math.max(0, idx - 40), idx + query.length + 60),
              query,
            })
            idx += q.length
          }
        })
        set({ searchResults: results, activeSearchResult: 0, searchQuery: query })
        if (results.length > 0) {
          get().setCurrentPage(results[0].page)
        }
      },

      nextSearchResult: () => {
        const { searchResults, activeSearchResult } = get()
        if (!searchResults.length) return
        const next = (activeSearchResult + 1) % searchResults.length
        set({ activeSearchResult: next })
        get().setCurrentPage(searchResults[next].page)
      },

      prevSearchResult: () => {
        const { searchResults, activeSearchResult } = get()
        if (!searchResults.length) return
        const prev = (activeSearchResult - 1 + searchResults.length) % searchResults.length
        set({ activeSearchResult: prev })
        get().setCurrentPage(searchResults[prev].page)
      },

      toggleSearch: () => set((state) => ({
        searchOpen: !state.searchOpen,
        searchQuery: state.searchOpen ? '' : state.searchQuery,
        searchResults: state.searchOpen ? [] : state.searchResults,
      })),

      // ── Settings ───────────────────────────────────────────
      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme)
        set({ theme })
      },
      setFontSize: (size) => set({ fontSize: Math.max(13, Math.min(24, size)) }),
      setLineHeight: (lh) => set({ lineHeight: Math.max(1.4, Math.min(2.4, lh)) }),
      toggleRulerLines: () => set((state) => ({ showRulerLines: !state.showRulerLines })),

      // ── Sidebar ────────────────────────────────────────────
      setSidebarTab: (tab) => set({ sidebarTab: tab }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      closeSidebar: () => set({ sidebarOpen: false }),

      // ── Reset (new file / navigate away) ──────────────────
      reset: () => set({
        pdfFile: null,
        pdfName: '',
        pages: [],
        totalPages: 0,
        currentPage: 1,
        isLoading: false,
        loadError: null,
        selectedText: '',
        selectionRect: null,
        panelOpen: false,
        searchQuery: '',
        searchResults: [],
        activeSearchResult: 0,
        searchOpen: false,
        sidebarOpen: false,
      }),

      // ── Full wipe (called on logout / login as different user) ─
      // Resets ALL state including bookmarks, notes, and readingProgress
      // so no user's data leaks to the next session.
      wipeUserData: () => set({
        pdfFile: null,
        pdfName: '',
        pages: [],
        totalPages: 0,
        currentPage: 1,
        isLoading: false,
        loadError: null,
        selectedText: '',
        selectionRect: null,
        panelOpen: false,
        searchQuery: '',
        searchResults: [],
        activeSearchResult: 0,
        searchOpen: false,
        sidebarOpen: false,
        // ↓ User-specific data that must be cleared between accounts
        bookmarks: [],
        notes: [],
        readingProgress: {},
      }),
    }),
    {
      // ── User-scoped key ──────────────────────────────────────
      // Each user ID gets its own localStorage bucket, e.g.:
      //   folio-storage-abc123   (user abc123's bookmarks/notes/progress)
      //   folio-storage-xyz789   (user xyz789's bookmarks/notes/progress)
      // This prevents data from one account ever appearing in another.
      name: getStorageKey(),

      // Only persist reading preferences and user content — never PDF binary data
      partialize: (state) => ({
        bookmarks: state.bookmarks,
        notes: state.notes,
        readingProgress: state.readingProgress,
        theme: state.theme,
        fontSize: state.fontSize,
        lineHeight: state.lineHeight,
        showRulerLines: state.showRulerLines,
      }),

      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          document.documentElement.setAttribute('data-theme', state.theme)
        }
      },
    }
  )
)