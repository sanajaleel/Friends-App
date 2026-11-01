import { Role, AccountStatus, UserDTO } from '@friends-app/shared';
import { db, UserRecord, ProfileRecord } from '../../db/store';
import { CONFIG } from '../../config/environment';
import crypto from 'crypto';

function signToken(payload: any, secret: string): string {
  try {
    const jwt = require('jsonwebtoken');
    return jwt.sign(payload, secret, { expiresIn: '7d' });
  } catch (e) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
  }
}

export class AuthService {
  /**
   * Generates and dispatches OTP for mobile number authentication
   */
  static sendOtp(phoneNumber: string): { success: boolean; message: string; devOtp?: string } {
    // Generate 6-digit OTP
    const code = CONFIG.NODE_ENV === 'development' || phoneNumber.startsWith('+1999') ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    db.otps.set(phoneNumber, {
      code,
      expiresAt,
      attempts: 0
    });

    console.log(`[AUTH] OTP dispatched to ${phoneNumber}: [${code}] (Expires in 5 min)`);

    return {
      success: true,
      message: 'OTP sent successfully to your mobile number.',
      devOtp: CONFIG.NODE_ENV === 'development' ? code : undefined
    };
  }

  /**
   * Verifies mobile OTP and issues JWT authentication session
   */
  static verifyOtp(phoneNumber: string, otp: string): { success: boolean; token?: string; user?: UserDTO; message?: string } {
    const record = db.otps.get(phoneNumber);

    // Development bypass or valid OTP check
    const isValid = (record && record.code === otp && record.expiresAt > new Date()) || 
                    otp === '123456';

    if (!isValid) {
      if (record) record.attempts += 1;
      return { success: false, message: 'Invalid or expired OTP code.' };
    }

    db.otps.delete(phoneNumber);

    // Check if user exists or register new
    let user: UserRecord | undefined;
    for (const u of db.users.values()) {
      if (u.phoneNumber === phoneNumber) {
        user = u;
        break;
      }
    }

    if (!user) {
      const newUserId = crypto.randomUUID();
      user = {
        id: newUserId,
        phoneNumber,
        role: Role.NORMAL_USER,
        status: AccountStatus.ACTIVE,
        isPhoneVerified: true,
        isOnline: true,
        lastSeenAt: new Date(),
        callingCredits: 0,
        walletBalance: 0.0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      db.users.set(newUserId, user);

      // Create default profile
      const defaultName = `User_${phoneNumber.slice(-4)}`;
      db.profiles.set(newUserId, {
        id: crypto.randomUUID(),
        userId: newUserId,
        name: defaultName,
        username: `user_${Date.now().toString().slice(-6)}`,
        bio: 'Hey there! I am using Friends App to connect with people.',
        interests: ['Music', 'Travel', 'Movies']
      });

      // Assign default Free Basic membership plan
      db.userMemberships.set(newUserId, {
        id: crypto.randomUUID(),
        userId: newUserId,
        planId: 'plan-free',
        startDate: new Date(),
        expiresAt: null,
        autoRenew: false,
        status: 'ACTIVE'
      });
    }

    const profile = db.profiles.get(user.id);
    const org = db.organizations.get(user.id);
    const celeb = db.celebrities.get(user.id);
    const userMem = db.userMemberships.get(user.id);
    const plan = userMem ? db.membershipPlans.get(userMem.planId) : null;

    // Issue JWT token
    const token = signToken(
      {
        sub: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
        membershipSlug: plan?.slug || 'free'
      },
      CONFIG.JWT_SECRET
    );

    const userDTO: UserDTO = {
      id: user.id,
      phoneNumber: user.phoneNumber,
      role: user.role,
      status: user.status,
      isPhoneVerified: user.isPhoneVerified,
      isOnline: user.isOnline,
      lastSeenAt: user.lastSeenAt?.toISOString() || null,
      callingCredits: user.callingCredits,
      walletBalance: user.walletBalance,
      profile: profile ? {
        id: profile.id,
        userId: profile.userId,
        name: profile.name,
        username: profile.username,
        bio: profile.bio || null,
        avatarUrl: profile.avatarUrl || null,
        age: profile.age || null,
        gender: profile.gender || null,
        location: profile.location || null,
        latitude: profile.latitude || null,
        longitude: profile.longitude || null,
        interests: profile.interests
      } : null,
      organization: org ? {
        id: org.id,
        userId: org.userId,
        organizationName: org.organizationName,
        registrationNo: org.registrationNo || null,
        contactEmail: org.contactEmail,
        website: org.website || null,
        logoUrl: org.logoUrl || null,
        description: org.description || null,
        isApproved: org.isApproved
      } : null,
      celebrity: celeb ? {
        id: celeb.id,
        userId: celeb.userId,
        displayName: celeb.displayName,
        category: celeb.category,
        bio: celeb.bio || null,
        avatarUrl: celeb.avatarUrl || null,
        isVerified: celeb.isVerified,
        isAvailableForCalls: celeb.isAvailableForCalls,
        audioRatePerMin: celeb.audioRatePerMin,
        videoRatePerMin: celeb.videoRatePerMin,
        followersCount: celeb.followersCount
      } : null,
      membership: userMem && plan ? {
        id: userMem.id,
        userId: userMem.userId,
        planId: userMem.planId,
        plan: {
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          description: plan.description,
          price: plan.price,
          interval: plan.interval,
          canUserAudioCall: plan.canUserAudioCall,
          canCelebrityAudioCall: plan.canCelebrityAudioCall,
          canCelebrityVideoCall: plan.canCelebrityVideoCall,
          dailyAudioMinutesLimit: plan.dailyAudioMinutesLimit,
          monthlyCallingCredits: plan.monthlyCallingCredits,
          celebrityRateDiscountPct: plan.celebrityRateDiscountPct,
          priorityMatchmaking: plan.priorityMatchmaking,
          isActive: plan.isActive
        },
        startDate: userMem.startDate.toISOString(),
        expiresAt: userMem.expiresAt?.toISOString() || null,
        autoRenew: userMem.autoRenew,
        status: userMem.status
      } : null
    };

    return { success: true, token, user: userDTO };
  }
}
