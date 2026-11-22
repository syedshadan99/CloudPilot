import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { IdentityService } from "../identity/services/identity.service.js";
import { ONBOARDING_STEPS } from "../identity/identity.constants.js";
import type { UpdateOnboardingDto } from "./dto/index.js";
import { OnboardingRepository, type OnboardingProgressRow } from "./onboarding.repository.js";

@Injectable()
export class OnboardingService {
  constructor(
    private readonly repo: OnboardingRepository,
    private readonly identity: IdentityService,
  ) {}

  async get(userId: string): Promise<ReturnType<OnboardingService["publicProgress"]>> {
    await this.identity.assertActiveCustomer(userId);
    const progress = await this.repo.findByUserId(userId);
    if (!progress) throw new ConflictException("Onboarding record is missing");
    return this.publicProgress(progress);
  }

  async update(userId: string, dto: UpdateOnboardingDto) {
    await this.identity.assertActiveCustomer(userId);
    const current = await this.repo.findByUserId(userId);
    if (!current) throw new ConflictException("Onboarding record is missing");
    if (current.status === "completed") {
      throw new ConflictException("Completed onboarding cannot be changed");
    }

    const currentIndex = ONBOARDING_STEPS.indexOf(current.current_step as (typeof ONBOARDING_STEPS)[number]);
    const nextStep = dto.currentStep ?? current.current_step;
    const nextIndex = ONBOARDING_STEPS.indexOf(nextStep as (typeof ONBOARDING_STEPS)[number]);
    if (nextIndex < 0 || nextStep === "complete" || nextIndex > currentIndex + 1) {
      throw new BadRequestException("Onboarding can advance only one persisted step at a time");
    }

    const responses = { ...current.responses } as Record<string, string | number>;
    if (dto.workloadType !== undefined) responses.workload = dto.workloadType;
    if (dto.durationDays !== undefined) responses.duration_days = dto.durationDays;
    if (dto.billingCycle !== undefined) responses.billing_cycle = dto.billingCycle;
    if (dto.technicalLevel !== undefined) responses.technical_level = dto.technicalLevel;
    if (dto.preferredCurrency !== undefined) responses.preferred_currency = dto.preferredCurrency;

    const status = dto.skip ? "skipped" : "in_progress";
    const updated = await this.repo.updateProgress(userId, current.updated_at, {
      currentStep: nextStep,
      status,
      responses,
    });
    return this.publicProgress(updated);
  }

  async complete(userId: string) {
    await this.identity.assertActiveCustomer(userId);
    const result = await this.repo.complete(userId);
    if (result.incomplete || !result.progress) {
      throw new BadRequestException("Complete workload, duration, billing cycle and technical level first");
    }
    return this.publicProgress(result.progress);
  }

  private publicProgress(progress: OnboardingProgressRow) {
    return {
      currentStep: progress.current_step,
      status: progress.status,
      responses: progress.responses,
      completedAt: progress.completed_at,
      updatedAt: progress.updated_at,
    };
  }
}
