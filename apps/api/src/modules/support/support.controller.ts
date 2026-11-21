import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { SupportService } from "./support.service.js";
import {
  CreateTicketDto,
  AddTicketMessageDto,
  UpdateTicketStatusDto,
  AssignTicketDto,
} from "./dto/support-ticket.dto.js";

@Controller("support/tickets")
export class SupportController {
  constructor(private readonly support: SupportService) {}

  /** POST /api/v1/support/tickets */
  @Post()
  createTicket(@Body() dto: CreateTicketDto) {
    return this.support.createTicket(dto);
  }

  /** GET /api/v1/support/tickets?actorId=...&role=...&status=...&assignedTo=... */
  @Get()
  listTickets(
    @Query("actorId") actorId: string,
    @Query("role") role?: string,
    @Query("status") status?: string,
    @Query("assignedTo") assignedTo?: string,
    @Query("priority") priority?: string,
  ) {
    return this.support.listTickets(actorId, role ?? "CUSTOMER", {
      status,
      assignedTo,
      priority,
    });
  }

  /** GET /api/v1/support/tickets/:id?actorId=...&role=... */
  @Get(":id")
  getTicket(
    @Param("id") id: string,
    @Query("actorId") actorId: string,
    @Query("role") role?: string,
  ) {
    return this.support.getTicket(id, actorId, role ?? "CUSTOMER");
  }

  /** POST /api/v1/support/tickets/:id/messages */
  @Post(":id/messages")
  addMessage(
    @Param("id") id: string,
    @Body() dto: AddTicketMessageDto,
  ) {
    return this.support.addMessage(id, dto);
  }

  /** PATCH /api/v1/support/tickets/:id/status */
  @Patch(":id/status")
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.support.updateStatus(id, dto);
  }

  /** PATCH /api/v1/support/tickets/:id/assign */
  @Patch(":id/assign")
  assignTicket(
    @Param("id") id: string,
    @Body() dto: AssignTicketDto,
  ) {
    return this.support.assignTicket(id, dto);
  }
}
