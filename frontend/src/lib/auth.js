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
