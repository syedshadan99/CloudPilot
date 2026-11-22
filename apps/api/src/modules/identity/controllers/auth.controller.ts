import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Get,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { APP_CONFIG, type AppConfig } from "../../../config/index.js";
import { Public } from "../../../common/decorators/index.js";
import { CurrentUser } from "../../../common/decorators/index.js";
import type { AuthenticatedPrincipal } from "../../../common/auth/authenticated-principal.js";
import { readCookie } from "../../../common/http/cookies.js";
import { Inject } from "@nestjs/common";
import { IdentityService } from "../services/identity.service.js";
import { EmailCredentialDto, LoginDto, RegisterDto, ResetPasswordDto, TokenCredentialDto } from "../dto/index.js";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly identity: IdentityService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post("register")
  @Public()
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.identity.register(dto, request);
  }

  @Get("me")
  me(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.identity.currentAccount(user.userId);
  }

  @Post("login")
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.identity.login(dto, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
    this.setSessionCookies(response, result.token);
    return {
      user: result.user,
      session: result.session,
    };
  }

  @Post("logout")
  @Public()
  @HttpCode(HttpStatus.OK)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const rawToken = readCookie(request.headers.cookie, this.config.session.cookieName);
    await this.identity.logout(rawToken);
    this.clearSessionCookies(response);
    return { loggedOut: true };
  }

  @Post("logout-all")
  @HttpCode(HttpStatus.OK)
  async logoutAll(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const userId = (request as Request & { user: { userId: string } }).user.userId;
    await this.identity.logoutAll(userId);
    this.clearSessionCookies(response);
    return { loggedOut: true, allSessionsRevoked: true };
  }

  @Post("verify-email")
  @Public()
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: TokenCredentialDto) {
    return this.identity.verifyEmail(dto);
  }

  @Post("resend-verification")
  @Public()
  @HttpCode(HttpStatus.OK)
  resendVerification(@Body() dto: EmailCredentialDto, @Req() request: Request) {
    return this.identity.resendVerification(dto, request);
  }

  @Post("forgot-password")
  @Public()
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: EmailCredentialDto, @Req() request: Request) {
    return this.identity.forgotPassword(dto, request);
  }

  @Post("reset-password")
  @Public()
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.identity.resetPassword(dto);
  }

  private setSessionCookies(response: Response, rawToken: string): void {
    const options = {
      httpOnly: true,
      secure: this.config.session.secure,
      sameSite: this.config.session.sameSite,
      path: "/",
      maxAge: this.config.session.ttlSeconds * 1000,
    } as const;
    response.cookie(this.config.session.cookieName, rawToken, options);
    response.cookie("cloudpilot_csrf", this.identity.csrfTokenFor(rawToken), {
      httpOnly: false,
      secure: this.config.session.secure,
      sameSite: this.config.session.sameSite,
      path: "/",
      maxAge: this.config.session.ttlSeconds * 1000,
    });
  }

  private clearSessionCookies(response: Response): void {
    const options = {
      secure: this.config.session.secure,
      sameSite: this.config.session.sameSite,
      path: "/",
    } as const;
    response.clearCookie(this.config.session.cookieName, options);
    response.clearCookie("cloudpilot_csrf", options);
  }
}
