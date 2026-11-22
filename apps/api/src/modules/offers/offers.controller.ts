import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { CurrentUser, Roles } from "../../common/decorators/index.js";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { DeclineOfferDto, OfferListQueryDto } from "./dto/offers.dto.js";
import { OffersService } from "./offers.service.js";

@Controller("offers")
@Roles("customer")
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: OfferListQueryDto) {
    return this.offers.listCustomerOffers(user, query.page, query.pageSize, query.status, query.chatSessionId);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string) {
    return this.offers.getCustomerOffer(user, id);
  }

  @Get(":id/events")
  events(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string) {
    return this.offers.offerEvents(user, id);
  }

  @Post(":id/decline")
  decline(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Body() dto: DeclineOfferDto, @Headers("idempotency-key") idempotencyKey?: string) {
    return this.offers.decline(user, id, dto.reason, idempotencyKey ?? "");
  }
}
