#!/bin/bash

echo "🚀 Starting PDF Chat Frontend..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo ""
echo "✅ Dependencies ready!"
echo ""
echo "🌐 Starting React app on http://localhost:3000"
echo ""

# Run the development server
npm start
