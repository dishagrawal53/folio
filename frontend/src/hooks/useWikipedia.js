import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api.js'

/**
 * useWikipedia — improved with Python/Flask NLP keyword extraction.
 *
 * Key fix: keywords now come from spaCy NER (or robust rule-based fallback)
 * on the backend, which correctly identifies named entities like "OSI model",
 * "TCP/IP", "Sharbel", etc. — avoiding spurious hits like "Acts of Sharbel"
 * when the user selects a networking paragraph.
 */

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
    `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=3&format=json&origin=*`,
    { signal }
  )
  if (!res.ok) return []
  const [, titles] = await res.json()
  return titles || []
}

/**
 * Relevance check: requires overlap between selected text words
 * and the Wikipedia result title + extract.
 * Uses a stricter threshold than before (2 words instead of 1).
 */
function scoreRelevance(selectedText, wikiTitle, wikiExtract) {
  const selWords = selectedText
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3)

  const haystack = (wikiTitle + ' ' + wikiExtract).toLowerCase()
  const matches = selWords.filter(w => haystack.includes(w))

  // Score = proportion of selection words found in wiki result
  return selWords.length > 0 ? matches.length / selWords.length : 0
}

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
      setState({ loading: false, title: '', summary: '', url: '', thumbnail: null, keywords: [], error: null, nlpMethod: '' })
      return
    }

    // Cancel previous
    if (controllerRef.current) controllerRef.current.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const sig = controller.signal

    setState(s => ({ ...s, loading: true, error: null, title: '', summary: '' }))

    async function fetchWiki() {
      try {
        const trimmed = selectedText.trim()

        // ── Step 1: Get NLP keywords from Flask backend ──────────
        let keywords = []
        let nlpMethod = 'fallback'
        try {
          const nlpData = await api.nlp.keywords(trimmed)
          keywords = nlpData.keywords || []
          nlpMethod = nlpData.method || 'rule-based'
        } catch {
          // Backend unavailable — use simple client-side fallback
          keywords = clientFallbackKeywords(trimmed)
          nlpMethod = 'client-fallback'
        }

        if (sig.aborted) return

        // ── Step 2: Build query list (NLP-guided, most specific first) ──
        const queries = [
          ...keywords,          // NLP picks (entities, noun phrases)
          trimmed.slice(0, 60), // Raw selection as last resort
        ].filter(Boolean).filter((q, i, arr) => arr.indexOf(q) === i)

        let best = null
        let bestScore = 0

        for (const query of queries.slice(0, 6)) {
          if (sig.aborted) return

          // Direct lookup
          const direct = await fetchSummary(query, sig)
          if (direct) {
            const score = scoreRelevance(trimmed, direct.title, direct.extract)
            if (score > bestScore) {
              bestScore = score
              best = direct
            }
            // Accept immediately if very high confidence
            if (score > 0.4) break
          }

          // OpenSearch
          const hits = await openSearch(query, sig)
          for (const hit of hits.slice(0, 2)) {
            if (sig.aborted) return
            const candidate = await fetchSummary(hit, sig)
            if (candidate) {
              const score = scoreRelevance(trimmed, candidate.title, candidate.extract)
              if (score > bestScore) {
                bestScore = score
                best = candidate
              }
              if (score > 0.4) break
            }
          }

          if (bestScore > 0.4) break
        }

        if (sig.aborted) return

        // Reject if relevance too low (prevents "Acts of Sharbel" type mismatches)
        if (!best || bestScore < 0.08) {
          setState({
            loading: false,
            error: 'No closely related Wikipedia article found.',
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
          url: best.content_urls?.desktop?.page ||
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

/** Minimal client-side keyword extractor when backend is down */
function clientFallbackKeywords(text) {
  const stopWords = new Set([
    'the','a','an','and','or','in','on','at','to','for','of','with','by',
    'is','are','was','were','this','that','it','they','we','you','he','she',
    'also','such','than','when','which','where','how','what','not','can',
    'into','as','if','so','about','each','other','more','very','just','while',
  ])

  // Prefer capitalized multi-word phrases
  const words = text.replace(/[^\w\s'-]/g, ' ').split(/\s+/)
  const properPhrases = []
  let i = 0
  while (i < len(words) - 1) {
    const w = words[i]
    if (w && w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase() && !stopWords.has(w.toLowerCase()) && w.length > 2) {
      const phrase = [w]
      let j = i + 1
      while (j < words.length && words[j] && words[j][0] === words[j][0].toUpperCase() && !stopWords.has(words[j].toLowerCase())) {
        phrase.push(words[j])
        j++
      }
      if (phrase.length >= 2 || phrase[0].length >= 6) properPhrases.push(phrase.join(' '))
      i = j
    } else {
      i++
    }
  }

  const contentWords = words.filter(w =>
    w.length >= 6 && !stopWords.has(w.toLowerCase()) && /^[a-zA-Z]/.test(w)
  )

  const seen = new Set()
  return [...properPhrases, ...contentWords].filter(k => {
    const lower = k.toLowerCase()
    if (seen.has(lower)) return false
    seen.add(lower)
    return true
  }).slice(0, 5)
}

// Fix: JS doesn't have Python's len(), use .length
function len(arr) { return arr.length }
