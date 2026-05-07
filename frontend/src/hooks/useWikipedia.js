import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api.js'

/**
 * useWikipedia — canvas-render-aware Wikipedia lookup.
 *
 * Improvements over original:
 *  1. Much stricter relevance gating (threshold 0.15 not 0.08).
 *  2. Filters out generic/short keywords before querying.
 *  3. Tries the longest NLP keyword first (most specific entity).
 *  4. Uses title-only match as a fast-accept shortcut.
 *  5. Client fallback avoids calling len() (JS bug fix).
 */

// ── Wikipedia API helpers ────────────────────────────────────────

async function fetchSummary(title, signal) {
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    { signal }
  )
  if (!res.ok) return null
  const data = await res.json()
  if (data.type === 'disambiguation' || !data.extract) return null
  return data
}

async function openSearch(query, signal) {
  const res = await fetch(
    `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
      query
    )}&limit=3&format=json&origin=*`,
    { signal }
  )
  if (!res.ok) return []
  const [, titles] = await res.json()
  return titles || []
}

// ── Relevance scoring ────────────────────────────────────────────

const GENERIC_STOP = new Set([
  'system','model','network','protocol','layer','data','type','process',
  'function','method','class','object','value','result','output','input',
  'figure','table','example','section','chapter','page','text','term',
  'concept','theory','approach','technique','algorithm','structure','design',
  'analysis','overview','introduction','summary','conclusion','reference',
])

function scoreRelevance(selectedText, wikiTitle, wikiExtract) {
  const selWords = selectedText
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !GENERIC_STOP.has(w))

  if (selWords.length === 0) return 0

  const haystack = (wikiTitle + ' ' + wikiExtract).toLowerCase()
  const matches = selWords.filter(w => haystack.includes(w))

  // Bonus: title directly contains a key word → strong signal
  const titleLower = wikiTitle.toLowerCase()
  const titleBonus = selWords.some(w => titleLower.includes(w)) ? 0.25 : 0

  return Math.min(1, matches.length / selWords.length + titleBonus)
}

// Reject keywords that are too generic to yield useful results
function isUsefulKeyword(kw) {
  if (!kw || kw.trim().length < 4) return false
  const lower = kw.toLowerCase().trim()
  if (GENERIC_STOP.has(lower)) return false
  // Skip purely numeric strings
  if (/^\d+$/.test(lower)) return false
  return true
}

// ── Main hook ────────────────────────────────────────────────────

export function useWikipedia(selectedText) {
  const [state, setState] = useState({
    loading: false,
    title: '',
    summary: '',
    url: '',
    thumbnail: null,
    keywords: [],
    error: null,
    nlpMethod: '',
  })

  const controllerRef = useRef(null)

  useEffect(() => {
    if (!selectedText || selectedText.trim().length < 4) {
      setState({
        loading: false, title: '', summary: '', url: '',
        thumbnail: null, keywords: [], error: null, nlpMethod: '',
      })
      return
    }

    if (controllerRef.current) controllerRef.current.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const sig = controller.signal

    setState(s => ({ ...s, loading: true, error: null, title: '', summary: '' }))

    async function fetchWiki() {
      try {
        const trimmed = selectedText.trim()

        // ── Step 1: NLP keywords from Flask backend ──────────────
        let keywords = []
        let nlpMethod = 'fallback'
        try {
          const nlpData = await api.nlp.keywords(trimmed)
          keywords = (nlpData.keywords || []).filter(isUsefulKeyword)
          nlpMethod = nlpData.method || 'rule-based'
        } catch {
          keywords = clientFallbackKeywords(trimmed)
          nlpMethod = 'client-fallback'
        }

        if (sig.aborted) return

        // ── Step 2: Build ranked query list ─────────────────────
        // Sort by length descending — longer = more specific entity
        const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length)

        // Limit raw selection fallback to first meaningful phrase
        const selectionFallback = trimmed
          .split(/[.!?;,\n]/)
          .map(s => s.trim())
          .filter(s => s.length > 8 && s.length < 80)[0] || trimmed.slice(0, 60)

        const queries = [
          ...sortedKeywords,
          selectionFallback,
        ].filter(Boolean).filter((q, i, arr) => arr.indexOf(q) === i)

        let best = null
        let bestScore = 0

        for (const query of queries.slice(0, 5)) {
          if (sig.aborted) return

          // Direct title lookup
          const direct = await fetchSummary(query, sig)
          if (direct) {
            const score = scoreRelevance(trimmed, direct.title, direct.extract)
            if (score > bestScore) { bestScore = score; best = direct }
            if (score > 0.5) break   // Very confident → stop early
          }

          if (sig.aborted) return

          // OpenSearch fallback for this query
          const hits = await openSearch(query, sig)
          for (const hit of hits.slice(0, 2)) {
            if (sig.aborted) return
            const candidate = await fetchSummary(hit, sig)
            if (candidate) {
              const score = scoreRelevance(trimmed, candidate.title, candidate.extract)
              if (score > bestScore) { bestScore = score; best = candidate }
              if (score > 0.5) break
            }
          }

          if (bestScore > 0.5) break
        }

        if (sig.aborted) return

        // Strict rejection threshold — prevents off-topic hits
        if (!best || bestScore < 0.15) {
          setState({
            loading: false,
            error: 'No closely related Wikipedia article found for this selection.',
            title: '', summary: '', url: '', thumbnail: null,
            keywords,
            nlpMethod,
          })
          return
        }

        setState({
          loading: false,
          title: best.title || '',
          summary: best.extract || '',
          url:
            best.content_urls?.desktop?.page ||
            `https://en.wikipedia.org/wiki/${encodeURIComponent(best.title)}`,
          thumbnail: best.thumbnail?.source || null,
          keywords,
          nlpMethod,
          error: null,
        })
      } catch (err) {
        if (err.name === 'AbortError') return
        setState(s => ({
          ...s,
          loading: false,
          error: 'Could not reach Wikipedia.',
          title: '',
          summary: '',
        }))
      }
    }

    fetchWiki()
    return () => controller.abort()
  }, [selectedText])

  return state
}

// ── Client-side fallback keyword extractor ───────────────────────

function clientFallbackKeywords(text) {
  const stopWords = new Set([
    'the','a','an','and','or','in','on','at','to','for','of','with','by',
    'is','are','was','were','this','that','it','they','we','you','he','she',
    'also','such','than','when','which','where','how','what','not','can',
    'into','as','if','so','about','each','other','more','very','just','while',
    ...Array.from(GENERIC_STOP),
  ])

  const words = text.replace(/[^\w\s'-]/g, ' ').split(/\s+/)
  const properPhrases = []
  let i = 0

  while (i < words.length) {
    const w = words[i]
    const firstChar = w[0]
    if (
      firstChar &&
      firstChar === firstChar.toUpperCase() &&
      firstChar !== firstChar.toLowerCase() &&
      !stopWords.has(w.toLowerCase()) &&
      w.length > 2
    ) {
      const phrase = [w]
      let j = i + 1
      while (
        j < words.length &&
        words[j] &&
        words[j][0] === words[j][0].toUpperCase() &&
        words[j][0] !== words[j][0].toLowerCase() &&
        !stopWords.has(words[j].toLowerCase())
      ) {
        phrase.push(words[j])
        j++
      }
      if (phrase.length >= 2 || phrase[0].length >= 6) {
        properPhrases.push(phrase.join(' '))
      }
      i = j
    } else {
      i++
    }
  }

  const contentWords = words.filter(
    w =>
      w.length >= 7 &&
      !stopWords.has(w.toLowerCase()) &&
      /^[a-zA-Z]/.test(w) &&
      isUsefulKeyword(w)
  )

  const seen = new Set()
  return [...properPhrases, ...contentWords]
    .filter(k => {
      const lower = k.toLowerCase()
      if (seen.has(lower)) return false
      seen.add(lower)
      return true
    })
    .slice(0, 5)
}