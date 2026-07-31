# 📚 Chat with PDF

A full-stack application that lets you chat with your PDF documents using AI. Upload any PDF, and the app will create embeddings using OpenAI, store them in a vector database, and let you ask questions about the content.

![Tech Stack](https://img.shields.io/badge/React-18-blue) ![Python](https://img.shields.io/badge/Python-3.9+-green) ![OpenAI](https://img.shields.io/badge/OpenAI-API-orange)

## ✨ Features

- **PDF Upload**: Drag & drop or click to upload PDF files
- **Smart Chunking**: Automatically splits documents into optimized chunks
- **Vector Embeddings**: Uses OpenAI's `text-embedding-3-small` model
- **Semantic Search**: Finds the most relevant passages for your questions
- **AI Answers**: GPT-4o-mini generates accurate answers from your documents
- **Source Citations**: See exactly which parts of the document were used
- **Beautiful UI**: Dark cyberpunk-themed interface

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React Frontend │────▶│   FastAPI       │────▶│   ChromaDB      │
│   (Port 3000)    │◀────│   (Port 8000)   │◀────│   (Vector Store)│
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   OpenAI API    │
                        │   (Embeddings   │
                        │    & Chat)      │
                        └─────────────────┘
```

## 📋 Prerequisites

Make sure you have the following installed on your MacBook:

- **Python 3.9+**: `brew install python@3.11`
- **Node.js 18+**: `brew install node`
- **OpenAI API Key**: Get one from [platform.openai.com](https://platform.openai.com)

## 🚀 Quick Start

### 1. Clone or Download the Project

Save all files to a directory called `chat-with-pdf`.

### 2. Start the Backend (Terminal 1)

```bash
cd chat-with-pdf/backend

# Make the script executable
chmod +x start.sh

# Run the backend
./start.sh
```

Or manually:
```bash
cd chat-with-pdf/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload --port 8000
```

The backend will start at `http://localhost:8000`

### 3. Start the Frontend (Terminal 2)

```bash
cd chat-with-pdf/frontend

# Make the script executable
chmod +x start.sh

# Run the frontend
./start.sh
```

Or manually:
```bash
cd chat-with-pdf/frontend

# Install dependencies
npm install

# Start the development server
npm start
```

The frontend will open at `http://localhost:3000`

### 4. Use the App

1. **Enter your OpenAI API key** in the header
2. **Upload a PDF** by dragging or clicking the upload zone
3. **Ask questions** about your document in the chat

## 📁 Project Structure

```
chat-with-pdf/
├── backend/
│   ├── main.py              # FastAPI server with all endpoints
│   ├── requirements.txt     # Python dependencies
│   ├── start.sh            # Backend startup script
│   ├── uploads/            # Uploaded PDFs (created automatically)
│   └── chroma_db/          # Vector database (created automatically)
│
├── frontend/
│   ├── public/
│   │   └── index.html      # HTML template
│   ├── src/
│   │   ├── index.js        # React entry point
│   │   ├── index.css       # Cyberpunk-themed styles
│   │   └── App.js          # Main React component
│   ├── package.json        # Node dependencies
│   └── start.sh           # Frontend startup script
│
└── README.md               # This file
```

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/api/set-api-key` | POST | Set OpenAI API key |
| `/api/check-api-key` | GET | Check if API key is set |
| `/api/upload` | POST | Upload and process PDF |
| `/api/documents` | GET | List all documents |
| `/api/documents/{id}` | DELETE | Delete a document |
| `/api/ask` | POST | Ask a question |

## 🛠️ How It Works

### 1. PDF Upload & Processing
- PDF is uploaded via React frontend
- Backend extracts text using PyPDF2
- Text is split into overlapping chunks (~1000 chars, 200 overlap)

### 2. Embedding Generation
- Each chunk is sent to OpenAI's embedding API
- Uses `text-embedding-3-small` model (1536 dimensions)
- Embeddings are stored in ChromaDB with metadata

### 3. Question Answering
- User's question is converted to an embedding
- ChromaDB performs cosine similarity search
- Top 5 most relevant chunks are retrieved
- GPT-4o-mini generates an answer using the context

## ⚙️ Configuration

### Change Embedding Model
In `backend/main.py`, modify:
```python
model="text-embedding-3-small"  # or "text-embedding-3-large"
```

### Change Chat Model
In `backend/main.py`, modify:
```python
model="gpt-4o-mini"  # or "gpt-4o", "gpt-4-turbo"
```

### Adjust Chunk Size
In `backend/main.py`, modify:
```python
chunks = chunk_text(text, chunk_size=1000, overlap=200)
```

## 🐛 Troubleshooting

### "CORS Error"
Make sure both servers are running and the frontend is accessing `http://localhost:8000`

### "Invalid API Key"
- Check your OpenAI API key is correct
- Ensure you have credits in your OpenAI account

### "Could not extract text from PDF"
- Some PDFs are image-based (scanned documents)
- Try a text-based PDF or use OCR first

### Port Already in Use
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

## 💰 Cost Estimation

- **Embeddings**: ~$0.02 per 1M tokens (~3000 pages)
- **Chat**: ~$0.15-0.60 per 1M input tokens (GPT-4o-mini)

A typical 20-page PDF costs less than $0.01 to process.

## 🔒 Security Notes

- API key is stored only in memory (not persisted)
- Uploaded files are stored locally in `backend/uploads/`
- No data is sent to external services except OpenAI

