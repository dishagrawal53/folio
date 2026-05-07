# Folio — AI-Powered PDF Study Companion

> **Live Demo:** [https://folio-1-ml39.onrender.com/](https://folio-1-ml39.onrender.com/)

A full-stack web app that turns any PDF into an interactive study session. Drop in a PDF, get pixel-perfect rendering, AI explanations, flashcards, notes, bookmarks, and a document-aware chat — all with your files staying private on your device.

---

## Tech Stack

**Frontend:** React 18, Zustand, Vite, pdf.js  
**Backend:** Flask (Python), MongoDB, spaCy NLP  
**AI:** OpenAI GPT-4o mini via OpenRouter  
**Auth:** JWT + bcrypt  
**Deployed on:** Render

---

## Features

- 📄 **Pixel-perfect PDF rendering** via pdf.js canvas with selectable text layer
- 🔍 **Full-text search** across all pages with highlighted matches
- 🤖 **AI tools** — explain selections, summarize pages, generate flashcards
- 💬 **AI Chat** — document-aware conversational assistant
- 🔖 **Bookmarks & Notes** — synced to the cloud per user
- 📁 **Folder library** — organize PDFs and bookmarks
- 🌐 **Wikipedia lookup** — highlight text to look it up with relevance scoring
- 🎨 **4 themes** — Parchment, Night, Slate, Sage
- 🔐 **Multi-user auth** with per-user data isolation

---

## Getting Started

### Backend
```bash
cd backend
pip install flask flask-cors pymongo pyjwt bcrypt python-dotenv openai spacy
python -m spacy download en_core_web_sm
# Create .env with MONGO_URI, JWT_SECRET, OPENAI_API_KEY
python app.py
```

### Frontend
```bash
cd frontend
npm install
# Create .env with VITE_API_URL=http://localhost:5000
npm run dev
```

---

## Privacy

PDF files are processed entirely in the browser using pdf.js — **no file data is ever sent to the server.** Only short text excerpts (for AI) and metadata (bookmarks, notes, progress) are stored in the cloud.

---

## Project Structure

```
backend/
└── app.py               # Flask API — auth, bookmarks, notes, progress, AI

frontend/src/
├── components/
│   ├── BookReader.jsx    # Main reading view
│   ├── ConceptPanel.jsx  # AI tools + Wikipedia panel
│   ├── AIChatPanel.jsx   # Conversational AI chat
│   ├── FolderManager.jsx # Library / folder management
│   ├── AuthScreen.jsx    # Login / Register
│   └── UploadScreen.jsx  # PDF upload landing page
├── hooks/
│   ├── usePdfLoader.js   # pdf.js rendering pipeline
│   ├── useWikipedia.js   # Wikipedia lookup with NLP
│   └── useOpenAI.js      # AI action hooks
└── lib/
    ├── api.js            # REST client
    ├── auth.js           # Auth store (Zustand)
    └── store.js          # Reading store (Zustand)
```

---

## API Overview

All endpoints require a `Bearer <token>` header except auth routes.

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account → returns JWT |
| POST | `/api/auth/login` | Login → returns JWT |
| GET | `/api/auth/me` | Get current user |

### Folders
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/folders` | List user's folders |
| POST | `/api/folders` | Create folder |
| PUT | `/api/folders/<id>` | Update name / color / icon |
| DELETE | `/api/folders/<id>` | Delete folder |

### Bookmarks
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/bookmarks/<pdf_name>` | Get bookmarks for a PDF |
| POST | `/api/bookmarks` | Add or toggle a bookmark |
| PUT | `/api/bookmarks/<id>` | Update label / folder |
| DELETE | `/api/bookmarks/<id>` | Delete bookmark |

### Notes
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/notes/<pdf_name>` | Get notes for a PDF |
| POST | `/api/notes` | Create note |
| PUT | `/api/notes/<id>` | Update note text |
| DELETE | `/api/notes/<id>` | Delete note |

### Reading Progress
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/progress/<pdf_name>` | Get saved page number |
| POST | `/api/progress` | Save current page + total |
| GET | `/api/progress/all` | Reading history (last 20) |

### NLP & AI
| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/api/nlp/keywords` | `{ text }` | Extract keywords via spaCy or rule-based fallback |
| POST | `/api/ai/explain` | `{ text }` | Explain selected text (GPT-4o mini) |
| POST | `/api/ai/summary` | `{ text, page }` | Summarize page into bullet points |
| POST | `/api/ai/flashcards` | `{ text }` | Generate `[{ q, a }]` flashcard JSON |
| POST | `/api/ai/chat` | `{ pdfName, message, pageContext, history }` | Document-aware chat with history |
| GET | `/api/ai/chat/history/<pdf_name>` | — | Load saved chat history |

---

## How It Works

### 1. PDF Rendering
The PDF never leaves the browser. pdf.js renders each page to an off-screen `<canvas>` and exports it as a JPEG image. On top of that image, invisible `<span>` elements are placed at the exact pixel coordinates of every text run — this is what lets you select and copy text from what looks like an image. A third layer renders colored highlight boxes for search matches.

### 2. Full-Text Search
During load, plain text is extracted from every page and held in memory. Search runs `String.indexOf()` across all pages client-side — no network call. Matches are mapped back to the invisible text spans for highlighting.

### 3. AI Tools
Selecting text opens the Concept Panel. Clicking Explain / Summary / Flashcards sends a short text excerpt to Flask, which calls GPT-4o mini via OpenRouter and returns the result. Flashcards are returned as a parsed JSON array `[{ q, a }]`. No AI API key is needed in the frontend.

### 4. Wikipedia Lookup
When you select text, the frontend calls `/api/nlp/keywords` to extract meaningful keywords using spaCy NER. Those keywords are then used to query the Wikipedia REST API directly from the browser. Each result is scored for relevance by checking how many selection words appear in the article — results below 15% relevance are rejected.

### 5. Auth & Data Isolation
Login returns a 30-day JWT. Every backend request attaches it as `Authorization: Bearer <token>`. All MongoDB queries are automatically scoped to the logged-in `userId`. On the frontend, Zustand state is persisted to localStorage under a user-scoped key (`folio-storage-{userId}`) so switching accounts always loads a clean slate.

---

## License

MIT
