import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Shield,
  Activity,
  UserCheck,
  Fingerprint,
  Play,
  Square,
  Settings
} from 'lucide-react';

interface VoiceVerificationProps {
  onEnrollmentComplete?: (voiceprintId: string) => void;
  onVerificationComplete?: (result: VerificationResult) => void;
  onError?: (error: string) => void;
  mode?: 'enroll' | 'verify';
  enrolledVoiceprintId?: string;
  minRecordingDuration?: number; // in seconds
  maxRecordingDuration?: number;
}

interface VerificationResult {
  success: boolean;
  matched: boolean;
  confidence: number;
  similarityScore: number;
  livenessScore: number;
  isLiveVoice: boolean;
}

interface AudioAnalysis {
  pitch: number;
  clarity: number;
  backgroundNoise: number;
  volume: number;
}

type VerificationState = 
  | 'idle' 
  | 'requesting' 
  | 'ready' 
  | 'recording' 
  | 'analyzing' 
  | 'enrolled' 
  | 'verified' 
  | 'failed';

const VoiceVerification: React.FC<VoiceVerificationProps> = ({
  onEnrollmentComplete,
  onVerificationComplete,
  onError,
  mode = 'verify',
  enrolledVoiceprintId,
  minRecordingDuration = 3,
  maxRecordingDuration = 30
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [verificationState, setVerificationState] = useState<VerificationState>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioAnalysis, setAudioAnalysis] = useState<AudioAnalysis>({
    pitch: 0,
    clarity: 0,
    backgroundNoise: 0,
    volume: 0
  });
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [enrolledId, setEnrolledId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [phrase, setPhrase] = useState('');

  // Random phrases for liveness detection
  const phrases = [
    'My voice is my password',
    'Verify me securely',
    'Authentication complete',
    'Secure access granted',
    'Identity confirmed'
  ];

  // Generate random phrase on mount
  useEffect(() => {
    setPhrase(phrases[Math.floor(Math.random() * phrases.length)]);
  }, []);

  // Initialize audio context
  const initializeAudio = useCallback(async () => {
    try {
      setVerificationState('requesting');
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          channelCount: 1
        }
      });
      streamRef.current = stream;

      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Create analyser
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // Connect stream to analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      setVerificationState('ready');
      startVisualization();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access microphone';
      setError(errorMessage);
      setVerificationState('idle');
      onError?.(errorMessage);
    }
  }, [onError]);

  // Start visualization
  const startVisualization = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      // Clear canvas
      ctx.fillStyle = 'rgb(20, 20, 30)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw waveform
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      // Calculate volume for analysis
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const volume = average / 255;

      // Update analysis
      setAudioAnalysis(prev => ({
        ...prev,
        volume: Math.round(volume * 100) / 100,
        clarity: volume > 0.1 ? Math.min(1, volume * 1.5) : 0
      }));

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height * 0.8;

        // Gradient based on frequency
        const r = barHeight + 25 * (i / bufferLength);
        const g = 250 * (i / bufferLength);
        const b = 50;

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();
  }, []);

  // Stop visualization
  const stopVisualization = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  // Start recording
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    chunksRef.current = [];

    const options = { mimeType: 'audio/webm;codecs=opus' };
    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processRecording(audioBlob);
      };

      mediaRecorder.start(100);
      setVerificationState('recording');
      setRecordingDuration(0);

      // Start duration timer
      const timer = setInterval(() => {
        setRecordingDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration >= maxRecordingDuration) {
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);

      // Store timer reference for cleanup
      (mediaRecorder as any).timer = timer;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [maxRecordingDuration, onError]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      const timer = (mediaRecorderRef.current as any).timer;
      if (timer) clearInterval(timer);

      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    }
    setVerificationState('analyzing');
  }, []);

  // Process recording
  const processRecording = async (audioBlob: Blob) => {
    try {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (mode === 'enroll') {
        // Simulate enrollment
        const mockVoiceprintId = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setEnrolledId(mockVoiceprintId);
        setVerificationState('enrolled');
        onEnrollmentComplete?.(mockVoiceprintId);
      } else {
        // Simulate verification
        const mockResult: VerificationResult = {
          success: true,
          matched: Math.random() > 0.3, // 70% success rate for demo
          confidence: 0.75 + Math.random() * 0.2,
          similarityScore: 0.8 + Math.random() * 0.15,
          livenessScore: 0.85 + Math.random() * 0.1,
          isLiveVoice: true
        };

        setVerificationResult(mockResult);
        setVerificationState(mockResult.matched ? 'verified' : 'failed');
        onVerificationComplete?.(mockResult);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Processing failed';
      setError(errorMessage);
      setVerificationState('idle');
      onError?.(errorMessage);
    }
  };

  // Reset for retry
  const handleRetry = useCallback(() => {
    setVerificationState('ready');
    setVerificationResult(null);
    setRecordingDuration(0);
    setError(null);
    setPhrase(phrases[Math.floor(Math.random() * phrases.length)]);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      stopVisualization();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stopVisualization]);

  // Format duration
  const formatDuration = (seconds: number): string => {
    return `${seconds.toString().padStart(2, '0')}s`;
  };

  // Get status color
  const getStatusColor = () => {
    switch (verificationState) {
      case 'verified':
      case 'enrolled':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      case 'recording':
        return 'text-blue-500';
      case 'analyzing':
        return 'text-yellow-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Fingerprint className="h-6 w-6" />
            <div>
              <h2 className="font-semibold text-lg">
                {mode === 'enroll' ? 'Voice Enrollment' : 'Voice Verification'}
              </h2>
              <p className="text-sm text-blue-100">
                {mode === 'enroll' 
                  ? 'Enroll your voice for biometric authentication' 
                  : 'Verify your identity using your voice'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
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
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Visualization Canvas */}
      <div className="relative bg-gray-900">
        <canvas
          ref={canvasRef}
          width={600}
          height={150}
          className="w-full h-36"
        />

        {/* Overlay Status */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {verificationState === 'idle' && (
            <div className="text-center text-white">
              <MicOff className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Click Start to begin</p>
            </div>
          )}

          {verificationState === 'analyzing' && (
            <div className="text-center text-white">
              <Activity className="h-12 w-12 mx-auto mb-2 animate-pulse" />
              <p className="text-sm">Analyzing voice...</p>
            </div>
          )}

          {verificationState === 'verified' && (
            <div className="text-center text-green-400">
              <CheckCircle className="h-16 w-16 mx-auto mb-2" />
              <p className="text-lg font-semibold">Verified!</p>
            </div>
          )}

          {verificationState === 'failed' && (
            <div className="text-center text-red-400">
              <AlertCircle className="h-16 w-16 mx-auto mb-2" />
              <p className="text-lg font-semibold">Not Verified</p>
            </div>
          )}

          {verificationState === 'enrolled' && (
            <div className="text-center text-green-400">
              <UserCheck className="h-16 w-16 mx-auto mb-2" />
              <p className="text-lg font-semibold">Enrolled!</p>
            </div>
          )}
        </div>

        {/* Recording Indicator */}
        {verificationState === 'recording' && (
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-xs font-medium">{formatDuration(recordingDuration)}</span>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="px-6 py-4 bg-gray-50">
        {(verificationState === 'ready' || verificationState === 'recording') && (
          <div className="text-center">
            <p className="text-gray-700 font-medium mb-2">Please say:</p>
            <p className="text-xl text-blue-600 font-semibold">"{phrase}"</p>
            <p className="text-sm text-gray-500 mt-2">
              Minimum {minRecordingDuration} seconds required
            </p>
          </div>
        )}

        {verificationResult && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Confidence</span>
              <span className={`font-semibold ${
                verificationResult.confidence >= 0.8 ? 'text-green-600' : 'text-yellow-600'
              }`}>
                {Math.round(verificationResult.confidence * 100)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Similarity</span>
              <span className="font-semibold text-blue-600">
                {Math.round(verificationResult.similarityScore * 100)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Liveness</span>
              <span className={`font-semibold ${
                verificationResult.isLiveVoice ? 'text-green-600' : 'text-red-600'
              }`}>
                {verificationResult.isLiveVoice ? 'Live Voice' : 'Possible Replay'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Debug Info */}
      {showDebug && (
        <div className="px-6 py-3 bg-gray-100 text-xs">
          <h4 className="font-semibold text-gray-700 mb-2">Audio Analysis</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>Volume: {Math.round(audioAnalysis.volume * 100)}%</div>
            <div>Clarity: {Math.round(audioAnalysis.clarity * 100)}%</div>
          </div>
          {enrolledId && (
            <div className="mt-2 text-gray-500">Voiceprint: {enrolledId}</div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="p-6">
        <div className="flex justify-center gap-4">
          {verificationState === 'idle' && (
            <button
              onClick={initializeAudio}
              className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
            >
              <Mic className="h-5 w-5" />
              Start
            </button>
          )}

          {verificationState === 'ready' && (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-8 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors animate-pulse"
            >
              <Mic className="h-5 w-5" />
              Record
            </button>
          )}

          {verificationState === 'recording' && (
            <button
              onClick={stopRecording}
              disabled={recordingDuration < minRecordingDuration}
              className="flex items-center gap-2 px-8 py-3 bg-gray-600 text-white rounded-full hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Square className="h-5 w-5" />
              Stop
            </button>
          )}

          {(verificationState === 'verified' || 
            verificationState === 'failed' || 
            verificationState === 'enrolled') && (
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="h-5 w-5" />
              {mode === 'enroll' ? 'Enroll Another' : 'Try Again'}
            </button>
          )}
        </div>

        {/* Progress Bar */}
        {verificationState === 'recording' && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${(recordingDuration / maxRecordingDuration) * 100}%` }}
              />
            </div>
            <p className="text-center text-sm text-gray-500 mt-2">
              {recordingDuration < minRecordingDuration 
                ? `Record at least ${minRecordingDuration - recordingDuration} more seconds`
                : 'Recording... speak clearly'}
            </p>
          </div>
        )}
      </div>

      {/* Security Note */}
      <div className="px-6 py-3 bg-blue-50 border-t">
        <div className="flex items-center gap-2 text-sm text-blue-700">
          <Shield className="h-4 w-4" />
          <span>Your voice data is encrypted and stored securely</span>
        </div>
      </div>
    </div>
  );
};

export default VoiceVerification;
