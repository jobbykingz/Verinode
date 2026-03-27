import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Monitor, MonitorOff, Users, Download, Settings, Maximize2, Minimize2, Mic, MicOff, Video, VideoOff, MessageSquare, PhoneOff } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';

interface ScreenShareParticipant {
  userId: string;
  socketId: string;
  displayName: string;
  isViewing: boolean;
  joinedAt: Date;
  cursor?: {
    x: number;
    y: number;
    visible: boolean;
  };
}

interface ScreenShareSettings {
  quality: 'low' | 'medium' | 'high';
  frameRate: 15 | 30 | 60;
  includeAudio: boolean;
  showCursor: boolean;
  allowRemoteControl: boolean;
  enableRecording: boolean;
  enableChat: boolean;
  maxViewers: number;
}

interface ScreenShareProps {
  sessionId?: string;
  isHost?: boolean;
  onSessionStart?: (sessionId: string) => void;
  onSessionEnd?: () => void;
  className?: string;
}

export const ScreenShare: React.FC<ScreenShareProps> = ({
  sessionId: initialSessionId,
  isHost: initialIsHost = false,
  onSessionStart,
  onSessionEnd,
  className = ''
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [currentSession, setCurrentSession] = useState<string | null>(initialSessionId || null);
  const [participants, setParticipants] = useState<ScreenShareParticipant[]>([]);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    userId: string;
    displayName: string;
    message: string;
    timestamp: Date;
  }>>([]);
  const [newMessage, setNewMessage] = useState('');
  const [settings, setSettings] = useState<ScreenShareSettings>({
    quality: 'high',
    frameRate: 30,
    includeAudio: false,
    showCursor: true,
    allowRemoteControl: false,
    enableRecording: false,
    enableChat: true,
    maxViewers: 50
  });

  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialize socket connection
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    const newSocket = io(process.env.REACT_APP_SCREEN_SHARE_SERVICE_URL || 'http://localhost:3002', {
      auth: { token }
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to screen share service');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from screen share service');
    });

    newSocket.on('session-started', (data: { sessionId: string, settings: ScreenShareSettings }) => {
      setCurrentSession(data.sessionId);
      setIsSharing(true);
      toast.success('Screen sharing session started');
      onSessionStart?.(data.sessionId);
    });

    newSocket.on('session-joined', (data: { sessionId: string, hostId: string, streamUrl: string }) => {
      setCurrentSession(data.sessionId);
      setIsViewing(true);
      toast.success('Joined screen sharing session');
    });

    newSocket.on('viewer-joined', (data: { participant: ScreenShareParticipant }) => {
      setParticipants(prev => [...prev, data.participant]);
      toast(`${data.participant.displayName} joined the session`);
    });

    newSocket.on('viewer-left', (data: { userId: string }) => {
      setParticipants(prev => prev.filter(p => p.userId !== data.userId));
      toast('A viewer left the session');
    });

    newSocket.on('screen-data', (data: { frame: ArrayBuffer, timestamp: number }) => {
      // Handle screen frame data
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          // Convert ArrayBuffer to ImageData and render
          const imageData = new ImageData(new Uint8ClampedArray(data.frame), 1920, 1080);
          ctx.putImageData(imageData, 0, 0);
        }
      }
    });

    newSocket.on('cursor-update', (data: { userId: string, x: number, y: number, visible: boolean }) => {
      setParticipants(prev => prev.map(p => 
        p.userId === data.userId ? { ...p, cursor: { x: data.x, y: data.y, visible: data.visible } } : p
      ));
    });

    newSocket.on('chat-message', (message: any) => {
      setChatMessages(prev => [...prev, message]);
    });

    newSocket.on('recording-started', () => {
      setIsRecording(true);
      toast('Recording started');
    });

    newSocket.on('recording-stopped', (data: { url: string }) => {
      setIsRecording(false);
      toast('Recording stopped');
    });

    newSocket.on('remote-control-request', (data: { userId: string, displayName: string }) => {
      if (settings.allowRemoteControl) {
        const response = window.confirm(`${data.displayName} wants to control your screen. Allow?`);
        socket.emit('remote-control-response', { 
          sessionId: currentSession, 
          userId: data.userId, 
          allowed: response 
        });
      }
    });

    newSocket.on('remote-control-granted', (data: { userId: string }) => {
      toast('Remote control granted');
    });

    newSocket.on('remote-control-denied', (data: { userId: string }) => {
      toast('Remote control request denied');
    });

    newSocket.on('error', (error: { message: string }) => {
      toast.error(error.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
      cleanup();
    };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Handle fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const startScreenShare = async () => {
    if (!socket) return;

    try {
      const displayMediaOptions: DisplayMediaStreamOptions = {
        video: {
          width: { ideal: settings.quality === 'high' ? 1920 : settings.quality === 'medium' ? 1280 : 854 },
          height: { ideal: settings.quality === 'high' ? 1080 : settings.quality === 'medium' ? 720 : 480 },
          frameRate: { ideal: settings.frameRate }
        },
        audio: settings.includeAudio
      };

      const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      setScreenStream(stream);

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
      }

      // Handle stream end
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopScreenShare();
      });

      // Start sharing session
      socket.emit('start-screen-share', {
        settings: {
          ...settings,
          resolution: settings.quality === 'high' ? '1920x1080' : settings.quality === 'medium' ? '1280x720' : '854x480'
        }
      });

    } catch (error) {
      console.error('Error starting screen share:', error);
      toast.error('Failed to start screen sharing');
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }

    if (socket && currentSession) {
      socket.emit('stop-screen-share', { sessionId: currentSession });
    }

    setIsSharing(false);
    setCurrentSession(null);
    setParticipants([]);
    onSessionEnd?.();
  };

  const joinSession = async (sessionId: string) => {
    if (!socket) return;

    try {
      socket.emit('join-screen-share', { sessionId });
    } catch (error) {
      console.error('Error joining session:', error);
      toast.error('Failed to join session');
    }
  };

  const leaveSession = () => {
    if (socket && currentSession) {
      socket.emit('leave-screen-share', { sessionId: currentSession });
    }

    setIsViewing(false);
    setCurrentSession(null);
    setParticipants([]);
  };

  const toggleAudio = () => {
    if (screenStream) {
      const audioTrack = screenStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
        setIsAudioEnabled(!isAudioEnabled);
      }
    }
  };

  const toggleVideo = () => {
    if (screenStream) {
      const videoTrack = screenStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
        setIsVideoEnabled(!isVideoEnabled);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const toggleRecording = () => {
    if (!socket || !currentSession) return;

    if (isRecording) {
      socket.emit('stop-recording', { sessionId: currentSession });
    } else {
      socket.emit('start-recording', { sessionId: currentSession });
    }
  };

  const requestRemoteControl = () => {
    if (socket && currentSession && !isHost) {
      socket.emit('request-remote-control', { sessionId: currentSession });
    }
  };

  const sendMessage = () => {
    if (!socket || !currentSession || !newMessage.trim()) return;

    socket.emit('chat-message', {
      sessionId: currentSession,
      message: newMessage.trim()
    });

    setNewMessage('');
  };

  const downloadRecording = () => {
    // In a real implementation, this would download the recorded video
    toast('Recording download started');
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!settings.allowRemoteControl || isHost) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Send click coordinates to host
    if (socket && currentSession) {
      socket.emit('remote-click', {
        sessionId: currentSession,
        x: (x / rect.width) * 100, // Percentage
        y: (y / rect.height) * 100
      });
    }
  };

  const cleanup = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
    }
  };

  if (!currentSession) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <h2 className="text-2xl font-bold mb-6">Screen Sharing</h2>
        
        <div className="space-y-6">
          {initialIsHost ? (
            <div>
              <h3 className="text-lg font-semibold mb-3">Start Screen Sharing</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quality
                    </label>
                    <select
                      value={settings.quality}
                      onChange={(e) => setSettings(prev => ({ ...prev, quality: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">Low (480p)</option>
                      <option value="medium">Medium (720p)</option>
                      <option value="high">High (1080p)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Frame Rate
                    </label>
                    <select
                      value={settings.frameRate}
                      onChange={(e) => setSettings(prev => ({ ...prev, frameRate: parseInt(e.target.value) as any }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="15">15 FPS</option>
                      <option value="30">30 FPS</option>
                      <option value="60">60 FPS</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.includeAudio}
                      onChange={(e) => setSettings(prev => ({ ...prev, includeAudio: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm">Include Audio</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.showCursor}
                      onChange={(e) => setSettings(prev => ({ ...prev, showCursor: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm">Show Cursor</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.allowRemoteControl}
                      onChange={(e) => setSettings(prev => ({ ...prev, allowRemoteControl: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm">Allow Remote Control</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.enableRecording}
                      onChange={(e) => setSettings(prev => ({ ...prev, enableRecording: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm">Enable Recording</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.enableChat}
                      onChange={(e) => setSettings(prev => ({ ...prev, enableChat: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm">Enable Chat</span>
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Viewers
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={settings.maxViewers}
                    onChange={(e) => setSettings(prev => ({ ...prev, maxViewers: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <button
                  onClick={startScreenShare}
                  disabled={!isConnected}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <Monitor className="w-5 h-5 mr-2" />
                  Start Screen Share
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold mb-3">Join Screen Sharing Session</h3>
              
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Enter Session ID"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const sessionId = (e.target as HTMLInputElement).value.trim();
                      if (sessionId) joinSession(sessionId);
                    }
                  }}
                />
                
                <button
                  onClick={() => {
                    const input = document.querySelector('input[placeholder="Enter Session ID"]') as HTMLInputElement;
                    const sessionId = input?.value.trim();
                    if (sessionId) joinSession(sessionId);
                  }}
                  disabled={!isConnected}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Join Session
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-6 text-center">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
            isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            <span className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold">
              {isSharing ? 'Screen Sharing' : 'Viewing Screen Share'}
            </h2>
            <span className="text-sm text-gray-500">Session: {currentSession}</span>
            <span className="text-sm text-gray-500">
              {participants.length} viewer{participants.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            {isRecording && (
              <span className="flex items-center text-red-600">
                <div className="w-2 h-2 bg-red-600 rounded-full mr-2 animate-pulse"></div>
                Recording
              </span>
            )}
            
            <button
              onClick={() => setShowParticipants(!showParticipants)}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
            >
              <Users className="w-5 h-5" />
            </button>
            
            {settings.enableChat && (
              <button
                onClick={() => setShowChat(!showChat)}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg relative"
              >
                <MessageSquare className="w-5 h-5" />
                {chatMessages.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full"></span>
                )}
              </button>
            )}
            
            <button
              onClick={toggleFullscreen}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            
            <button
              onClick={isSharing ? stopScreenShare : leaveSession}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-96">
        {/* Screen Display */}
        <div className="flex-1 relative bg-black">
          {isSharing ? (
            <video
              ref={screenVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-contain"
            />
          ) : isViewing ? (
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="w-full h-full cursor-crosshair"
              width={1920}
              height={1080}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white">
              <div className="text-center">
                <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Waiting for screen share...</p>
              </div>
            </div>
          )}

          {/* Remote cursors */}
          {participants.map((participant) => (
            participant.cursor && participant.cursor.visible && (
              <div
                key={participant.userId}
                className="absolute w-4 h-4 border-2 border-blue-500 rounded-full pointer-events-none"
                style={{
                  left: `${participant.cursor.x}%`,
                  top: `${participant.cursor.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="absolute -top-6 left-4 bg-black bg-opacity-75 text-white text-xs px-1 rounded">
                  {participant.displayName}
                </div>
              </div>
            )
          ))}

          {/* Quality indicator */}
          <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
            {settings.quality.toUpperCase()} • {settings.frameRate} FPS
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-gray-200 flex flex-col">
          {/* Participants Panel */}
          {showParticipants && (
            <div className="flex-1 p-4 overflow-y-auto">
              <h3 className="font-semibold mb-3">Viewers</h3>
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div key={participant.userId} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center mr-2">
                        <span className="text-xs font-semibold">
                          {participant.displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-medium">{participant.displayName}</div>
                        <div className="text-xs text-gray-500">
                          Joined {new Date(participant.joinedAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    {participant.isViewing && (
                      <span className="text-xs text-green-600">Viewing</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat Panel */}
          {showChat && settings.enableChat && (
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold">Chat</h3>
              </div>
              
              <div
                ref={chatContainerRef}
                className="flex-1 p-4 overflow-y-auto space-y-2"
              >
                {chatMessages.map((message) => (
                  <div key={message.id} className="bg-gray-50 rounded-lg p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{message.displayName}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-sm">{message.message}</div>
                  </div>
                ))}
              </div>
              
              <div className="p-4 border-t border-gray-200">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center justify-center space-x-4">
          {isSharing && settings.includeAudio && (
            <button
              onClick={toggleAudio}
              className={`p-3 rounded-full ${
                isAudioEnabled
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
          )}

          {isSharing && (
            <button
              onClick={toggleVideo}
              className={`p-3 rounded-full ${
                isVideoEnabled
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
          )}

          {!isHost && settings.allowRemoteControl && (
            <button
              onClick={requestRemoteControl}
              className="p-3 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300"
              title="Request Remote Control"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}

          {isSharing && settings.enableRecording && (
            <button
              onClick={toggleRecording}
              className={`p-3 rounded-full ${
                isRecording
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full ${isRecording ? 'bg-red-600' : 'bg-gray-600'}`}></div>
            </button>
          )}

          {isRecording && (
            <button
              onClick={downloadRecording}
              className="p-3 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300"
              title="Download Recording"
            >
              <Download className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={isSharing ? stopScreenShare : leaveSession}
            className="p-3 bg-red-600 text-white rounded-full hover:bg-red-700"
          >
            <MonitorOff className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
