import { Role, CallType, CallingPermissionResult } from '@friends-app/shared';
import { db } from '../../db/store';
import crypto from 'crypto';

export class CallingPermissionGuard {
  /**
   * Validates whether a call attempt is permitted based on:
   * 1. Calling Permission Matrix (Role of caller vs callee & CallType)
   * 2. Caller's active Membership Plan permissions & daily limits
   * 3. Caller's calling credits / wallet balance for celebrity calls
   * 4. Callee availability status & active busy state
   */
  static validateCall(
    callerId: string, 
    calleeId: string, 
    type: CallType,
    activeCallSessions: Set<string>
  ): CallingPermissionResult {
    const caller = db.users.get(callerId);
    const callee = db.users.get(calleeId);

    if (!caller) {
      return { allowed: false, errorCode: 'FORBIDDEN', message: 'Caller account does not exist.' };
    }
    if (!callee) {
      return { allowed: false, errorCode: 'FORBIDDEN', message: 'Callee account does not exist.' };
    }

    // Check mutual blocklist
    for (const block of db.blocks.values()) {
      if ((block.blockerId === callerId && block.blockedId === calleeId) ||
          (block.blockerId === calleeId && block.blockedId === callerId)) {
        return { allowed: false, errorCode: 'FORBIDDEN', message: 'Unable to establish call with this user.' };
      }
    }

    // Check if callee is in an active call
    if (activeCallSessions.has(calleeId)) {
      return { allowed: false, errorCode: 'USER_BUSY', message: 'The user is currently on another call.' };
    }

    // Check if callee is online
    if (!callee.isOnline) {
      return { allowed: false, errorCode: 'USER_OFFLINE', message: 'The user is currently offline.' };
    }

    // Fetch caller membership plan
    const userMembership = db.userMemberships.get(callerId);
    const plan = userMembership ? db.membershipPlans.get(userMembership.planId) : null;

    // ==========================================
    // MATRIX RULE 1: Normal User -> Normal User
    // ==========================================
    if (caller.role === Role.NORMAL_USER && callee.role === Role.NORMAL_USER) {
      // VIDEO CALLS ARE STRICTLY PROHIBITED BETWEEN NORMAL USERS
      if (type === CallType.VIDEO) {
        return {
          allowed: false,
          errorCode: 'VIDEO_NOT_PERMITTED',
          message: 'Video calling is strictly reserved for Celebrity VIP connections. Normal user-to-user calls are audio only.'
        };
      }

      // AUDIO CALLS: Governed by active membership plan
      if (!plan || !plan.canUserAudioCall) {
        return {
          allowed: false,
          errorCode: 'UPGRADE_PLAN_FOR_AUDIO',
          message: 'Audio calling is not available on your current plan. Please upgrade to a Silver or Gold membership to enable friend voice calls.'
        };
      }

      return {
        allowed: true,
        message: 'Normal user audio call authorized.',
        sessionToken: crypto.randomUUID()
      };
    }

    // ==========================================
    // MATRIX RULE 2: Normal User -> Celebrity
    // ==========================================
    if (caller.role === Role.NORMAL_USER && callee.role === Role.CELEBRITY) {
      const celebrity = db.celebrities.get(calleeId);
      if (!celebrity) {
        return { allowed: false, errorCode: 'FORBIDDEN', message: 'Celebrity profile not found.' };
      }

      // Check celebrity availability
      if (!celebrity.isAvailableForCalls) {
        return {
          allowed: false,
          errorCode: 'CELEBRITY_UNAVAILABLE',
          message: `${celebrity.displayName} is currently unavailable for incoming calls. Please check back later.`
        };
      }

      // CELEBRITY VIDEO CALLING: Strict paid membership + credits requirement
      if (type === CallType.VIDEO) {
        if (!plan || !plan.canCelebrityVideoCall) {
          return {
            allowed: false,
            errorCode: 'CREDITS_OR_VIP_PLAN_REQUIRED',
            message: 'Celebrity video calling requires an active Gold VIP membership plan. Please upgrade your membership.'
          };
        }

        const requiredCredits = Math.ceil(celebrity.videoRatePerMin);
        if (caller.callingCredits < requiredCredits && caller.walletBalance < celebrity.videoRatePerMin) {
          return {
            allowed: false,
            errorCode: 'CREDITS_OR_VIP_PLAN_REQUIRED',
            message: `Insufficient calling credits. Celebrity video calls require at least ${requiredCredits} credits or $${celebrity.videoRatePerMin.toFixed(2)} wallet balance.`
          };
        }

        return {
          allowed: true,
          message: 'Celebrity VIP video call authorized.',
          ratePerMin: celebrity.videoRatePerMin,
          sessionToken: crypto.randomUUID()
        };
      }

      // CELEBRITY AUDIO CALLING: Governed by membership / credits
      if (type === CallType.AUDIO) {
        const canCall = (plan && plan.canCelebrityAudioCall) || caller.callingCredits >= 5 || caller.walletBalance >= celebrity.audioRatePerMin;
        if (!canCall) {
          return {
            allowed: false,
            errorCode: 'CREDITS_OR_VIP_PLAN_REQUIRED',
            message: `Celebrity audio calls require a membership plan with celebrity calling enabled or at least $${celebrity.audioRatePerMin.toFixed(2)} in calling credits.`
          };
        }

        return {
          allowed: true,
          message: 'Celebrity audio call authorized.',
          ratePerMin: celebrity.audioRatePerMin,
          sessionToken: crypto.randomUUID()
        };
      }
    }

    // ==========================================
    // MATRIX RULE 3: Celebrity -> Normal User
    // ==========================================
    if (caller.role === Role.CELEBRITY && callee.role === Role.NORMAL_USER) {
      return {
        allowed: true,
        message: 'Celebrity callback authorized.',
        sessionToken: crypto.randomUUID()
      };
    }

    // ==========================================
    // MATRIX RULE 4: Admin / Support / Other
    // ==========================================
    if (caller.role === Role.SUPER_ADMIN || caller.role === Role.ADMIN) {
      return {
        allowed: true,
        message: 'Administrative bypass authorized.',
        sessionToken: crypto.randomUUID()
      };
    }

    return {
      allowed: false,
      errorCode: 'FORBIDDEN',
      message: 'This calling combination is not permitted by platform policy.'
    };
  }
}
