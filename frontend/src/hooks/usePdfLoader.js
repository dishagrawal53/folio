import { useEffect, useRef } from 'react'
import { useStore } from '../lib/store.js'
import { api } from '../lib/api.js'

let pdfjsLib = null

async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib
  pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).href
  return pdfjsLib
}

async function renderPageToCanvas(pdfPage, scale = 1.8) {
  const viewport = pdfPage.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  await pdfPage.render({ canvasContext: ctx, viewport }).promise
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    width: viewport.width,
    height: viewport.height,
    viewport,
  }
}

/**
 * Extracts plain text from a PDF page, preserving line breaks and spacing.
 *
 * This text string is used for two purposes:
 *   1. Fallback rendering when canvas image is unavailable
 *   2. Full-text search — runSearch() in the store searches page.text and
 *      records character offsets (start/end) into this string. Those offsets
 *      are then mapped back to textItems in SearchHighlightLayer.
 *
 * IMPORTANT: The character order here must match the order that textItems
 * are concatenated in SearchHighlightLayer's charMap. Both iterate
 * textContent.items in the same forward order, so they stay in sync.
 */
async function extractPageText(pdfPage) {
  const textContent = await pdfPage.getTextContent()
  let text = ''
  let lastY = null
  let lastX = null
  for (const item of textContent.items) {
    if ('str' in item) {
      const y = item.transform?.[5] ?? 0
      const x = item.transform?.[4] ?? 0
      if (lastY !== null && Math.abs(y - lastY) > 8) text += '\n'
      else if (lastX !== null && x - lastX > 20 && lastY !== null && Math.abs(y - lastY) < 3) text += '  '
      text += item.str
      lastY = y
      lastX = x + (item.width || 0)
    }
  }
  return text.trim()
}

/**
 * Extract text items with canvas-pixel coordinates.
 * These power the invisible selectable text layer drawn over the PDF image.
 *
 * PDF coordinate system: origin is bottom-left, y increases upward.
 * Canvas coordinate system: origin is top-left, y increases downward.
 * Conversion: canvasY = viewportHeight - (pdfY * scale)
 *
 * Each item in the returned array has:
 *   str      — the text string for this run
 *   x        — left edge in canvas pixels
 *   y        — top edge in canvas pixels (flipped from PDF coords)
 *   width    — width in canvas pixels
 *   height   — height in canvas pixels (fontSize * 1.15 for descenders)
 *   fontSize — font size in canvas pixels
 *
 * These coordinates are used directly as CSS left/top/width/height on the
 * invisible <span> elements in PdfPageView's text layer, and as the bounding
 * boxes for highlight rectangles in SearchHighlightLayer.
 *
 * NOTE: Items with zero width or zero fontSize are skipped — they are
 * typically invisible glyphs (soft hyphens, zero-width joiners, etc.) that
 * would produce invisible zero-size spans and confuse the layout.
 */
async function extractTextItems(pdfPage, viewport) {
  const textContent = await pdfPage.getTextContent()
  const items = []

  for (const item of textContent.items) {
    if (!('str' in item) || item.str === '') continue

    const tx = item.transform // [a, b, c, d, e, f] — affine matrix
    const scale = viewport.scale

    // Font size from matrix scale component (tx[3] = vertical scale = font size in PDF units)
    const fontSize = Math.abs(tx[3]) * scale

    // X position: tx[4] is PDF x in user units, multiply by scale for canvas pixels
    const x = tx[4] * scale

    // Y position: PDF y origin is bottom-left, canvas y origin is top-left.
    // tx[5] is the baseline y in PDF units (from bottom).
    // We subtract fontSize to get the top of the glyph box.
    const y = viewport.height - tx[5] * scale - fontSize

    const width = (item.width || 0) * scale

    if (width <= 0 || fontSize <= 0) continue

    items.push({
      str: item.str,
      x,
      y,
      width,
      height: fontSize * 1.15, // 1.15 adds room for descenders (g, p, y, etc.)
      fontSize,
    })
  }

  return items
}

export function usePdfLoader() {
  const { pdfFile, currentPage, setCurrentPage, setPages, setLoading, setLoadError } = useStore()
  const abortRef = useRef(false)

  // Restore saved reading position when a new file is opened
  useEffect(() => {
    if (!pdfFile) return
    async function loadSavedProgress() {
      try {
        const saved = await api.progress.get(pdfFile.name)
        if (saved?.progress?.page) setCurrentPage(saved.progress.page)
      } catch { /* offline — ignore */ }
    }
    loadSavedProgress()
  }, [pdfFile]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load, render, and extract text data from every page of the PDF.
  //
  // For each page we produce:
  //   imageDataUrl  — JPEG canvas render for pixel-perfect display
  //   text          — plain text string used by runSearch() and fallback renderer
  //   textItems     — per-glyph-run bounding boxes used by the text selection
  //                   layer and SearchHighlightLayer in BookReader
  //
  // All pages are processed sequentially (not in parallel) to avoid
  // overwhelming the pdf.js worker with concurrent render requests.
  useEffect(() => {
    if (!pdfFile) return
    abortRef.current = false
    setLoading(true)

    async function loadPdf() {
      try {
        const lib = await getPdfJs()
        const arrayBuffer = await pdfFile.arrayBuffer()
        const pdf = await lib.getDocument({ data: arrayBuffer }).promise
        if (abortRef.current) return

        const total = pdf.numPages

        // Scale: use device pixel ratio for sharp rendering on HiDPI screens,
        // capped at 2.8× to keep memory and file size reasonable.
        const scale = Math.min(window.devicePixelRatio * 1.4, 2.8)
        const pageData = []

        for (let i = 1; i <= total; i++) {
          if (abortRef.current) return
          const page = await pdf.getPage(i)
          const rendered = await renderPageToCanvas(page, scale)

          // Extract plain text and positioned text items in parallel —
          // both read the same textContent but process it differently.
          const [text, textItems] = await Promise.all([
            extractPageText(page),
            extractTextItems(page, rendered.viewport),
          ])

          pageData.push({
            pageNum: i,
            text,           // used by runSearch() in the store
            imageDataUrl: rendered.dataUrl,
            imageWidth: rendered.width,
            imageHeight: rendered.height,
            textItems,      // used by PdfPageView text layer + SearchHighlightLayer
          })
        }

        if (!abortRef.current) {
          setPages(pageData, total)
          await api.progress.save(pdfFile.name, currentPage || 1, total)
        }
      } catch (err) {
        if (!abortRef.current) setLoadError(err.message || 'Failed to load PDF')
      }
    }

    loadPdf()

    // Abort in-flight rendering if the component unmounts or pdfFile changes
    return () => { abortRef.current = true }
  }, [pdfFile]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save reading progress whenever the user turns a page
  useEffect(() => {
    if (!pdfFile || !currentPage) return
    async function saveProgress() {
      try {
        const totalPages = useStore.getState().totalPages
        await api.progress.save(pdfFile.name, currentPage, totalPages)
      } catch { /* offline — ignore */ }
    }
    saveProgress()
  }, [currentPage, pdfFile])
}