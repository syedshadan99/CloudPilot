import { BadRequestException } from "@nestjs/common";
import type { VmSpec } from "./pricing-calculator.js";

/**
 * Validates storage safety:
 * Disallows shrinking storage entirely (cloud virtual disk safety standard).
 */
export function validateStorageSafety(oldSpec: VmSpec, newSpec: VmSpec): void {
  if (newSpec.storageGb < oldSpec.storageGb) {
    throw new BadRequestException(
      `Storage cannot be reduced below current allocation of ${oldSpec.storageGb} GB. Disk shrinking is not supported to protect data integrity.`,
    );
  }
}

/**
 * Validates configuration ranges and ensures the requested config actually differs.
 */
export function validateConfigurationChange(oldSpec: VmSpec, newSpec: VmSpec): void {
  if (
    oldSpec.cpuCores === newSpec.cpuCores &&
    oldSpec.ramGb === newSpec.ramGb &&
    oldSpec.storageGb === newSpec.storageGb
  ) {
    throw new BadRequestException("Requested configuration is identical to the current VM configuration.");
  }

  if (!newSpec.cpuCores || newSpec.cpuCores < 1 || newSpec.cpuCores > 64) {
    throw new BadRequestException("Requested CPU cores must be between 1 and 64.");
  }
  if (!newSpec.ramGb || newSpec.ramGb < 1 || newSpec.ramGb > 512) {
    throw new BadRequestException("Requested RAM must be between 1 and 512 GB.");
  }
  if (!newSpec.storageGb || newSpec.storageGb < 10 || newSpec.storageGb > 10240) {
    throw new BadRequestException("Requested storage must be between 10 and 10240 GB.");
  }
}
