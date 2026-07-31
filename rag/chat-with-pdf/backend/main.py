"""
Chat with PDF Backend
FastAPI server with PDF processing, OpenAI embeddings, and ChromaDB vector store
"""

import os
import uuid
import shutil
from typing import List, Optional
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import chromadb
from chromadb.config import Settings
import openai
from PyPDF2 import PdfReader

# Initialize FastAPI app
app = FastAPI(title="Chat with PDF API", version="1.0.0")

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage paths
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# ChromaDB setup
chroma_client = chromadb.Client(Settings(
    anonymized_telemetry=False,
    persist_directory="./chroma_db"
))

# Store for managing collections per document
document_collections = {}

# OpenAI client (will be set when API key is provided)
openai_client = None


class APIKeyRequest(BaseModel):
    api_key: str


class QuestionRequest(BaseModel):
    question: str
    document_id: str
    top_k: int = 5


class AnswerResponse(BaseModel):
    answer: str
    sources: List[dict]


class DocumentInfo(BaseModel):
    document_id: str
    filename: str
    num_chunks: int


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """Split text into overlapping chunks."""
    chunks = []
    start = 0
    text_length = len(text)
    
    while start < text_length:
        end = start + chunk_size
        chunk = text[start:end]
        
        # Try to break at sentence boundary
        if end < text_length:
            last_period = chunk.rfind('.')
            last_newline = chunk.rfind('\n')
            break_point = max(last_period, last_newline)
            if break_point > chunk_size * 0.5:
                chunk = chunk[:break_point + 1]
                end = start + break_point + 1
        
        chunks.append(chunk.strip())
        start = end - overlap
    
    return [c for c in chunks if c]  # Remove empty chunks


def extract_text_from_pdf(file_path: Path) -> str:
    """Extract text from PDF file."""
    reader = PdfReader(file_path)
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text


def get_embeddings(texts: List[str]) -> List[List[float]]:
    """Get embeddings from OpenAI."""
    if not openai_client:
        raise HTTPException(status_code=400, detail="OpenAI API key not set")
    
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=texts
    )
    return [item.embedding for item in response.data]


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "healthy", "message": "Chat with PDF API is running"}


@app.post("/api/set-api-key")
async def set_api_key(request: APIKeyRequest):
    """Set OpenAI API key."""
    global openai_client
    try:
        # Create client
        client = openai.OpenAI(api_key=request.api_key)
        
        # Test with a minimal embedding request
        client.embeddings.create(
            model="text-embedding-3-small",
            input="test"
        )
        
        # If successful, store the client
        openai_client = client
        return {"status": "success", "message": "API key validated and set"}
    except openai.AuthenticationError as e:
        openai_client = None
        raise HTTPException(status_code=400, detail="Invalid API key")
    except openai.RateLimitError as e:
        # Key is valid but rate limited - still accept it
        openai_client = client
        return {"status": "success", "message": "API key set (rate limited, but valid)"}
    except Exception as e:
        openai_client = None
        raise HTTPException(status_code=400, detail=f"Error validating key: {str(e)}")


@app.get("/api/check-api-key")
async def check_api_key():
    """Check if API key is set."""
    return {"is_set": openai_client is not None}


@app.post("/api/upload", response_model=DocumentInfo)
async def upload_pdf(file: UploadFile = File(...)):
    """Upload and process a PDF file."""
    if not openai_client:
        raise HTTPException(status_code=400, detail="Please set OpenAI API key first")
    
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Generate unique document ID
    document_id = str(uuid.uuid4())[:8]
    
    # Save uploaded file
    file_path = UPLOAD_DIR / f"{document_id}_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        # Extract text from PDF
        text = extract_text_from_pdf(file_path)
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
        
        # Chunk the text
        chunks = chunk_text(text)
        
        # Get embeddings for all chunks
        embeddings = get_embeddings(chunks)
        
        # Create ChromaDB collection for this document
        collection_name = f"doc_{document_id}"
        
        # Delete collection if it exists
        try:
            chroma_client.delete_collection(collection_name)
        except:
            pass
        
        collection = chroma_client.create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        
        # Add chunks to collection
        collection.add(
            ids=[f"chunk_{i}" for i in range(len(chunks))],
            embeddings=embeddings,
            documents=chunks,
            metadatas=[{"chunk_index": i, "document_id": document_id} for i in range(len(chunks))]
        )
        
        # Store collection reference
        document_collections[document_id] = {
            "collection_name": collection_name,
            "filename": file.filename,
            "num_chunks": len(chunks)
        }
        
        return DocumentInfo(
            document_id=document_id,
            filename=file.filename,
            num_chunks=len(chunks)
        )
        
    except Exception as e:
        # Clean up on error
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ask", response_model=AnswerResponse)
async def ask_question(request: QuestionRequest):
    """Ask a question about an uploaded document."""
    if not openai_client:
        raise HTTPException(status_code=400, detail="Please set OpenAI API key first")
    
    if request.document_id not in document_collections:
        raise HTTPException(status_code=404, detail="Document not found")
    
    doc_info = document_collections[request.document_id]
    
    try:
        # Get collection
        collection = chroma_client.get_collection(doc_info["collection_name"])
        
        # Get embedding for the question
        question_embedding = get_embeddings([request.question])[0]
        
        # Query the collection
        results = collection.query(
            query_embeddings=[question_embedding],
            n_results=request.top_k,
            include=["documents", "distances", "metadatas"]
        )
        
        # Prepare context from retrieved chunks
        context_chunks = results["documents"][0]
        distances = results["distances"][0]
        
        # Build context for GPT
        context = "\n\n---\n\n".join(context_chunks)
        
        # Generate answer using GPT
        system_prompt = """You are a helpful assistant that answers questions based on the provided context from a PDF document.
        
Rules:
- Only use information from the provided context to answer
- If the context doesn't contain enough information, say so
- Be concise but thorough
- Quote relevant parts when appropriate
- If asked about something not in the context, explain that the information is not available in the document"""

        user_prompt = f"""Context from the document:
{context}

Question: {request.question}

Please provide a helpful answer based on the context above."""

        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            max_tokens=1000
        )
        
        answer = response.choices[0].message.content
        
        # Prepare sources
        sources = [
            {
                "text": chunk[:200] + "..." if len(chunk) > 200 else chunk,
                "relevance": round(1 - dist, 3)  # Convert distance to similarity
            }
            for chunk, dist in zip(context_chunks, distances)
        ]
        
        return AnswerResponse(answer=answer, sources=sources)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/documents")
async def list_documents():
    """List all uploaded documents."""
    return {
        "documents": [
            {
                "document_id": doc_id,
                "filename": info["filename"],
                "num_chunks": info["num_chunks"]
            }
            for doc_id, info in document_collections.items()
        ]
    }


@app.delete("/api/documents/{document_id}")
async def delete_document(document_id: str):
    """Delete a document and its embeddings."""
    if document_id not in document_collections:
        raise HTTPException(status_code=404, detail="Document not found")
    
    doc_info = document_collections[document_id]
    
    try:
        # Delete ChromaDB collection
        chroma_client.delete_collection(doc_info["collection_name"])
        
        # Remove from tracking
        del document_collections[document_id]
        
        # Delete uploaded file
        for f in UPLOAD_DIR.glob(f"{document_id}_*"):
            f.unlink()
        
        return {"status": "success", "message": "Document deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
