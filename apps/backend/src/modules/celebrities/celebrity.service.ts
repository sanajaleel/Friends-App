import { db, CelebrityRecord, CelebrityMediaRecord } from '../../db/store';
import { CelebrityProfileDTO } from '@friends-app/shared';
import crypto from 'crypto';

export class CelebrityService {
  /**
   * Retrieves list of verified celebrity profiles
   */
  static listCelebrities(category?: string): CelebrityProfileDTO[] {
    const list: CelebrityProfileDTO[] = [];

    for (const celeb of db.celebrities.values()) {
      if (!celeb.isVerified) continue;
      if (category && category !== 'All' && celeb.category.toLowerCase() !== category.toLowerCase()) continue;

      list.push({
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
      });
    }

    return list;
  }

  /**
   * Retrieves a celebrity's media gallery and details
   */
  static getCelebrityDetails(celebrityId: string) {
    const celeb = db.celebrities.get(celebrityId);
    if (!celeb) return null;

    const media: CelebrityMediaRecord[] = [];
    for (const m of db.celebrityMedia.values()) {
      if (m.celebrityId === celebrityId) {
        media.push(m);
      }
    }

    return {
      celebrity: {
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
      },
      media
    };
  }

  /**
   * Toggle celebrity availability for incoming calls
   */
  static toggleAvailability(userId: string, isAvailable: boolean) {
    const celeb = db.celebrities.get(userId);
    if (celeb) {
      celeb.isAvailableForCalls = isAvailable;
      return true;
    }
    return false;
  }

  /**
   * Upload a photo or video to celebrity feed
   */
  static postMedia(celebrityId: string, type: 'IMAGE' | 'VIDEO', mediaUrl: string, caption?: string) {
    const mediaId = crypto.randomUUID();
    const record: CelebrityMediaRecord = {
      id: mediaId,
      celebrityId,
      type,
      mediaUrl,
      caption,
      createdAt: new Date()
    };
    db.celebrityMedia.set(mediaId, record);
    return record;
  }
}
