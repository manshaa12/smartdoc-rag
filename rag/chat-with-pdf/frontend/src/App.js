import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { 
  FileText, 
  Send, 
  Trash2, 
  Upload, 
  Key, 
  MessageSquare,
  Zap,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';

const API_URL = 'http://localhost:8000';

function App() {
  // State
  const [apiKey, setApiKey] = useState('');
  const [isApiKeySet, setIsApiKeySet] = useState(false);
  const [isSettingKey, setIsSettingKey] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Check API key status on mount
  useEffect(() => {
    checkApiKey();
    fetchDocuments();
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const checkApiKey = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/check-api-key`);
      setIsApiKeySet(response.data.is_set);
    } catch (error) {
      console.error('Error checking API key:', error);
    }
  };

  const setApiKeyHandler = async () => {
    if (!apiKey.trim()) return;
    
    setIsSettingKey(true);
    try {
      await axios.post(`${API_URL}/api/set-api-key`, { api_key: apiKey });
      setIsApiKeySet(true);
      setApiKey('');
    } catch (error) {
      alert('Invalid API key. Please check and try again.');
    } finally {
      setIsSettingKey(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/documents`);
      setDocuments(response.data.documents);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!isApiKeySet) {
      alert('Please set your OpenAI API key first');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 50) / progressEvent.total);
          setUploadProgress(progress);
        }
      });

      // Simulate processing progress
      setUploadProgress(75);
      await new Promise(resolve => setTimeout(resolve, 500));
      setUploadProgress(100);

      const newDoc = response.data;
      setDocuments(prev => [...prev, newDoc]);
      setSelectedDoc(newDoc);
      setMessages([]);
      
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to upload file';
      alert(errorMsg);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [isApiKeySet]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    disabled: isUploading
  });

  const deleteDocument = async (docId, e) => {
    e.stopPropagation();
    
    try {
      await axios.delete(`${API_URL}/api/documents/${docId}`);
      setDocuments(prev => prev.filter(d => d.document_id !== docId));
      if (selectedDoc?.document_id === docId) {
        setSelectedDoc(null);
        setMessages([]);
      }
    } catch (error) {
      alert('Failed to delete document');
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || !selectedDoc || isLoading) return;

    const question = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/ask`, {
        question,
        document_id: selectedDoc.document_id,
        top_k: 5
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.data.answer,
        sources: response.data.sources
      }]);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to get response';
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${errorMsg}`,
        isError: true
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <div className="logo-icon">
              <Zap size={24} color="#0a0a0f" />
            </div>
            <div>
              <div className="logo-text">PDF Neural Interface</div>
              <div className="logo-subtitle">Powered by OpenAI</div>
            </div>
          </div>

          <div className="api-key-section">
            {!isApiKeySet ? (
              <>
                <input
                  type="password"
                  className="api-key-input"
                  placeholder="Enter OpenAI API Key..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && setApiKeyHandler()}
                />
                <button 
                  className="btn btn-primary" 
                  onClick={setApiKeyHandler}
                  disabled={isSettingKey || !apiKey.trim()}
                >
                  {isSettingKey ? <Loader2 size={18} className="animate-spin" /> : <Key size={18} />}
                  Connect
                </button>
              </>
            ) : (
              <div className="api-status connected">
                <span className="status-dot"></span>
                <CheckCircle size={16} />
                API Connected
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-title">Documents</div>
            
            {/* Upload Zone */}
            <div 
              {...getRootProps()} 
              className={`upload-zone ${isDragActive ? 'drag-active' : ''} ${isUploading ? 'uploading' : ''}`}
            >
              <input {...getInputProps()} />
              <Upload size={32} className="upload-icon" />
              <div className="upload-text">
                {isDragActive ? 'Drop your PDF here' : 'Drop PDF or click to upload'}
              </div>
              <div className="upload-hint">.pdf files only</div>
              
              {isUploading && (
                <div className="upload-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <div className="progress-text">
                    {uploadProgress < 50 ? 'Uploading...' : 
                     uploadProgress < 100 ? 'Processing & Creating Embeddings...' : 'Complete!'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Document List */}
          <div className="document-list">
            {documents.map((doc) => (
              <div
                key={doc.document_id}
                className={`document-item ${selectedDoc?.document_id === doc.document_id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedDoc(doc);
                  setMessages([]);
                }}
              >
                <div className="document-name">
                  <FileText size={16} style={{ marginRight: '8px', opacity: 0.7 }} />
                  {doc.filename}
                </div>
                <div className="document-meta">
                  <span className="document-chunks">{doc.num_chunks} chunks</span>
                  <button 
                    className="document-delete"
                    onClick={(e) => deleteDocument(doc.document_id, e)}
                    title="Delete document"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Chat Area */}
        <main className="chat-area">
          {selectedDoc ? (
            <>
              {/* Chat Header */}
              <div className="chat-header">
                <div>
                  <div className="chat-title">Chat with Document</div>
                  <div className="chat-document">{selectedDoc.filename}</div>
                </div>
              </div>

              {/* Messages */}
              <div className="messages-container">
                {messages.length === 0 && (
                  <div className="empty-state">
                    <MessageSquare size={48} className="empty-icon" />
                    <div className="empty-title">Start a conversation</div>
                    <div className="empty-text">
                      Ask any question about your document and I'll find the relevant information for you.
                    </div>
                  </div>
                )}
                
                {messages.map((msg, idx) => (
                  <div key={idx} className={`message ${msg.role}`}>
                    <div className={`message-content ${msg.isError ? 'error' : ''}`}>
                      {msg.content}
                      
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="message-sources">
                          <div className="sources-title">Sources</div>
                          {msg.sources.slice(0, 3).map((source, sIdx) => (
                            <div key={sIdx} className="source-item">
                              {source.text}
                              <div className="source-relevance">
                                Relevance: {(source.relevance * 100).toFixed(1)}%
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="message assistant">
                    <div className="typing-indicator">
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="chat-input-container">
                <div className="chat-input-wrapper">
                  <textarea
                    ref={inputRef}
                    className="chat-input"
                    placeholder="Ask a question about your document..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                    rows={1}
                  />
                  <button 
                    className="send-button"
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || isLoading}
                  >
                    {isLoading ? (
                      <div className="loading-spinner"></div>
                    ) : (
                      <Send size={20} />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <FileText size={64} className="empty-icon" />
              <div className="empty-title">No document selected</div>
              <div className="empty-text">
                Upload a PDF document or select one from the sidebar to start chatting.
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
