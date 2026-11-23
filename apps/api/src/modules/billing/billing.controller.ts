import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { CurrentUser, Roles } from "../../common/decorators/index.js";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { BillingService } from "./billing.service.js";
import { InvoiceListQueryDto } from "./dto/billing.dto.js";

@Controller()
@Roles("customer")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get("billing/summary")
  summary(@CurrentUser() user: AuthenticatedPrincipal) { return this.billing.summary(user); }

  @Get("invoices")
  list(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: InvoiceListQueryDto) { return this.billing.listInvoices(user, query); }

  @Get("invoices/:id")
  get(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string) { return this.billing.getInvoice(user, id); }
}
