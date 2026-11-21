import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UsageRepository } from "./usage.repository.js";
import { VmsRepository } from "../vms/vms.repository.js";

@Injectable()
export class UsageService {
  constructor(
    private readonly usageRepo: UsageRepository,
    private readonly vmsRepo: VmsRepository,
  ) {}

  /**
   * Return usage records for a VM after verifying ownership.
   */
  async getUsage(vmId: string, customerId: string, limit = 48) {
    const vm = await this.vmsRepo.findById(vmId);
    if (!vm) throw new NotFoundException(`VM ${vmId} not found`);
    if (vm.customer_id !== customerId) {
      throw new ForbiddenException("You do not own this VM");
    }
    return this.usageRepo.listByVm(vmId, limit);
  }

  /**
   * Write a usage tick for the current UTC hour.
   * Idempotent — safe to call multiple times in the same hour.
   */
  async recordTick(vmId: string) {
    return this.usageRepo.generateHourlyTick(vmId);
  }
}
