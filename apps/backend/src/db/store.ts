import { 
  Role, AccountStatus, FriendshipStatus, CallType, CallStatus, 
  TicketStatus, TicketPriority, TicketStatusEnum 
} from '@friends-app/shared';

export interface UserRecord {
  id: string;
  phoneNumber: string;
  role: Role;
  status: AccountStatus;
  isPhoneVerified: boolean;
  isOnline: boolean;
  lastSeenAt: Date | null;
  callingCredits: number;
  walletBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileRecord {
  id: string;
  userId: string;
  name: string;
  username: string;
  bio?: string;
  avatarUrl?: string;
  age?: number;
  gender?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  interests: string[];
}

export interface OrganizationRecord {
  id: string;
  userId: string;
  organizationName: string;
  registrationNo?: string;
  contactEmail: string;
  website?: string;
  logoUrl?: string;
  description?: string;
  isApproved: boolean;
}

export interface CelebrityRecord {
  id: string;
  userId: string;
  displayName: string;
  category: string;
  bio?: string;
  avatarUrl?: string;
  isVerified: boolean;
  isAvailableForCalls: boolean;
  audioRatePerMin: number;
  videoRatePerMin: number;
  followersCount: number;
}

export interface CelebrityMediaRecord {
  id: string;
  celebrityId: string;
  type: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  caption?: string;
  createdAt: Date;
}

export interface MembershipPlanRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  interval: string;
  canUserAudioCall: boolean;
  canCelebrityAudioCall: boolean;
  canCelebrityVideoCall: boolean;
  dailyAudioMinutesLimit: number;
  monthlyCallingCredits: number;
  celebrityRateDiscountPct: number;
  priorityMatchmaking: boolean;
  isActive: boolean;
}

export interface UserMembershipRecord {
  id: string;
  userId: string;
  planId: string;
  startDate: Date;
  expiresAt: Date | null;
  autoRenew: boolean;
  status: string;
}

export interface EventRecord {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  category: string;
  posterUrl?: string;
  venueName: string;
  address: string;
  latitude: number;
  longitude: number;
  startTime: Date;
  endTime: Date;
  isPublished: boolean;
}

export interface EventTicketTierRecord {
  id: string;
  eventId: string;
  name: string;
  price: number;
  totalSeats: number;
  available: number;
}

export interface TicketBookingRecord {
  id: string;
  userId: string;
  eventId: string;
  tierId: string;
  quantity: number;
  totalPrice: number;
  qrCodeHash: string;
  status: TicketStatus;
  createdAt: Date;
}

export interface FriendshipRecord {
  id: string;
  senderId: string;
  receiverId: string;
  status: FriendshipStatus;
  createdAt: Date;
}

export interface BlockRecord {
  id: string;
  blockerId: string;
  blockedId: string;
  reason?: string;
  createdAt: Date;
}

export interface CallLogRecord {
  id: string;
  callerId: string;
  calleeId: string;
  type: CallType;
  status: CallStatus;
  durationSeconds: number;
  creditsCharged: number;
  createdAt: Date;
}

export interface SupportTicketRecord {
  id: string;
  ticketNumber: string;
  userId: string;
  assignedStaffId?: string;
  subject: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatusEnum;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupportMessageRecord {
  id: string;
  ticketId: string;
  senderId: string;
  message: string;
  isStaffReply: boolean;
  createdAt: Date;
}

export interface AuditLogRecord {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: any;
  createdAt: Date;
}

class InMemoryDataStore {
  users: Map<string, UserRecord> = new Map();
  profiles: Map<string, ProfileRecord> = new Map();
  organizations: Map<string, OrganizationRecord> = new Map();
  celebrities: Map<string, CelebrityRecord> = new Map();
  celebrityMedia: Map<string, CelebrityMediaRecord> = new Map();
  membershipPlans: Map<string, MembershipPlanRecord> = new Map();
  userMemberships: Map<string, UserMembershipRecord> = new Map();
  events: Map<string, EventRecord> = new Map();
  eventTiers: Map<string, EventTicketTierRecord> = new Map();
  ticketBookings: Map<string, TicketBookingRecord> = new Map();
  friendships: Map<string, FriendshipRecord> = new Map();
  blocks: Map<string, BlockRecord> = new Map();
  callLogs: Map<string, CallLogRecord> = new Map();
  supportTickets: Map<string, SupportTicketRecord> = new Map();
  supportMessages: Map<string, SupportMessageRecord> = new Map();
  auditLogs: AuditLogRecord[] = [];
  otps: Map<string, { code: string; expiresAt: Date; attempts: number }> = new Map();

  constructor() {
    this.seedDefaultData();
  }

  seedDefaultData() {
    // 1. Membership Plans
    const freePlan: MembershipPlanRecord = {
      id: 'plan-free',
      name: 'Free Basic',
      slug: 'free',
      description: 'Standard account with random friend matching. Audio calls require Silver or Gold upgrade.',
      price: 0,
      interval: 'MONTHLY',
      canUserAudioCall: false, // Normal audio calls require plan
      canCelebrityAudioCall: false,
      canCelebrityVideoCall: false,
      dailyAudioMinutesLimit: 0,
      monthlyCallingCredits: 0,
      celebrityRateDiscountPct: 0,
      priorityMatchmaking: false,
      isActive: true
    };

    const silverPlan: MembershipPlanRecord = {
      id: 'plan-silver',
      name: 'Silver Connect',
      slug: 'silver',
      description: 'Unlimited friend audio calling, 60 daily minutes, and celebrity audio call access.',
      price: 9.99,
      interval: 'MONTHLY',
      canUserAudioCall: true,
      canCelebrityAudioCall: true,
      canCelebrityVideoCall: false, // Normal video is NEVER allowed, and celebrity video is Gold only
      dailyAudioMinutesLimit: 60,
      monthlyCallingCredits: 10,
      celebrityRateDiscountPct: 10,
      priorityMatchmaking: true,
      isActive: true
    };

    const goldPlan: MembershipPlanRecord = {
      id: 'plan-gold',
      name: 'Gold VIP',
      slug: 'gold',
      description: 'Unlimited audio calls, full VIP access to Celebrity Video & Audio calls, and 50 call credits.',
      price: 24.99,
      interval: 'MONTHLY',
      canUserAudioCall: true,
      canCelebrityAudioCall: true,
      canCelebrityVideoCall: true, // VIP celebrity video enabled
      dailyAudioMinutesLimit: 0, // unlimited
      monthlyCallingCredits: 50,
      celebrityRateDiscountPct: 25,
      priorityMatchmaking: true,
      isActive: true
    };

    this.membershipPlans.set(freePlan.id, freePlan);
    this.membershipPlans.set(silverPlan.id, silverPlan);
    this.membershipPlans.set(goldPlan.id, goldPlan);

    // 2. Super Admin
    const adminId = 'usr-admin-01';
    this.users.set(adminId, {
      id: adminId,
      phoneNumber: '+19990000001',
      role: Role.SUPER_ADMIN,
      status: AccountStatus.ACTIVE,
      isPhoneVerified: true,
      isOnline: true,
      lastSeenAt: new Date(),
      callingCredits: 9999,
      walletBalance: 1000.0,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    this.profiles.set(adminId, {
      id: 'prof-admin',
      userId: adminId,
      name: 'System Super Admin',
      username: 'superadmin',
      bio: 'Platform Governance & Infrastructure Team',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      interests: ['Infrastructure', 'Security', 'Management']
    });

    // 3. Customer Support Staff
    const supportId = 'usr-support-01';
    this.users.set(supportId, {
      id: supportId,
      phoneNumber: '+19990000002',
      role: Role.SUPPORT_STAFF,
      status: AccountStatus.ACTIVE,
      isPhoneVerified: true,
      isOnline: true,
      lastSeenAt: new Date(),
      callingCredits: 0,
      walletBalance: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    this.profiles.set(supportId, {
      id: 'prof-support',
      userId: supportId,
      name: 'Sarah Jenkins (Support)',
      username: 'support_sarah',
      bio: 'Friends App Helpdesk Specialist',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      interests: ['Helpdesk', 'Community']
    });

    // 4. Organization Account & Event
    const orgUserId = 'usr-org-01';
    this.users.set(orgUserId, {
      id: orgUserId,
      phoneNumber: '+19990000010',
      role: Role.ORGANIZATION,
      status: AccountStatus.ACTIVE,
      isPhoneVerified: true,
      isOnline: true,
      lastSeenAt: new Date(),
      callingCredits: 0,
      walletBalance: 5200.0,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    this.organizations.set(orgUserId, {
      id: 'org-nexus',
      userId: orgUserId,
      organizationName: 'Nexus Global Entertainment',
      registrationNo: 'NEX-88921-US',
      contactEmail: 'contact@nexus-events.com',
      website: 'https://nexus-events.example.com',
      logoUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150',
      description: 'Premier festival, concert, and networking event organizers.',
      isApproved: true
    });

    // Events for Nexus
    const eventId1 = 'evt-music-fest-2026';
    this.events.set(eventId1, {
      id: eventId1,
      organizationId: 'org-nexus',
      title: 'Neon Horizon Music & Social Festival 2026',
      description: 'An immersive 2-day music, interactive art, and social connection experience under the skyline stars.',
      category: 'Music & Concerts',
      posterUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800',
      venueName: 'Skyline Waterfront Arena',
      address: '742 Ocean Boulevard, San Francisco, CA',
      latitude: 37.7749,
      longitude: -122.4194,
      startTime: new Date(Date.now() + 86400000 * 7),
      endTime: new Date(Date.now() + 86400000 * 8),
      isPublished: true
    });

    this.eventTiers.set('tier-gen-1', {
      id: 'tier-gen-1',
      eventId: eventId1,
      name: 'General Admission',
      price: 49.00,
      totalSeats: 500,
      available: 482
    });

    this.eventTiers.set('tier-vip-1', {
      id: 'tier-vip-1',
      eventId: eventId1,
      name: 'VIP Social Lounge Pass',
      price: 149.00,
      totalSeats: 100,
      available: 94
    });

    // 5. Celebrity VIP Accounts
    const celebUserId1 = 'usr-celeb-01';
    this.users.set(celebUserId1, {
      id: celebUserId1,
      phoneNumber: '+19990000020',
      role: Role.CELEBRITY,
      status: AccountStatus.ACTIVE,
      isPhoneVerified: true,
      isOnline: true,
      lastSeenAt: new Date(),
      callingCredits: 0,
      walletBalance: 2450.0,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    this.celebrities.set(celebUserId1, {
      id: 'celeb-aria',
      userId: celebUserId1,
      displayName: 'Aria Sterling',
      category: 'Pop Musician & Vocalist',
      bio: 'Grammy-nominated artist, live performer & acoustic songwriter. Excited to chat with my fans!',
      avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200',
      isVerified: true,
      isAvailableForCalls: true,
      audioRatePerMin: 4.00,
      videoRatePerMin: 8.00,
      followersCount: 142000
    });
    this.celebrityMedia.set('med-1', {
      id: 'med-1',
      celebrityId: 'celeb-aria',
      type: 'IMAGE',
      mediaUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800',
      caption: 'Backstage vibes right before taking the main stage! 🎤✨',
      createdAt: new Date()
    });

    // 6. Normal Users
    const user1Id = 'usr-alex-01';
    this.users.set(user1Id, {
      id: user1Id,
      phoneNumber: '+19990000030',
      role: Role.NORMAL_USER,
      status: AccountStatus.ACTIVE,
      isPhoneVerified: true,
      isOnline: true,
      lastSeenAt: new Date(),
      callingCredits: 35,
      walletBalance: 50.0,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    this.profiles.set(user1Id, {
      id: 'prof-alex',
      userId: user1Id,
      name: 'Alex Morgan',
      username: 'alex_m',
      bio: 'Travel enthusiast, photographer, and coffee addict. Always up for good conversations!',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      age: 26,
      gender: 'Male',
      location: 'San Francisco, CA',
      latitude: 37.7750,
      longitude: -122.4183,
      interests: ['Photography', 'Travel', 'Hiking', 'Coffee', 'Design']
    });
    this.userMemberships.set(user1Id, {
      id: 'mem-alex',
      userId: user1Id,
      planId: 'plan-gold',
      startDate: new Date(),
      expiresAt: new Date(Date.now() + 86400000 * 30),
      autoRenew: true,
      status: 'ACTIVE'
    });

    const user2Id = 'usr-sam-02';
    this.users.set(user2Id, {
      id: user2Id,
      phoneNumber: '+19990000031',
      role: Role.NORMAL_USER,
      status: AccountStatus.ACTIVE,
      isPhoneVerified: true,
      isOnline: true,
      lastSeenAt: new Date(),
      callingCredits: 10,
      walletBalance: 20.0,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    this.profiles.set(user2Id, {
      id: 'prof-sam',
      userId: user2Id,
      name: 'Samantha Chen',
      username: 'sam_chen',
      bio: 'UX designer, book lover, indie games fan. Let’s connect and talk creative ideas!',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      age: 24,
      gender: 'Female',
      location: 'Oakland, CA',
      latitude: 37.8044,
      longitude: -122.2712,
      interests: ['UI/UX', 'Reading', 'Gaming', 'Art', 'Music']
    });
    this.userMemberships.set(user2Id, {
      id: 'mem-sam',
      userId: user2Id,
      planId: 'plan-silver',
      startDate: new Date(),
      expiresAt: new Date(Date.now() + 86400000 * 30),
      autoRenew: true,
      status: 'ACTIVE'
    });

    const user3Id = 'usr-david-03';
    this.users.set(user3Id, {
      id: user3Id,
      phoneNumber: '+19990000032',
      role: Role.NORMAL_USER,
      status: AccountStatus.ACTIVE,
      isPhoneVerified: true,
      isOnline: true,
      lastSeenAt: new Date(),
      callingCredits: 0,
      walletBalance: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    this.profiles.set(user3Id, {
      id: 'prof-david',
      userId: user3Id,
      name: 'David Kim',
      username: 'david_k',
      bio: 'Tech enthusiast & marathon runner. Exploring new hobbies and meeting new friends!',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      age: 28,
      gender: 'Male',
      location: 'San Jose, CA',
      latitude: 37.3382,
      longitude: -121.8863,
      interests: ['Running', 'Startups', 'Podcasts', 'Cooking']
    });
    this.userMemberships.set(user3Id, {
      id: 'mem-david',
      userId: user3Id,
      planId: 'plan-free', // Free tier
      startDate: new Date(),
      expiresAt: null,
      autoRenew: false,
      status: 'ACTIVE'
    });
  }
}

export const db = new InMemoryDataStore();

