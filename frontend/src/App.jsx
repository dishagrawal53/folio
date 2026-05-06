import React, { useState, useEffect } from 'react'
import { useAuth } from './lib/auth.js'
import { useStore } from './lib/store.js'
import AuthScreen from './components/AuthScreen.jsx'
import UploadScreen from './components/UploadScreen.jsx'
import BookReader from './components/BookReader.jsx'
import ConceptPanel from './components/ConceptPanel.jsx'
import AIChatPanel from './components/AIChatPanel.jsx'
import FolderManager from './components/FolderManager.jsx'

export default function App() {
  const { user, isAuthenticated } = useAuth()
  const { pdfFile, panelOpen, setCurrentPage, pdfName } = useStore()

  const [showChat, setShowChat] = useState(false)
  const [showFolders, setShowFolders] = useState(false)

  // Sync theme on mount
  useEffect(() => {
    const theme = useStore.getState().theme
    document.documentElement.setAttribute('data-theme', theme)
  }, [])

  // Not logged in → auth screen
  if (!isAuthenticated()) {
    return <AuthScreen />
  }

  // No PDF → upload screen
  if (!pdfFile) {
    return (
      <div style={{ display: 'flex', height: '100vh' }}>
        {showFolders && (
          <FolderManager
            onClose={() => setShowFolders(false)}
            onGoToPage={setCurrentPage}
            pdfName={pdfName}
          />
        )}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <UploadScreen onOpenFolders={() => setShowFolders(true)} />
        </div>
      </div>
    )
  }

  // Reading view
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Left: Folder manager (slides in) */}
      {showFolders && (
        <FolderManager
          onClose={() => setShowFolders(false)}
          onGoToPage={(page) => { setCurrentPage(page); setShowFolders(false) }}
          pdfName={pdfName}
        />
      )}

      {/* Center: Book reader */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <BookReader
          onToggleChat={() => setShowChat(v => !v)}
          onToggleFolders={() => setShowFolders(v => !v)}
          chatOpen={showChat}
          foldersOpen={showFolders}
        />
      </div>

      {/* Right: Concept panel (on text selection) */}
      {panelOpen && <ConceptPanel />}

      {/* Right: AI Chat panel */}
      {showChat && <AIChatPanel onClose={() => setShowChat(false)} />}
    </div>
  )
}
