import { CallingPermissionGuard } from '../modules/calling/calling-permission.guard';
import { MembershipService } from '../modules/memberships/membership.service';
import { db } from '../db/store';
import { CallType, Role } from '../../../../packages/shared/src/types';

function runTestSuite() {
  console.log('\n=============================================================');
  console.log('🧪 RUNNING FRIENDS APP CALLING PERMISSION MATRIX TEST SUITE');
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(testName: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} - ${detail || ''}`);
      failed++;
    }
  }

  const activeCallUsers = new Set<string>();

  // Normal users in seed:
  // Alex (Gold VIP): usr-alex-01
  // Sam (Silver Connect): usr-sam-02
  // David (Free Basic): usr-david-03
  // Celebrity (Aria): usr-celeb-01

  // TEST 1: Normal user to normal user VIDEO call must be STRICTLY PROHIBITED
  const res1 = CallingPermissionGuard.validateCall('usr-alex-01', 'usr-sam-02', CallType.VIDEO, activeCallUsers);
  assert(
    'Normal User -> Normal User Video Call is Strictly Prohibited',
    !res1.allowed && res1.errorCode === 'VIDEO_NOT_PERMITTED',
    `Expected VIDEO_NOT_PERMITTED, received ${res1.errorCode} - ${res1.message}`
  );

  // TEST 2: Normal user (David, Free Basic) to normal user AUDIO call without plan permission must be BLOCKED
  const res2 = CallingPermissionGuard.validateCall('usr-david-03', 'usr-sam-02', CallType.AUDIO, activeCallUsers);
  assert(
    'Normal User on Free Plan (canUserAudioCall: false) is Blocked from Audio Calling',
    !res2.allowed && res2.errorCode === 'UPGRADE_PLAN_FOR_AUDIO',
    `Expected UPGRADE_PLAN_FOR_AUDIO, received ${res2.errorCode} - ${res2.message}`
  );

  // TEST 3: Normal user (Sam, Silver Connect) to normal user AUDIO call must be ALLOWED
  const res3 = CallingPermissionGuard.validateCall('usr-sam-02', 'usr-alex-01', CallType.AUDIO, activeCallUsers);
  assert(
    'Normal User on Silver Plan (canUserAudioCall: true) is Authorized for Audio Calling',
    res3.allowed && !!res3.sessionToken,
    `Expected allowed: true with sessionToken, received allowed: ${res3.allowed}`
  );

  // TEST 4: Normal user on Silver plan (canCelebrityVideoCall: false) requesting Celebrity VIDEO call must be BLOCKED
  const res4 = CallingPermissionGuard.validateCall('usr-sam-02', 'usr-celeb-01', CallType.VIDEO, activeCallUsers);
  assert(
    'Normal User on Silver Plan without VIP Video Access is Blocked from Celebrity Video Calls',
    !res4.allowed && res4.errorCode === 'CREDITS_OR_VIP_PLAN_REQUIRED',
    `Expected CREDITS_OR_VIP_PLAN_REQUIRED, received ${res4.errorCode}`
  );

  // TEST 5: Normal user on Gold VIP plan with calling credits requesting Celebrity VIDEO call must be AUTHORIZED
  const res5 = CallingPermissionGuard.validateCall('usr-alex-01', 'usr-celeb-01', CallType.VIDEO, activeCallUsers);
  assert(
    'Normal User on Gold VIP Plan with Credits is Authorized for Celebrity Video Calling',
    res5.allowed && !!res5.sessionToken && res5.ratePerMin === 8.0,
    `Expected allowed: true with ratePerMin: 8.0, received allowed: ${res5.allowed}`
  );

  // TEST 6: Normal user requesting call when Celebrity is unavailable must be BLOCKED
  const celeb = db.celebrities.get('usr-celeb-01')!;
  celeb.isAvailableForCalls = false;
  const res6 = CallingPermissionGuard.validateCall('usr-alex-01', 'usr-celeb-01', CallType.AUDIO, activeCallUsers);
  assert(
    'Call Request to Unavailable Celebrity is Blocked with Availability Notice',
    !res6.allowed && res6.errorCode === 'CELEBRITY_UNAVAILABLE',
    `Expected CELEBRITY_UNAVAILABLE, received ${res6.errorCode}`
  );
  celeb.isAvailableForCalls = true; // reset

  // TEST 7: Dynamic Super Admin Plan Configuration
  // Admin disables user audio calling on Silver plan -> Sam should now be blocked
  MembershipService.updatePlan('plan-silver', { canUserAudioCall: false });
  const res7 = CallingPermissionGuard.validateCall('usr-sam-02', 'usr-alex-01', CallType.AUDIO, activeCallUsers);
  assert(
    'Admin Dynamic Plan Update (Disabling Audio Calling) takes effect immediately',
    !res7.allowed && res7.errorCode === 'UPGRADE_PLAN_FOR_AUDIO',
    `Expected UPGRADE_PLAN_FOR_AUDIO after admin update, received ${res7.errorCode}`
  );
  MembershipService.updatePlan('plan-silver', { canUserAudioCall: true }); // restore

  console.log('\n-------------------------------------------------------------');
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
