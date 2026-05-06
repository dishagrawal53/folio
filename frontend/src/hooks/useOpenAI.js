import { useState, useCallback, useRef } from 'react'
import { api } from '../lib/api.js'

/**
 * useOpenAI — replaces useGemini
 * Calls the Flask backend which uses gpt-4o-mini.
 * No API key needed in the frontend.
 */
export function useOpenAI() {
  const [state, setState] = useState({
    loading: false,
    result: null,
    cards: null,
    error: null,
    type: null,
  })

  const abortRef = useRef(false)

  const run = useCallback(async (apiFn, type) => {
    abortRef.current = false
    setState({ loading: true, result: null, cards: null, error: null, type })
    try {
      const data = await apiFn()
      if (abortRef.current) return
      setState({
        loading: false,
        result: data.result || '',
        cards: data.cards || null,
        error: null,
        type,
      })
    } catch (e) {
      if (abortRef.current) return
      setState({ loading: false, result: null, cards: null, error: e.message, type })
    }
  }, [])

  const explain = useCallback((text) =>
    run(() => api.ai.explain(text), 'explain'), [run])

  const summarizePage = useCallback((text, page) =>
    run(() => api.ai.summary(text, page), 'summary'), [run])

  const makeFlashcards = useCallback((text) =>
    run(() => api.ai.flashcards(text), 'flashcards'), [run])

  const clear = useCallback(() => {
    abortRef.current = true
    setState({ loading: false, result: null, cards: null, error: null, type: null })
  }, [])

  return { ...state, explain, summarizePage, makeFlashcards, clear }
}
