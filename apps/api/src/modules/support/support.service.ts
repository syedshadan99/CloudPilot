import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  SupportRepository,
  type SupportTicketRow,
  type SupportTicketMessageRow,
} from "./support.repository.js";
import {
  CreateTicketDto,
  AddTicketMessageDto,
  UpdateTicketStatusDto,
  AssignTicketDto,
  TicketStatus,
} from "./dto/support-ticket.dto.js";

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(private readonly repo: SupportRepository) {}

  async createTicket(dto: CreateTicketDto): Promise<SupportTicketRow> {
    const ticket = await this.repo.createTicket(dto);
    this.logger.log(`Ticket ${ticket.id} created by customer ${dto.customerId}: "${ticket.subject}"`);
    return ticket;
  }

  async getTicket(
    id: string,
    actorId: string,
    role = "CUSTOMER",
  ): Promise<{ ticket: SupportTicketRow; messages: SupportTicketMessageRow[] }> {
    const ticket = await this.repo.findById(id);
    if (!ticket) {
      throw new NotFoundException(`Support ticket ${id} not found`);
    }

    // Customer can only view their own tickets
    if (role.toUpperCase() === "CUSTOMER" && ticket.customer_id !== actorId) {
      throw new ForbiddenException("You do not have access to this support ticket");
    }

    const messages = await this.repo.listMessages(id);
    return { ticket, messages };
  }

  async listTickets(
    actorId: string,
    role = "CUSTOMER",
    filters?: { status?: string; assignedTo?: string; priority?: string },
  ): Promise<SupportTicketRow[]> {
    if (role.toUpperCase() === "CUSTOMER") {
      return this.repo.listByCustomer(actorId);
    }

    if (role.toUpperCase() === "PROVIDER") {
      return this.repo.listAll(filters);
    }

    throw new ForbiddenException("Invalid role for listing support tickets");
  }

  async addMessage(
    id: string,
    dto: AddTicketMessageDto,
  ): Promise<SupportTicketMessageRow> {
    const ticket = await this.repo.findById(id);
    if (!ticket) {
      throw new NotFoundException(`Support ticket ${id} not found`);
    }

    if (
      dto.senderRole.toUpperCase() === "CUSTOMER" &&
      ticket.customer_id !== dto.senderId
    ) {
      throw new ForbiddenException("You cannot reply to a ticket you do not own");
    }

    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException("Cannot reply to a closed ticket");
    }

    const message = await this.repo.addMessage({
      ticketId: id,
      senderId: dto.senderId,
      senderRole: dto.senderRole.toUpperCase(),
      message: dto.message,
    });

    // Auto-transition to IN_PROGRESS if customer replies while waiting
    if (
      dto.senderRole.toUpperCase() === "CUSTOMER" &&
      ticket.status === TicketStatus.WAITING_ON_CUSTOMER
    ) {
      await this.repo.updateStatus(id, TicketStatus.IN_PROGRESS);
    }

    return message;
  }

  async updateStatus(
    id: string,
    dto: UpdateTicketStatusDto,
  ): Promise<SupportTicketRow> {
    const ticket = await this.repo.findById(id);
    if (!ticket) {
      throw new NotFoundException(`Support ticket ${id} not found`);
    }

    const isCustomer = dto.actorRole.toUpperCase() === "CUSTOMER";
    const isProvider = dto.actorRole.toUpperCase() === "PROVIDER";

    if (!isCustomer && !isProvider) {
      throw new ForbiddenException("Unauthorized actor role");
    }

    if (isCustomer) {
      if (ticket.customer_id !== dto.actorId) {
        throw new ForbiddenException("You do not own this ticket");
      }
      // Customers may only close their tickets
      if (dto.status !== TicketStatus.CLOSED) {
        throw new ForbiddenException("Customers can only close their support tickets");
      }
    }

    const updated = await this.repo.updateStatus(
      id,
      dto.status,
      dto.resolutionNotes,
    );
    this.logger.log(`Ticket ${id} status changed to ${dto.status} by ${dto.actorId}`);
    return updated!;
  }

  async assignTicket(
    id: string,
    dto: AssignTicketDto,
  ): Promise<SupportTicketRow> {
    const ticket = await this.repo.findById(id);
    if (!ticket) {
      throw new NotFoundException(`Support ticket ${id} not found`);
    }

    const updated = await this.repo.assignTicket(id, dto.assignedTo);
    this.logger.log(`Ticket ${id} assigned to ${dto.assignedTo} by provider ${dto.providerId}`);
    return updated!;
  }
}
