import { db, SupportTicketRecord, SupportMessageRecord } from '../../db/store';
import { SupportTicketDTO, SupportMessageDTO, TicketPriority, TicketStatusEnum } from '@friends-app/shared';
import crypto from 'crypto';

export class SupportService {
  /**
   * Creates a new support ticket
   */
  static createTicket(userId: string, subject: string, description: string, category: string, priority: TicketPriority = TicketPriority.MEDIUM): SupportTicketDTO {
    const ticketId = crypto.randomUUID();
    const ticketNumber = `TICK-${Math.floor(100000 + Math.random() * 900000)}`;

    const record: SupportTicketRecord = {
      id: ticketId,
      ticketNumber,
      userId,
      subject,
      description,
      category,
      priority,
      status: TicketStatusEnum.OPEN,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    db.supportTickets.set(ticketId, record);

    // Initial user description message
    const messageId = crypto.randomUUID();
    db.supportMessages.set(messageId, {
      id: messageId,
      ticketId,
      senderId: userId,
      message: description,
      isStaffReply: false,
      createdAt: new Date()
    });

    return this.getTicketDTO(record);
  }

  /**
   * Adds a reply message to ticket
   */
  static replyTicket(ticketId: string, senderId: string, message: string, isStaff: boolean): SupportMessageDTO | null {
    const ticket = db.supportTickets.get(ticketId);
    if (!ticket) return null;

    const messageId = crypto.randomUUID();
    const record: SupportMessageRecord = {
      id: messageId,
      ticketId,
      senderId,
      message,
      isStaffReply: isStaff,
      createdAt: new Date()
    };
    db.supportMessages.set(messageId, record);

    ticket.updatedAt = new Date();
    if (isStaff && ticket.status === TicketStatusEnum.OPEN) {
      ticket.status = TicketStatusEnum.IN_PROGRESS;
    }

    const senderProfile = db.profiles.get(senderId);

    return {
      id: record.id,
      ticketId: record.ticketId,
      senderId: record.senderId,
      message: record.message,
      isStaffReply: record.isStaffReply,
      createdAt: record.createdAt.toISOString(),
      senderName: senderProfile?.name || (isStaff ? 'Support Staff' : 'User')
    };
  }

  /**
   * Updates ticket status or escalates to Super Admin
   */
  static updateStatus(ticketId: string, status: TicketStatusEnum) {
    const ticket = db.supportTickets.get(ticketId);
    if (!ticket) return null;

    ticket.status = status;
    ticket.updatedAt = new Date();
    return this.getTicketDTO(ticket);
  }

  /**
   * Helper to format DTO with messages
   */
  private static getTicketDTO(t: SupportTicketRecord): SupportTicketDTO {
    const messages: SupportMessageDTO[] = [];
    for (const m of db.supportMessages.values()) {
      if (m.ticketId === t.id) {
        const sender = db.profiles.get(m.senderId);
        messages.push({
          id: m.id,
          ticketId: m.ticketId,
          senderId: m.senderId,
          message: m.message,
          isStaffReply: m.isStaffReply,
          createdAt: m.createdAt.toISOString(),
          senderName: sender?.name
        });
      }
    }

    return {
      id: t.id,
      ticketNumber: t.ticketNumber,
      userId: t.userId,
      assignedStaffId: t.assignedStaffId || null,
      subject: t.subject,
      description: t.description,
      category: t.category,
      priority: t.priority,
      status: t.status,
      messages,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString()
    };
  }

  static getUserTickets(userId: string): SupportTicketDTO[] {
    const list: SupportTicketDTO[] = [];
    for (const t of db.supportTickets.values()) {
      if (t.userId === userId) {
        list.push(this.getTicketDTO(t));
      }
    }
    return list;
  }

  static getAllTickets(): SupportTicketDTO[] {
    return Array.from(db.supportTickets.values()).map(t => this.getTicketDTO(t));
  }
}
