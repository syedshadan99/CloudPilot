import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "../../../common/auth/authenticated-principal.js";
import { AuthorizationService } from "../../identity/services/authorization.service.js";
import { CapacityService } from "./capacity.service.js";
import { CatalogRepository, type TemplateRow } from "../repositories/catalog.repository.js";
import type { CatalogQueryDto, CreateVmTemplateDto, UpdateVmTemplateDto } from "../dto/catalog.dto.js";

@Injectable()
export class CatalogService {
  constructor(
    private readonly repo: CatalogRepository,
    private readonly authorization: AuthorizationService,
    private readonly capacity: CapacityService,
  ) {}

  async listCustomer(query: CatalogQueryDto) {
    const result = await this.repo.listCustomerTemplates(query as unknown as Record<string, unknown>);
    return { data: result.rows.map((row) => this.publicTemplate(row)), pagination: { page: query.page, pageSize: query.pageSize, total: result.total } };
  }

  async getCustomer(id: string) {
    const row = await this.repo.findCustomerTemplate(id);
    if (!row) throw new NotFoundException("VM template not found");
    return this.publicTemplate(row);
  }

  async listProvider(user: AuthenticatedPrincipal, organizationId: string, page: number, pageSize: number) {
    await this.assertMember(user, organizationId);
    const result = await this.repo.listProviderTemplates(organizationId, page, pageSize);
    return { data: result.rows.map((row) => this.providerTemplate(row)), pagination: { page, pageSize, total: result.total } };
  }

  async getProvider(user: AuthenticatedPrincipal, organizationId: string, id: string) {
    await this.assertMember(user, organizationId);
    const row = await this.repo.findProviderTemplate(id, organizationId);
    if (!row) throw new NotFoundException("VM template not found");
    return this.providerTemplate(row);
  }

  async create(user: AuthenticatedPrincipal, dto: CreateVmTemplateDto) {
    await this.assertAdmin(user, dto.organizationId);
    if (dto.availability === "retired" && dto.active === true) throw new BadRequestException("A retired template cannot be active");
    try {
      const row = await this.repo.createTemplate({ ...dto, createdBy: user.userId });
      return this.providerTemplate(row);
    } catch (error) {
      this.translateRepositoryError(error);
      if (this.isUniqueViolation(error)) throw new ConflictException("A template with this slug already exists in this organization");
      throw error;
    }
  }

  async update(user: AuthenticatedPrincipal, organizationId: string, id: string, dto: UpdateVmTemplateDto) {
    await this.assertAdmin(user, organizationId);
    if (dto.availability === "retired" && dto.active === true) throw new BadRequestException("A retired template cannot be active");
    try {
      const row = await this.repo.updateTemplate(id, organizationId, dto as unknown as Record<string, unknown>, user.userId);
      if (!row) throw new NotFoundException("VM template not found");
      return this.providerTemplate(row);
    } catch (error) {
      this.translateRepositoryError(error);
      if (this.isUniqueViolation(error)) throw new ConflictException("A template with this slug already exists in this organization");
      throw error;
    }
  }

  async state(user: AuthenticatedPrincipal, organizationId: string, id: string, state: { active?: boolean; availability?: "available" | "limited" | "unavailable" | "retired" }) {
    await this.assertAdmin(user, organizationId);
    const current = await this.repo.findProviderTemplate(id, organizationId);
    if (!current) throw new NotFoundException("VM template not found");
    if (current.availability === "retired" && state.active === true) throw new ConflictException("Retired templates cannot be reactivated");
    if (state.availability === "retired") state.active = false;
    const row = await this.repo.setTemplateState(id, organizationId, state, user.userId);
    if (!row) throw new NotFoundException("VM template not found");
    return this.providerTemplate(row);
  }

  async checkTemplateCapacity(template: TemplateRow) {
    if (!template.capacity_pool_id) return this.capacity.check({ organizationId: template.organization_id, region: template.region, cpuCores: template.cpu_cores, ramGb: template.ram_gb, storageGb: template.storage_gb });
    return this.capacity.check({ organizationId: template.organization_id, region: template.region, cpuCores: template.cpu_cores, ramGb: template.ram_gb, storageGb: template.storage_gb });
  }

  private publicTemplate(row: TemplateRow) {
    return {
      id: row.id, providerOrganizationId: row.organization_id, providerName: row.organization_name,
      name: row.name, slug: row.slug, description: row.description, cpuCores: row.cpu_cores, ramGb: row.ram_gb,
      storageGb: row.storage_gb, storageType: row.storage_type, operatingSystem: row.operating_system,
      bandwidthMbps: row.bandwidth_mbps, region: row.region, availability: row.availability,
      eligibleForQuote: row.active && (row.availability === "available" || row.availability === "limited"),
      pricing: row.pricing_version_id && row.currency ? {
        pricingVersionId: row.pricing_version_id, currency: row.currency, hourlyRate: row.hourly_rate,
        dailyRate: row.daily_rate, monthlyRate: row.monthly_rate,
      } : null,
    };
  }

  private providerTemplate(row: TemplateRow) {
    return { ...this.publicTemplate(row), active: row.active, currentPricingVersionId: row.current_pricing_version_id, capacityPoolId: row.capacity_pool_id, createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  private async assertMember(user: AuthenticatedPrincipal, organizationId: string): Promise<void> {
    if (user.role !== "provider_admin" && user.role !== "provider_staff") throw new ForbiddenException("Provider role required");
    await this.authorization.assertOrganizationMember(user.userId, organizationId);
  }

  private async assertAdmin(user: AuthenticatedPrincipal, organizationId: string): Promise<void> {
    if (user.role !== "provider_admin") throw new ForbiddenException("Provider administrator role required");
    await this.authorization.assertOrganizationMember(user.userId, organizationId, ["owner", "admin"]);
  }

  private translateRepositoryError(error: unknown): void {
    if (!(error instanceof Error)) return;
    if (error.message === "CROSS_ORGANIZATION_CAPACITY_POOL" || error.message === "CROSS_ORGANIZATION_PRICING_VERSION") throw new BadRequestException("Associated records must belong to the same provider organization");
  }

  private isUniqueViolation(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505"; }
}
