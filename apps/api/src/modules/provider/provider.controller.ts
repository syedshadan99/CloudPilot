import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query } from "@nestjs/common";
import type { PipeTransform } from "@nestjs/common";
import { CurrentUser, Roles } from "../../common/decorators/index.js";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { ProviderOverrideDto, ProviderReportQueryDto, UUID_SHAPE } from "./dto/provider.dto.js";
import { ProviderService } from "./provider.service.js";

class UuidShapePipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID_SHAPE.test(value)) throw new BadRequestException("Validation failed: id must be a UUID-shaped identifier");
    return value;
  }
}
@Controller("provider")
@Roles("provider_admin", "provider_staff")
export class ProviderController {
  constructor(private readonly provider: ProviderService) {}

  @Get("dashboard") dashboard(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: ProviderReportQueryDto) { return this.provider.dashboard(user, query); }
  @Get("customers") customers(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: ProviderReportQueryDto) { return this.provider.listCustomers(user, query); }
  @Get("customers/:id") customer(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", new UuidShapePipe()) id: string, @Query() query: ProviderReportQueryDto) { return this.provider.getCustomer(user, query.organizationId, id); }
  @Get("deals") deals(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: ProviderReportQueryDto) { return this.provider.listDeals(user, query); }
  @Get("deals/:id") deal(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", new UuidShapePipe()) id: string, @Query() query: ProviderReportQueryDto) { return this.provider.getDeal(user, query.organizationId, id); }
  @Post("deals/:id/override") override(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", new UuidShapePipe()) id: string, @Query() query: ProviderReportQueryDto, @Body() dto: ProviderOverrideDto, @Headers("idempotency-key") idempotencyKey?: string) { return this.provider.overrideDeal(user, query.organizationId, id, dto, idempotencyKey ?? ""); }
  @Get("orders") orders(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: ProviderReportQueryDto) { return this.provider.listOrders(user, query); }
  @Get("vms") vms(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: ProviderReportQueryDto) { return this.provider.listVms(user, query); }
  @Get("invoices") invoices(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: ProviderReportQueryDto) { return this.provider.listInvoices(user, query); }
  @Get("pricing/history") pricing(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: ProviderReportQueryDto) { return this.provider.pricingHistory(user, query); }
  @Get("pricing/history/:id") pricingVersion(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", new UuidShapePipe()) id: string, @Query() query: ProviderReportQueryDto) { return this.provider.pricingVersion(user, query.organizationId, id); }
  @Get("activity") activity(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: ProviderReportQueryDto) { return this.provider.activity(user, query); }
}
