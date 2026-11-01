import { z } from 'zod';
import { Role, CallType, TicketPriority } from './types';

export const SendOtpSchema = z.object({
  phoneNumber: z.string().min(8, 'Phone number must be at least 8 digits').regex(/^\+?[1-9]\d{7,14}$/, 'Invalid international phone number format')
});

export const VerifyOtpSchema = z.object({
  phoneNumber: z.string().min(8),
  otp: z.string().length(6, 'OTP must be 6 digits')
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain alphanumeric and underscores'),
  bio: z.string().max(250).optional().nullable(),
  age: z.number().int().min(18, 'Must be at least 18 years old').max(120).optional().nullable(),
  gender: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  interests: z.array(z.string()).max(10, 'Max 10 interests allowed')
});

export const CallInitiateSchema = z.object({
  calleeId: z.string().uuid(),
  type: z.nativeEnum(CallType)
});

export const CreateEventSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(2000),
  category: z.string().min(2),
  venueName: z.string().min(2),
  address: z.string().min(5),
  latitude: z.number(),
  longitude: z.number(),
  startTime: z.string(),
  endTime: z.string(),
  ticketTiers: z.array(z.object({
    name: z.string().min(1),
    price: z.number().min(0),
    totalSeats: z.number().int().positive()
  })).min(1, 'At least one ticket tier is required')
});

export const BookTicketSchema = z.object({
  eventId: z.string().uuid(),
  tierId: z.string().uuid(),
  quantity: z.number().int().min(1).max(10)
});

export const MembershipPlanConfigSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().min(5),
  price: z.number().min(0),
  interval: z.enum(['MONTHLY', 'YEARLY', 'LIFETIME']),
  canUserAudioCall: z.boolean(),
  canCelebrityAudioCall: z.boolean(),
  canCelebrityVideoCall: z.boolean(),
  dailyAudioMinutesLimit: z.number().int().min(0),
  monthlyCallingCredits: z.number().int().min(0),
  celebrityRateDiscountPct: z.number().int().min(0).max(100),
  priorityMatchmaking: z.boolean(),
  isActive: z.boolean()
});

export const CreateSupportTicketSchema = z.object({
  subject: z.string().min(5).max(100),
  description: z.string().min(10).max(2000),
  category: z.string().min(2),
  priority: z.nativeEnum(TicketPriority).default(TicketPriority.MEDIUM)
});

export const SendSupportMessageSchema = z.object({
  ticketId: z.string().uuid(),
  message: z.string().min(1).max(1000)
});

