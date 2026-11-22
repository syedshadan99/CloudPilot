import { Body, Controller, Get, Patch, Post } from "@nestjs/common";
import { CurrentUser, Roles } from "../../common/decorators/index.js";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import type { UpdateOnboardingDto } from "./dto/index.js";
import { OnboardingService } from "./onboarding.service.js";

@Controller("onboarding")
@Roles("customer")
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.onboarding.get(user.userId);
  }

  @Patch()
  update(@CurrentUser() user: AuthenticatedPrincipal, @Body() dto: UpdateOnboardingDto) {
    return this.onboarding.update(user.userId, dto);
  }

  @Post("complete")
  complete(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.onboarding.complete(user.userId);
  }
}
