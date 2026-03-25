import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Settings,
  Download,
  Share2,
  Shield,
  CheckCircle,
  AlertCircle,
  Lock,
  Unlock,
  FileText
} from 'lucide-react';

interface MediaPlayerProps {
  src: string;
  type: 'video' | 'audio';
  title?: string;
  proofId?: string;
  isVerified?: boolean;
  watermark?: string;
  allowDownload?: boolean;
  onVerify?: () => void;
  onShare?: () => void;
}

interface MediaMetadata {
  duration: number;
  currentTime: number;
  volume: number;
  playbackRate: number;
  buffered: TimeRanges | null;
}

const MediaPlayer: React.FC<MediaPlayerProps> = ({
  src,
  type,
  title = 'Untitled Media',
  proofId,
  isVerified = false,
  watermark,
  allowDownload = false,
  onVerify,
  onShare
}) => {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [metadata, setMetadata] = useState<MediaMetadata>({
    duration: 0,
    currentTime: 0,
    volume: 1,
    playbackRate: 1,
    buffered: null
  });
  const [verificationStatus, setVerificationStatus] = useState<{
    checking: boolean;
    valid: boolean | null;
    confidence: number;
    details: {
      hashValid: boolean;
      signatureValid: boolean;
      watermarkValid: boolean;
    };
  }>({
    checking: false,
    valid: isVerified,
    confidence: 0,
    details: {
      hashValid: false,
      signatureValid: false,
      watermarkValid: false
    }
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize media element
  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    const updateMetadata = () => {
      setMetadata(prev => ({
        ...prev,
        duration: media.duration || 0,
        buffered: media.buffered
      }));
    };

    const updateTime = () => {
      setMetadata(prev => ({
        ...prev,
        currentTime: media.currentTime
      }));
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handleVolumeChange = () => {
      setMetadata(prev => ({
        ...prev,
        volume: media.volume,
        muted: media.muted
      }));
      setIsMuted(media.muted || media.volume === 0);
    };

    media.addEventListener('loadedmetadata', updateMetadata);
    media.addEventListener('timeupdate', updateTime);
    media.addEventListener('ended', handleEnded);
    media.addEventListener('volumechange', handleVolumeChange);
    media.addEventListener('progress', updateMetadata);

    return () => {
      media.removeEventListener('loadedmetadata', updateMetadata);
      media.removeEventListener('timeupdate', updateTime);
      media.removeEventListener('ended', handleEnded);
      media.removeEventListener('volumechange', handleVolumeChange);
      media.removeEventListener('progress', updateMetadata);
    };
  }, [src]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;

    if (isPlaying) {
      media.pause();
    } else {
      media.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;

    media.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const media = mediaRef.current;
    if (!media) return;

    const volume = parseFloat(e.target.value);
    media.volume = volume;
    setMetadata(prev => ({ ...prev, volume }));
    setIsMuted(volume === 0);
  }, []);

  // Handle seek
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const media = mediaRef.current;
    const progressBar = progressRef.current;
    if (!media || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * metadata.duration;
    
    media.currentTime = newTime;
    setMetadata(prev => ({ ...prev, currentTime: newTime }));
  }, [metadata.duration]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Skip forward/backward
  const skip = useCallback((seconds: number) => {
    const media = mediaRef.current;
    if (!media) return;

    media.currentTime = Math.max(0, Math.min(metadata.duration, media.currentTime + seconds));
  }, [metadata.duration]);

  // Change playback rate
  const changePlaybackRate = useCallback((rate: number) => {
    const media = mediaRef.current;
    if (!media) return;

    media.playbackRate = rate;
    setMetadata(prev => ({ ...prev, playbackRate: rate }));
    setShowSettings(false);
  }, []);

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle mouse move for controls visibility
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  // Verify media authenticity
  const verifyMedia = useCallback(async () => {
    setVerificationStatus(prev => ({ ...prev, checking: true }));
    setShowVerification(true);

    // Simulate verification process
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock verification result
    const mockResult = {
      checking: false,
      valid: true,
      confidence: 0.95,
      details: {
        hashValid: true,
        signatureValid: true,
        watermarkValid: !!watermark
      }
    };

    setVerificationStatus(mockResult);
    onVerify?.();
  }, [watermark, onVerify]);

  // Download media
  const downloadMedia = useCallback(() => {
    const a = document.createElement('a');
    a.href = src;
    a.download = `${title.replace(/\s+/g, '_')}.${type === 'video' ? 'mp4' : 'mp3'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [src, title, type]);

  // Apply watermark overlay
  useEffect(() => {
    if (!watermark || !canvasRef.current || type !== 'video') return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawWatermark = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw semi-transparent watermark
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.textAlign = 'right';
      ctx.fillText(watermark, canvas.width - 20, canvas.height - 20);
      
      requestAnimationFrame(drawWatermark);
    };

    drawWatermark();
  }, [watermark, type]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          skip(-10);
          break;
        case 'ArrowRight':
          skip(10);
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          toggleMute();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, skip, toggleFullscreen, toggleMute]);

  const MediaElement = type === 'video' ? 'video' : 'audio';

  return (
    <div
      ref={containerRef}
      className={`relative bg-black rounded-lg overflow-hidden ${
        type === 'audio' ? 'h-32' : 'aspect-video'
      }`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Media Element */}
      <MediaElement
        ref={mediaRef as any}
        src={src}
        className={`w-full ${type === 'video' ? 'h-full object-contain' : 'hidden'}`}
        onClick={togglePlay}
        playsInline
      />

      {/* Watermark Overlay */}
      {watermark && type === 'video' && (
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      )}

      {/* Verification Badge */}
      {isVerified && (
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-green-600 text-white px-3 py-1 rounded-full text-sm">
          <Shield className="h-4 w-4" />
          <span>Verified</span>
        </div>
      )}

      {/* Verification Panel */}
      {showVerification && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Media Verification</h3>
            
            {verificationStatus.checking ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                <p className="text-gray-600">Verifying authenticity...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Hash Valid</span>
                  {verificationStatus.details.hashValid ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Signature Valid</span>
                  {verificationStatus.details.signatureValid ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Watermark Valid</span>
                  {verificationStatus.details.watermarkValid ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
                <div className="pt-3 border-t">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Confidence</span>
                    <span className={`font-bold ${
                      verificationStatus.confidence >= 0.9 ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {Math.round(verificationStatus.confidence * 100)}%
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowVerification(false)}
                  className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Title Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start">
          <div className="text-white">
            <h3 className="font-semibold">{title}</h3>
            {proofId && (
              <p className="text-xs text-gray-300">ID: {proofId}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={verifyMedia}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
              title="Verify authenticity"
            >
              <Shield className="h-4 w-4" />
            </button>
            {allowDownload && (
              <button
                onClick={downloadMedia}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onShare}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
              title="Share"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Center Play Button */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-4 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
          >
            <Play className="h-12 w-12" />
          </button>
        )}

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          {/* Progress Bar */}
          <div
            ref={progressRef}
            className="relative h-1 bg-white/30 rounded-full cursor-pointer mb-4 group"
            onClick={handleSeek}
          >
            {/* Buffered */}
            {metadata.buffered && metadata.buffered.length > 0 && (
              <div
                className="absolute h-full bg-white/40 rounded-full"
                style={{
                  left: `${(metadata.buffered.start(0) / metadata.duration) * 100}%`,
                  width: `${((metadata.buffered.end(0) - metadata.buffered.start(0)) / metadata.duration) * 100}%`
                }}
              />
            )}
            
            {/* Progress */}
            <div
              className="absolute h-full bg-blue-500 rounded-full"
              style={{ width: `${(metadata.currentTime / metadata.duration) * 100}%` }}
            />
            
            {/* Hover Preview */}
            <div className="absolute h-full bg-white/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="p-2 hover:bg-white/20 rounded-full text-white transition-colors"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>

              <button
                onClick={() => skip(-10)}
                className="p-2 hover:bg-white/20 rounded-full text-white transition-colors"
              >
                <SkipBack className="h-5 w-5" />
              </button>

              <button
                onClick={() => skip(10)}
                className="p-2 hover:bg-white/20 rounded-full text-white transition-colors"
              >
                <SkipForward className="h-5 w-5" />
              </button>

              {/* Volume Control */}
              <div className="flex items-center gap-2 group">
                <button
                  onClick={toggleMute}
                  className="p-2 hover:bg-white/20 rounded-full text-white transition-colors"
                >
                  {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : metadata.volume}
                  onChange={handleVolumeChange}
                  className="w-0 group-hover:w-20 transition-all duration-300 accent-blue-500"
                />
              </div>

              {/* Time Display */}
              <span className="text-white text-sm">
                {formatTime(metadata.currentTime)} / {formatTime(metadata.duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Playback Rate */}
              <div className="relative">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 hover:bg-white/20 rounded-full text-white transition-colors"
                >
                  <Settings className="h-5 w-5" />
                </button>

                {showSettings && (
                  <div className="absolute bottom-full right-0 mb-2 bg-gray-900 rounded-lg p-2 min-w-[120px]">
                    <p className="text-white text-xs mb-2 px-2">Speed</p>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                      <button
                        key={rate}
                        onClick={() => changePlaybackRate(rate)}
                        className={`w-full text-left px-2 py-1 text-sm rounded ${
                          metadata.playbackRate === rate
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2 hover:bg-white/20 rounded-full text-white transition-colors"
              >
                {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Audio Player UI */}
      {type === 'audio' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="text-center text-white">
            <div className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center">
              {isPlaying ? (
                <div className="flex gap-1">
                  <div className="w-2 h-8 bg-white animate-pulse" />
                  <div className="w-2 h-6 bg-white animate-pulse delay-75" />
                  <div className="w-2 h-10 bg-white animate-pulse delay-150" />
                  <div className="w-2 h-5 bg-white animate-pulse delay-100" />
                </div>
              ) : (
                <Play className="h-10 w-10" />
              )}
            </div>
            <h3 className="font-semibold text-lg">{title}</h3>
            {isVerified && (
              <div className="flex items-center justify-center gap-1 mt-2 text-green-300">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Verified</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaPlayer;
