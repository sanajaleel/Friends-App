import express, { Request, Response } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { CONFIG } from './config/environment';
import { db } from './db/store';
import { AuthService } from './modules/auth/auth.service';
import { EventsService } from './modules/events/events.service';
import { CelebrityService } from './modules/celebrities/celebrity.service';
import { MembershipService } from './modules/memberships/membership.service';
import { SupportService } from './modules/support/support.service';
import { CallingPermissionGuard } from './modules/calling/calling-permission.guard';
import { SignalingGateway } from './modules/calling/signaling.gateway';
import { MatchmakerService } from './modules/matchmaking/matchmaker.service';
import { CallType, Role, AccountStatus, TicketPriority, TicketStatusEnum } from '../../../packages/shared/src/types';
import jwt from 'jsonwebtoken';

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

const server = http.createServer(app);

// Setup Socket.io for Real-time WebRTC Signaling & Matchmaking
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Initialize Signaling Gateway & Matchmaker Service
const signaling = new SignalingGateway(io);
const matchmaker = new MatchmakerService(io);

// ==========================================
// AUTH MIDDLEWARE
// ==========================================
function authenticate(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authorization token required.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as any;
    (req as any).user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

// ==========================================
// 1. AUTHENTICATION & USER PROFILE
// ==========================================
app.post('/api/auth/send-otp', (req: Request, res: Response) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ success: false, message: 'Phone number is required.' });

  const result = AuthService.sendOtp(phoneNumber);
  return res.json(result);
});

app.post('/api/auth/verify-otp', (req: Request, res: Response) => {
  const { phoneNumber, otp } = req.body;
  if (!phoneNumber || !otp) return res.status(400).json({ success: false, message: 'Phone number and OTP required.' });

  const result = AuthService.verifyOtp(phoneNumber, otp);
  if (!result.success) return res.status(400).json(result);
  return res.json(result);
});

app.get('/api/users/me', authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const user = db.users.get(userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  const profile = db.profiles.get(userId);
  const org = db.organizations.get(userId);
  const celeb = db.celebrities.get(userId);
  const userMem = db.userMemberships.get(userId);
  const plan = userMem ? db.membershipPlans.get(userMem.planId) : null;

  return res.json({
    success: true,
    user: {
      id: user.id,
      phoneNumber: user.phoneNumber,
      role: user.role,
      status: user.status,
      isOnline: user.isOnline,
      callingCredits: user.callingCredits,
      walletBalance: user.walletBalance,
      profile,
      organization: org,
      celebrity: celeb,
      membership: userMem && plan ? {
        ...userMem,
        plan
      } : null
    }
  });
});

app.put('/api/users/me', authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const profile = db.profiles.get(userId);
  if (!profile) return res.status(404).json({ success: false, message: 'Profile not found.' });

  const { name, bio, interests, age, gender, location, latitude, longitude, avatarUrl } = req.body;
  if (name) profile.name = name;
  if (bio !== undefined) profile.bio = bio;
  if (interests) profile.interests = interests;
  if (age !== undefined) profile.age = age;
  if (gender !== undefined) profile.gender = gender;
  if (location !== undefined) profile.location = location;
  if (latitude !== undefined) profile.latitude = latitude;
  if (longitude !== undefined) profile.longitude = longitude;
  if (avatarUrl !== undefined) profile.avatarUrl = avatarUrl;

  return res.json({ success: true, message: 'Profile updated successfully!', profile });
});

// ==========================================
// 2. CALLING PERMISSIONS REST VALIDATOR
// ==========================================
app.post('/api/calls/validate', authenticate, (req: Request, res: Response) => {
  const callerId = (req as any).user.sub;
  const { calleeId, type } = req.body;

  if (!calleeId || !type) {
    return res.status(400).json({ success: false, message: 'calleeId and type are required.' });
  }

  const result = CallingPermissionGuard.validateCall(
    callerId,
    calleeId,
    type as CallType,
    signaling.getActiveCallUsers()
  );

  return res.json(result);
});

// ==========================================
// 3. EVENTS & TICKETING
// ==========================================
app.get('/api/events/nearby', (req: Request, res: Response) => {
  const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
  const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
  const radiusKm = req.query.radiusKm ? parseFloat(req.query.radiusKm as string) : 100;
  const category = req.query.category as string | undefined;

  const events = EventsService.getNearbyEvents(lat, lng, radiusKm, category);
  return res.json({ success: true, events });
});

app.post('/api/events/:id/book', authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const eventId = req.params.id;
  const { tierId, quantity } = req.body;

  const result = EventsService.bookTicket(userId, eventId, tierId, quantity || 1);
  if (!result.success) return res.status(400).json(result);
  return res.json(result);
});

app.get('/api/events/my-bookings', authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const bookings = Array.from(db.ticketBookings.values())
    .filter(b => b.userId === userId)
    .map(b => {
      const event = db.events.get(b.eventId);
      const tier = db.eventTiers.get(b.tierId);
      return {
        ...b,
        eventName: event?.title,
        venueName: event?.venueName,
        tierName: tier?.name,
        startTime: event?.startTime
      };
    });

  return res.json({ success: true, bookings });
});

app.post('/api/events/:id/checkin', authenticate, (req: Request, res: Response) => {
  const { qrCodeHash } = req.body;
  if (!qrCodeHash) return res.status(400).json({ success: false, message: 'qrCodeHash is required.' });

  const result = EventsService.checkInTicket(qrCodeHash);
  if (!result.success) return res.status(400).json(result);
  return res.json(result);
});

// ==========================================
// 4. CELEBRITY VIP MODULE
// ==========================================
app.get('/api/celebrities', (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  const list = CelebrityService.listCelebrities(category);
  return res.json({ success: true, celebrities: list });
});

app.get('/api/celebrities/:id', (req: Request, res: Response) => {
  const details = CelebrityService.getCelebrityDetails(req.params.id);
  if (!details) return res.status(404).json({ success: false, message: 'Celebrity not found.' });
  return res.json({ success: true, ...details });
});

app.put('/api/celebrity/availability', authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const { isAvailable } = req.body;

  const updated = CelebrityService.toggleAvailability(userId, !!isAvailable);
  return res.json({ success: updated, isAvailableForCalls: !!isAvailable });
});

// ==========================================
// 5. MEMBERSHIP & BILLING PLANS
// ==========================================
app.get('/api/memberships/plans', (req: Request, res: Response) => {
  const plans = MembershipService.getPlans();
  return res.json({ success: true, plans });
});

app.post('/api/memberships/subscribe', authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const { planId } = req.body;

  const result = MembershipService.subscribeUser(userId, planId);
  if (!result.success) return res.status(400).json(result);
  return res.json(result);
});

app.post('/api/memberships/credits/recharge', authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const { credits, amount } = req.body;

  const success = MembershipService.rechargeCredits(userId, credits || 10, amount || 10.0);
  return res.json({ success, message: 'Credits recharged successfully!' });
});

// ==========================================
// 6. CUSTOMER SUPPORT
// ==========================================
app.get('/api/support/my-tickets', authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const tickets = SupportService.getUserTickets(userId);
  return res.json({ success: true, tickets });
});

app.get('/api/support/tickets', authenticate, (req: Request, res: Response) => {
  const tickets = SupportService.getAllTickets();
  return res.json({ success: true, tickets });
});

app.post('/api/support/tickets', authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const { subject, description, category, priority } = req.body;

  const ticket = SupportService.createTicket(userId, subject, description, category || 'General', priority);
  return res.json({ success: true, ticket });
});

app.post('/api/support/tickets/:id/messages', authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const user = db.users.get(userId);
  const isStaff = user?.role === Role.SUPPORT_STAFF || user?.role === Role.SUPER_ADMIN;
  const { message } = req.body;

  const msg = SupportService.replyTicket(req.params.id, userId, message, isStaff);
  if (!msg) return res.status(404).json({ success: false, message: 'Ticket not found.' });
  return res.json({ success: true, message: msg });
});

app.put('/api/support/tickets/:id/status', authenticate, (req: Request, res: Response) => {
  const { status } = req.body;
  const updated = SupportService.updateStatus(req.params.id, status as TicketStatusEnum);
  if (!updated) return res.status(404).json({ success: false, message: 'Ticket not found.' });
  return res.json({ success: true, ticket: updated });
});

// ==========================================
// 7. SUPER ADMIN CONTROLS
// ==========================================
app.get('/api/admin/metrics', authenticate, (req: Request, res: Response) => {
  const totalUsers = db.users.size;
  const onlineUsers = Array.from(db.users.values()).filter(u => u.isOnline).length;
  const totalBookings = db.ticketBookings.size;
  const totalRevenue = Array.from(db.ticketBookings.values()).reduce((sum, b) => sum + b.totalPrice, 0);

  return res.json({
    success: true,
    metrics: {
      totalUsers,
      onlineUsers,
      totalBookings,
      totalRevenue: totalRevenue.toFixed(2),
      activeCalls: signaling.getActiveCallUsers().size / 2,
      openSupportTickets: Array.from(db.supportTickets.values()).filter(t => t.status !== TicketStatusEnum.RESOLVED).length
    }
  });
});

app.put('/api/admin/memberships/plans/:id', authenticate, (req: Request, res: Response) => {
  const planId = req.params.id;
  const updates = req.body;

  const result = MembershipService.updatePlan(planId, updates);
  if (!result.success) return res.status(400).json(result);
  return res.json(result);
});

app.put('/api/admin/users/:id/status', authenticate, (req: Request, res: Response) => {
  const { status } = req.body;
  const success = MembershipService.setUserStatus(req.params.id, status as AccountStatus);
  return res.json({ success, status });
});

// ==========================================
// 8. SOCIAL FRIENDS
// ==========================================
app.get('/api/friends', authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const friendsList = [];

  for (const f of db.friendships.values()) {
    if (f.status === 'ACCEPTED' && (f.senderId === userId || f.receiverId === userId)) {
      const friendId = f.senderId === userId ? f.receiverId : f.senderId;
      const friendUser = db.users.get(friendId);
      const friendProfile = db.profiles.get(friendId);
      if (friendUser && friendProfile) {
        friendsList.push({
          id: friendUser.id,
          name: friendProfile.name,
          username: friendProfile.username,
          avatarUrl: friendProfile.avatarUrl,
          isOnline: friendUser.isOnline,
          interests: friendProfile.interests,
          bio: friendProfile.bio
        });
      }
    }
  }

  return res.json({ success: true, friends: friendsList });
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Friends App Backend API & WebRTC Gateway',
    version: '1.0.0'
  });
});

// Start Server
server.listen(CONFIG.PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Friends App Backend Server Running on Port: ${CONFIG.PORT}`);
  console.log(`📡 WebRTC Signaling Gateway Active via Socket.IO`);
  console.log(`🛡️ Calling Permission Matrix: Enforced on all media routes`);
  console.log(`=======================================================`);
});

export { app, server, io };
