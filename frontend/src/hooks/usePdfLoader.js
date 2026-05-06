import { useEffect, useRef } from 'react'
import { useStore } from '../lib/store.js'
import { api } from '../lib/api.js' // assuming this exists

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

export function usePdfLoader() {
  const {
    pdfFile,
    currentPage,
    setCurrentPage,
    setPages,
    setLoading,
    setLoadError
  } = useStore()

  const abortRef = useRef(false)

  // 🔹 Load saved progress when PDF changes
  useEffect(() => {
    if (!pdfFile) return

    async function loadSavedProgress() {
      try {
        const saved = await api.progress.get(pdfFile.name)
        if (saved?.progress?.page) {
          setCurrentPage(saved.progress.page)
        }
      } catch (e) {
        console.warn('Failed to load saved progress')
      }
    }

    loadSavedProgress()
  }, [pdfFile])

  // 🔹 Load PDF
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
        const pageData = []

        for (let i = 1; i <= total; i++) {
          if (abortRef.current) return

          const page = await pdf.getPage(i)
          const textContent = await page.getTextContent()

          let text = ''
          let lastY = null
          let lastX = null

          for (const item of textContent.items) {
            if ('str' in item) {
              const y = item.transform?.[5] ?? 0
              const x = item.transform?.[4] ?? 0

              if (lastY !== null && Math.abs(y - lastY) > 8) {
                text += '\n'
              } else if (
                lastX !== null &&
                x - lastX > 20 &&
                lastY !== null &&
                Math.abs(y - lastY) < 3
              ) {
                text += '  '
              }

              text += item.str
              lastY = y
              lastX = x + (item.width || 0)
            }
          }

          pageData.push({
            pageNum: i,
            text: text.trim()
          })
        }

        if (!abortRef.current) {
          setPages(pageData, total)

          // 🔹 Save initial progress after load
          await api.progress.save(pdfFile.name, currentPage || 1, total)
        }
      } catch (err) {
        if (!abortRef.current) {
          setLoadError(err.message || 'Failed to load PDF')
        }
      }
    }

    loadPdf()

    return () => {
      abortRef.current = true
    }
  }, [pdfFile])

  // 🔹 Save progress whenever page changes
  useEffect(() => {
    if (!pdfFile || !currentPage) return

    async function saveProgress() {
      try {
        const totalPages = useStore.getState().totalPages
        await api.progress.save(pdfFile.name, currentPage, totalPages)
      } catch (e) {
        console.warn('Failed to save progress')
      }
    }

    saveProgress()
  }, [currentPage, pdfFile])
}