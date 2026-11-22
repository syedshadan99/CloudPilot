import { ConflictException, Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service.js";
import type { ProgressInput } from "../identity/repositories/identity.repository.js";

export interface OnboardingProgressRow {
  user_id: string;
  current_step: string;
  status: "not_started" | "in_progress" | "completed" | "skipped";
  responses: Record<string, unknown>;
  completed_at: Date | null;
  updated_at: Date;
}

@Injectable()
export class OnboardingRepository {
  constructor(private readonly db: DatabaseService) {}

  async findByUserId(userId: string): Promise<OnboardingProgressRow | undefined> {
    const result = await this.db.query<OnboardingProgressRow>(
      `SELECT user_id, current_step, status, responses, completed_at, updated_at
       FROM onboarding_progress WHERE user_id = $1`,
      [userId],
    );
    return result.rows[0];
  }

  async updateProgress(
    userId: string,
    expectedUpdatedAt: Date,
    input: ProgressInput,
  ): Promise<OnboardingProgressRow> {
    const result = await this.db.query<OnboardingProgressRow>(
      `UPDATE onboarding_progress
       SET current_step = $2, status = $3, responses = $4::jsonb, updated_at = NOW()
       WHERE user_id = $1 AND updated_at = $5
       RETURNING user_id, current_step, status, responses, completed_at, updated_at`,
      [userId, input.currentStep, input.status, JSON.stringify(input.responses), expectedUpdatedAt],
    );
    if (!result.rows[0]) {
      throw new ConflictException("Onboarding changed concurrently; reload and retry");
    }
    return result.rows[0];
  }

  async complete(userId: string): Promise<{ progress?: OnboardingProgressRow; incomplete: boolean }> {
    return this.db.transaction(async (client) => {
      const current = await client.query<OnboardingProgressRow>(
        `SELECT user_id, current_step, status, responses, completed_at, updated_at
         FROM onboarding_progress WHERE user_id = $1 FOR UPDATE`,
        [userId],
      );
      const row = current.rows[0];
      if (!row) return { incomplete: true };
      if (row.status === "completed") return { progress: row, incomplete: false };
      const required = ["workload", "duration_days", "billing_cycle", "technical_level"];
      if (!required.every((key) => row.responses[key] !== undefined && row.responses[key] !== null)) {
        return { progress: row, incomplete: true };
      }
      const result = await client.query<OnboardingProgressRow>(
        `UPDATE onboarding_progress
         SET current_step = 'complete', status = 'completed', completed_at = COALESCE(completed_at, NOW()), updated_at = NOW()
         WHERE user_id = $1
         RETURNING user_id, current_step, status, responses, completed_at, updated_at`,
        [userId],
      );
      return { progress: result.rows[0], incomplete: false };
    });
  }
}
