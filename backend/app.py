"""
Folio Backend — Flask + MongoDB + spaCy NLP + OpenAI
Run: python app.py
Requires: .env with MONGO_URI, JWT_SECRET, OPENAI_API_KEY
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timedelta
import os, jwt, bcrypt, re
from functools import wraps
from dotenv import load_dotenv
from openai import OpenAI

# ── NLP imports (spaCy optional, fallback to rule-based) ────────
try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
    SPACY_AVAILABLE = True
except Exception:
    SPACY_AVAILABLE = False
    nlp = None

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://localhost:3000"], supports_credentials=True)

# ── MongoDB ──────────────────────────────────────────────────────
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/folio")
client = MongoClient(MONGO_URI)
db = client.folio

users_col      = db.users
bookmarks_col  = db.bookmarks
notes_col      = db.notes
folders_col    = db.folders
progress_col   = db.reading_progress
chat_col       = db.chat_history

JWT_SECRET  = os.getenv("JWT_SECRET")
JWT_EXPIRY  = timedelta(days=30)



# ── Helpers ──────────────────────────────────────────────────────
def serialize(doc):
    """Convert MongoDB doc to JSON-safe dict."""
    if doc is None:
        return None
    doc = dict(doc)
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            doc[k] = str(v)
        elif isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
        if not token:
            return jsonify({"error": "Token missing"}), 401
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            current_user = users_col.find_one({"_id": ObjectId(data["user_id"])})
            if not current_user:
                return jsonify({"error": "User not found"}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except Exception:
            return jsonify({"error": "Invalid token"}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# ── NLP: Smart keyword extraction ────────────────────────────────
STOP_WORDS = {
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'by','from','is','are','was','were','be','been','have','has','had',
    'do','does','did','will','would','could','should','may','might',
    'this','that','these','those','it','its','they','them','their','we',
    'our','you','your','he','she','his','her','also','such','than','when',
    'which','where','who','how','what','not','can','into','as','if','so',
    'about','before','after','each','other','more','very','just','while',
    'acts','act','said','says','say','called','named','known','used',
    'based','found','given','made','set','came','come','goes','went',
}

def extract_keywords_spacy(text: str) -> list[str]:
    """Use spaCy NER + noun chunks for high-quality keyword extraction."""
    doc = nlp(text[:1000])
    keywords = []

    # Named entities first (highest confidence)
    for ent in doc.ents:
        if ent.label_ in ("PERSON","ORG","GPE","LOC","EVENT","WORK_OF_ART","PRODUCT","NORP","FAC"):
            kw = ent.text.strip()
            if len(kw) > 2 and kw not in keywords:
                keywords.append(kw)

    # Noun chunks (skip if dominated by stop words)
    for chunk in doc.noun_chunks:
        head = chunk.root.text.lower()
        if head not in STOP_WORDS and len(chunk.text) > 3:
            kw = chunk.text.strip()
            if kw not in keywords:
                keywords.append(kw)

    return keywords[:5]

def extract_keywords_rule(text: str) -> list[str]:
    """
    Rule-based extraction when spaCy model unavailable.
    Strategy: prefer capitalized multi-word phrases (proper nouns),
    then long content words. Crucially filters generic tech/networking
    jargon that causes off-topic Wikipedia hits.
    """
    # Remove punctuation except apostrophes and hyphens within words
    clean = re.sub(r"[^\w\s'-]", " ", text)
    words = clean.split()

    # Step 1: find capitalized runs (likely proper nouns / named entities)
    proper_phrases = []
    i = 0
    while i < len(words):
        w = words[i]
        if w and w[0].isupper() and w.lower() not in STOP_WORDS and len(w) > 2:
            phrase = [w]
            j = i + 1
            while j < len(words) and words[j] and words[j][0].isupper() and words[j].lower() not in STOP_WORDS:
                phrase.append(words[j])
                j += 1
            if len(phrase) >= 2 or len(phrase[0]) >= 5:
                proper_phrases.append(" ".join(phrase))
            i = j
        else:
            i += 1

    # Step 2: content words (long, not stop words)
    content_words = [
        w for w in words
        if len(w) >= 6
        and w.lower() not in STOP_WORDS
        and not w.isnumeric()
        and re.match(r'^[a-zA-Z]', w)
    ]

    # Deduplicate while preserving order
    seen = set()
    result = []
    for phrase in (proper_phrases + content_words):
        key = phrase.lower()
        if key not in seen:
            seen.add(key)
            result.append(phrase)

    return result[:5]

def extract_keywords(text: str) -> list[str]:
    if SPACY_AVAILABLE and nlp:
        return extract_keywords_spacy(text)
    return extract_keywords_rule(text)

# ══════════════════════════════════════════════════════════════════
#  AUTH ROUTES
# ══════════════════════════════════════════════════════════════════

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    name = data.get("name", "Reader").strip()

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    if users_col.find_one({"email": email}):
        return jsonify({"error": "Email already registered"}), 409

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
    user = {
        "email": email,
        "name": name,
        "password": hashed,
        "createdAt": datetime.utcnow(),
        "avatar": name[0].upper(),
    }
    result = users_col.insert_one(user)
    user_id = str(result.inserted_id)

    # Create default "My Library" folder
    folders_col.insert_one({
        "userId": user_id,
        "name": "My Library",
        "color": "#b5451b",
        "icon": "📚",
        "createdAt": datetime.utcnow(),
        "isDefault": True,
    })

    token = jwt.encode(
        {"user_id": user_id, "exp": datetime.utcnow() + JWT_EXPIRY},
        JWT_SECRET, algorithm="HS256"
    )
    return jsonify({
        "token": token,
        "user": {"id": user_id, "email": email, "name": name, "avatar": name[0].upper()}
    }), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = users_col.find_one({"email": email})
    if not user or not bcrypt.checkpw(password.encode(), user["password"]):
        return jsonify({"error": "Invalid credentials"}), 401

    user_id = str(user["_id"])
    token = jwt.encode(
        {"user_id": user_id, "exp": datetime.utcnow() + JWT_EXPIRY},
        JWT_SECRET, algorithm="HS256"
    )
    return jsonify({
        "token": token,
        "user": {
            "id": user_id,
            "email": user["email"],
            "name": user.get("name", "Reader"),
            "avatar": user.get("avatar", "R"),
        }
    })


@app.route("/api/auth/me", methods=["GET"])
@token_required
def me(current_user):
    u = serialize(current_user)
    u.pop("password", None)
    return jsonify({"user": u})

# ══════════════════════════════════════════════════════════════════
#  FOLDERS
# ══════════════════════════════════════════════════════════════════

@app.route("/api/folders", methods=["GET"])
@token_required
def get_folders(current_user):
    user_id = str(current_user["_id"])
    docs = list(folders_col.find({"userId": user_id}).sort("createdAt", 1))
    return jsonify({"folders": [serialize(d) for d in docs]})


@app.route("/api/folders", methods=["POST"])
@token_required
def create_folder(current_user):
    user_id = str(current_user["_id"])
    data = request.get_json()
    folder = {
        "userId": user_id,
        "name": data.get("name", "New Folder"),
        "color": data.get("color", "#1a56db"),
        "icon": data.get("icon", "📁"),
        "createdAt": datetime.utcnow(),
        "isDefault": False,
    }
    result = folders_col.insert_one(folder)
    folder["_id"] = result.inserted_id
    return jsonify({"folder": serialize(folder)}), 201


@app.route("/api/folders/<folder_id>", methods=["PUT"])
@token_required
def update_folder(current_user, folder_id):
    user_id = str(current_user["_id"])
    data = request.get_json()
    folders_col.update_one(
        {"_id": ObjectId(folder_id), "userId": user_id},
        {"$set": {k: v for k, v in data.items() if k in ("name","color","icon")}}
    )
    return jsonify({"ok": True})


@app.route("/api/folders/<folder_id>", methods=["DELETE"])
@token_required
def delete_folder(current_user, folder_id):
    user_id = str(current_user["_id"])
    folder = folders_col.find_one({"_id": ObjectId(folder_id), "userId": user_id})
    if folder and folder.get("isDefault"):
        return jsonify({"error": "Cannot delete default folder"}), 400
    folders_col.delete_one({"_id": ObjectId(folder_id), "userId": user_id})
    return jsonify({"ok": True})

# ══════════════════════════════════════════════════════════════════
#  BOOKMARKS
# ══════════════════════════════════════════════════════════════════

@app.route("/api/bookmarks/<pdf_name>", methods=["GET"])
@token_required
def get_bookmarks(current_user, pdf_name):
    user_id = str(current_user["_id"])
    docs = list(bookmarks_col.find({"userId": user_id, "pdfName": pdf_name}).sort("page", 1))
    return jsonify({"bookmarks": [serialize(d) for d in docs]})


@app.route("/api/bookmarks", methods=["POST"])
@token_required
def upsert_bookmark(current_user):
    user_id = str(current_user["_id"])
    data = request.get_json()
    pdf_name = data.get("pdfName")
    page = data.get("page")

    # Toggle: remove if exists
    existing = bookmarks_col.find_one({"userId": user_id, "pdfName": pdf_name, "page": page})
    if existing:
        bookmarks_col.delete_one({"_id": existing["_id"]})
        return jsonify({"action": "removed", "bookmarkId": str(existing["_id"])})

    doc = {
        "userId": user_id,
        "pdfName": pdf_name,
        "page": page,
        "label": data.get("label", f"Page {page}"),
        "snippet": data.get("snippet", "")[:200],
        "color": data.get("color", "accent"),
        "folderId": data.get("folderId"),
        "createdAt": datetime.utcnow(),
    }
    result = bookmarks_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return jsonify({"action": "added", "bookmark": serialize(doc)}), 201


@app.route("/api/bookmarks/<bookmark_id>", methods=["PUT"])
@token_required
def update_bookmark(current_user, bookmark_id):
    user_id = str(current_user["_id"])
    data = request.get_json()
    bookmarks_col.update_one(
        {"_id": ObjectId(bookmark_id), "userId": user_id},
        {"$set": {k: v for k, v in data.items() if k in ("label","color","folderId","snippet")}}
    )
    return jsonify({"ok": True})


@app.route("/api/bookmarks/<bookmark_id>", methods=["DELETE"])
@token_required
def delete_bookmark(current_user, bookmark_id):
    user_id = str(current_user["_id"])
    bookmarks_col.delete_one({"_id": ObjectId(bookmark_id), "userId": user_id})
    return jsonify({"ok": True})

# ══════════════════════════════════════════════════════════════════
#  NOTES
# ══════════════════════════════════════════════════════════════════

@app.route("/api/notes/<pdf_name>", methods=["GET"])
@token_required
def get_notes(current_user, pdf_name):
    user_id = str(current_user["_id"])
    docs = list(notes_col.find({"userId": user_id, "pdfName": pdf_name}).sort("createdAt", -1))
    return jsonify({"notes": [serialize(d) for d in docs]})


@app.route("/api/notes", methods=["POST"])
@token_required
def add_note(current_user):
    user_id = str(current_user["_id"])
    data = request.get_json()
    doc = {
        "userId": user_id,
        "pdfName": data.get("pdfName"),
        "page": data.get("page"),
        "text": data.get("text", ""),
        "color": data.get("color", "yellow"),
        "selection": data.get("selection", "")[:300],
        "createdAt": datetime.utcnow(),
    }
    result = notes_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return jsonify({"note": serialize(doc)}), 201


@app.route("/api/notes/<note_id>", methods=["PUT"])
@token_required
def update_note(current_user, note_id):
    user_id = str(current_user["_id"])
    data = request.get_json()
    notes_col.update_one(
        {"_id": ObjectId(note_id), "userId": user_id},
        {"$set": {"text": data.get("text", ""), "updatedAt": datetime.utcnow()}}
    )
    return jsonify({"ok": True})


@app.route("/api/notes/<note_id>", methods=["DELETE"])
@token_required
def delete_note(current_user, note_id):
    user_id = str(current_user["_id"])
    notes_col.delete_one({"_id": ObjectId(note_id), "userId": user_id})
    return jsonify({"ok": True})

# ══════════════════════════════════════════════════════════════════
#  READING PROGRESS
# ══════════════════════════════════════════════════════════════════

@app.route("/api/progress/<pdf_name>", methods=["GET"])
@token_required
def get_progress(current_user, pdf_name):
    user_id = str(current_user["_id"])
    doc = progress_col.find_one({"userId": user_id, "pdfName": pdf_name})
    return jsonify({"progress": serialize(doc)})


@app.route("/api/progress", methods=["POST"])
@token_required
def save_progress(current_user):
    user_id = str(current_user["_id"])
    data = request.get_json()
    pdf_name = data.get("pdfName")
    page = data.get("page", 1)
    total = data.get("totalPages", 1)

    progress_col.update_one(
        {"userId": user_id, "pdfName": pdf_name},
        {"$set": {
            "page": page,
            "totalPages": total,
            "percentComplete": round((page / total) * 100, 1) if total else 0,
            "lastRead": datetime.utcnow(),
        }, "$setOnInsert": {"firstRead": datetime.utcnow()}},
        upsert=True
    )
    return jsonify({"ok": True})


@app.route("/api/progress/all", methods=["GET"])
@token_required
def get_all_progress(current_user):
    user_id = str(current_user["_id"])
    docs = list(progress_col.find({"userId": user_id}).sort("lastRead", -1).limit(20))
    return jsonify({"history": [serialize(d) for d in docs]})

# ══════════════════════════════════════════════════════════════════
#  NLP — Wikipedia keyword extraction
# ══════════════════════════════════════════════════════════════════

@app.route("/api/nlp/keywords", methods=["POST"])
@token_required
def nlp_keywords(current_user):
    data = request.get_json()
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"keywords": [], "method": "none"})

    keywords = extract_keywords(text)
    method = "spacy" if (SPACY_AVAILABLE and nlp) else "rule-based"
    return jsonify({"keywords": keywords, "method": method})

# ══════════════════════════════════════════════════════════════════
#  AI — OpenAI powered features
# ══════════════════════════════════════════════════════════════════

def call_openai(messages: list, max_tokens: int = 400) -> str:
    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        raise ValueError("OPENAI_API_KEY not set in .env")

    client = OpenAI(
        api_key=api_key,  
        base_url="https://openrouter.ai/api/v1"  # 🔥 OpenRouter endpoint
    )

    response = client.chat.completions.create(
        model="openai/gpt-4o-mini",  # 🔥 required format for OpenRouter
        messages=messages,
        max_tokens=max_tokens,
        temperature=0.7,
    )

    return response.choices[0].message.content.strip()


@app.route("/api/ai/explain", methods=["POST"])
@token_required
def ai_explain(current_user):
    data = request.get_json()
    text = data.get("text", "")[:800]
    try:
        result = call_openai([
            {"role": "system", "content": "You are a helpful study assistant. Explain concepts clearly and concisely in 3-4 sentences."},
            {"role": "user", "content": f'Explain this passage in simple terms:\n\n"{text}"'}
        ])
        return jsonify({"result": result, "type": "explain"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/ai/summary", methods=["POST"])
@token_required
def ai_summary(current_user):
    data = request.get_json()
    text = data.get("text", "")[:2000]
    page = data.get("page", "?")
    try:
        result = call_openai([
            {"role": "system", "content": "You are a concise study summarizer. Return 4-5 bullet points (use • character) of the key ideas."},
            {"role": "user", "content": f"Summarize page {page} key concepts:\n\n{text}"}
        ])
        return jsonify({"result": result, "type": "summary"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/ai/flashcards", methods=["POST"])
@token_required
def ai_flashcards(current_user):
    data = request.get_json()
    text = data.get("text", "")[:1200]
    try:
        result = call_openai([
            {"role": "system", "content": 'Return ONLY a JSON array of flashcards: [{"q":"question","a":"answer"}]. No markdown, no preamble. Generate 4 cards.'},
            {"role": "user", "content": f"Create flashcards from:\n\n{text}"}
        ], max_tokens=600)
        # Validate JSON
        import json
        cards = json.loads(result.replace("```json","").replace("```","").strip())
        return jsonify({"result": result, "cards": cards, "type": "flashcards"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/ai/chat", methods=["POST"])
@token_required
def ai_chat(current_user):
    """PDF-aware conversational chat with history."""
    user_id = str(current_user["_id"])
    data = request.get_json()
    pdf_name = data.get("pdfName", "")
    user_message = data.get("message", "")
    page_context = data.get("pageContext", "")
    history = data.get("history", [])  # [{role, content}, ...]

    if not user_message:
        return jsonify({"error": "Message required"}), 400

    try:
        system_prompt = (
            "You are Folio, an intelligent reading assistant embedded in a PDF reader. "
            "You help users understand, analyze, and study the document they are reading. "
            "Be concise, insightful, and pedagogically helpful. "
            f"Document: {pdf_name}. "
            f"Current page excerpt: {page_context[:600] if page_context else 'not provided'}."
        )

        messages = [{"role": "system", "content": system_prompt}]

        # Include recent history (last 6 exchanges)
        for msg in history[-12:]:
            if msg.get("role") in ("user", "assistant"):
                messages.append({"role": msg["role"], "content": msg["content"]})

        messages.append({"role": "user", "content": user_message})

        result = call_openai(messages, max_tokens=500)

        # Persist chat message
        chat_col.insert_one({
            "userId": user_id,
            "pdfName": pdf_name,
            "role": "user",
            "content": user_message,
            "createdAt": datetime.utcnow(),
        })
        chat_col.insert_one({
            "userId": user_id,
            "pdfName": pdf_name,
            "role": "assistant",
            "content": result,
            "createdAt": datetime.utcnow(),
        })

        return jsonify({"result": result, "type": "chat"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/ai/chat/history/<pdf_name>", methods=["GET"])
@token_required
def get_chat_history(current_user, pdf_name):
    user_id = str(current_user["_id"])
    docs = list(chat_col.find(
        {"userId": user_id, "pdfName": pdf_name}
    ).sort("createdAt", 1).limit(50))
    return jsonify({"history": [serialize(d) for d in docs]})

# ══════════════════════════════════════════════════════════════════
#  HEALTH
# ══════════════════════════════════════════════════════════════════

@app.route("/api/health", methods=["GET"])
def health():
    spacy_status = "spacy-model" if (SPACY_AVAILABLE and nlp) else "rule-based-nlp"
    try:
        client.admin.command("ping")
        mongo_status = "connected"
    except Exception:
        mongo_status = "disconnected"
    return jsonify({
        "status": "ok",
        "nlp": spacy_status,
        "mongodb": mongo_status,
        "openai": "configured" if os.getenv("OPENAI_API_KEY") else "missing-key",
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
