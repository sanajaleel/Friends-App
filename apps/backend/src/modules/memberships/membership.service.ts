import { db, MembershipPlanRecord } from '../../db/store';
import { MembershipPlanDTO, AccountStatus } from '@friends-app/shared';
import crypto from 'crypto';

export class MembershipService {
  /**
   * Retrieves all available membership plans
   */
  static getPlans(): MembershipPlanDTO[] {
    return Array.from(db.membershipPlans.values()).map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: p.price,
      interval: p.interval,
      canUserAudioCall: p.canUserAudioCall,
      canCelebrityAudioCall: p.canCelebrityAudioCall,
      canCelebrityVideoCall: p.canCelebrityVideoCall,
      dailyAudioMinutesLimit: p.dailyAudioMinutesLimit,
      monthlyCallingCredits: p.monthlyCallingCredits,
      celebrityRateDiscountPct: p.celebrityRateDiscountPct,
      priorityMatchmaking: p.priorityMatchmaking,
      isActive: p.isActive
    }));
  }

  /**
   * Subscribes a user to a membership plan and grants included credits
   */
  static subscribeUser(userId: string, planId: string): { success: boolean; message: string; plan?: MembershipPlanDTO } {
    const plan = db.membershipPlans.get(planId);
    if (!plan || !plan.isActive) {
      return { success: false, message: 'Invalid or inactive membership plan.' };
    }

    const user = db.users.get(userId);
    if (!user) return { success: false, message: 'User not found.' };

    // Update user membership
    db.userMemberships.set(userId, {
      id: crypto.randomUUID(),
      userId,
      planId,
      startDate: new Date(),
      expiresAt: new Date(Date.now() + 86400000 * 30),
      autoRenew: true,
      status: 'ACTIVE'
    });

    // Grant bonus calling credits included with the plan
    if (plan.monthlyCallingCredits > 0) {
      user.callingCredits += plan.monthlyCallingCredits;
    }

    return {
      success: true,
      message: `Successfully upgraded to ${plan.name}!`,
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
      }
    };
  }

  /**
   * Adds calling credits to user account
   */
  static rechargeCredits(userId: string, credits: number, amountPaid: number) {
    const user = db.users.get(userId);
    if (!user) return false;

    user.callingCredits += credits;
    user.walletBalance += amountPaid;
    return true;
  }

  /**
   * Admin: Dynamic configuration of membership plan permissions and pricing
   */
  static updatePlan(planId: string, updates: Partial<MembershipPlanRecord>): { success: boolean; plan?: MembershipPlanDTO; message: string } {
    const plan = db.membershipPlans.get(planId);
    if (!plan) return { success: false, message: 'Plan not found.' };

    Object.assign(plan, updates);

    return {
      success: true,
      message: `Plan ${plan.name} updated successfully. All user calling permissions have been synced.`,
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
      }
    };
  }

  /**
   * Admin: Moderate user account (Active, Suspended, Banned)
   */
  static setUserStatus(userId: string, status: AccountStatus) {
    const user = db.users.get(userId);
    if (!user) return false;
    user.status = status;
    return true;
  }
}
