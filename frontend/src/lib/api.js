/**
 * Folio API Client
 * All communication with the Flask backend goes through here.
 */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function getToken() {
  return localStorage.getItem('folio_token')
}

async function request(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`)
  }
  return data
}

// ── Auth ────────────────────────────────────────────────────────
export const api = {
  auth: {
    register: (name, email, password) =>
      request('/api/auth/register', { method: 'POST', body: { name, email, password } }),
    login: (email, password) =>
      request('/api/auth/login', { method: 'POST', body: { email, password } }),
    me: () => request('/api/auth/me'),
  },

  // ── Folders ─────────────────────────────────────────────────
  folders: {
    list: () => request('/api/folders'),
    create: (data) => request('/api/folders', { method: 'POST', body: data }),
    update: (id, data) => request(`/api/folders/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/api/folders/${id}`, { method: 'DELETE' }),
  },

  // ── Bookmarks ────────────────────────────────────────────────
  bookmarks: {
    list: (pdfName) => request(`/api/bookmarks/${encodeURIComponent(pdfName)}`),
    upsert: (data) => request('/api/bookmarks', { method: 'POST', body: data }),
    update: (id, data) => request(`/api/bookmarks/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/api/bookmarks/${id}`, { method: 'DELETE' }),
  },

  // ── Notes ───────────────────────────────────────────────────
  notes: {
    list: (pdfName) => request(`/api/notes/${encodeURIComponent(pdfName)}`),
    create: (data) => request('/api/notes', { method: 'POST', body: data }),
    update: (id, data) => request(`/api/notes/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/api/notes/${id}`, { method: 'DELETE' }),
  },

  // ── Progress ─────────────────────────────────────────────────
  progress: {
    get: (pdfName) => request(`/api/progress/${encodeURIComponent(pdfName)}`),
    save: (pdfName, page, totalPages) =>
      request('/api/progress', { method: 'POST', body: { pdfName, page, totalPages } }),
    history: () => request('/api/progress/all'),
  },

  // ── NLP ──────────────────────────────────────────────────────
  nlp: {
    keywords: (text) => request('/api/nlp/keywords', { method: 'POST', body: { text } }),
  },

  // ── AI ───────────────────────────────────────────────────────
  ai: {
    explain: (text) => request('/api/ai/explain', { method: 'POST', body: { text } }),
    summary: (text, page) => request('/api/ai/summary', { method: 'POST', body: { text, page } }),
    flashcards: (text) => request('/api/ai/flashcards', { method: 'POST', body: { text } }),
    chat: (pdfName, message, pageContext, history) =>
      request('/api/ai/chat', { method: 'POST', body: { pdfName, message, pageContext, history } }),
    chatHistory: (pdfName) => request(`/api/ai/chat/history/${encodeURIComponent(pdfName)}`),
  },

  // ── Health ───────────────────────────────────────────────────
  health: () => request('/api/health'),
}
