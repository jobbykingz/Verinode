import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';

export interface VideoRoom {
  id: string;
  name: string;
  projectId: string;
  participants: VideoParticipant[];
  settings: VideoRoomSettings;
  recording?: VideoRecording;
  createdAt: Date;
  lastActivity: Date;
}

export interface VideoParticipant {
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

export interface VideoRoomSettings {
  maxParticipants: number;
  requirePassword: boolean;
  password?: string;
  enableRecording: boolean;
  enableChat: boolean;
  enableScreenShare: boolean;
  waitingRoom: boolean;
}

export interface VideoRecording {
  isActive: boolean;
  startTime?: Date;
  duration?: number;
  url?: string;
  initiatedBy: string;
}

export interface VideoServiceConfig {
  serverUrl: string;
  authToken: string;
  iceServers?: RTCIceServer[];
}

export class VideoService {
  private socket: Socket | null = null;
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private config: VideoServiceConfig;
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor(config: VideoServiceConfig) {
    this.config = config;
  }

  // Connection Management
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.config.serverUrl, {
          auth: { token: this.config.authToken },
          transports: ['websocket', 'polling']
        });

        this.socket.on('connect', () => {
          console.log('Connected to video service');
          this.emit('connected');
          resolve();
        });

        this.socket.on('disconnect', () => {
          console.log('Disconnected from video service');
          this.emit('disconnected');
        });

        this.socket.on('error', (error: any) => {
          console.error('Video service error:', error);
          this.emit('error', error);
          reject(error);
        });

        // Room events
        this.socket.on('room-created', (data: any) => {
          this.emit('roomCreated', data);
        });

        this.socket.on('joined-room', (data: any) => {
          this.emit('joinedRoom', data);
        });

        this.socket.on('participant-joined', (data: any) => {
          this.emit('participantJoined', data);
        });

        this.socket.on('participant-left', (data: any) => {
          this.emit('participantLeft', data);
          this.cleanupPeerConnection(data.userId);
        });

        this.socket.on('participant-updated', (data: any) => {
          this.emit('participantUpdated', data);
        });

        // Signaling events
        this.socket.on('signaling', (message: any) => {
          this.handleSignalingMessage(message);
        });

        // Media events
        this.socket.on('screen-share-started', (data: any) => {
          this.emit('screenShareStarted', data);
        });

        this.socket.on('screen-share-stopped', (data: any) => {
          this.emit('screenShareStopped', data);
        });

        // Recording events
        this.socket.on('recording-started', (data: any) => {
          this.emit('recordingStarted', data);
        });

        this.socket.on('recording-stopped', (data: any) => {
          this.emit('recordingStopped', data);
        });

        // Chat events
        this.socket.on('chat-message', (message: any) => {
          this.emit('chatMessage', message);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.cleanup();
  }

  // Local Media Management
  async getLocalMedia(constraints: MediaStreamConstraints = { video: true, audio: true }): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (error) {
      console.error('Error accessing local media:', error);
      throw new Error('Failed to access camera/microphone');
    }
  }

  stopLocalMedia(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  // Room Management
  async createRoom(projectId: string, name: string, settings: VideoRoomSettings): Promise<VideoRoom> {
    if (!this.socket) {
      throw new Error('Not connected to video service');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit('create-room', { projectId, name, settings });
      
      const timeout = setTimeout(() => {
        reject(new Error('Timeout creating room'));
      }, 10000);

      const handler = (data: VideoRoom) => {
        clearTimeout(timeout);
        this.off('roomCreated', handler);
        resolve(data);
      };

      this.on('roomCreated', handler);
    });
  }

  async joinRoom(roomId: string, password?: string): Promise<VideoRoom> {
    if (!this.socket) {
      throw new Error('Not connected to video service');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit('join-room', { roomId, password });
      
      const timeout = setTimeout(() => {
        reject(new Error('Timeout joining room'));
      }, 10000);

      const handler = (data: VideoRoom) => {
        clearTimeout(timeout);
        this.off('joinedRoom', handler);
        resolve(data);
      };

      this.on('joinedRoom', handler);
    });
  }

  leaveRoom(roomId: string): void {
    if (this.socket) {
      this.socket.emit('leave-room', { roomId });
    }
    this.cleanup();
  }

  // Media Controls
  toggleAudio(roomId: string): void {
    if (this.socket && this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.socket.emit('toggle-audio', { roomId });
      }
    }
  }

  toggleVideo(roomId: string): void {
    if (this.socket && this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.socket.emit('toggle-video', { roomId });
      }
    }
  }

  async startScreenShare(roomId: string): Promise<void> {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      // Add screen share tracks to all peer connections
      this.peerConnections.forEach(pc => {
        screenStream.getTracks().forEach(track => {
          pc.addTrack(track, screenStream);
        });
      });

      if (this.socket) {
        this.socket.emit('start-screen-share', { roomId });
      }

      // Handle screen share end
      screenStream.getVideoTracks()[0].addEventListener('ended', () => {
        this.stopScreenShare(roomId);
      });

    } catch (error) {
      console.error('Error starting screen share:', error);
      throw new Error('Failed to start screen sharing');
    }
  }

  stopScreenShare(roomId: string): void {
    if (this.socket) {
      this.socket.emit('stop-screen-share', { roomId });
    }
  }

  // Recording Controls
  startRecording(roomId: string): void {
    if (this.socket) {
      this.socket.emit('start-recording', { roomId });
    }
  }

  stopRecording(roomId: string): void {
    if (this.socket) {
      this.socket.emit('stop-recording', { roomId });
    }
  }

  // Chat
  sendChatMessage(roomId: string, message: string): void {
    if (this.socket) {
      this.socket.emit('chat-message', { roomId, message });
    }
  }

  // WebRTC Signaling
  private async handleSignalingMessage(message: any): Promise<void> {
    const { type, payload, userId, targetUserId } = message;

    if (targetUserId && targetUserId !== this.getUserId()) {
      return; // Not for us
    }

    try {
      switch (type) {
        case 'offer':
          await this.handleOffer(payload, userId);
          break;
        case 'answer':
          await this.handleAnswer(payload, userId);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(payload, userId);
          break;
      }
    } catch (error) {
      console.error('Error handling signaling message:', error);
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit, userId: string): Promise<void> {
    let pc = this.peerConnections.get(userId);
    if (!pc) {
      pc = await this.createPeerConnection(userId);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (this.socket) {
      this.socket.emit('signaling', {
        type: 'answer',
        payload: answer,
        userId: this.getUserId(),
        targetUserId: userId
      });
    }
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit, userId: string): Promise<void> {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit, userId: string): Promise<void> {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private async createPeerConnection(userId: string): Promise<RTCPeerConnection> {
    const pc = new RTCPeerConnection({
      iceServers: this.config.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Add local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit('signaling', {
          type: 'ice-candidate',
          payload: event.candidate,
          userId: this.getUserId(),
          targetUserId: userId
        });
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      this.emit('remoteStream', { userId, stream: event.streams[0] });
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      this.emit('connectionStateChange', { userId, state: pc.connectionState });
      
      if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        this.cleanupPeerConnection(userId);
      }
    };

    this.peerConnections.set(userId, pc);
    return pc;
  }

  private cleanupPeerConnection(userId: string): void {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
    }
  }

  private cleanup(): void {
    this.stopLocalMedia();
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
  }

  // Utility Methods
  private getUserId(): string {
    // Extract user ID from JWT token or socket auth
    return 'current-user-id'; // This should be extracted from auth token
  }

  // Event Management
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler?: Function): void {
    if (handler) {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    } else {
      this.eventHandlers.delete(event);
    }
  }

  private emit(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Error in event handler:', error);
        }
      });
    }
  }

  // Statistics and Monitoring
  getConnectionStats(): { activeConnections: number; localStreamActive: boolean } {
    return {
      activeConnections: this.peerConnections.size,
      localStreamActive: !!this.localStream
    };
  }

  async getPeerConnectionStats(userId: string): Promise<RTCStatsReport | null> {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      return await pc.getStats();
    }
    return null;
  }

  // Error Handling
  private handleError(error: any, context: string): void {
    console.error(`VideoService error in ${context}:`, error);
    this.emit('error', { error, context });
    toast.error(`Video service error: ${error.message || 'Unknown error'}`);
  }

  // Static factory method
  static create(config: VideoServiceConfig): VideoService {
    return new VideoService(config);
  }
}

// Export types for external use
export type { VideoServiceConfig };
