import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, MessageSquare, Users, Settings, Record, Square, Volume2, VolumeX } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';

interface Participant {
  userId: string;
  socketId: string;
  displayName: string;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  joinedAt: Date;
  role: 'HOST' | 'MODERATOR' | 'PARTICIPANT';
  stream?: MediaStream;
}

interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  message: string;
  timestamp: Date;
}

interface VideoConferenceProps {
  projectId: string;
  roomId?: string;
  onClose?: () => void;
  className?: string;
}

export const VideoConference: React.FC<VideoConferenceProps> = ({
  projectId,
  roomId: initialRoomId,
  onClose,
  className = ''
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<string | null>(initialRoomId || null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomSettings, setRoomSettings] = useState({
    maxParticipants: 50,
    requirePassword: false,
    password: '',
    enableRecording: false,
    enableChat: true,
    enableScreenShare: true,
    waitingRoom: false
  });

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareRef = useRef<HTMLVideoElement>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialize socket connection
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    const newSocket = io(process.env.REACT_APP_VIDEO_SERVICE_URL || 'http://localhost:3001', {
      auth: { token }
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to video conference service');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from video conference service');
    });

    newSocket.on('room-created', (data: { roomId: string, room: any }) => {
      setCurrentRoom(data.roomId);
      toast.success(`Room "${data.room.name}" created successfully`);
    });

    newSocket.on('joined-room', (data: { room: any, participant: Participant }) => {
      setCurrentRoom(data.room.id);
      setParticipants(data.room.participants);
      toast.success(`Joined room: ${data.room.name}`);
    });

    newSocket.on('participant-joined', (data: { participant: Participant, room: any }) => {
      setParticipants(data.room.participants);
      toast(`${data.participant.displayName} joined the room`);
    });

    newSocket.on('participant-left', (data: { participant: Participant }) => {
      setParticipants(prev => prev.filter(p => p.userId !== data.participant.userId));
      
      // Clean up peer connection
      const pc = peerConnections.current.get(data.participant.userId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(data.participant.userId);
      }
      
      toast(`${data.participant.displayName} left the room`);
    });

    newSocket.on('participant-updated', (data: { participant: Participant }) => {
      setParticipants(prev => prev.map(p => 
        p.userId === data.participant.userId ? data.participant : p
      ));
    });

    newSocket.on('signaling', handleSignaling);
    newSocket.on('chat-message', (message: ChatMessage) => {
      setChatMessages(prev => [...prev, message]);
    });

    newSocket.on('screen-share-started', (data: { participant: Participant }) => {
      setParticipants(prev => prev.map(p => 
        p.userId === data.participant.userId ? data.participant : p
      ));
      toast(`${data.participant.displayName} started screen sharing`);
    });

    newSocket.on('screen-share-stopped', (data: { participant: Participant }) => {
      setParticipants(prev => prev.map(p => 
        p.userId === data.participant.userId ? data.participant : p
      ));
      toast(`${data.participant.displayName} stopped screen sharing`);
    });

    newSocket.on('recording-started', (data: { recording: any }) => {
      setIsRecording(true);
      toast('Recording started');
    });

    newSocket.on('recording-stopped', (data: { recording: any }) => {
      setIsRecording(false);
      toast('Recording stopped');
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

  // Initialize local media
  useEffect(() => {
    if (isConnected && !localStream) {
      initializeLocalMedia();
    }

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isConnected]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const initializeLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
      toast.error('Failed to access camera/microphone');
    }
  };

  const createRoom = async () => {
    if (!socket || !roomName.trim()) return;

    setIsCreatingRoom(true);
    try {
      socket.emit('create-room', {
        projectId,
        name: roomName,
        settings: roomSettings
      });
    } catch (error) {
      toast.error('Failed to create room');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const joinRoom = async () => {
    if (!socket || !joiningRoomId.trim()) return;

    try {
      socket.emit('join-room', {
        roomId: joiningRoomId,
        password: roomSettings.password || undefined
      });
    } catch (error) {
      toast.error('Failed to join room');
    }
  };

  const leaveRoom = () => {
    if (socket && currentRoom) {
      socket.emit('leave-room', { roomId: currentRoom });
      setCurrentRoom(null);
      setParticipants([]);
      setChatMessages([]);
      
      // Clean up all peer connections
      peerConnections.current.forEach(pc => pc.close());
      peerConnections.current.clear();
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
        setIsAudioEnabled(!isAudioEnabled);
        
        if (socket && currentRoom) {
          socket.emit('toggle-audio', { roomId: currentRoom });
        }
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
        setIsVideoEnabled(!isVideoEnabled);
        
        if (socket && currentRoom) {
          socket.emit('toggle-video', { roomId: currentRoom });
        }
      }
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      if (screenShareRef.current) {
        screenShareRef.current.srcObject = screenStream;
      }

      setIsScreenSharing(true);

      if (socket && currentRoom) {
        socket.emit('start-screen-share', { roomId: currentRoom });
      }

      // Stop screen sharing when user ends it
      screenStream.getVideoTracks()[0].addEventListener('ended', () => {
        stopScreenShare();
      });
    } catch (error) {
      console.error('Error starting screen share:', error);
      toast.error('Failed to start screen sharing');
    }
  };

  const stopScreenShare = () => {
    if (screenShareRef.current && screenShareRef.current.srcObject) {
      const stream = screenShareRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      screenShareRef.current.srcObject = null;
    }

    setIsScreenSharing(false);

    if (socket && currentRoom) {
      socket.emit('stop-screen-share', { roomId: currentRoom });
    }
  };

  const toggleRecording = () => {
    if (!socket || !currentRoom) return;

    if (isRecording) {
      socket.emit('stop-recording', { roomId: currentRoom });
    } else {
      socket.emit('start-recording', { roomId: currentRoom });
    }
  };

  const sendMessage = () => {
    if (!socket || !currentRoom || !newMessage.trim()) return;

    socket.emit('chat-message', {
      roomId: currentRoom,
      message: newMessage.trim()
    });

    setNewMessage('');
  };

  const handleSignaling = async (message: any) => {
    const { type, payload, userId, targetUserId } = message;

    if (targetUserId && targetUserId !== socket?.userId) return;

    try {
      switch (type) {
        case 'offer':
          await handleOffer(payload, userId);
          break;
        case 'answer':
          await handleAnswer(payload, userId);
          break;
        case 'ice-candidate':
          await handleIceCandidate(payload, userId);
          break;
      }
    } catch (error) {
      console.error('Error handling signaling message:', error);
    }
  };

  const createPeerConnection = (userId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Add local stream
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket && currentRoom) {
        socket.emit('signaling', {
          type: 'ice-candidate',
          payload: event.candidate,
          roomId: currentRoom,
          userId: socket.userId,
          targetUserId: userId
        });
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      setParticipants(prev => prev.map(p => 
        p.userId === userId ? { ...p, stream } : p
      ));
    };

    peerConnections.current.set(userId, pc);
    return pc;
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit, userId: string) => {
    let pc = peerConnections.current.get(userId);
    if (!pc) {
      pc = createPeerConnection(userId);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (socket && currentRoom) {
      socket.emit('signaling', {
        type: 'answer',
        payload: answer,
        roomId: currentRoom,
        userId: socket.userId,
        targetUserId: userId
      });
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit, userId: string) => {
    const pc = peerConnections.current.get(userId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit, userId: string) => {
    const pc = peerConnections.current.get(userId);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }

    if (screenShareRef.current?.srcObject) {
      const stream = screenShareRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }

    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
  };

  if (!currentRoom) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <h2 className="text-2xl font-bold mb-6">Video Conference</h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3">Create New Room</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Room Name"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Participants
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="100"
                    value={roomSettings.maxParticipants}
                    onChange={(e) => setRoomSettings(prev => ({ ...prev, maxParticipants: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={roomSettings.requirePassword}
                      onChange={(e) => setRoomSettings(prev => ({ ...prev, requirePassword: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm">Require Password</span>
                  </label>
                  
                  {roomSettings.requirePassword && (
                    <input
                      type="password"
                      placeholder="Password"
                      value={roomSettings.password}
                      onChange={(e) => setRoomSettings(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  )}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={roomSettings.enableRecording}
                    onChange={(e) => setRoomSettings(prev => ({ ...prev, enableRecording: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm">Enable Recording</span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={roomSettings.enableChat}
                    onChange={(e) => setRoomSettings(prev => ({ ...prev, enableChat: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm">Enable Chat</span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={roomSettings.enableScreenShare}
                    onChange={(e) => setRoomSettings(prev => ({ ...prev, enableScreenShare: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm">Enable Screen Share</span>
                </label>
              </div>
              
              <button
                onClick={createRoom}
                disabled={!roomName.trim() || isCreatingRoom || !isConnected}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingRoom ? 'Creating...' : 'Create Room'}
              </button>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-3">Join Existing Room</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Room ID"
                value={joiningRoomId}
                onChange={(e) => setJoiningRoomId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              <button
                onClick={joinRoom}
                disabled={!joiningRoomId.trim() || !isConnected}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Join Room
              </button>
            </div>
          </div>
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
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold">Video Conference</h2>
            <span className="text-sm text-gray-500">Room: {currentRoom}</span>
            <span className="text-sm text-gray-500">
              {participants.length} participant{participants.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            {isRecording && (
              <span className="flex items-center text-red-600">
                <Record className="w-4 h-4 mr-1 animate-pulse" />
                Recording
              </span>
            )}
            
            <button
              onClick={() => setShowParticipants(!showParticipants)}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
            >
              <Users className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => setShowChat(!showChat)}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg relative"
            >
              <MessageSquare className="w-5 h-5" />
              {chatMessages.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full"></span>
              )}
            </button>
            
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-96">
        {/* Video Area */}
        <div className="flex-1 p-4">
          <div className="grid grid-cols-2 gap-4 h-full">
            {/* Local Video */}
            <div className="relative bg-gray-900 rounded-lg overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                You
                {!isAudioEnabled && <MicOff className="w-3 h-3 inline ml-1" />}
                {!isVideoEnabled && <VideoOff className="w-3 h-3 inline ml-1" />}
              </div>
            </div>

            {/* Screen Share */}
            {isScreenSharing && (
              <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                <video
                  ref={screenShareRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded text-sm">
                  Screen Share
                </div>
              </div>
            )}

            {/* Participant Videos */}
            {participants.map((participant) => (
              <div key={participant.userId} className="relative bg-gray-900 rounded-lg overflow-hidden">
                {participant.stream ? (
                  <video
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                    ref={(video) => {
                      if (video && participant.stream) {
                        video.srcObject = participant.stream;
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Users className="w-8 h-8" />
                      </div>
                      <div className="text-sm">{participant.displayName}</div>
                    </div>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                  {participant.displayName}
                  {participant.isMuted && <MicOff className="w-3 h-3 inline ml-1" />}
                  {participant.isVideoOn && <Video className="w-3 h-3 inline ml-1" />}
                  {participant.isScreenSharing && <Monitor className="w-3 h-3 inline ml-1" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-gray-200 flex flex-col">
          {/* Participants Panel */}
          {showParticipants && (
            <div className="flex-1 p-4 overflow-y-auto">
              <h3 className="font-semibold mb-3">Participants</h3>
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
                        <div className="text-xs text-gray-500">{participant.role}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {participant.isMuted && <MicOff className="w-4 h-4 text-red-500" />}
                      {participant.isVideoOn && <Video className="w-4 h-4 text-green-500" />}
                      {participant.isScreenSharing && <Monitor className="w-4 h-4 text-blue-500" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat Panel */}
          {showChat && roomSettings.enableChat && (
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

          {roomSettings.enableScreenShare && (
            <button
              onClick={isScreenSharing ? stopScreenShare : startScreenShare}
              className={`p-3 rounded-full ${
                isScreenSharing
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
            </button>
          )}

          {roomSettings.enableRecording && (
            <button
              onClick={toggleRecording}
              className={`p-3 rounded-full ${
                isRecording
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {isRecording ? <Square className="w-5 h-5" /> : <Record className="w-5 h-5" />}
            </button>
          )}

          <button
            onClick={leaveRoom}
            className="p-3 bg-red-600 text-white rounded-full hover:bg-red-700"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
