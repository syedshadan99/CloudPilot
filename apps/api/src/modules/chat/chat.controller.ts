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
export class ChatController {
  constructor(private readonly service: ChatService) {}

  @Post("sessions")
  createSession(@Body() dto: CreateSessionDto) {
    return this.service.createSession(dto);
  }

  @Get("sessions")
  listSessions(@Query("customerId") customerId: string) {
    if (!customerId) {
      throw new NotFoundException("customerId query parameter is required");
    }
    return this.service.listSessions(customerId);
  }

  @Get("sessions/:id")
  getSession(@Param("id") id: string) {
    return this.service.getSession(id);
  }

  @Post("sessions/:id/messages")
  sendMessage(@Param("id") id: string, @Body() dto: CreateMessageDto) {
    return this.service.sendMessage(id, dto);
  }

  @Get("sessions/:id/requirements")
  getRequirements(@Param("id") id: string) {
    return this.service.getRequirements(id);
  }

  @Put("sessions/:id/requirements")
  updateRequirements(@Param("id") id: string, @Body() dto: UpdateRequirementsDto) {
    return this.service.updateRequirements(id, dto);
  }
}
