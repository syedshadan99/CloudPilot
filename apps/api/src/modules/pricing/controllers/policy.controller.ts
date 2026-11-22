import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser, Roles } from "../../../common/decorators/index.js";
import type { AuthenticatedPrincipal } from "../../../common/auth/authenticated-principal.js";
import { CreateNegotiationPolicyDto, PolicyEvaluationDto, PricingOrganizationQueryDto, UpdateNegotiationPolicyDto } from "../dto/pricing.dto.js";
import { PolicyService } from "../services/policy.service.js";

@Controller("provider/negotiation-policies")
@Roles("provider_admin", "provider_staff")
export class PolicyController {
  constructor(private readonly policies: PolicyService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: PricingOrganizationQueryDto) { return this.policies.list(user, query.organizationId, query.page, query.pageSize); }

  @Get(":id")
  get(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Query() query: PricingOrganizationQueryDto) { return this.policies.get(user, query.organizationId, id); }

  @Post()
  @Roles("provider_admin")
  create(@CurrentUser() user: AuthenticatedPrincipal, @Body() dto: CreateNegotiationPolicyDto) { return this.policies.create(user, dto as unknown as Record<string, unknown>); }

  @Patch(":id")
  @Roles("provider_admin")
  update(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Query() query: PricingOrganizationQueryDto, @Body() dto: UpdateNegotiationPolicyDto) { return this.policies.update(user, query.organizationId, id, dto as unknown as Record<string, unknown>); }

  @Post(":id/activate")
  @Roles("provider_admin")
  activate(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Query() query: PricingOrganizationQueryDto) { return this.policies.activate(user, query.organizationId, id); }

  @Post(":id/deactivate")
  @Roles("provider_admin")
  deactivate(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Query() query: PricingOrganizationQueryDto) { return this.policies.deactivate(user, query.organizationId, id); }

  @Post("evaluate")
  @Roles("provider_admin", "provider_staff")
  evaluate(@CurrentUser() user: AuthenticatedPrincipal, @Body() dto: PolicyEvaluationDto) { return this.policies.evaluate(user, dto); }
}
