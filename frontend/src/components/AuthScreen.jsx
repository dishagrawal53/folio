import React, { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth.js'

export default function AuthScreen() {
  const { login, register, loading, error, clearError } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setTimeout(() => setMounted(true), 50) }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearError()
    let ok
    if (mode === 'login') {
      ok = await login(form.email, form.password)
    } else {
      ok = await register(form.name, form.email, form.password)
    }
    // On success, parent re-renders (useAuth reactive)
  }

  const set = (k) => (e) => {
    clearError()
    setForm(f => ({ ...f, [k]: e.target.value }))
  }

  return (
    <div style={as.root}>
      {/* Ruled paper background */}
      <div style={as.paperBg} />
      <div style={as.marginLine} />
      {[100, 260, 420].map(top => (
        <div key={top} style={{ ...as.hole, top }} />
      ))}

      <div style={{ ...as.card, opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(20px)', transition: 'all 0.5s cubic-bezier(0.16,1,0.3,1)' }}>

        {/* Logo */}
        <div style={as.logoRow}>
          <div style={as.logo}>F</div>
          <div>
            <h1 style={as.title}>Folio</h1>
            <p style={as.tagline}>Your study companion</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={as.tabs}>
          <button
            onClick={() => { setMode('login'); clearError() }}
            style={{ ...as.tab, ...(mode === 'login' ? as.tabActive : {}) }}
          >Sign In</button>
          <button
            onClick={() => { setMode('register'); clearError() }}
            style={{ ...as.tab, ...(mode === 'register' ? as.tabActive : {}) }}
          >Create Account</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={as.form}>
          {mode === 'register' && (
            <div style={as.field}>
              <label style={as.label}>Your name</label>
              <input
                type="text"
                placeholder="Ada Lovelace"
                value={form.name}
                onChange={set('name')}
                required
                style={as.input}
              />
            </div>
          )}

          <div style={as.field}>
            <label style={as.label}>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={set('email')}
              required
              style={as.input}
            />
          </div>

          <div style={as.field}>
            <label style={as.label}>Password</label>
            <input
              type="password"
              placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'}
              value={form.password}
              onChange={set('password')}
              required
              style={as.input}
            />
          </div>

          {error && (
            <div style={as.error}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ ...as.submitBtn, opacity: loading ? 0.6 : 1 }}
          >
            {loading
              ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
              : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <p style={as.footer}>
          All your notes and bookmarks sync across devices.<br />
          Your PDFs stay on your device — never uploaded.
        </p>
      </div>
    </div>
  )
}

const as = {
  root: {
    height: '100vh',
    width: '100%',
    background: 'var(--bg)',
    display: 'flex',
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
    top: 0, bottom: 0, left: '80px',
    width: '1px',
    background: 'rgba(200,100,80,0.15)',
  },
  hole: {
    position: 'absolute',
    left: '28px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: 'var(--bg-alt)',
    border: '1.5px solid var(--border)',
  },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    boxShadow: '0 8px 40px var(--shadow-lg)',
    padding: '36px 32px',
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    position: 'relative',
    zIndex: 1,
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    justifyContent: 'center',
  },
  logo: {
    width: '48px', height: '48px',
    background: 'var(--accent)',
    color: 'white',
    fontFamily: 'var(--font-display)',
    fontSize: '26px',
    fontWeight: '700',
    fontStyle: 'italic',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    boxShadow: '3px 3px 0 var(--border)',
    flexShrink: 0,
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '32px',
    fontWeight: '700',
    color: 'var(--ink)',
    lineHeight: 1.1,
  },
  tagline: {
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    color: 'var(--ink-3)',
  },
  tabs: {
    display: 'flex',
    background: 'var(--tag-bg)',
    borderRadius: '7px',
    padding: '3px',
    gap: '2px',
  },
  tab: {
    flex: 1,
    padding: '8px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    color: 'var(--ink-3)',
    borderRadius: '5px',
    transition: 'all 0.2s',
    fontWeight: '500',
  },
  tabActive: {
    background: 'var(--bg-card)',
    color: 'var(--ink)',
    fontWeight: '600',
    boxShadow: '0 1px 4px var(--shadow)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--ink-4)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  input: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '10px 12px',
    fontFamily: 'var(--font-ui)',
    fontSize: '14px',
    color: 'var(--ink)',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  error: {
    background: 'rgba(180,50,50,0.08)',
    border: '1px solid rgba(180,50,50,0.2)',
    borderRadius: '6px',
    padding: '9px 12px',
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    color: '#c0392b',
  },
  submitBtn: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '7px',
    padding: '12px',
    fontFamily: 'var(--font-ui)',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
    marginTop: '4px',
  },
  footer: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--ink-4)',
    textAlign: 'center',
    lineHeight: 1.6,
    letterSpacing: '0.03em',
  },
}
