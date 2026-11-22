import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac } from "node:crypto";
import type { Request } from "express";
import { APP_CONFIG, type AppConfig } from "../../../config/index.js";
import type { AuthenticatedPrincipal } from "../../../common/auth/authenticated-principal.js";
import type { EmailMessage } from "./email-delivery.service.js";
import { EMAIL_DELIVERY, type EmailDelivery } from "./email-delivery.service.js";
import { IdentityRepository, type AccountRow, type UserRow } from "../repositories/identity.repository.js";
import type { EmailCredentialDto, LoginDto, RegisterDto, ResetPasswordDto, TokenCredentialDto, UpdateProfileDto } from "../dto/index.js";
import { PasswordService } from "./password.service.js";
import { generateToken, hashToken } from "./token.service.js";
import { RateLimiterService } from "./rate-limiter.service.js";

export interface LoginRequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class IdentityService {
  constructor(
    private readonly repo: IdentityRepository,
    private readonly passwords: PasswordService,
    private readonly limiter: RateLimiterService,
    @Inject(EMAIL_DELIVERY) private readonly email: EmailDelivery,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async register(dto: RegisterDto, request: Request) {
    this.limiter.consume(`register:ip:${request.ip}`, 10, 60 * 60 * 1000);
    const email = this.normalizeEmail(dto.email);
    const passwordHash = await this.passwords.hash(dto.password);
    const verification = generateToken();
    const expiresAt = this.expiresFromNow(this.config.verificationTokenTtlSeconds);

    let result;
    try {
      result = await this.repo.createRegistration(
        { ...dto, email },
        passwordHash,
        verification.hash,
        expiresAt,
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException("An account with this email already exists");
      }
      throw error;
    }

    await this.deliver({
      kind: "verification",
      recipient: email,
      token: verification.raw,
      expiresAt,
    });

    return {
      user: this.publicUser(result.user),
      verificationRequired: true,
      message: "Registration successful. Check your email to verify your account.",
    };
  }

  async login(dto: LoginDto, metadata: LoginRequestMetadata) {
    const email = this.normalizeEmail(dto.email);
    const limiterKey = `login:${metadata.ipAddress ?? "unknown"}:${email}`;
    this.limiter.consume(limiterKey, 10, 15 * 60 * 1000);

    const user = await this.repo.findForLogin(email);
    const passwordMatches = await this.passwords.verify(dto.password, user?.password_hash);
    if (!user || !passwordMatches) {
      throw new UnauthorizedException("Invalid email or password");
    }
    if (user.status === "pending_verification") {
      throw new ForbiddenException("Email verification is required");
    }
    if (user.status === "suspended" || user.status === "deactivated") {
      throw new ForbiddenException("This account cannot authenticate");
    }

    const sessionToken = generateToken();
    const expiresAt = this.expiresFromNow(this.config.session.ttlSeconds);
    const session = await this.repo.createSession(
      user.id,
      sessionToken.hash,
      expiresAt,
      metadata.ipAddress,
      metadata.userAgent?.slice(0, 500),
    );

    return {
      user: this.publicUser(user),
      session: { expiresAt: session.expires_at },
      token: sessionToken.raw,
    };
  }

  async validateSession(rawToken: string): Promise<AuthenticatedPrincipal | undefined> {
    if (!this.isSessionTokenFormat(rawToken)) return undefined;
    const session = await this.repo.findValidSession(hashToken(rawToken), this.config.session.idleSeconds);
    if (!session) return undefined;
    await this.repo.touchSession(session.id);
    return {
      userId: session.user_id,
      sessionId: session.id,
      email: session.email,
      fullName: session.full_name,
      role: session.role,
      status: "active",
    };
  }

  csrfTokenFor(rawSessionToken: string): string {
    return createHmac("sha256", this.config.csrfSecret).update(rawSessionToken).digest("base64url");
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken && this.isSessionTokenFormat(rawToken)) {
      await this.repo.revokeSession(hashToken(rawToken));
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.repo.revokeAllSessions(userId);
  }

  async currentAccount(userId: string): Promise<ReturnType<IdentityService["publicAccount"]>> {
    const account = await this.repo.findAccount(userId);
    if (!account || account.status !== "active") throw new UnauthorizedException("Authentication required");
    return this.publicAccount(account);
  }

  async verifyEmail(dto: TokenCredentialDto) {
    this.assertToken(dto.token);
    const user = await this.repo.verifyEmail(hashToken(dto.token));
    if (!user) throw new ConflictException("Verification token is invalid or expired");
    return { user: this.publicUser(user), verified: true };
  }

  async resendVerification(dto: EmailCredentialDto, request: Request) {
    this.limiter.consume(`verify-resend:ip:${request.ip}`, 5, 60 * 60 * 1000);
    const email = this.normalizeEmail(dto.email);
    const user = await this.repo.findForLogin(email);
    if (user?.status === "pending_verification") {
      const token = generateToken();
      const expiresAt = this.expiresFromNow(this.config.verificationTokenTtlSeconds);
      await this.repo.createVerificationToken(user.id, token.hash, expiresAt);
      await this.deliver({ kind: "verification", recipient: email, token: token.raw, expiresAt });
    }
    return { message: "If the account requires verification, a new verification email has been sent." };
  }

  async forgotPassword(dto: EmailCredentialDto, request: Request) {
    this.limiter.consume(`password-recovery:ip:${request.ip}`, 5, 60 * 60 * 1000);
    const email = this.normalizeEmail(dto.email);
    const user = await this.repo.findForLogin(email);
    if (user && user.status !== "deactivated") {
      const token = generateToken();
      const expiresAt = this.expiresFromNow(this.config.passwordResetTokenTtlSeconds);
      await this.repo.createPasswordResetToken(user.id, token.hash, expiresAt);
      await this.deliver({ kind: "password_reset", recipient: email, token: token.raw, expiresAt });
    }
    return { message: "If an eligible account exists, a password reset email has been sent." };
  }

  async resetPassword(dto: ResetPasswordDto) {
    this.assertToken(dto.token);
    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.repo.resetPassword(hashToken(dto.token), passwordHash);
    if (!user) throw new ConflictException("Reset token is invalid or expired");
    return { message: "Password reset successfully. Please sign in again." };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const account = await this.repo.findAccount(userId);
    if (!account) throw new NotFoundException("Account not found");
    if (account.role !== "customer" && [dto.companyName, dto.workloadType, dto.billingEmail, dto.preferredCurrency, dto.timezone].some((value) => value !== undefined)) {
      throw new ForbiddenException("Customer profile fields are not available for this role");
    }
    const updated = await this.repo.updateProfile(userId, dto);
    if (!updated) throw new InternalServerErrorException("Profile update failed");
    return this.publicAccount(updated);
  }

  async assertActiveCustomer(userId: string): Promise<void> {
    const account = await this.repo.findAccount(userId);
    if (!account || account.status !== "active") throw new ForbiddenException("Active customer account required");
    if (account.role !== "customer") throw new ForbiddenException("Customer role required");
  }

  private async deliver(message: EmailMessage): Promise<void> {
    try {
      if (message.kind === "verification") await this.email.sendVerification(message);
      else await this.email.sendPasswordReset(message);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException("Email delivery is temporarily unavailable");
    }
  }

  private publicUser(user: UserRow) {
    return {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.email_verified_at,
      termsAcceptedAt: user.terms_accepted_at,
      createdAt: user.created_at,
    };
  }

  private publicAccount(account: AccountRow) {
    return {
      ...this.publicUser(account),
      profile: account.role === "customer" ? {
        organizationId: account.organization_id,
        companyName: account.company_name,
        workloadType: account.workload_type,
        preferredCurrency: account.preferred_currency,
        billingEmail: account.billing_email,
        timezone: account.timezone,
      } : null,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLocaleLowerCase("en-US");
  }

  private expiresFromNow(seconds: number): Date {
    return new Date(Date.now() + seconds * 1000);
  }

  private isSessionTokenFormat(token: string): boolean {
    return /^[A-Za-z0-9_-]{43}$/.test(token);
  }

  private assertToken(token: string): void {
    if (!this.isSessionTokenFormat(token)) throw new ConflictException("Credential is invalid or expired");
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
  }
}
