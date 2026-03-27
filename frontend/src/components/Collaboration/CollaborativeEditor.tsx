import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Edit3, Users, Save, Download, Upload, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Link, Image, Code, Eye, EyeOff, MessageSquare, History, Palette, Type } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';

interface CollaborativeUser {
  userId: string;
  socketId: string;
  displayName: string;
  color: string;
  cursor?: {
    line: number;
    column: number;
    visible: boolean;
  };
  selection?: {
    start: number;
    end: number;
    text: string;
  };
  isTyping: boolean;
  lastActivity: Date;
}

interface DocumentOperation {
  type: 'insert' | 'delete' | 'retain' | 'format';
  position: number;
  length?: number;
  content?: string;
  attributes?: any;
  userId: string;
  timestamp: number;
  version: number;
}

interface Comment {
  id: string;
  userId: string;
  displayName: string;
  content: string;
  range: { start: number; end: number };
  createdAt: Date;
  resolved: boolean;
  replies: Array<{
    id: string;
    userId: string;
    displayName: string;
    content: string;
    createdAt: Date;
  }>;
}

interface CollaborativeEditorProps {
  documentId: string;
  initialContent?: string;
  readOnly?: boolean;
  onContentChange?: (content: string) => void;
  onUserJoined?: (user: CollaborativeUser) => void;
  onUserLeft?: (userId: string) => void;
  className?: string;
}

export const CollaborativeEditor: React.FC<CollaborativeEditorProps> = ({
  documentId,
  initialContent = '',
  readOnly = false,
  onContentChange,
  onUserJoined,
  onUserLeft,
  className = ''
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [users, setUsers] = useState<CollaborativeUser[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [version, setVersion] = useState(0);
  const [pendingOperations, setPendingOperations] = useState<DocumentOperation[]>([]);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    code: false
  });

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // User colors for collaboration
  const userColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
  ];

  // Initialize socket connection
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    const newSocket = io(process.env.REACT_APP_COLLABORATION_SERVICE_URL || 'http://localhost:3003', {
      auth: { token }
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to collaborative editor service');
      
      // Join document session
      newSocket.emit('join-document', { documentId });
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from collaborative editor service');
    });

    newSocket.on('document-joined', (data: { content: string, version: number, users: CollaborativeUser[] }) => {
      setContent(data.content);
      setVersion(data.version);
      setUsers(data.users);
      onUserJoined?.(data.users[0]); // Current user
    });

    newSocket.on('user-joined', (user: CollaborativeUser) => {
      setUsers(prev => [...prev, user]);
      onUserJoined?.(user);
      toast(`${user.displayName} joined the document`);
    });

    newSocket.on('user-left', (data: { userId: string }) => {
      setUsers(prev => prev.filter(u => u.userId !== data.userId));
      onUserLeft?.(data.userId);
      toast('A user left the document');
    });

    newSocket.on('operation', (operation: DocumentOperation) => {
      applyOperation(operation);
    });

    newSocket.on('cursor-update', (data: { userId: string, cursor: { line: number; column: number; visible: boolean } }) => {
      setUsers(prev => prev.map(u => 
        u.userId === data.userId ? { ...u, cursor: data.cursor } : u
      ));
    });

    newSocket.on('selection-update', (data: { userId: string, selection: { start: number; end: number; text: string } }) => {
      setUsers(prev => prev.map(u => 
        u.userId === data.userId ? { ...u, selection: data.selection } : u
      ));
    });

    newSocket.on('typing', (data: { userId: string, isTyping: boolean }) => {
      setUsers(prev => prev.map(u => 
        u.userId === data.userId ? { ...u, isTyping: data.isTyping } : u
      ));
    });

    newSocket.on('comment-added', (comment: Comment) => {
      setComments(prev => [...prev, comment]);
    });

    newSocket.on('comment-updated', (comment: Comment) => {
      setComments(prev => prev.map(c => c.id === comment.id ? comment : c));
    });

    newSocket.on('comment-deleted', (commentId: string) => {
      setComments(prev => prev.filter(c => c.id !== commentId));
    });

    newSocket.on('error', (error: { message: string }) => {
      toast.error(error.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [documentId]);

  // Apply operation to document
  const applyOperation = useCallback((operation: DocumentOperation) => {
    setContent(prevContent => {
      let newContent = prevContent;
      
      switch (operation.type) {
        case 'insert':
          newContent = prevContent.slice(0, operation.position) + 
                     operation.content + 
                     prevContent.slice(operation.position);
          break;
        case 'delete':
          newContent = prevContent.slice(0, operation.position) + 
                     prevContent.slice(operation.position + operation.length!);
          break;
        case 'retain':
          // No content change, just position tracking
          break;
        case 'format':
          // Apply formatting (simplified - in real implementation would use rich text)
          break;
      }
      
      return newContent;
    });
    
    setVersion(prev => prev + 1);
    onContentChange?.(content);
  }, [content, onContentChange]);

  // Handle content changes
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const cursorPosition = e.target.selectionStart;
    
    // Calculate operation
    let operation: DocumentOperation | null = null;
    
    if (newContent.length > content.length) {
      // Insert operation
      const insertedContent = newContent.slice(content.length);
      operation = {
        type: 'insert',
        position: content.length,
        content: insertedContent,
        userId: socket?.userId || '',
        timestamp: Date.now(),
        version: version + 1
      };
    } else if (newContent.length < content.length) {
      // Delete operation
      const deletedLength = content.length - newContent.length;
      operation = {
        type: 'delete',
        position: cursorPosition,
        length: deletedLength,
        userId: socket?.userId || '',
        timestamp: Date.now(),
        version: version + 1
      };
    }
    
    setContent(newContent);
    onContentChange?.(newContent);
    
    // Send operation to server
    if (operation && socket) {
      socket.emit('operation', { documentId, operation });
    }
    
    // Handle typing indicator
    setIsTyping(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (socket) {
        socket.emit('typing', { documentId, isTyping: false });
      }
    }, 1000);
    
    if (socket) {
      socket.emit('typing', { documentId, isTyping: true });
    }
  };

  // Handle cursor position changes
  const handleCursorChange = () => {
    if (!editorRef.current || !socket) return;
    
    const textarea = editorRef.current;
    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = textarea.value.substring(0, cursorPosition);
    const lines = textBeforeCursor.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    
    socket.emit('cursor-update', {
      documentId,
      cursor: { line, column, visible: true }
    });
  };

  // Handle selection changes
  const handleSelectionChange = () => {
    if (!editorRef.current || !socket) return;
    
    const textarea = editorRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    if (start !== end) {
      const selectedText = textarea.value.substring(start, end);
      socket.emit('selection-update', {
        documentId,
        selection: { start, end, text: selectedText }
      });
    }
    
    setSelection(start !== end ? { start, end } : null);
  };

  // Format text
  const formatText = (format: string) => {
    if (!editorRef.current || readOnly) return;
    
    const textarea = editorRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    
    let formattedText = selectedText;
    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'underline':
        formattedText = `__${selectedText}__`;
        break;
      case 'code':
        formattedText = `\`${selectedText}\``;
        break;
    }
    
    const newContent = textarea.value.substring(0, start) + formattedText + textarea.value.substring(end);
    setContent(newContent);
    
    // Send operation
    if (socket) {
      const operation: DocumentOperation = {
        type: 'insert',
        position: start,
        content: formattedText,
        userId: socket.userId || '',
        timestamp: Date.now(),
        version: version + 1
      };
      socket.emit('operation', { documentId, operation });
    }
  };

  // Add comment
  const addComment = (content: string) => {
    if (!selection || !socket) return;
    
    const comment: Comment = {
      id: Date.now().toString(),
      userId: socket.userId || '',
      displayName: 'You', // Would get from user profile
      content,
      range: selection,
      createdAt: new Date(),
      resolved: false,
      replies: []
    };
    
    socket.emit('add-comment', { documentId, comment });
  };

  // Save document
  const saveDocument = () => {
    if (socket) {
      socket.emit('save-document', { documentId, content });
      toast('Document saved');
    }
  };

  // Export document
  const exportDocument = (format: 'markdown' | 'html' | 'txt') => {
    let exportContent = content;
    let filename = `document.${format}`;
    
    if (format === 'html') {
      // Simple markdown to HTML conversion
      exportContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/__(.*?)__/g, '<u>$1</u>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
      filename = 'document.html';
    }
    
    const blob = new Blob([exportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    toast(`Document exported as ${format.toUpperCase()}`);
  };

  // Render preview
  const renderPreview = () => {
    if (!previewRef.current) return;
    
    let htmlContent = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/__(.*?)__/g, '<u>$1</u>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
    
    previewRef.current.innerHTML = htmlContent;
  };

  useEffect(() => {
    if (showPreview) {
      renderPreview();
    }
  }, [content, showPreview]);

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold">Collaborative Editor</h2>
            <span className="text-sm text-gray-500">Document: {documentId}</span>
            <span className="text-sm text-gray-500">Version: {version}</span>
            <div className="flex items-center space-x-2">
              {users.slice(0, 3).map((user, index) => (
                <div
                  key={user.userId}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                  style={{ backgroundColor: userColors[index % userColors.length] }}
                  title={user.displayName}
                >
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
              ))}
              {users.length > 3 && (
                <span className="text-xs text-gray-500">+{users.length - 3}</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {users.some(u => u.isTyping) && (
              <span className="text-sm text-gray-500 italic">
                Someone is typing...
              </span>
            )}
            
            <button
              onClick={() => setShowUsers(!showUsers)}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
            >
              <Users className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => setShowComments(!showComments)}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg relative"
            >
              <MessageSquare className="w-5 h-5" />
              {comments.filter(c => !c.resolved).length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full"></span>
              )}
            </button>
            
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
            >
              <History className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`p-2 rounded-lg ${
                showPreview ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              {showPreview ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-gray-200 p-2">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 border-r border-gray-200 pr-2">
            <button
              onClick={() => formatText('bold')}
              disabled={readOnly}
              className={`p-2 rounded hover:bg-gray-100 ${activeFormats.bold ? 'bg-gray-200' : ''}`}
              title="Bold"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              onClick={() => formatText('italic')}
              disabled={readOnly}
              className={`p-2 rounded hover:bg-gray-100 ${activeFormats.italic ? 'bg-gray-200' : ''}`}
              title="Italic"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              onClick={() => formatText('underline')}
              disabled={readOnly}
              className={`p-2 rounded hover:bg-gray-100 ${activeFormats.underline ? 'bg-gray-200' : ''}`}
              title="Underline"
            >
              <Underline className="w-4 h-4" />
            </button>
            <button
              onClick={() => formatText('code')}
              disabled={readOnly}
              className={`p-2 rounded hover:bg-gray-100 ${activeFormats.code ? 'bg-gray-200' : ''}`}
              title="Code"
            >
              <Code className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex items-center space-x-1 border-r border-gray-200 pr-2">
            <button
              className="p-2 rounded hover:bg-gray-100"
              title="Align Left"
            >
              <AlignLeft className="w-4 h-4" />
            </button>
            <button
              className="p-2 rounded hover:bg-gray-100"
              title="Align Center"
            >
              <AlignCenter className="w-4 h-4" />
            </button>
            <button
              className="p-2 rounded hover:bg-gray-100"
              title="Align Right"
            >
              <AlignRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex items-center space-x-1 border-r border-gray-200 pr-2">
            <button
              className="p-2 rounded hover:bg-gray-100"
              title="Bullet List"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              className="p-2 rounded hover:bg-gray-100"
              title="Numbered List"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex items-center space-x-1 border-r border-gray-200 pr-2">
            <button
              className="p-2 rounded hover:bg-gray-100"
              title="Insert Link"
            >
              <Link className="w-4 h-4" />
            </button>
            <button
              className="p-2 rounded hover:bg-gray-100"
              title="Insert Image"
            >
              <Image className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex items-center space-x-1 ml-auto">
            <button
              onClick={saveDocument}
              className="p-2 rounded hover:bg-gray-100"
              title="Save"
            >
              <Save className="w-4 h-4" />
            </button>
            
            <div className="relative group">
              <button
                className="p-2 rounded hover:bg-gray-100"
                title="Export"
              >
                <Download className="w-4 h-4" />
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible z-10">
                <button
                  onClick={() => exportDocument('markdown')}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  Export as Markdown
                </button>
                <button
                  onClick={() => exportDocument('html')}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  Export as HTML
                </button>
                <button
                  onClick={() => exportDocument('txt')}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  Export as Text
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-96">
        {/* Editor */}
        <div className="flex-1 flex">
          {!showPreview ? (
            <textarea
              ref={editorRef}
              value={content}
              onChange={handleContentChange}
              onSelect={handleSelectionChange}
              onClick={handleCursorChange}
              onKeyUp={handleCursorChange}
              readOnly={readOnly}
              placeholder="Start typing your document here..."
              className="flex-1 p-4 font-mono text-sm resize-none focus:outline-none"
              style={{ lineHeight: '1.6' }}
            />
          ) : (
            <div
              ref={previewRef}
              className="flex-1 p-4 overflow-y-auto"
              style={{ lineHeight: '1.6' }}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-gray-200 flex flex-col">
          {/* Users Panel */}
          {showUsers && (
            <div className="flex-1 p-4 overflow-y-auto">
              <h3 className="font-semibold mb-3">Active Users</h3>
              <div className="space-y-2">
                {users.map((user, index) => (
                  <div key={user.userId} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                    <div className="flex items-center">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold mr-2"
                        style={{ backgroundColor: userColors[index % userColors.length] }}
                      >
                        {user.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{user.displayName}</div>
                        <div className="text-xs text-gray-500">
                          {user.isTyping ? 'Typing...' : 'Active'}
                        </div>
                      </div>
                    </div>
                    {user.cursor && (
                      <div className="text-xs text-gray-500">
                        Line {user.cursor.line}, Col {user.cursor.column}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments Panel */}
          {showComments && (
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold">Comments</h3>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto space-y-2">
                {comments.map((comment) => (
                  <div key={comment.id} className={`bg-gray-50 rounded-lg p-3 ${comment.resolved ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{comment.displayName}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm mb-2">{comment.content}</div>
                    <div className="text-xs text-gray-500 bg-gray-200 rounded p-1">
                      Line {Math.floor(comment.range.start / 50) + 1}
                    </div>
                    {comment.replies.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="text-xs bg-white rounded p-2">
                            <div className="font-medium">{reply.displayName}:</div>
                            <div>{reply.content}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {selection && (
                <div className="p-4 border-t border-gray-200">
                  <textarea
                    placeholder="Add a comment..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    rows={2}
                  />
                  <button
                    onClick={() => {
                      const textarea = document.querySelector('textarea[placeholder="Add a comment..."]') as HTMLTextAreaElement;
                      if (textarea && textarea.value.trim()) {
                        addComment(textarea.value.trim());
                        textarea.value = '';
                      }
                    }}
                    className="mt-2 w-full bg-blue-600 text-white py-1 px-3 rounded text-sm hover:bg-blue-700"
                  >
                    Add Comment
                  </button>
                </div>
              )}
            </div>
          )}

          {/* History Panel */}
          {showHistory && (
            <div className="flex-1 p-4 overflow-y-auto">
              <h3 className="font-semibold mb-3">Document History</h3>
              <div className="space-y-2">
                <div className="text-sm text-gray-500">
                  <div className="font-medium">Version {version}</div>
                  <div>Current version</div>
                </div>
                {/* In a real implementation, this would show version history */}
                <div className="text-sm text-gray-400 italic">
                  History tracking would be implemented here
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="border-t border-gray-200 px-4 py-2 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-4">
          <span>{content.length} characters</span>
          <span>{content.split('\n').length} lines</span>
          <span>{content.split(/\s+/).filter(word => word.length > 0).length} words</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`inline-flex items-center px-2 py-1 rounded-full ${
            isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            <span className={`w-2 h-2 rounded-full mr-1 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          {readOnly && (
            <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
              Read Only
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
