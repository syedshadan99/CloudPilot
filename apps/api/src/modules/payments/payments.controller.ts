import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { CurrentUser, Roles } from "../../common/decorators/index.js";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { PaymentListQueryDto, SimulatedPaymentDto } from "./dto/payments.dto.js";
import { PaymentsService } from "./payments.service.js";

@Controller("payments")
@Roles("customer")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("simulated")
  submit(@CurrentUser() user: AuthenticatedPrincipal, @Body() dto: SimulatedPaymentDto, @Headers("idempotency-key") key?: string) { return this.payments.submit(user, dto, key ?? ""); }

  @Get()
  listAll(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: PaymentListQueryDto) { return this.payments.listForCustomer(user, query); }

  @Get(":id")
  get(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string) { return this.payments.get(user, id); }
}

@Controller("invoices")
@Roles("customer")
export class InvoicePaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get(":id/payments")
  list(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string) { return this.payments.listForInvoice(user, id); }
}
