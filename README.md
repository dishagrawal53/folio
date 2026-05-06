# Folio 📖

> An AI-powered PDF study companion — read, annotate, and understand documents with built-in AI tools.

---

## What is Folio?

Folio is a full-stack web application that transforms any PDF into an interactive study session. Upload a textbook, research paper, or lecture notes — and read it with bookmarks, sticky notes, AI explanations, flashcard generation, and a context-aware chat assistant, all in one place.

Your PDFs never leave your device. All text extraction happens in the browser via pdf.js. Only your bookmarks, notes, and reading progress sync to the backend.

---

## Features

| Feature | Description |
|---|---|
| 📄 **PDF Reader** | Client-side PDF parsing with layout-preserving text extraction |
| 🔖 **Bookmarks** | Dog-ear page corners or click to bookmark; assign to folders |
| 📝 **Notes** | Color-coded sticky notes anchored to any page |
| 💡 **AI Explain** | GPT-4o-mini explains selected text in plain language |
| 📋 **Page Summary** | Bullet-point summary of the current page |
| 🃏 **Flashcards** | Auto-generated Q&A flashcards from selected text |
| 🤖 **AI Chat** | Conversational assistant with full document + page context |
| 🌐 **Wikipedia Lookup** | Highlight text → instant Wikipedia article with relevance scoring |
| 🔍 **Full-text Search** | Search across all pages with match highlighting |
| 📁 **Folders** | Organize bookmarks into color-coded, icon-labeled folders |
| 📊 **Reading Progress** | Auto-saves your position and resumes where you left off |
| 🎨 **Themes** | Parchment, Night, Slate, and Sage reading themes |
| 🔐 **Auth** | JWT-based login and registration with bcrypt password hashing |

---

## Tech Stack

**Frontend:** React 18, Zustand, Vite, pdf.js (pdfjs-dist), JavaScript ES2022

**Backend:** Python, Flask, Flask-CORS, PyMongo, PyJWT, bcrypt, python-dotenv

**AI / NLP:** OpenAI GPT-4o-mini (via OpenRouter), spaCy (en_core_web_sm), rule-based NLP fallback

**Database:** MongoDB (users, bookmarks, notes, folders, reading_progress, chat_history)

**External APIs:** Wikipedia REST API, Wikipedia OpenSearch API

---

## Project Structure

```
folio/
├── backend/
│   └── app.py                  # Flask API — all routes and business logic
│
└── frontend/
    ├── src/
    │   ├── App.jsx              # Root component, routing between screens
    │   ├── components/
    │   │   ├── AuthScreen.jsx   # Login / register UI
    │   │   ├── UploadScreen.jsx # PDF drag-and-drop landing page
    │   │   ├── BookReader.jsx   # Main reading view with toolbar
    │   │   ├── ConceptPanel.jsx # Text selection → Wikipedia + AI panel
    │   │   ├── AIChatPanel.jsx  # Conversational AI chat sidebar
    │   │   └── FolderManager.jsx# Folder and bookmark management
    │   ├── hooks/
    │   │   ├── usePdfLoader.js  # pdf.js integration, page extraction
    │   │   ├── useOpenAI.js     # AI tool state management hook
    │   │   └── useWikipedia.js  # Wikipedia search with relevance scoring
    │   └── lib/
    │       ├── api.js           # Centralized Flask API client
    │       ├── store.js         # Zustand global state (reading, bookmarks, notes)
    │       └── auth.js          # Zustand auth store with JWT persistence
    └── index.html
```


---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login and receive JWT |
| GET | `/api/auth/me` | Get current user |
| GET/POST | `/api/bookmarks/:pdf` | List or toggle bookmarks |
| PUT/DELETE | `/api/bookmarks/:id` | Update or delete bookmark |
| GET/POST | `/api/notes/:pdf` | List or create notes |
| PUT/DELETE | `/api/notes/:id` | Update or delete note |
| GET/POST | `/api/folders` | List or create folders |
| GET/POST | `/api/progress/:pdf` | Get or save reading progress |
| GET | `/api/progress/all` | Reading history (last 20 PDFs) |
| POST | `/api/nlp/keywords` | Extract NLP keywords from text |
| POST | `/api/ai/explain` | AI explanation of selected text |
| POST | `/api/ai/summary` | AI page summary |
| POST | `/api/ai/flashcards` | AI flashcard generation |
| POST | `/api/ai/chat` | Conversational AI chat |
| GET | `/api/ai/chat/history/:pdf` | Load chat history for a PDF |
| GET | `/api/health` | Service health check |

---

## How It Works

### PDF Parsing (Client-side)
The `usePdfLoader` hook dynamically imports `pdfjs-dist` and extracts text from every page using `getTextContent()`. It tracks Y-axis coordinates to insert newlines at paragraph breaks and spaces at column gaps — preserving the original layout structure. The PDF file never leaves the browser.

### NLP Pipeline
When text is selected, a request goes to `/api/nlp/keywords`. Flask uses spaCy Named Entity Recognition (PERSON, ORG, GPE, WORK_OF_ART, etc.) to extract high-quality keywords. If spaCy is unavailable, a rule-based extractor identifies capitalized multi-word phrases and long content words while filtering stop words.

### Wikipedia Relevance Scoring
Keywords are used to query Wikipedia via direct title lookup and OpenSearch. Each candidate article is scored by how many words from the original selection appear in the article's title and extract. Results below 8% relevance are rejected to prevent off-topic matches.

### AI Study Tools
All AI calls route through Flask to OpenRouter's GPT-4o-mini endpoint. Each tool has a dedicated system prompt:
- **Explain**: 3-4 sentence plain-language explanation
- **Summary**: 4-5 bullet points of key ideas from the current page
- **Flashcards**: JSON array `[{"q":"...","a":"..."}]`, parsed and rendered as an interactive flip-card viewer

### AI Chat
Each chat message includes the current page's extracted text as context, the PDF filename, and the last 12 messages of conversation history. The AI knows what document you're reading and what page you're on. Chat history is persisted in MongoDB.

### State Management
Zustand manages two stores. `useStore` holds all reading state — pages, bookmarks, notes, search, and UI settings. `useAuth` handles JWT authentication. Both use Zustand's `persist` middleware to sync to localStorage. Only serializable data is persisted (not File objects). Changes to bookmarks and notes apply optimistically to local state, then sync to the backend in the background.


- [OpenRouter](https://openrouter.ai/) — Unified AI model API
- [Wikipedia REST API](https://en.wikipedia.org/api/rest_v1/) — Free encyclopedia data
- [Zustand](https://github.com/pmndrs/zustand) — Lightweight React state management
