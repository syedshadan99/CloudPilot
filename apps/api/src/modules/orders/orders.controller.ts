import { Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { CurrentUser, Roles } from "../../common/decorators/index.js";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { OrderListQueryDto } from "./dto/orders.dto.js";
import { OrdersService } from "./orders.service.js";

@Controller("offers")
@Roles("customer")
export class OfferConfirmationController {
  constructor(private readonly orders: OrdersService) {}

  @Post(":id/confirm")
  confirm(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Headers("idempotency-key") key?: string) {
    return this.orders.confirmOffer(user, id, key ?? "");
  }
}

@Controller("orders")
@Roles("customer")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: OrderListQueryDto) { return this.orders.listCustomerOrders(user, query); }

  @Get(":id")
  get(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string) { return this.orders.getCustomerOrder(user, id); }

  @Get(":id/events")
  events(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string) { return this.orders.orderEvents(user, id); }
}
