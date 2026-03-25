import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Video, 
  StopCircle, 
  Play, 
  Pause, 
  Camera, 
  Mic, 
  MicOff,
  Settings,
  CheckCircle,
  AlertCircle,
  Upload,
  Download,
  RefreshCw
} from 'lucide-react';

interface VideoRecorderProps {
  onRecordingComplete?: (blob: Blob, metadata: RecordingMetadata) => void;
  onError?: (error: string) => void;
  maxDuration?: number; // in seconds
  quality?: 'low' | 'medium' | 'high';
  enableWatermark?: boolean;
  watermarkText?: string;
}

interface RecordingMetadata {
  duration: number;
  size: number;
  resolution: { width: number; height: number };
  mimeType: string;
}

interface MediaDevice {
  deviceId: string;
  label: string;
  kind: 'videoinput' | 'audioinput';
}

type RecordingState = 'idle' | 'requesting' | 'ready' | 'recording' | 'paused' | 'preview' | 'processing';

const VideoRecorder: React.FC<VideoRecorderProps> = ({
  onRecordingComplete,
  onError,
  maxDuration = 300, // 5 minutes default
  quality = 'high',
  enableWatermark = false,
  watermarkText = 'Verinode'
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [videoDevices, setVideoDevices] = useState<MediaDevice[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDevice[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamHealth, setStreamHealth] = useState<'good' | 'fair' | 'poor'>('good');

  // Quality settings
  const qualitySettings = {
    low: { width: 640, height: 480, bitrate: 500000 },
    medium: { width: 1280, height: 720, bitrate: 1500000 },
    high: { width: 1920, height: 1080, bitrate: 5000000 }
  };

  // Get available media devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        const videoDevs = devices
          .filter(d => d.kind === 'videoinput')
          .map(d => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 8)}`, kind: 'videoinput' as const }));
        
        const audioDevs = devices
          .filter(d => d.kind === 'audioinput')
          .map(d => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`, kind: 'audioinput' as const }));

        setVideoDevices(videoDevs);
        setAudioDevices(audioDevs);

        if (videoDevs.length > 0 && !selectedVideoDevice) {
          setSelectedVideoDevice(videoDevs[0].deviceId);
        }
        if (audioDevs.length > 0 && !selectedAudioDevice) {
          setSelectedAudioDevice(audioDevs[0].deviceId);
        }
      } catch (err) {
        console.error('Error enumerating devices:', err);
      }
    };

    getDevices();
  }, []);

  // Initialize camera stream
  const initializeStream = useCallback(async () => {
    try {
      setRecordingState('requesting');
      setError(null);

      const constraints: MediaStreamConstraints = {
        video: isVideoEnabled ? {
          deviceId: selectedVideoDevice ? { exact: selectedVideoDevice } : undefined,
          width: { ideal: qualitySettings[quality].width },
          height: { ideal: qualitySettings[quality].height },
          frameRate: { ideal: 30 }
        } : false,
        audio: isAudioEnabled ? {
          deviceId: selectedAudioDevice ? { exact: selectedAudioDevice } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Monitor stream health
      monitorStreamHealth(stream);

      setRecordingState('ready');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera/microphone';
      setError(errorMessage);
      setRecordingState('idle');
      onError?.(errorMessage);
    }
  }, [selectedVideoDevice, selectedAudioDevice, isVideoEnabled, isAudioEnabled, quality, onError]);

  // Monitor stream quality
  const monitorStreamHealth = (stream: MediaStream) => {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    const checkHealth = () => {
      const settings = videoTrack.getSettings();
      const constraints = videoTrack.getConstraints();
      
      // Check if actual resolution matches requested
      const targetWidth = qualitySettings[quality].width;
      const actualWidth = settings.width || 0;
      
      if (actualWidth < targetWidth * 0.8) {
        setStreamHealth('poor');
      } else if (actualWidth < targetWidth * 0.95) {
        setStreamHealth('fair');
      } else {
        setStreamHealth('good');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    
    return () => clearInterval(interval);
  };

  // Start recording
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    
    const options: MediaRecorderOptions = {
      mimeType: getSupportedMimeType(),
      videoBitsPerSecond: qualitySettings[quality].bitrate
    };

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: options.mimeType });
        setRecordedBlob(blob);
        setRecordingState('preview');

        // Generate metadata
        const metadata: RecordingMetadata = {
          duration: recordingDuration,
          size: blob.size,
          resolution: qualitySettings[quality],
          mimeType: options.mimeType || 'video/webm'
        };

        onRecordingComplete?.(blob, metadata);
      };

      mediaRecorder.start(1000); // Collect data every second
      setRecordingState('recording');
      setRecordingDuration(0);

      // Start duration timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration >= maxDuration) {
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [quality, maxDuration, recordingDuration, onRecordingComplete, onError]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    setRecordingState('processing');
  }, []);

  // Pause/Resume recording
  const togglePause = useCallback(() => {
    if (!mediaRecorderRef.current) return;

    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
      if (timerRef.current) clearInterval(timerRef.current);
    } else if (mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    }
  }, []);

  // Retake recording
  const retakeRecording = useCallback(() => {
    setRecordedBlob(null);
    setRecordingDuration(0);
    setRecordingState('ready');
    initializeStream();
  }, [initializeStream]);

  // Download recording
  const downloadRecording = useCallback(() => {
    if (!recordedBlob) return;

    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [recordedBlob]);

  // Stop stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stopStream]);

  // Get supported MIME type
  const getSupportedMimeType = (): string => {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'video/webm';
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Apply watermark to canvas
  const applyWatermark = useCallback(() => {
    if (!enableWatermark || !canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const drawFrame = () => {
      if (video.paused || video.ended) return;
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Draw watermark
      ctx.font = '20px Arial';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillText(watermarkText, canvas.width - 150, canvas.height - 20);
      
      requestAnimationFrame(drawFrame);
    };

    drawFrame();
  }, [enableWatermark, watermarkText]);

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          <span className="font-semibold">Video Recorder</span>
        </div>
        <div className="flex items-center gap-2">
          {streamHealth !== 'good' && (
            <span className={`text-xs px-2 py-1 rounded ${
              streamHealth === 'fair' ? 'bg-yellow-600' : 'bg-red-600'
            }`}>
              {streamHealth === 'fair' ? 'Fair Quality' : 'Poor Quality'}
            </span>
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
        <div className="bg-red-50 border-l-4 border-red-500 p-4 m-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-gray-50 p-4 border-b">
          <h3 className="font-medium text-gray-700 mb-3">Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Camera</label>
              <select
                value={selectedVideoDevice}
                onChange={(e) => setSelectedVideoDevice(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                {videoDevices.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Microphone</label>
              <select
                value={selectedAudioDevice}
                onChange={(e) => setSelectedAudioDevice(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                {audioDevices.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setIsVideoEnabled(!isVideoEnabled)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                isVideoEnabled ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
              }`}
            >
              <Camera className="h-4 w-4" />
              {isVideoEnabled ? 'Video On' : 'Video Off'}
            </button>

            <button
              onClick={() => setIsAudioEnabled(!isAudioEnabled)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                isAudioEnabled ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              {isAudioEnabled ? 'Audio On' : 'Audio Off'}
            </button>
          </div>
        </div>
      )}

      {/* Video Preview */}
      <div className="relative bg-black aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={recordingState === 'recording'}
          className="w-full h-full object-cover"
          onPlay={applyWatermark}
          loading="lazy"
        />

        {/* Watermark Canvas (overlay) */}
        {enableWatermark && recordingState === 'recording' && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        )}

        {/* Recording Indicator */}
        {recordingState === 'recording' && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            <span className="text-sm font-medium">REC {formatDuration(recordingDuration)}</span>
          </div>
        )}

        {recordingState === 'paused' && (
          <div className="absolute top-4 left-4 bg-yellow-600 text-white px-3 py-1 rounded-full">
            <span className="text-sm font-medium">PAUSED</span>
          </div>
        )}

        {/* Duration Limit Warning */}
        {recordingState === 'recording' && recordingDuration >= maxDuration - 30 && (
          <div className="absolute top-4 right-4 bg-orange-600 text-white px-3 py-1 rounded-full text-sm">
            {maxDuration - recordingDuration}s remaining
          </div>
        )}

        {/* Preview State */}
        {recordingState === 'preview' && recordedBlob && (
          <video
            src={URL.createObjectURL(recordedBlob)}
            controls
            className="w-full h-full"
            loading="lazy"
          />
        )}

        {/* Idle State */}
        {recordingState === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Click Start to begin recording</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 bg-gray-50">
        <div className="flex items-center justify-center gap-4">
          {recordingState === 'idle' && (
            <button
              onClick={initializeStream}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
            >
              <Camera className="h-5 w-5" />
              Start Camera
            </button>
          )}

          {recordingState === 'ready' && (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
            >
              <Video className="h-5 w-5" />
              Start Recording
            </button>
          )}

          {recordingState === 'recording' && (
            <>
              <button
                onClick={togglePause}
                className="flex items-center gap-2 px-6 py-3 bg-yellow-600 text-white rounded-full hover:bg-yellow-700 transition-colors"
              >
                <Pause className="h-5 w-5" />
                Pause
              </button>
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
              >
                <StopCircle className="h-5 w-5" />
                Stop
              </button>
            </>
          )}

          {recordingState === 'paused' && (
            <>
              <button
                onClick={togglePause}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
              >
                <Play className="h-5 w-5" />
                Resume
              </button>
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
              >
                <StopCircle className="h-5 w-5" />
                Stop
              </button>
            </>
          )}

          {recordingState === 'preview' && (
            <>
              <button
                onClick={retakeRecording}
                className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-full hover:bg-gray-700 transition-colors"
              >
                <RefreshCw className="h-5 w-5" />
                Retake
              </button>
              <button
                onClick={downloadRecording}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
              >
                <Download className="h-5 w-5" />
                Download
              </button>
            </>
          )}
        </div>

        {/* Recording Info */}
        {(recordingState === 'recording' || recordingState === 'paused') && (
          <div className="mt-4 text-center text-sm text-gray-600">
            <p>Recording: {formatDuration(recordingDuration)} / {formatDuration(maxDuration)}</p>
            <p className="text-xs mt-1">Quality: {quality} | {isAudioEnabled ? 'Audio On' : 'Audio Off'}</p>
          </div>
        )}

        {recordingState === 'preview' && recordedBlob && (
          <div className="mt-4 text-center text-sm text-gray-600">
            <p>Duration: {formatDuration(recordingDuration)}</p>
            <p>Size: {(recordedBlob.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoRecorder;
