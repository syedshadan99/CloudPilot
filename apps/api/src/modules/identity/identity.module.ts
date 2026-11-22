import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { DatabaseModule } from "../../database/database.module.js";
import { AuthGuard, CsrfGuard, RolesGuard } from "../../common/guards/index.js";
import { AuthController } from "./controllers/auth.controller.js";
import { UsersController } from "./controllers/users.controller.js";
import { AuthorizationService } from "./services/authorization.service.js";
import { DevelopmentEmailDelivery, EMAIL_DELIVERY } from "./services/email-delivery.service.js";
import { IdentityService } from "./services/identity.service.js";
import { PasswordService } from "./services/password.service.js";
import { RateLimiterService } from "./services/rate-limiter.service.js";
import { IdentityRepository } from "./repositories/identity.repository.js";

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController, UsersController],
  providers: [
    IdentityRepository,
    IdentityService,
    AuthorizationService,
    PasswordService,
    RateLimiterService,
    DevelopmentEmailDelivery,
    { provide: EMAIL_DELIVERY, useExisting: DevelopmentEmailDelivery },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
  exports: [IdentityService, AuthorizationService, PasswordService, IdentityRepository, DevelopmentEmailDelivery],
})
export class IdentityModule {}
