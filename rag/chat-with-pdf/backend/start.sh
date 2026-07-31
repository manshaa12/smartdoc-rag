#!/bin/bash

echo "🚀 Starting PDF Chat Backend..."
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt --quiet

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "🌐 Starting FastAPI server on http://localhost:8000"
echo "📚 API docs available at http://localhost:8000/docs"
echo ""

# Run the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
