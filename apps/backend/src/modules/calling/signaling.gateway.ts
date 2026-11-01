import { Server, Socket } from 'socket.io';
import { CallType, CallStatus, SOCKET_EVENTS } from '@friends-app/shared';
import { db } from '../../db/store';
import { CallingPermissionGuard } from './calling-permission.guard';
import crypto from 'crypto';

interface ActiveCall {
  id: string;
  callerId: string;
  calleeId: string;
  type: CallType;
  startedAt: Date;
  ratePerMin: number;
  durationSeconds: number;
  timerInterval?: NodeJS.Timeout;
}

export class SignalingGateway {
  private io: Server;
  // Map of userId -> socketId
  private userSockets: Map<string, string> = new Map();
  // Map of socketId -> userId
  private socketUsers: Map<string, string> = new Map();
  // Set of userIds currently in an active call
  private activeCallUsers: Set<string> = new Set();
  // Map of callId -> ActiveCall
  private activeCalls: Map<string, ActiveCall> = new Map();

  constructor(io: Server) {
    this.io = io;
    this.setupListeners();
  }

  public getActiveCallUsers(): Set<string> {
    return this.activeCallUsers;
  }

  public getUserSocket(userId: string): string | undefined {
    return this.userSockets.get(userId);
  }

  private setupListeners() {
    this.io.on('connection', (socket: Socket) => {
      const userId = socket.handshake.auth?.userId || (socket.handshake.query?.userId as string);

      if (userId && db.users.has(userId)) {
        this.userSockets.set(userId, socket.id);
        this.socketUsers.set(socket.id, userId);

        const user = db.users.get(userId)!;
        user.isOnline = true;
        user.lastSeenAt = new Date();

        // Broadcast presence
        this.io.emit(SOCKET_EVENTS.PRESENCE_STATUS, { userId, isOnline: true });
      }

      // ==========================================
      // CALL INITIATION WITH STRICT PERMISSIONS
      // ==========================================
      socket.on(SOCKET_EVENTS.CALL_INITIATE, (data: { calleeId: string; type: CallType }) => {
        const callerId = this.socketUsers.get(socket.id);
        if (!callerId) {
          socket.emit(SOCKET_EVENTS.CALL_ERROR, { message: 'Authentication required to initiate calls.' });
          return;
        }

        const { calleeId, type } = data;

        // Execute Calling Permission Matrix verification on the backend
        const permission = CallingPermissionGuard.validateCall(
          callerId,
          calleeId,
          type,
          this.activeCallUsers
        );

        if (!permission.allowed) {
          socket.emit(SOCKET_EVENTS.CALL_ERROR, {
            code: permission.errorCode,
            message: permission.message
          });
          return;
        }

        const calleeSocketId = this.userSockets.get(calleeId);
        if (!calleeSocketId) {
          socket.emit(SOCKET_EVENTS.CALL_ERROR, {
            code: 'USER_OFFLINE',
            message: 'User is not currently reachable.'
          });
          return;
        }

        const callerProfile = db.profiles.get(callerId);
        const callerUser = db.users.get(callerId)!;
        const callId = crypto.randomUUID();

        // Send incoming call prompt to Callee
        this.io.to(calleeSocketId).emit(SOCKET_EVENTS.CALL_INCOMING, {
          callId,
          callerId,
          callerName: callerProfile?.name || callerUser.phoneNumber,
          callerAvatar: callerProfile?.avatarUrl,
          type,
          ratePerMin: permission.ratePerMin || 0
        });

        // Store pending call setup
        socket.emit('call:ringing', { callId, calleeId });
      });

      // ==========================================
      // CALL ACCEPT / REJECT
      // ==========================================
      socket.on(SOCKET_EVENTS.CALL_ACCEPT, (data: { callId: string; callerId: string; type: CallType; ratePerMin?: number }) => {
        const calleeId = this.socketUsers.get(socket.id);
        if (!calleeId) return;

        const { callId, callerId, type, ratePerMin } = data;
        const callerSocketId = this.userSockets.get(callerId);

        if (!callerSocketId) {
          socket.emit(SOCKET_EVENTS.CALL_ERROR, { message: 'Caller disconnected.' });
          return;
        }

        // Mark users as busy
        this.activeCallUsers.add(callerId);
        this.activeCallUsers.add(calleeId);

        const activeCall: ActiveCall = {
          id: callId,
          callerId,
          calleeId,
          type,
          startedAt: new Date(),
          ratePerMin: ratePerMin || 0,
          durationSeconds: 0
        };

        // Start call duration timer
        activeCall.timerInterval = setInterval(() => {
          activeCall.durationSeconds += 1;
          
          // Emit duration tick
          this.io.to(socket.id).emit(SOCKET_EVENTS.CALL_DURATION_TICK, {
            callId,
            durationSeconds: activeCall.durationSeconds
          });
          this.io.to(callerSocketId).emit(SOCKET_EVENTS.CALL_DURATION_TICK, {
            callId,
            durationSeconds: activeCall.durationSeconds
          });

          // Check celebrity billing credit deduction every 60 seconds
          if (activeCall.ratePerMin > 0 && activeCall.durationSeconds % 60 === 0) {
            const caller = db.users.get(callerId);
            if (caller) {
              const minutesElapsed = Math.floor(activeCall.durationSeconds / 60);
              const cost = activeCall.ratePerMin;
              
              if (caller.callingCredits >= 1) {
                caller.callingCredits -= 1;
              } else if (caller.walletBalance >= cost) {
                caller.walletBalance -= cost;
              } else {
                // Out of funds -> terminate call cleanly
                this.endCall(callId, 'CREDITS_EXHAUSTED');
              }
            }
          }
        }, 1000);

        this.activeCalls.set(callId, activeCall);

        // Notify both parties that call is connected
        this.io.to(callerSocketId).emit(SOCKET_EVENTS.CALL_ACCEPT, { callId, calleeId });
        this.io.to(socket.id).emit(SOCKET_EVENTS.CALL_ACCEPT, { callId, callerId });
      });

      socket.on(SOCKET_EVENTS.CALL_REJECT, (data: { callId: string; callerId: string; reason?: string }) => {
        const { callerId, reason } = data;
        const callerSocketId = this.userSockets.get(callerId);
        if (callerSocketId) {
          this.io.to(callerSocketId).emit(SOCKET_EVENTS.CALL_REJECT, {
            reason: reason || 'Call was declined by user.'
          });
        }
      });

      // ==========================================
      // WEBRTC SIGNALING (OFFER / ANSWER / ICE)
      // ==========================================
      socket.on(SOCKET_EVENTS.SIGNAL_OFFER, (data: { targetUserId: string; sdp: any }) => {
        const senderId = this.socketUsers.get(socket.id);
        const targetSocketId = this.userSockets.get(data.targetUserId);
        if (targetSocketId && senderId) {
          this.io.to(targetSocketId).emit(SOCKET_EVENTS.SIGNAL_OFFER, {
            senderId,
            sdp: data.sdp
          });
        }
      });

      socket.on(SOCKET_EVENTS.SIGNAL_ANSWER, (data: { targetUserId: string; sdp: any }) => {
        const senderId = this.socketUsers.get(socket.id);
        const targetSocketId = this.userSockets.get(data.targetUserId);
        if (targetSocketId && senderId) {
          this.io.to(targetSocketId).emit(SOCKET_EVENTS.SIGNAL_ANSWER, {
            senderId,
            sdp: data.sdp
          });
        }
      });

      socket.on(SOCKET_EVENTS.SIGNAL_ICE_CANDIDATE, (data: { targetUserId: string; candidate: any }) => {
        const senderId = this.socketUsers.get(socket.id);
        const targetSocketId = this.userSockets.get(data.targetUserId);
        if (targetSocketId && senderId) {
          this.io.to(targetSocketId).emit(SOCKET_EVENTS.SIGNAL_ICE_CANDIDATE, {
            senderId,
            candidate: data.candidate
          });
        }
      });

      // ==========================================
      // CALL END / HANGUP
      // ==========================================
      socket.on(SOCKET_EVENTS.CALL_ENDED, (data: { callId?: string; targetUserId?: string }) => {
        if (data.callId) {
          this.endCall(data.callId, 'USER_HANGUP');
        } else if (data.targetUserId) {
          const targetSocketId = this.userSockets.get(data.targetUserId);
          if (targetSocketId) {
            this.io.to(targetSocketId).emit(SOCKET_EVENTS.CALL_ENDED, { reason: 'USER_HANGUP' });
          }
        }
      });

      // ==========================================
      // DISCONNECT HANDLING
      // ==========================================
      socket.on('disconnect', () => {
        const userId = this.socketUsers.get(socket.id);
        if (userId) {
          this.userSockets.delete(userId);
          this.socketUsers.delete(socket.id);
          this.activeCallUsers.delete(userId);

          const user = db.users.get(userId);
          if (user) {
            user.isOnline = false;
            user.lastSeenAt = new Date();
          }

          // Terminate any active calls associated with this user
          for (const [callId, call] of this.activeCalls.entries()) {
            if (call.callerId === userId || call.calleeId === userId) {
              this.endCall(callId, 'USER_DISCONNECTED');
            }
          }

          this.io.emit(SOCKET_EVENTS.PRESENCE_STATUS, { userId, isOnline: false });
        }
      });
    });
  }

  public endCall(callId: string, reason: string) {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    if (call.timerInterval) {
      clearInterval(call.timerInterval);
    }

    this.activeCallUsers.delete(call.callerId);
    this.activeCallUsers.delete(call.calleeId);

    // Save call log in database
    db.callLogs.set(callId, {
      id: callId,
      callerId: call.callerId,
      calleeId: call.calleeId,
      type: call.type,
      status: CallStatus.ENDED,
      durationSeconds: call.durationSeconds,
      creditsCharged: call.ratePerMin > 0 ? (call.durationSeconds / 60) * call.ratePerMin : 0,
      createdAt: call.startedAt
    });

    const callerSocketId = this.userSockets.get(call.callerId);
    const calleeSocketId = this.userSockets.get(call.calleeId);

    if (callerSocketId) {
      this.io.to(callerSocketId).emit(SOCKET_EVENTS.CALL_ENDED, { callId, reason });
    }
    if (calleeSocketId) {
      this.io.to(calleeSocketId).emit(SOCKET_EVENTS.CALL_ENDED, { callId, reason });
    }

    this.activeCalls.delete(callId);
  }
}
