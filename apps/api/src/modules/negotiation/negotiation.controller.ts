import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CurrentUser, Roles } from "../../common/decorators/index.js";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { CounterNegotiationDto, StartNegotiationDto } from "./dto/negotiation.dto.js";
import { NegotiationService } from "./negotiation.service.js";

@Controller("negotiations")
@Roles("customer")
export class NegotiationController {
  constructor(private readonly negotiation: NegotiationService) {}

  @Post()
  start(@CurrentUser() user: AuthenticatedPrincipal, @Body() dto: StartNegotiationDto, @Headers("idempotency-key") idempotencyKey?: string) {
    return this.negotiation.start(user, dto, idempotencyKey ?? "");
  }

  @Post(":id/counter")
  counter(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Body() dto: CounterNegotiationDto, @Headers("idempotency-key") idempotencyKey?: string) {
    return this.negotiation.counter(user, id, dto, idempotencyKey ?? "");
  }

  @Get(":id")
  get(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string) {
    return this.negotiation.getNegotiation(user, id);
  }

  @Get(":id/history")
  history(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string) {
    return this.negotiation.history(user, id);
  }
}
