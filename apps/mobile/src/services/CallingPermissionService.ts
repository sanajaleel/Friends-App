import { CallType, Role, CallingPermissionResult } from '../../../packages/shared/src/types';

export class MobileCallingPermissionService {
  /**
   * Client-side preflight check before opening calling view
   */
  static checkPermission(
    callerRole: Role,
    calleeRole: Role,
    type: CallType,
    userMembership: { canUserAudioCall: boolean; canCelebrityAudioCall: boolean; canCelebrityVideoCall: boolean; credits: number; planName: string }
  ): CallingPermissionResult {
    // RULE 1: Normal to Normal Video
    if (callerRole === Role.NORMAL_USER && calleeRole === Role.NORMAL_USER && type === CallType.VIDEO) {
      return {
        allowed: false,
        errorCode: 'VIDEO_NOT_PERMITTED',
        message: 'Video calling between normal users is not supported. Video calls are exclusively reserved for VIP Celebrity connections.'
      };
    }

    // RULE 2: Normal to Normal Audio
    if (callerRole === Role.NORMAL_USER && calleeRole === Role.NORMAL_USER && type === CallType.AUDIO) {
      if (!userMembership.canUserAudioCall) {
        return {
          allowed: false,
          errorCode: 'UPGRADE_PLAN_FOR_AUDIO',
          message: 'Audio calling is not enabled on your Free Basic plan. Please upgrade to Silver or Gold to unlock friend voice calling.'
        };
      }
      return { allowed: true, message: 'Audio call permitted.' };
    }

    // RULE 3: Normal to Celebrity Video
    if (callerRole === Role.NORMAL_USER && calleeRole === Role.CELEBRITY && type === CallType.VIDEO) {
      if (!userMembership.canCelebrityVideoCall) {
        return {
          allowed: false,
          errorCode: 'CREDITS_OR_VIP_PLAN_REQUIRED',
          message: 'Celebrity video calling requires an active Gold VIP subscription. Upgrade now to connect with creators.'
        };
      }
      if (userMembership.credits < 8) {
        return {
          allowed: false,
          errorCode: 'CREDITS_OR_VIP_PLAN_REQUIRED',
          message: 'Insufficient calling credits. Recharge calling credits to proceed with the VIP video call.'
        };
      }
      return { allowed: true, message: 'VIP video call permitted.' };
    }

    return { allowed: true, message: 'Call permitted.' };
  }
}

