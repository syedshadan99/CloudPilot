import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { CurrentUser, Roles } from "../../common/decorators/index.js";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { BillingService } from "./billing.service.js";
import { BillingListQueryDto, InvoiceListQueryDto } from "./dto/billing.dto.js";

@Controller()
@Roles("customer")
export class BillingController {
  constructor(private readonly billing: BillingService) {}
  @Get("billing/summary") summary(@CurrentUser() user: AuthenticatedPrincipal) { return this.billing.summary(user); }
  @Get("billing/charges") charges(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: BillingListQueryDto) { return this.billing.listCharges(user, query); }
  @Get("billing/charges/:id") charge(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string) { return this.billing.getCharge(user, id); }
  @Get("billing/usage") usage(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: BillingListQueryDto) { return this.billing.usageBilling(user, undefined, query); }
  @Get("vms/:id/billing") vmBilling(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Query() query: BillingListQueryDto) { return this.billing.usageBilling(user, id, query); }
  @Get("invoices") list(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: InvoiceListQueryDto) { return this.billing.listInvoices(user, query); }
  @Get("invoices/:id") get(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string) { return this.billing.getInvoice(user, id); }
}
