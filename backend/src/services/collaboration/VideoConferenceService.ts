import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { Project } from '../../models/Project';
import { CollaborationSession } from '../../models/CollaborationSession';

export interface VideoConferenceRoom {
  id: string;
  projectId: string;
  name: string;
  participants: {
    userId: string;
    socketId: string;
    displayName: string;
    isMuted: boolean;
    isVideoOn: boolean;
    isScreenSharing: boolean;
    joinedAt: Date;
    role: 'HOST' | 'MODERATOR' | 'PARTICIPANT';
  }[];
  settings: {
    maxParticipants: number;
    requirePassword: boolean;
    password?: string;
    enableRecording: boolean;
    enableChat: boolean;
    enableScreenShare: boolean;
    waitingRoom: boolean;
  };
  recording?: {
    isActive: boolean;
    startTime?: Date;
    duration?: number;
    url?: string;
    initiatedBy: string;
  };
  createdAt: Date;
  lastActivity: Date;
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join-room' | 'leave-room' | 'toggle-audio' | 'toggle-video' | 'start-screen-share' | 'stop-screen-share' | 'start-recording' | 'stop-recording';
  payload: any;
  roomId: string;
  userId: string;
  targetUserId?: string;
}

export class VideoConferenceService {
  private io: SocketIOServer;
  private rooms: Map<string, VideoConferenceRoom> = new Map();
  private userSockets: Map<string, string> = new Map(); // userId -> socketId

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // JWT authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        socket.userId = decoded.userId;
        socket.userEmail = decoded.email;
        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.userId} connected to video conference`);

      // Store user socket mapping
      this.userSockets.set(socket.userId, socket.id);

      // Handle room creation
      socket.on('create-room', async (data: { projectId: string, name: string, settings: any }) => {
        try {
          await this.handleCreateRoom(socket, data);
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Handle joining room
      socket.on('join-room', async (data: { roomId: string, password?: string }) => {
        try {
          await this.handleJoinRoom(socket, data);
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Handle WebRTC signaling
      socket.on('signaling', async (message: SignalingMessage) => {
        try {
          await this.handleSignaling(socket, message);
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Handle audio/video toggle
      socket.on('toggle-audio', (data: { roomId: string }) => {
        this.handleToggleAudio(socket, data.roomId);
      });

      socket.on('toggle-video', (data: { roomId: string }) => {
        this.handleToggleVideo(socket, data.roomId);
      });

      // Handle screen sharing
      socket.on('start-screen-share', (data: { roomId: string }) => {
        this.handleStartScreenShare(socket, data.roomId);
      });

      socket.on('stop-screen-share', (data: { roomId: string }) => {
        this.handleStopScreenShare(socket, data.roomId);
      });

      // Handle recording
      socket.on('start-recording', (data: { roomId: string }) => {
        this.handleStartRecording(socket, data.roomId);
      });

      socket.on('stop-recording', (data: { roomId: string }) => {
        this.handleStopRecording(socket, data.roomId);
      });

      // Handle chat
      socket.on('chat-message', (data: { roomId: string, message: string }) => {
        this.handleChatMessage(socket, data.roomId, data.message);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private async handleCreateRoom(socket: any, data: { projectId: string, name: string, settings: any }) {
    // Verify user has permission to create room for this project
    const project = await Project.findById(data.projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const userRole = project.getUserRole(socket.userId);
    if (!userRole || !['OWNER', 'ADMIN', 'MEMBER'].includes(userRole)) {
      throw new Error('Insufficient permissions to create conference room');
    }

    // Check if video conferencing is enabled for project
    if (!project.collaboration.videoConferenceEnabled) {
      throw new Error('Video conferencing is disabled for this project');
    }

    const roomId = this.generateRoomId();
    const room: VideoConferenceRoom = {
      id: roomId,
      projectId: data.projectId,
      name: data.name,
      participants: [],
      settings: {
        maxParticipants: data.settings.maxParticipants || 50,
        requirePassword: data.settings.requirePassword || false,
        password: data.settings.password,
        enableRecording: data.settings.enableRecording || false,
        enableChat: data.settings.enableChat !== false,
        enableScreenShare: data.settings.enableScreenShare !== false,
        waitingRoom: data.settings.waitingRoom || false
      },
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.rooms.set(roomId, room);
    socket.join(roomId);
    
    socket.emit('room-created', { roomId, room });
    console.log(`Room ${roomId} created by user ${socket.userId}`);
  }

  private async handleJoinRoom(socket: any, data: { roomId: string, password?: string }) {
    const room = this.rooms.get(data.roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Check password if required
    if (room.settings.requirePassword && room.settings.password !== data.password) {
      throw new Error('Invalid password');
    }

    // Check participant limit
    if (room.participants.length >= room.settings.maxParticipants) {
      throw new Error('Room is full');
    }

    // Verify user has access to project
    const project = await Project.findById(room.projectId);
    if (!project) {
      throw new Error('Associated project not found');
    }

    if (!project.isMember(socket.userId) && !project.settings.isPublic) {
      throw new Error('Access denied to this project');
    }

    // Check if user is already in room
    const existingParticipant = room.participants.find(p => p.userId === socket.userId);
    if (existingParticipant) {
      // Update socket ID if reconnected
      existingParticipant.socketId = socket.id;
      socket.join(data.roomId);
      socket.emit('joined-room', { room, participant: existingParticipant });
      return;
    }

    // Add participant to room
    const participant = {
      userId: socket.userId,
      socketId: socket.id,
      displayName: socket.userEmail || `User_${socket.userId.slice(-6)}`,
      isMuted: false,
      isVideoOn: false,
      isScreenSharing: false,
      joinedAt: new Date(),
      role: socket.userId === project.owner ? 'HOST' : 'PARTICIPANT'
    };

    room.participants.push(participant);
    room.lastActivity = new Date();

    socket.join(data.roomId);

    // Notify all participants
    this.io.to(data.roomId).emit('participant-joined', { participant, room });
    socket.emit('joined-room', { room, participant });

    console.log(`User ${socket.userId} joined room ${data.roomId}`);
  }

  private async handleSignaling(socket: any, message: SignalingMessage) {
    const room = this.rooms.get(message.roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Verify sender is in room
    const sender = room.participants.find(p => p.userId === message.userId);
    if (!sender) {
      throw new Error('Sender not in room');
    }

    // Handle different message types
    switch (message.type) {
      case 'offer':
      case 'answer':
      case 'ice-candidate':
        if (message.targetUserId) {
          // Send to specific participant
          const targetSocket = this.userSockets.get(message.targetUserId);
          if (targetSocket) {
            this.io.to(targetSocket).emit('signaling', message);
          }
        } else {
          // Broadcast to all other participants
          socket.to(message.roomId).emit('signaling', message);
        }
        break;

      default:
        throw new Error('Unknown signaling message type');
    }
  }

  private handleToggleAudio(socket: any, roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.find(p => p.socketId === socket.id);
    if (participant) {
      participant.isMuted = !participant.isMuted;
      room.lastActivity = new Date();
      
      this.io.to(roomId).emit('participant-updated', { participant });
    }
  }

  private handleToggleVideo(socket: any, roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.find(p => p.socketId === socket.id);
    if (participant) {
      participant.isVideoOn = !participant.isVideoOn;
      room.lastActivity = new Date();
      
      this.io.to(roomId).emit('participant-updated', { participant });
    }
  }

  private handleStartScreenShare(socket: any, roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (!room.settings.enableScreenShare) {
      socket.emit('error', { message: 'Screen sharing is disabled in this room' });
      return;
    }

    // Check if anyone else is already screen sharing
    const existingSharer = room.participants.find(p => p.isScreenSharing);
    if (existingSharer) {
      socket.emit('error', { message: 'Another participant is already screen sharing' });
      return;
    }

    const participant = room.participants.find(p => p.socketId === socket.id);
    if (participant) {
      participant.isScreenSharing = true;
      room.lastActivity = new Date();
      
      this.io.to(roomId).emit('screen-share-started', { participant });
    }
  }

  private handleStopScreenShare(socket: any, roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.find(p => p.socketId === socket.id);
    if (participant) {
      participant.isScreenSharing = false;
      room.lastActivity = new Date();
      
      this.io.to(roomId).emit('screen-share-stopped', { participant });
    }
  }

  private handleStartRecording(socket: any, roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (!room.settings.enableRecording) {
      socket.emit('error', { message: 'Recording is disabled in this room' });
      return;
    }

    if (room.recording?.isActive) {
      socket.emit('error', { message: 'Recording is already in progress' });
      return;
    }

    room.recording = {
      isActive: true,
      startTime: new Date(),
      initiatedBy: socket.userId
    };

    room.lastActivity = new Date();
    this.io.to(roomId).emit('recording-started', { recording: room.recording });
  }

  private handleStopRecording(socket: any, roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (!room.recording?.isActive) {
      socket.emit('error', { message: 'No recording is in progress' });
      return;
    }

    const duration = Date.now() - room.recording.startTime!.getTime();
    room.recording.isActive = false;
    room.recording.duration = duration;
    room.recording.url = `/api/recordings/${roomId}_${Date.now()}.webm`;

    room.lastActivity = new Date();
    this.io.to(roomId).emit('recording-stopped', { recording: room.recording });
  }

  private handleChatMessage(socket: any, roomId: string, message: string) {
    const room = this.rooms.get(roomId);
    if (!room || !room.settings.enableChat) return;

    const participant = room.participants.find(p => p.socketId === socket.id);
    if (!participant) return;

    const chatMessage = {
      id: Date.now().toString(),
      userId: socket.userId,
      displayName: participant.displayName,
      message,
      timestamp: new Date()
    };

    room.lastActivity = new Date();
    this.io.to(roomId).emit('chat-message', chatMessage);
  }

  private handleDisconnect(socket: any) {
    console.log(`User ${socket.userId} disconnected from video conference`);

    // Remove user from all rooms
    for (const [roomId, room] of this.rooms.entries()) {
      const participantIndex = room.participants.findIndex(p => p.socketId === socket.id);
      if (participantIndex !== -1) {
        const participant = room.participants[participantIndex];
        room.participants.splice(participantIndex, 1);
        room.lastActivity = new Date();

        // Notify other participants
        this.io.to(roomId).emit('participant-left', { participant });

        // Clean up empty rooms
        if (room.participants.length === 0) {
          this.rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        }
      }
    }

    // Remove user socket mapping
    this.userSockets.delete(socket.userId);
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 12);
  }

  // Public methods for API integration
  public getRoom(roomId: string): VideoConferenceRoom | undefined {
    return this.rooms.get(roomId);
  }

  public getRoomsForProject(projectId: string): VideoConferenceRoom[] {
    return Array.from(this.rooms.values()).filter(room => room.projectId === projectId);
  }

  public getActiveRoomCount(): number {
    return this.rooms.size;
  }

  public getParticipantCount(): number {
    return Array.from(this.rooms.values()).reduce((total, room) => total + room.participants.length, 0);
  }

  // Cleanup inactive rooms (call this periodically)
  public cleanupInactiveRooms(maxInactiveMinutes: number = 60) {
    const cutoff = new Date(Date.now() - maxInactiveMinutes * 60 * 1000);
    
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.lastActivity < cutoff && room.participants.length === 0) {
        this.rooms.delete(roomId);
        console.log(`Cleaned up inactive room ${roomId}`);
      }
    }
  }
}
