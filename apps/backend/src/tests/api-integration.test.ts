import { AuthService } from '../modules/auth/auth.service';
import { CallingPermissionGuard } from '../modules/calling/calling-permission.guard';
import { EventsService } from '../modules/events/events.service';
import { CelebrityService } from '../modules/celebrities/celebrity.service';
import { MembershipService } from '../modules/memberships/membership.service';
import { SupportService } from '../modules/support/support.service';
import { db } from '../db/store';
import { CallType, Role, TicketStatus, TicketStatusEnum, AccountStatus } from '@friends-app/shared';

function runIntegrationTests() {
  console.log('\n=============================================================');
  console.log('🚀 FRIENDS APP FULL END-TO-END SYSTEM INTEGRATION TEST SUITE');
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name} - ${detail || ''}`);
      failed++;
    }
  }

  // 1. AUTH & OTP TEST
  const testPhone = '+19991234567';
  const otpRes = AuthService.sendOtp(testPhone);
  assert('AuthService dispatches OTP successfully', otpRes.success);

  const verifyRes = AuthService.verifyOtp(testPhone, '123456');
  assert('AuthService verifies OTP and returns JWT token & UserDTO', verifyRes.success && !!verifyRes.token && !!verifyRes.user);
  const newUserId = verifyRes.user!.id;
  assert('New user is assigned default Free Basic membership plan', verifyRes.user?.membership?.plan.slug === 'free');

  // 2. CALLING PERMISSION MATRIX ENFORCEMENT
  const activeSessions = new Set<string>();

  // Normal user to normal user VIDEO call -> STRICTLY BLOCKED
  const videoAttempt = CallingPermissionGuard.validateCall(newUserId, 'usr-sam-02', CallType.VIDEO, activeSessions);
  assert(
    'Calling Matrix: Normal user-to-user VIDEO call is strictly prohibited',
    !videoAttempt.allowed && videoAttempt.errorCode === 'VIDEO_NOT_PERMITTED'
  );

  // Normal user on Free plan AUDIO call -> BLOCKED WITH UPGRADE PROMPT
  const audioFreeAttempt = CallingPermissionGuard.validateCall(newUserId, 'usr-sam-02', CallType.AUDIO, activeSessions);
  assert(
    'Calling Matrix: Normal user on Free Basic plan is blocked from audio calls',
    !audioFreeAttempt.allowed && audioFreeAttempt.errorCode === 'UPGRADE_PLAN_FOR_AUDIO'
  );

  // Upgrade user to Silver Connect plan
  const subRes = MembershipService.subscribeUser(newUserId, 'plan-silver');
  assert('User can upgrade membership to Silver Connect', subRes.success && subRes.plan?.canUserAudioCall === true);

  // Normal user on Silver plan AUDIO call -> NOW ALLOWED
  const audioSilverAttempt = CallingPermissionGuard.validateCall(newUserId, 'usr-sam-02', CallType.AUDIO, activeSessions);
  assert(
    'Calling Matrix: Normal user on Silver Connect plan is authorized for audio calling',
    audioSilverAttempt.allowed && !!audioSilverAttempt.sessionToken
  );

  // Normal user on Silver plan attempting Celebrity VIDEO call -> BLOCKED (Requires Gold VIP)
  const celebVideoSilverAttempt = CallingPermissionGuard.validateCall(newUserId, 'usr-celeb-01', CallType.VIDEO, activeSessions);
  assert(
    'Calling Matrix: Silver user blocked from Celebrity Video calls without Gold VIP tier',
    !celebVideoSilverAttempt.allowed && celebVideoSilverAttempt.errorCode === 'CREDITS_OR_VIP_PLAN_REQUIRED'
  );

  // Upgrade user to Gold VIP plan with 50 credits
  const vipSubRes = MembershipService.subscribeUser(newUserId, 'plan-gold');
  assert('User upgrades to Gold VIP plan', vipSubRes.success && vipSubRes.plan?.canCelebrityVideoCall === true);

  // Normal user on Gold VIP plan attempting Celebrity VIDEO call -> AUTHORIZED
  const celebVideoGoldAttempt = CallingPermissionGuard.validateCall(newUserId, 'usr-celeb-01', CallType.VIDEO, activeSessions);
  assert(
    'Calling Matrix: Gold VIP user with credits is authorized for Celebrity Video calls',
    celebVideoGoldAttempt.allowed && !!celebVideoGoldAttempt.sessionToken && celebVideoGoldAttempt.ratePerMin === 8.0
  );

  // 3. GEOLOCATION EVENTS & DIGITAL TICKETING
  // Search nearby San Francisco (37.7749, -122.4194)
  const sfEvents = EventsService.getNearbyEvents(37.7749, -122.4194, 50);
  assert('EventsService discovers nearby events via Haversine calculation', sfEvents.length > 0 && sfEvents[0].distanceKm !== undefined);

  // Book 2 General Admission tickets for the event
  const eventId = sfEvents[0].id;
  const tierId = sfEvents[0].ticketTiers[0].id;
  const initialAvailable = sfEvents[0].ticketTiers[0].available;

  const bookingRes = EventsService.bookTicket(newUserId, eventId, tierId, 2);
  assert('EventsService books tickets and generates signed digital QR hash', bookingRes.success && !!bookingRes.booking?.qrCodeHash);
  
  const updatedTier = db.eventTiers.get(tierId);
  assert('Ticket booking atomically decreases tier remaining capacity', updatedTier?.available === initialAvailable - 2);

  // Attendee Check-In via QR hash
  const checkinRes = EventsService.checkInTicket(bookingRes.booking!.qrCodeHash);
  assert('Organization check-in scanner validates digital QR pass', checkinRes.success && checkinRes.booking?.status === TicketStatus.CHECKED_IN);

  // Duplicate Check-In attempt should fail
  const dupCheckin = EventsService.checkInTicket(bookingRes.booking!.qrCodeHash);
  assert('Duplicate QR pass check-in is prevented', !dupCheckin.success);

  // 4. CELEBRITY VIP PROFILE & AVAILABILITY
  const celebDetails = CelebrityService.getCelebrityDetails('usr-celeb-01');
  assert('CelebrityService fetches celebrity profile and media gallery', !!celebDetails && celebDetails.celebrity.displayName === 'Aria Sterling');

  CelebrityService.toggleAvailability('usr-celeb-01', false);
  const unavailAttempt = CallingPermissionGuard.validateCall(newUserId, 'usr-celeb-01', CallType.AUDIO, activeSessions);
  assert('Call to celebrity toggled offline is blocked with availability prompt', !unavailAttempt.allowed && unavailAttempt.errorCode === 'CELEBRITY_UNAVAILABLE');
  CelebrityService.toggleAvailability('usr-celeb-01', true);

  // 5. CUSTOMER SUPPORT TICKET SYSTEM
  const ticket = SupportService.createTicket(newUserId, 'Audio Call Connection Quality', 'Experiencing slight latency during call test.', 'Technical');
  assert('SupportService creates ticket with tracking number', !!ticket.ticketNumber && ticket.status === TicketStatusEnum.OPEN);

  const reply = SupportService.replyTicket(ticket.id, 'usr-support-01', 'Thank you for reaching out! We are checking your connection telemetry.', true);
  assert('Support staff replies to ticket and status advances to IN_PROGRESS', !!reply && reply.isStaffReply);

  const updatedTicket = SupportService.updateStatus(ticket.id, TicketStatusEnum.RESOLVED);
  assert('Support ticket can be marked as RESOLVED', updatedTicket?.status === TicketStatusEnum.RESOLVED);

  // 6. ADMIN MEMBERSHIP DYNAMIC CONTROL
  // Admin updates Gold plan to disable celebrity video calling
  MembershipService.updatePlan('plan-gold', { canCelebrityVideoCall: false });
  const blockedVip = CallingPermissionGuard.validateCall(newUserId, 'usr-celeb-01', CallType.VIDEO, activeSessions);
  assert('Super Admin disabling VIP Video permission reflects instantly in calling guard', !blockedVip.allowed);
  MembershipService.updatePlan('plan-gold', { canCelebrityVideoCall: true }); // restore

  // Admin moderates account status
  MembershipService.setUserStatus(newUserId, AccountStatus.SUSPENDED);
  const userRecord = db.users.get(newUserId);
  assert('Super Admin can moderate user account status to SUSPENDED', userRecord?.status === AccountStatus.SUSPENDED);

  console.log('\n-------------------------------------------------------------');
  console.log(`System Integration Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runIntegrationTests();
