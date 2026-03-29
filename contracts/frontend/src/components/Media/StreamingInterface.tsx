import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Radio,
  StopCircle,
  Users,
  Eye,
  Clock,
  Signal,
  Settings,
  Share2,
  Copy,
  CheckCircle,
  AlertCircle,
  Video,
  Mic,
  MicOff,
  VideoOff,
  MessageSquare,
  Heart,
  MoreVertical
} from 'lucide-react';

interface StreamingInterfaceProps {
  streamKey?: string;
  rtmpUrl?: string;
  hlsUrl?: string;
  onStartStream?: () => void;
  onStopStream?: () => void;
  onError?: (error: string) => void;
}

interface StreamStats {
  viewers: number;
  duration: number;
  bitrate: number;
  fps: number;
  resolution: string;
  audioLevel: number;
}

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: Date;
  isModerator?: boolean;
}

type StreamStatus = 'idle' | 'connecting' | 'live' | 'error' | 'ended';

const StreamingInterface: React.FC<StreamingInterfaceProps> = ({
  streamKey,
  rtmpUrl,
  hlsUrl,
  onStartStream,
  onStopStream,
  onError
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [streamStatus, setStreamStatus] = useState<StreamStatus>('idle');
  const [streamStats, setStreamStats] = useState<StreamStats>({
    viewers: 0,
    duration: 0,
    bitrate: 0,
    fps: 30,
    resolution: '1920x1080',
    audioLevel: 0
  });
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<'720p' | '1080p' | '480p'>('1080p');
  const [error, setError] = useState<string | null>(null);

  // Quality settings
  const qualitySettings = {
    '480p': { width: 854, height: 480, bitrate: 2500000 },
    '720p': { width: 1280, height: 720, bitrate: 5000000 },
    '1080p': { width: 1920, height: 1080, bitrate: 8000000 }
  };

  // Initialize stream
  const initializeStream = useCallback(async () => {
    try {
      setStreamStatus('connecting');
      setError(null);

      const settings = qualitySettings[selectedQuality];

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: settings.width },
          height: { ideal: settings.height },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Monitor audio levels
      monitorAudioLevel(stream);

      setStreamStatus('live');
      onStartStream?.();

      // Start stats collection
      startStatsCollection();

      // Connect to chat (mock)
      connectToChat();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start stream';
      setError(errorMessage);
      setStreamStatus('error');
      onError?.(errorMessage);
    }
  }, [selectedQuality, onStartStream, onError]);

  // Monitor audio level
  const monitorAudioLevel = (stream: MediaStream) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkLevel = () => {
      if (streamStatus !== 'live') return;
      
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setStreamStats(prev => ({ ...prev, audioLevel: average / 255 }));
      
      requestAnimationFrame(checkLevel);
    };

    checkLevel();
  };

  // Start stats collection
  const startStatsCollection = () => {
    statsIntervalRef.current = setInterval(() => {
      setStreamStats(prev => ({
        ...prev,
        duration: prev.duration + 1,
        viewers: prev.viewers + Math.floor(Math.random() * 3) - 1 // Simulate viewer changes
      }));
    }, 1000);
  };

  // Connect to chat (mock)
  const connectToChat = () => {
    // Mock chat messages
    const mockMessages: ChatMessage[] = [
      { id: '1', username: 'User1', message: 'Hello! Great stream!', timestamp: new Date() },
      { id: '2', username: 'User2', message: 'Looking good!', timestamp: new Date() }
    ];
    setChatMessages(mockMessages);
  };

  // Stop stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setStreamStatus('ended');
    onStopStream?.();
  }, [onStopStream]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
        setIsVideoEnabled(!isVideoEnabled);
      }
    }
  }, [isVideoEnabled]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
        setIsAudioEnabled(!isAudioEnabled);
      }
    }
  }, [isAudioEnabled]);

  // Send chat message
  const sendMessage = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      username: 'You',
      message: newMessage,
      timestamp: new Date(),
      isModerator: true
    };

    setChatMessages(prev => [...prev, message]);
    setNewMessage('');
  }, [newMessage]);

  // Copy stream link
  const copyStreamLink = useCallback(() => {
    const link = hlsUrl || window.location.href;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }, [hlsUrl]);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio className={`h-5 w-5 ${streamStatus === 'live' ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} />
          <div>
            <h2 className="font-semibold">Live Stream</h2>
            {streamStatus === 'live' && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                LIVE
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {streamStatus === 'live' && (
            <>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Eye className="h-4 w-4" />
                <span>{streamStats.viewers}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Clock className="h-4 w-4" />
                <span>{formatDuration(streamStats.duration)}</span>
              </div>
            </>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-gray-700 rounded-full transition-colors"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/50 border-l-4 border-red-500 p-4 m-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex">
        {/* Video Area */}
        <div className="flex-1 relative">
          {/* Video Preview */}
          <div className="relative aspect-video bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Stream Overlay */}
            {streamStatus === 'live' && (
              <>
                {/* Live Badge */}
                <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  LIVE
                </div>

                {/* Stats Overlay */}
                <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-2 rounded-lg text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <Signal className="h-3 w-3" />
                    <span>{streamStats.bitrate > 0 ? `${(streamStats.bitrate / 1000000).toFixed(1)} Mbps` : 'Connecting...'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Video className="h-3 w-3" />
                    <span>{streamStats.fps} FPS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Res:</span>
                    <span>{streamStats.resolution}</span>
                  </div>
                </div>

                {/* Audio Level Indicator */}
                <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/50 px-3 py-2 rounded-lg">
                  <Mic className="h-4 w-4 text-white" />
                  <div className="w-20 h-2 bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-100"
                      style={{ width: `${streamStats.audioLevel * 100}%` }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Idle State */}
            {streamStatus === 'idle' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-4">Ready to start streaming</p>
                  <button
                    onClick={initializeStream}
                    className="px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <Radio className="h-5 w-5" />
                    Go Live
                  </button>
                </div>
              </div>
            )}

            {/* Connecting State */}
            {streamStatus === 'connecting' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-center text-white">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
                  <p>Connecting to stream server...</p>
                </div>
              </div>
            )}

            {/* Ended State */}
            {streamStatus === 'ended' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center text-white">
                  <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                  <p className="text-lg mb-4">Stream ended</p>
                  <button
                    onClick={() => setStreamStatus('idle')}
                    className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                  >
                    Start New Stream
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Controls Bar */}
          <div className="bg-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleVideo}
                  className={`p-3 rounded-full transition-colors ${
                    isVideoEnabled ? 'bg-gray-700 text-white' : 'bg-red-600 text-white'
                  }`}
                >
                  {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </button>

                <button
                  onClick={toggleAudio}
                  className={`p-3 rounded-full transition-colors ${
                    isAudioEnabled ? 'bg-gray-700 text-white' : 'bg-red-600 text-white'
                  }`}
                >
                  {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </button>

                {streamStatus === 'live' && (
                  <button
                    onClick={stopStream}
                    className="px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors flex items-center gap-2"
                  >
                    <StopCircle className="h-5 w-5" />
                    End Stream
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowChat(!showChat)}
                  className={`p-3 rounded-full transition-colors ${
                    showChat ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white'
                  }`}
                >
                  <MessageSquare className="h-5 w-5" />
                </button>

                <button
                  onClick={copyStreamLink}
                  className="p-3 bg-gray-700 text-white rounded-full hover:bg-gray-600 transition-colors flex items-center gap-2"
                >
                  {copiedLink ? <CheckCircle className="h-5 w-5 text-green-400" /> : <Copy className="h-5 w-5" />}
                  <span className="hidden sm:inline">{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                </button>

                <button
                  onClick={() => {}}
                  className="p-3 bg-gray-700 text-white rounded-full hover:bg-gray-600 transition-colors"
                >
                  <Share2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Panel */}
        {showChat && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Live Chat
              </h3>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-96">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${msg.isModerator ? 'text-blue-400' : 'text-gray-300'}`}>
                      {msg.username}
                    </span>
                    {msg.isModerator && (
                      <span className="text-xs bg-blue-600 text-white px-1 rounded">MOD</span>
                    )}
                  </div>
                  <p className="text-gray-400 mt-1">{msg.message}</p>
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <form onSubmit={sendMessage} className="p-4 border-t border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Heart className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-gray-800 p-4 border-t border-gray-700">
          <h3 className="text-white font-semibold mb-4">Stream Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Quality</label>
              <select
                value={selectedQuality}
                onChange={(e) => setSelectedQuality(e.target.value as '720p' | '1080p' | '480p')}
                disabled={streamStatus === 'live'}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg text-sm disabled:opacity-50"
              >
                <option value="1080p">1080p (Full HD)</option>
                <option value="720p">720p (HD)</option>
                <option value="480p">480p (SD)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Stream Key</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={streamKey || ''}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg text-sm"
                />
                <button
                  onClick={() => streamKey && navigator.clipboard.writeText(streamKey)}
                  className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">RTMP URL</label>
              <input
                type="text"
                value={rtmpUrl || 'rtmp://stream.verinode.io/live'}
                readOnly
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg text-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StreamingInterface;
