import { Body, Controller, Get, Patch } from "@nestjs/common";
import { CurrentUser } from "../../../common/decorators/index.js";
import type { AuthenticatedPrincipal } from "../../../common/auth/authenticated-principal.js";
import { UpdateProfileDto } from "../dto/index.js";
import { IdentityService } from "../services/identity.service.js";

@Controller("users")
export class UsersController {
  constructor(private readonly identity: IdentityService) {}

  @Get("me")
  getProfile(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.identity.currentAccount(user.userId);
  }

  @Patch("me")
  updateProfile(@CurrentUser() user: AuthenticatedPrincipal, @Body() dto: UpdateProfileDto) {
    return this.identity.updateProfile(user.userId, dto);
  }
}
