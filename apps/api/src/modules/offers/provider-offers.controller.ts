import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { CurrentUser, Roles } from "../../common/decorators/index.js";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { OfferDecisionDto, ProviderOfferQueryDto } from "./dto/offers.dto.js";
import { OffersService } from "./offers.service.js";

@Controller("provider/offers")
@Roles("provider_admin", "provider_staff")
export class ProviderOffersController {
  constructor(private readonly offers: OffersService) {}

  @Get("pending-review")
  queue(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: ProviderOfferQueryDto) {
    return this.offers.providerQueue(user, query.organizationId, query.page, query.pageSize);
  }

  @Post(":id/approve")
  approve(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Query() query: ProviderOfferQueryDto, @Body() dto: OfferDecisionDto, @Headers("idempotency-key") idempotencyKey?: string) {
    return this.offers.providerDecision(user, id, query.organizationId, "approved", dto.reason, idempotencyKey ?? "");
  }

  @Post(":id/reject")
  reject(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Query() query: ProviderOfferQueryDto, @Body() dto: OfferDecisionDto, @Headers("idempotency-key") idempotencyKey?: string) {
    return this.offers.providerDecision(user, id, query.organizationId, "rejected", dto.reason, idempotencyKey ?? "");
  }
}
