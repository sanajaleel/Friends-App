import { db, EventRecord, EventTicketTierRecord, TicketBookingRecord } from '../../db/store';
import { EventItemDTO, TicketBookingDTO, TicketStatus } from '@friends-app/shared';
import crypto from 'crypto';

export class EventsService {
  /**
   * Calculates distance between two latitude/longitude points in kilometers using Haversine formula
   */
  private static calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
  }

  /**
   * Lists nearby events within a given kilometer radius
   */
  static getNearbyEvents(lat?: number, lng?: number, radiusKm: number = 50, category?: string): EventItemDTO[] {
    const results: EventItemDTO[] = [];

    for (const event of db.events.values()) {
      if (!event.isPublished) continue;
      if (category && category !== 'All' && event.category.toLowerCase() !== category.toLowerCase()) continue;

      let distanceKm: number | undefined;
      if (lat !== undefined && lng !== undefined) {
        distanceKm = this.calculateDistanceKm(lat, lng, event.latitude, event.longitude);
        if (distanceKm > radiusKm) continue;
      }

      // Collect tiers
      const tiers: EventTicketTierRecord[] = [];
      for (const tier of db.eventTiers.values()) {
        if (tier.eventId === event.id) {
          tiers.push(tier);
        }
      }

      const org = db.organizations.get(event.organizationId);

      results.push({
        id: event.id,
        organizationId: event.organizationId,
        title: event.title,
        description: event.description,
        category: event.category,
        posterUrl: event.posterUrl,
        venueName: event.venueName,
        address: event.address,
        latitude: event.latitude,
        longitude: event.longitude,
        distanceKm,
        startTime: event.startTime.toISOString(),
        endTime: event.endTime.toISOString(),
        isPublished: event.isPublished,
        ticketTiers: tiers.map(t => ({
          id: t.id,
          eventId: t.eventId,
          name: t.name,
          price: t.price,
          totalSeats: t.totalSeats,
          available: t.available
        })),
        organization: org ? {
          id: org.id,
          userId: org.userId,
          organizationName: org.organizationName,
          contactEmail: org.contactEmail,
          logoUrl: org.logoUrl || null,
          isApproved: org.isApproved
        } : undefined
      });
    }

    // Sort by distance if available, otherwise by date
    if (lat !== undefined && lng !== undefined) {
      results.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
    }

    return results;
  }

  /**
   * Books event tickets, creates signed digital QR code hash, updates inventory
   */
  static bookTicket(userId: string, eventId: string, tierId: string, quantity: number): { success: boolean; booking?: TicketBookingDTO; message: string } {
    const event = db.events.get(eventId);
    if (!event) return { success: false, message: 'Event not found.' };

    const tier = db.eventTiers.get(tierId);
    if (!tier || tier.eventId !== eventId) return { success: false, message: 'Ticket tier not found.' };

    if (tier.available < quantity) {
      return { success: false, message: `Only ${tier.available} tickets remaining in this tier.` };
    }

    // Decrement tier seats
    tier.available -= quantity;

    const totalPrice = tier.price * quantity;
    const qrCodeHash = crypto.createHash('sha256')
      .update(`${userId}-${eventId}-${tierId}-${Date.now()}-${crypto.randomUUID()}`)
      .digest('hex');

    const bookingId = crypto.randomUUID();
    const booking: TicketBookingRecord = {
      id: bookingId,
      userId,
      eventId,
      tierId,
      quantity,
      totalPrice,
      qrCodeHash,
      status: TicketStatus.CONFIRMED,
      createdAt: new Date()
    };

    db.ticketBookings.set(bookingId, booking);

    return {
      success: true,
      message: 'Tickets booked successfully!',
      booking: {
        id: booking.id,
        userId: booking.userId,
        eventId: booking.eventId,
        tierId: booking.tierId,
        quantity: booking.quantity,
        totalPrice: booking.totalPrice,
        qrCodeHash: booking.qrCodeHash,
        status: booking.status,
        createdAt: booking.createdAt.toISOString()
      }
    };
  }

  /**
   * Check in an attendee by scanning their digital QR hash
   */
  static checkInTicket(qrCodeHash: string): { success: boolean; message: string; booking?: TicketBookingDTO } {
    for (const booking of db.ticketBookings.values()) {
      if (booking.qrCodeHash === qrCodeHash) {
        if (booking.status === TicketStatus.CHECKED_IN) {
          return { success: false, message: 'Ticket has already been checked in!' };
        }
        if (booking.status === TicketStatus.CANCELLED || booking.status === TicketStatus.REFUNDED) {
          return { success: false, message: 'Ticket is invalid or was cancelled.' };
        }

        booking.status = TicketStatus.CHECKED_IN;
        return {
          success: true,
          message: 'Attendee successfully checked in!',
          booking: {
            id: booking.id,
            userId: booking.userId,
            eventId: booking.eventId,
            tierId: booking.tierId,
            quantity: booking.quantity,
            totalPrice: booking.totalPrice,
            qrCodeHash: booking.qrCodeHash,
            status: booking.status,
            createdAt: booking.createdAt.toISOString()
          }
        };
      }
    }

    return { success: false, message: 'Ticket QR code not found.' };
  }
}
