import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from './api.js'

export const useAuth = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loading: false,
      error: null,

      login: async (email, password) => {
        set({ loading: true, error: null })
        try {
          const data = await api.auth.login(email, password)
          // Wipe any previous user's data before loading new user
          clearAllUserData()
          localStorage.setItem('folio_token', data.token)
          set({ user: data.user, token: data.token, loading: false })
          return true
        } catch (e) {
          set({ error: e.message, loading: false })
          return false
        }
      },

      register: async (name, email, password) => {
        set({ loading: true, error: null })
        try {
          const data = await api.auth.register(name, email, password)
          clearAllUserData()
          localStorage.setItem('folio_token', data.token)
          set({ user: data.user, token: data.token, loading: false })
          return true
        } catch (e) {
          set({ error: e.message, loading: false })
          return false
        }
      },

      logout: () => {
        localStorage.removeItem('folio_token')
        clearAllUserData()
        set({ user: null, token: null })
      },

      clearError: () => set({ error: null }),

      isAuthenticated: () => !!get().user && !!localStorage.getItem('folio_token'),
    }),
    {
      name: 'folio-auth',
      partialize: (s) => ({ user: s.user, token: s.token }),
    }
  )
)

/**
 * Wipes all user-specific data from localStorage, sessionStorage,
 * and the in-memory Zustand reading store.
 * Called on login (to clear previous user) and logout (to clear current user).
 */
function clearAllUserData() {
  // Remove every folio-storage-* key (one bucket per user ID)
  Object.keys(localStorage)
    .filter(k => k.startsWith('folio-storage'))
    .forEach(k => localStorage.removeItem(k))

  // Remove folder files (stored per-session, not per-user in original code)
  localStorage.removeItem('folio_folder_files')

  // Clear PDF session data (base64 blobs stored in sessionStorage)
  sessionStorage.clear()

  // Wipe the in-memory Zustand reading store via lazy import to avoid
  // circular dependency (store.js imports api.js, auth.js also imports api.js)
  import('./store.js').then(({ useStore }) => {
    useStore.getState().wipeUserData()
  })
}