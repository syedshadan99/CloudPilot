import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../database/database.service.js";
import type { RegisterDto, UpdateProfileDto } from "../dto/index.js";

export interface UserRow {
  id: string;
  full_name: string;
  email: string;
  normalized_email: string;
  password_hash: string;
  role: "customer" | "provider_admin" | "provider_staff";
  status: "pending_verification" | "active" | "suspended" | "deactivated";
  email_verified_at: Date | null;
  terms_accepted_at: Date;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface AccountRow extends UserRow {
  organization_id: string | null;
  company_name: string | null;
  workload_type: string | null;
  preferred_currency: string;
  billing_email: string | null;
  timezone: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  last_seen_at: Date;
  email: string;
  full_name: string;
  role: UserRow["role"];
  status: UserRow["status"];
}

export interface RegistrationResult {
  user: UserRow;
  verificationTokenExpiresAt: Date;
}

export interface ProgressInput {
  currentStep: string;
  status: "not_started" | "in_progress" | "skipped";
  responses: Record<string, string | number>;
}

@Injectable()
export class IdentityRepository {
  constructor(private readonly db: DatabaseService) {}

  async findForLogin(normalizedEmail: string): Promise<UserRow | undefined> {
    const result = await this.db.query<UserRow>(
      `SELECT id, full_name, email, normalized_email, password_hash, role, status,
              email_verified_at, terms_accepted_at, last_login_at, created_at, updated_at
       FROM users WHERE normalized_email = $1`,
      [normalizedEmail],
    );
    return result.rows[0];
  }

  async findAccount(userId: string): Promise<AccountRow | undefined> {
    const result = await this.db.query<AccountRow>(
      `SELECT u.id, u.full_name, u.email, u.normalized_email, u.password_hash,
              u.role, u.status, u.email_verified_at, u.terms_accepted_at,
              u.last_login_at, u.created_at, u.updated_at,
              cp.organization_id, cp.company_name, cp.workload_type,
              cp.preferred_currency, cp.billing_email, cp.timezone
       FROM users u
       LEFT JOIN customer_profiles cp ON cp.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );
    return result.rows[0];
  }

  async createRegistration(
    dto: RegisterDto,
    passwordHash: string,
    verificationTokenHash: string,
    verificationTokenExpiresAt: Date,
  ): Promise<RegistrationResult> {
    return this.db.transaction(async (client) => {
      const userResult = await client.query<UserRow>(
        `INSERT INTO users (full_name, email, normalized_email, password_hash, role, status, terms_accepted_at)
         VALUES ($1, $2, $2, $3, 'customer', 'pending_verification', NOW())
         RETURNING id, full_name, email, normalized_email, password_hash, role, status,
                   email_verified_at, terms_accepted_at, last_login_at, created_at, updated_at`,
        [dto.fullName, dto.email, passwordHash],
      );
      const user = userResult.rows[0]!;

      await client.query(
        `INSERT INTO customer_profiles
           (user_id, company_name, workload_type, preferred_currency, billing_email)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, dto.companyName ?? null, dto.workloadType, dto.preferredCurrency, dto.email],
      );
      await client.query(
        `INSERT INTO onboarding_progress (user_id, responses)
         VALUES ($1, $2::jsonb)`,
        [user.id, JSON.stringify({ workload: dto.workloadType, preferred_currency: dto.preferredCurrency })],
      );
      await client.query(
        `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, verificationTokenHash, verificationTokenExpiresAt],
      );
      return { user, verificationTokenExpiresAt };
    });
  }

  async createVerificationToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE email_verification_tokens
         SET consumed_at = COALESCE(consumed_at, NOW())
         WHERE user_id = $1 AND consumed_at IS NULL`,
        [userId],
      );
      await client.query(
        `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt],
      );
    });
  }

  async verifyEmail(tokenHash: string): Promise<UserRow | undefined> {
    return this.db.transaction(async (client) => {
      const tokenResult = await client.query<{ user_id: string }>(
        `UPDATE email_verification_tokens
         SET consumed_at = NOW()
         WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > NOW()
         RETURNING user_id`,
        [tokenHash],
      );
      const token = tokenResult.rows[0];
      if (!token) return undefined;

      const userResult = await client.query<UserRow>(
        `UPDATE users
         SET email_verified_at = COALESCE(email_verified_at, NOW()),
             status = CASE WHEN status = 'pending_verification' THEN 'active' ELSE status END,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, full_name, email, normalized_email, password_hash, role, status,
                   email_verified_at, terms_accepted_at, last_login_at, created_at, updated_at`,
        [token.user_id],
      );
      return userResult.rows[0];
    });
  }

  async createSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    ipAddress: string | undefined,
    userAgent: string | undefined,
  ): Promise<{ id: string; expires_at: Date }> {
    return this.db.transaction(async (client) => {
      const session = await client.query<{ id: string; expires_at: Date }>(
        `INSERT INTO sessions (user_id, token_hash, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, expires_at`,
        [userId, tokenHash, expiresAt, ipAddress ?? null, userAgent ?? null],
      );
      await client.query(`UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`, [userId]);
      return session.rows[0]!;
    });
  }

  async findValidSession(tokenHash: string, idleSeconds: number): Promise<SessionRow | undefined> {
    const result = await this.db.query<SessionRow>(
      `SELECT s.id, s.user_id, s.expires_at, s.revoked_at, s.last_seen_at,
              u.email, u.full_name, u.role, u.status
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > NOW()
         AND s.last_seen_at > NOW() - make_interval(secs => $2::double precision)
         AND u.status = 'active'`,
      [tokenHash, idleSeconds],
    );
    return result.rows[0];
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.db.query(
      `UPDATE sessions SET last_seen_at = NOW()
       WHERE id = $1 AND last_seen_at < NOW() - INTERVAL '5 minutes'`,
      [sessionId],
    );
  }

  async revokeSession(tokenHash: string): Promise<void> {
    await this.db.query(
      `UPDATE sessions SET revoked_at = COALESCE(revoked_at, NOW())
       WHERE token_hash = $1`,
      [tokenHash],
    );
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE sessions SET revoked_at = COALESCE(revoked_at, NOW())
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  }

  async createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE password_reset_tokens SET consumed_at = COALESCE(consumed_at, NOW())
         WHERE user_id = $1 AND consumed_at IS NULL`,
        [userId],
      );
      await client.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt],
      );
    });
  }

  async resetPassword(tokenHash: string, passwordHash: string): Promise<UserRow | undefined> {
    return this.db.transaction(async (client) => {
      const tokenResult = await client.query<{ user_id: string }>(
        `UPDATE password_reset_tokens
         SET consumed_at = NOW()
         WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > NOW()
         RETURNING user_id`,
        [tokenHash],
      );
      const token = tokenResult.rows[0];
      if (!token) return undefined;

      const userResult = await client.query<UserRow>(
        `UPDATE users SET password_hash = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING id, full_name, email, normalized_email, password_hash, role, status,
                   email_verified_at, terms_accepted_at, last_login_at, created_at, updated_at`,
        [token.user_id, passwordHash],
      );
      await client.query(
        `UPDATE sessions SET revoked_at = COALESCE(revoked_at, NOW())
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [token.user_id],
      );
      return userResult.rows[0];
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<AccountRow | undefined> {
    return this.db.transaction(async (client) => {
      const userFields: string[] = [];
      const userValues: unknown[] = [userId];
      if (dto.fullName !== undefined) { userFields.push(`full_name = $${userValues.length + 1}`); userValues.push(dto.fullName); }
      if (userFields.length > 0) {
        userFields.push("updated_at = NOW()");
        await client.query(`UPDATE users SET ${userFields.join(", ")} WHERE id = $1`, userValues);
      }

      const profileFields: string[] = [];
      const profileValues: unknown[] = [userId];
      const profileValuesMap: Array<[keyof UpdateProfileDto, string]> = [
        ["companyName", "company_name"],
        ["workloadType", "workload_type"],
        ["billingEmail", "billing_email"],
        ["preferredCurrency", "preferred_currency"],
        ["timezone", "timezone"],
      ];
      for (const [property, column] of profileValuesMap) {
        const value = dto[property];
        if (value !== undefined) {
          profileFields.push(`${column} = $${profileValues.length + 1}`);
          profileValues.push(value);
        }
      }
      if (profileFields.length > 0) {
        profileFields.push("updated_at = NOW()");
        await client.query(
          `UPDATE customer_profiles SET ${profileFields.join(", ")} WHERE user_id = $1`,
          profileValues,
        );
      }
      const result = await client.query<AccountRow>(
        `SELECT u.id, u.full_name, u.email, u.normalized_email, u.password_hash,
                u.role, u.status, u.email_verified_at, u.terms_accepted_at,
                u.last_login_at, u.created_at, u.updated_at,
                cp.organization_id, cp.company_name, cp.workload_type,
                cp.preferred_currency, cp.billing_email, cp.timezone
         FROM users u LEFT JOIN customer_profiles cp ON cp.user_id = u.id
         WHERE u.id = $1`,
        [userId],
      );
      return result.rows[0];
    });
  }

  async findMembership(userId: string, organizationId: string): Promise<{ member_role: string } | undefined> {
    const result = await this.db.query<{ member_role: string }>(
      `SELECT om.member_role FROM organization_members om
       JOIN organizations o ON o.id = om.organization_id AND o.status = 'active'
       JOIN users u ON u.id = om.user_id AND u.status = 'active'
       WHERE om.user_id = $1 AND om.organization_id = $2`,
      [userId, organizationId],
    );
    return result.rows[0];
  }
}
