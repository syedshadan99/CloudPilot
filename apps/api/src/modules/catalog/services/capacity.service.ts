import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { AuthorizationService } from "../../identity/services/authorization.service.js";
import type { AuthenticatedPrincipal } from "../../../common/auth/authenticated-principal.js";
import type { CreateCapacityPoolDto, UpdateCapacityPoolDto } from "../dto/catalog.dto.js";
import { CatalogRepository } from "../repositories/catalog.repository.js";

export interface CapacityRequest {
  organizationId: string;
  region: string;
  cpuCores: number;
  ramGb: number;
  storageGb: number;
}

@Injectable()
export class CapacityService {
  constructor(
    private readonly repo: CatalogRepository,
    private readonly authorization: AuthorizationService,
  ) {}

  async list(user: AuthenticatedPrincipal, organizationId: string, page: number, pageSize: number) {
    await this.assertProviderMember(user, organizationId);
    const result = await this.repo.listPools(organizationId, page, pageSize);
    return { data: result.rows.map((row) => this.publicPool(row)), pagination: { page, pageSize, total: result.total } };
  }

  async create(user: AuthenticatedPrincipal, dto: CreateCapacityPoolDto) {
    await this.assertProviderAdmin(user, dto.organizationId);
    try {
      const row = await this.repo.createPool({ ...dto, createdBy: user.userId });
      return this.publicPool(row);
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException("A capacity pool with this name already exists in the region");
      throw error;
    }
  }

  async get(user: AuthenticatedPrincipal, organizationId: string, id: string) {
    await this.assertProviderMember(user, organizationId);
    const row = await this.repo.findPool(id, organizationId);
    if (!row) throw new BadRequestException("Capacity pool was not found in this organization");
    return this.withUtilization(row);
  }

  async update(user: AuthenticatedPrincipal, organizationId: string, id: string, dto: UpdateCapacityPoolDto) {
    await this.assertProviderAdmin(user, organizationId);
    try {
      const row = await this.repo.updatePool(id, organizationId, dto as unknown as Record<string, unknown>, user.userId);
      if (!row) throw new BadRequestException("Capacity pool was not found in this organization");
      return this.withUtilization(row);
    } catch (error) {
      if (error instanceof Error && error.message === "CAPACITY_SHRINK_BELOW_ALLOCATIONS") {
        throw new ConflictException("Capacity cannot be reduced below active committed or unexpired held allocations");
      }
      if (error instanceof Error && error.message === "CAPACITY_REGION_IN_USE") {
        throw new ConflictException("Capacity pool region cannot change while templates are attached");
      }
      if (this.isUniqueViolation(error)) throw new ConflictException("A capacity pool with this name already exists in the region");
      throw error;
    }
  }

  async availability(user: AuthenticatedPrincipal, organizationId: string, poolId: string, request: CapacityRequest) {
    await this.assertProviderMember(user, organizationId);
    const pool = await this.repo.findPool(poolId, organizationId);
    if (!pool) throw new BadRequestException("Capacity pool was not found in this organization");
    if (!pool.available) return { available: false, reason: "This simulated capacity pool is disabled" };
    if (pool.region !== request.region) return { available: false, reason: "Requested region does not match this capacity pool" };
    const usage = await this.repo.capacityUsage(poolId);
    const remaining = {
      cpuCores: Math.max(0, pool.total_cpu_cores - Number(usage.cpu_used)),
      ramGb: Math.max(0, pool.total_ram_gb - Number(usage.ram_used)),
      storageGb: Math.max(0, pool.total_storage_gb - Number(usage.storage_used)),
    };
    return remaining.cpuCores >= request.cpuCores && remaining.ramGb >= request.ramGb && remaining.storageGb >= request.storageGb
      ? { available: true, poolId, remaining }
      : { available: false, poolId, remaining, reason: "Requested CPU, RAM and storage exceed this pool's free capacity" };
  }

  async check(request: CapacityRequest): Promise<{ available: boolean; reason?: string; poolId?: string; remaining?: { cpuCores: number; ramGb: number; storageGb: number } }> {
    if (![request.cpuCores, request.ramGb, request.storageGb].every((value) => Number.isInteger(value) && value > 0)) {
      throw new BadRequestException("Capacity quantities must be positive integers");
    }
    const pools = await this.repo.poolsForAvailability(request.organizationId, request.region);
    if (pools.length === 0) return { available: false, reason: "No enabled simulated capacity pool exists in this region" };
    for (const pool of pools) {
      const remaining = {
        cpuCores: Math.max(0, pool.total_cpu_cores - Number(pool.cpu_used)),
        ramGb: Math.max(0, pool.total_ram_gb - Number(pool.ram_used)),
        storageGb: Math.max(0, pool.total_storage_gb - Number(pool.storage_used)),
      };
      if (remaining.cpuCores >= request.cpuCores && remaining.ramGb >= request.ramGb && remaining.storageGb >= request.storageGb) {
        return { available: true, poolId: pool.id, remaining };
      }
    }
    return { available: false, reason: "Requested CPU, RAM and storage do not fit in an enabled simulated pool" };
  }

  private async withUtilization(row: Awaited<ReturnType<CatalogRepository["findPool"]>> & object) {
    const usage = await this.repo.capacityUsage(row.id);
    return {
      ...this.publicPool(row),
      utilization: {
        cpuUsed: Number(usage.cpu_used), ramUsedGb: Number(usage.ram_used), storageUsedGb: Number(usage.storage_used),
        cpuRemaining: Math.max(0, row.total_cpu_cores - Number(usage.cpu_used)),
        ramRemainingGb: Math.max(0, row.total_ram_gb - Number(usage.ram_used)),
        storageRemainingGb: Math.max(0, row.total_storage_gb - Number(usage.storage_used)),
        activeHeldReservations: Number(usage.held_count),
        committedReservations: Number(usage.committed_count),
      },
    };
  }

  private publicPool(row: NonNullable<Awaited<ReturnType<CatalogRepository["findPool"]>>>) {
    return {
      id: row.id, organizationId: row.organization_id, name: row.name, region: row.region,
      totalCpuCores: row.total_cpu_cores, totalRamGb: row.total_ram_gb, totalStorageGb: row.total_storage_gb,
      available: row.available, createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  private async assertProviderMember(user: AuthenticatedPrincipal, organizationId: string): Promise<void> {
    if (user.role !== "provider_admin" && user.role !== "provider_staff") throw new ForbiddenException("Provider role required");
    await this.authorization.assertOrganizationMember(user.userId, organizationId);
  }

  private async assertProviderAdmin(user: AuthenticatedPrincipal, organizationId: string): Promise<void> {
    if (user.role !== "provider_admin") throw new ForbiddenException("Provider administrator role required");
    await this.authorization.assertOrganizationMember(user.userId, organizationId, ["owner", "admin"]);
  }

  private isUniqueViolation(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505"; }
}
