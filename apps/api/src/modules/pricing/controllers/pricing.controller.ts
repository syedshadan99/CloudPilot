import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser, Roles } from "../../../common/decorators/index.js";
import type { AuthenticatedPrincipal } from "../../../common/auth/authenticated-principal.js";
import { CreatePricingRuleDto, CreatePricingVersionDto, PricingOrganizationQueryDto, QuoteDto, UpdatePricingRuleDto, UpdatePricingVersionDto } from "../dto/pricing.dto.js";
import { PricingService } from "../services/pricing.service.js";

@Controller("pricing")
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Post("quotes")
  @Roles("customer")
  quote(@CurrentUser() user: AuthenticatedPrincipal, @Body() dto: QuoteDto) { return this.pricing.quote(user, dto); }

  @Get("versions")
  @Roles("provider_admin", "provider_staff")
  listVersions(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: PricingOrganizationQueryDto) { return this.pricing.listVersions(user, query.organizationId, query.page, query.pageSize, query.includeRules); }

  @Post("versions")
  @Roles("provider_admin")
  createVersion(@CurrentUser() user: AuthenticatedPrincipal, @Body() dto: CreatePricingVersionDto) { return this.pricing.createVersion(user, dto); }

  @Get("versions/:id")
  @Roles("provider_admin", "provider_staff")
  getVersion(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Query() query: PricingOrganizationQueryDto) { return this.pricing.getVersion(user, query.organizationId, id); }

  @Patch("versions/:id")
  @Roles("provider_admin")
  updateVersion(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Query() query: PricingOrganizationQueryDto, @Body() dto: UpdatePricingVersionDto) { return this.pricing.updateVersion(user, query.organizationId, id, dto); }

  @Post("versions/:id/activate")
  @Roles("provider_admin")
  activate(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Query() query: PricingOrganizationQueryDto) { return this.pricing.activate(user, query.organizationId, id); }

  @Post("versions/:id/retire")
  @Roles("provider_admin")
  retire(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Query() query: PricingOrganizationQueryDto) { return this.pricing.retire(user, query.organizationId, id); }

  @Post("versions/:id/rules")
  @Roles("provider_admin")
  createRule(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Query() query: PricingOrganizationQueryDto, @Body() dto: CreatePricingRuleDto) { return this.pricing.createRule(user, query.organizationId, id, dto); }

  @Patch("versions/:id/rules/:ruleId")
  @Roles("provider_admin")
  updateRule(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Param("ruleId", ParseUUIDPipe) ruleId: string, @Query() query: PricingOrganizationQueryDto, @Body() dto: UpdatePricingRuleDto) { return this.pricing.updateRule(user, query.organizationId, id, ruleId, dto); }

  @Delete("versions/:id/rules/:ruleId")
  @Roles("provider_admin")
  deleteRule(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Param("ruleId", ParseUUIDPipe) ruleId: string, @Query() query: PricingOrganizationQueryDto) { return this.pricing.deleteRule(user, query.organizationId, id, ruleId); }
}
