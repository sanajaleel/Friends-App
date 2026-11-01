export enum Role {
  NORMAL_USER = 'NORMAL_USER',
  ORGANIZATION = 'ORGANIZATION',
  CELEBRITY = 'CELEBRITY',
  SUPPORT_STAFF = 'SUPPORT_STAFF',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

export enum AccountStatus {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED'
}

export enum FriendshipStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  BLOCKED = 'BLOCKED'
}

export enum CallType {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO'
}

export enum CallStatus {
  RINGING = 'RINGING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  BUSY = 'BUSY',
  OFFLINE = 'OFFLINE',
  MISSED = 'MISSED',
  ENDED = 'ENDED',
  FAILED = 'FAILED'
}

export enum TicketStatus {
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED'
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export enum TicketStatusEnum {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  ESCALATED = 'ESCALATED'
}

// User & Profile
export interface UserDTO {
  id: string;
  phoneNumber: string;
  role: Role;
  status: AccountStatus;
  isPhoneVerified: boolean;
  isOnline: boolean;
  lastSeenAt?: string | null;
  callingCredits: number;
  walletBalance: number;
  profile?: ProfileDTO | null;
  organization?: OrganizationProfileDTO | null;
  celebrity?: CelebrityProfileDTO | null;
  membership?: UserMembershipDTO | null;
}

export interface ProfileDTO {
  id: string;
  userId: string;
  name: string;
  username: string;
  bio?: string | null;
  avatarUrl?: string | null;
  age?: number | null;
  gender?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  interests: string[];
}

export interface OrganizationProfileDTO {
  id: string;
  userId: string;
  organizationName: string;
  registrationNo?: string | null;
  contactEmail: string;
  website?: string | null;
  logoUrl?: string | null;
  description?: string | null;
  isApproved: boolean;
}

export interface CelebrityProfileDTO {
  id: string;
  userId: string;
  displayName: string;
  category: string;
  bio?: string | null;
  avatarUrl?: string | null;
  isVerified: boolean;
  isAvailableForCalls: boolean;
  audioRatePerMin: number;
  videoRatePerMin: number;
  followersCount: number;
}

// Membership & Calling Permissions
export interface MembershipPlanDTO {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  interval: string;
  canUserAudioCall: boolean;
  canCelebrityAudioCall: boolean;
  canCelebrityVideoCall: boolean;
  dailyAudioMinutesLimit: number; // 0 = unlimited
  monthlyCallingCredits: number;
  celebrityRateDiscountPct: number;
  priorityMatchmaking: boolean;
  isActive: boolean;
}

export interface UserMembershipDTO {
  id: string;
  userId: string;
  planId: string;
  plan: MembershipPlanDTO;
  startDate: string;
  expiresAt?: string | null;
  autoRenew: boolean;
  status: string;
}

// Calling Permission Verification Result
export interface CallingPermissionResult {
  allowed: boolean;
  errorCode?: 
    | 'VIDEO_NOT_PERMITTED' 
    | 'UPGRADE_PLAN_FOR_AUDIO' 
    | 'CREDITS_OR_VIP_PLAN_REQUIRED' 
    | 'CELEBRITY_UNAVAILABLE' 
    | 'USER_BUSY' 
    | 'USER_OFFLINE'
    | 'DAILY_AUDIO_LIMIT_REACHED'
    | 'FORBIDDEN';
  message: string;
  ratePerMin?: number;
  sessionToken?: string;
}

// WebRTC Signaling Events
export const SOCKET_EVENTS = {
  // Presence
  PRESENCE_PING: 'presence:ping',
  PRESENCE_STATUS: 'presence:status',

  // Matchmaking
  MATCH_JOIN_QUEUE: 'match:join_queue',
  MATCH_LEAVE_QUEUE: 'match:leave_queue',
  MATCH_FOUND: 'match:found',
  MATCH_ACCEPT: 'match:accept',
  MATCH_REJECT: 'match:reject',
  MATCH_CONNECTED: 'match:connected',
  MATCH_CANCELLED: 'match:cancelled',

  // Calling
  CALL_INITIATE: 'call:initiate',
  CALL_INCOMING: 'call:incoming',
  CALL_ACCEPT: 'call:accept',
  CALL_REJECT: 'call:reject',
  CALL_BUSY: 'call:busy',
  CALL_ENDED: 'call:ended',
  CALL_ERROR: 'call:error',
  CALL_DURATION_TICK: 'call:duration_tick',

  // WebRTC Signals
  SIGNAL_OFFER: 'signal:offer',
  SIGNAL_ANSWER: 'signal:answer',
  SIGNAL_ICE_CANDIDATE: 'signal:ice_candidate'
} as const;

// Event & Ticketing
export interface EventItemDTO {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  category: string;
  posterUrl?: string | null;
  venueName: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  startTime: string;
  endTime: string;
  isPublished: boolean;
  ticketTiers: EventTicketTierDTO[];
  organization?: OrganizationProfileDTO;
}

export interface EventTicketTierDTO {
  id: string;
  eventId: string;
  name: string;
  price: number;
  totalSeats: number;
  available: number;
}

export interface TicketBookingDTO {
  id: string;
  userId: string;
  eventId: string;
  tierId: string;
  quantity: number;
  totalPrice: number;
  qrCodeHash: string;
  status: TicketStatus;
  createdAt: string;
  event?: EventItemDTO;
}

// Support Tickets
export interface SupportTicketDTO {
  id: string;
  ticketNumber: string;
  userId: string;
  assignedStaffId?: string | null;
  subject: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatusEnum;
  messages: SupportMessageDTO[];
  createdAt: string;
  updatedAt: string;
  user?: UserDTO;
}

export interface SupportMessageDTO {
  id: string;
  ticketId: string;
  senderId: string;
  message: string;
  isStaffReply: boolean;
  createdAt: string;
  senderName?: string;
}

