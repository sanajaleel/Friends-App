import { Server } from 'socket.io';
import { SOCKET_EVENTS } from '@friends-app/shared';
import { db } from '../../db/store';
import crypto from 'crypto';

interface QueueUser {
  userId: string;
  socketId: string;
  joinedAt: Date;
}

interface PendingMatch {
  matchId: string;
  user1Id: string;
  user2Id: string;
  user1Accepted: boolean;
  user2Accepted: boolean;
  timeout: NodeJS.Timeout;
}

export class MatchmakerService {
  private io: Server;
  private queue: Map<string, QueueUser> = new Map();
  private pendingMatches: Map<string, PendingMatch> = new Map();

  constructor(io: Server) {
    this.io = io;
    this.setupListeners();
  }

  private setupListeners() {
    this.io.on('connection', (socket) => {
      socket.on(SOCKET_EVENTS.MATCH_JOIN_QUEUE, () => {
        const userId = socket.handshake.auth?.userId || (socket.handshake.query?.userId as string);
        if (!userId) return;

        this.addUserToQueue(userId, socket.id);
      });

      socket.on(SOCKET_EVENTS.MATCH_LEAVE_QUEUE, () => {
        const userId = socket.handshake.auth?.userId || (socket.handshake.query?.userId as string);
        if (!userId) return;

        this.queue.delete(userId);
        socket.emit(SOCKET_EVENTS.MATCH_CANCELLED, { message: 'Left matchmaking queue.' });
      });

      socket.on(SOCKET_EVENTS.MATCH_ACCEPT, (data: { matchId: string }) => {
        const userId = socket.handshake.auth?.userId || (socket.handshake.query?.userId as string);
        if (!userId || !data.matchId) return;

        this.handleMatchAccept(data.matchId, userId);
      });

      socket.on(SOCKET_EVENTS.MATCH_REJECT, (data: { matchId: string }) => {
        const userId = socket.handshake.auth?.userId || (socket.handshake.query?.userId as string);
        if (!userId || !data.matchId) return;

        this.handleMatchReject(data.matchId, userId);
      });

      socket.on('disconnect', () => {
        for (const [userId, qUser] of this.queue.entries()) {
          if (qUser.socketId === socket.id) {
            this.queue.delete(userId);
            break;
          }
        }
      });
    });
  }

  public addUserToQueue(userId: string, socketId: string) {
    // Remove if already in queue
    this.queue.set(userId, { userId, socketId, joinedAt: new Date() });
    this.io.to(socketId).emit('match:searching', { status: 'SEARCHING' });

    this.tryMatchUsers();
  }

  private tryMatchUsers() {
    if (this.queue.size < 2) return;

    const entries = Array.from(this.queue.entries());
    for (let i = 0; i < entries.length; i++) {
      const [user1Id, qUser1] = entries[i];

      for (let j = i + 1; j < entries.length; j++) {
        const [user2Id, qUser2] = entries[j];

        // Check mutual blocklist
        let isBlocked = false;
        for (const block of db.blocks.values()) {
          if ((block.blockerId === user1Id && block.blockedId === user2Id) ||
              (block.blockerId === user2Id && block.blockedId === user1Id)) {
            isBlocked = true;
            break;
          }
        }

        if (!isBlocked) {
          // Found match! Remove from queue
          this.queue.delete(user1Id);
          this.queue.delete(user2Id);

          const matchId = crypto.randomUUID();
          const profile1 = db.profiles.get(user1Id);
          const profile2 = db.profiles.get(user2Id);

          // 15-second acceptance window
          const timeout = setTimeout(() => {
            this.handleMatchTimeout(matchId);
          }, 15000);

          this.pendingMatches.set(matchId, {
            matchId,
            user1Id,
            user2Id,
            user1Accepted: false,
            user2Accepted: false,
            timeout
          });

          // Send match preview to User 1
          this.io.to(qUser1.socketId).emit(SOCKET_EVENTS.MATCH_FOUND, {
            matchId,
            peerId: user2Id,
            peerName: profile1?.name ? profile2?.name || 'New Friend' : 'Anonymous User',
            peerBio: profile2?.bio,
            peerAvatar: profile2?.avatarUrl,
            peerInterests: profile2?.interests || [],
            timeoutSeconds: 15
          });

          // Send match preview to User 2
          this.io.to(qUser2.socketId).emit(SOCKET_EVENTS.MATCH_FOUND, {
            matchId,
            peerId: user1Id,
            peerName: profile1?.name || 'New Friend',
            peerBio: profile1?.bio,
            peerAvatar: profile1?.avatarUrl,
            peerInterests: profile1?.interests || [],
            timeoutSeconds: 15
          });

          return;
        }
      }
    }
  }

  private handleMatchAccept(matchId: string, userId: string) {
    const match = this.pendingMatches.get(matchId);
    if (!match) return;

    if (match.user1Id === userId) {
      match.user1Accepted = true;
    } else if (match.user2Id === userId) {
      match.user2Accepted = true;
    }

    if (match.user1Accepted && match.user2Accepted) {
      clearTimeout(match.timeout);
      this.pendingMatches.delete(matchId);

      // Create session in database
      db.friendships.set(`match-${matchId}`, {
        id: `match-${matchId}`,
        senderId: match.user1Id,
        receiverId: match.user2Id,
        status: 'ACCEPTED' as any,
        createdAt: new Date()
      });

      // Emit connected event
      this.io.emit(SOCKET_EVENTS.MATCH_CONNECTED, {
        matchId,
        user1Id: match.user1Id,
        user2Id: match.user2Id
      });
    }
  }

  private handleMatchReject(matchId: string, userId: string) {
    const match = this.pendingMatches.get(matchId);
    if (!match) return;

    clearTimeout(match.timeout);
    this.pendingMatches.delete(matchId);

    const otherUserId = match.user1Id === userId ? match.user2Id : match.user1Id;
    this.io.emit(SOCKET_EVENTS.MATCH_CANCELLED, { matchId, reason: 'Declined by peer.' });
  }

  private handleMatchTimeout(matchId: string) {
    const match = this.pendingMatches.get(matchId);
    if (!match) return;

    this.pendingMatches.delete(matchId);
    this.io.emit(SOCKET_EVENTS.MATCH_CANCELLED, { matchId, reason: 'Match acceptance timed out.' });
  }
}
