import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { CurrentUser, Roles } from "../../common/decorators/index.js";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { ChatService } from "./chat.service.js";
import { CreateSessionDto, CreateMessageDto, UpdateRequirementsDto } from "./dto/chat.dto.js";

/**
 * Chat API — all routes versioned under /api/v1/chat
 *
 * GET  /api/v1/chat/sessions?customerId=...
 * POST /api/v1/chat/sessions
 * GET  /api/v1/chat/sessions/:id
 * POST /api/v1/chat/sessions/:id/messages
 * GET  /api/v1/chat/sessions/:id/requirements
 * PUT  /api/v1/chat/sessions/:id/requirements
 */
@Controller("chat")
@Roles("customer")
export class ChatController {
  constructor(private readonly service: ChatService) {}

  @Post("sessions")
  createSession(@Body() dto: CreateSessionDto, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.service.createSession({ ...dto, customerId: user.userId });
  }

  @Get("sessions")
  listSessions(@Query("customerId") customerId: string | undefined, @CurrentUser() user: AuthenticatedPrincipal) {
    if (customerId && customerId !== user.userId) throw new NotFoundException("Chat sessions not found");
    return this.service.listSessions(user.userId);
  }

  @Get("sessions/:id")
  getSession(@Param("id") id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.service.getSession(id, user.userId);
  }

  @Post("sessions/:id/messages")
  sendMessage(@Param("id") id: string, @Body() dto: CreateMessageDto, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.service.sendMessage(id, dto, user.userId);
  }

  @Get("sessions/:id/requirements")
  getRequirements(@Param("id") id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.service.getRequirements(id, user.userId);
  }

  @Put("sessions/:id/requirements")
  updateRequirements(@Param("id") id: string, @Body() dto: UpdateRequirementsDto, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.service.updateRequirements(id, dto, user.userId);
  }
}
