import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { AuthorizationService } from "../identity/services/authorization.service.js";
import { ProviderRepository } from "../provider/provider.repository.js";
import { ProviderService } from "../provider/provider.service.js";
import type { ProviderReportQueryDto } from "../provider/dto/provider.dto.js";

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly repo: ProviderRepository,
    private readonly provider: ProviderService,
    private readonly authorization: AuthorizationService,
  ) {}

  async overview(user: AuthenticatedPrincipal, query: ProviderReportQueryDto) {
    return this.provider.dashboard(user, query);
  }

  async revenue(user: AuthenticatedPrincipal, query: ProviderReportQueryDto) {
    await this.assertMember(user, query);
    this.validateWindow(query);
    return { currencyGroups: await this.repo.financialSummary(query.organizationId, query), trend: await this.repo.revenueTrend(query.organizationId, query), semantics: "Invoiced amounts and verified simulated payments are separate facts; no recognized-revenue claim is made." };
  }

  async deals(user: AuthenticatedPrincipal, query: ProviderReportQueryDto) {
    await this.assertMember(user, query);
    this.validateWindow(query);
    return { byStatus: await this.repo.dealAnalytics(query.organizationId, query), conversion: await this.repo.conversionFunnel(query.organizationId, query) };
  }

  async discounts(user: AuthenticatedPrincipal, query: ProviderReportQueryDto) {
    await this.assertMember(user, query);
    this.validateWindow(query);
    return await this.repo.discountAnalytics(query.organizationId, query);
  }

  async vms(user: AuthenticatedPrincipal, query: ProviderReportQueryDto) {
    await this.assertMember(user, query);
    this.validateWindow(query);
    return this.repo.vmAnalytics(query.organizationId, query);
  }

  async billing(user: AuthenticatedPrincipal, query: ProviderReportQueryDto) {
    await this.assertMember(user, query);
    this.validateWindow(query);
    const invoices = await this.repo.invoiceAllocations(query.organizationId, query, 1, 100);
    return { byCurrency: await this.repo.financialSummary(query.organizationId, query), invoiceStatusCounts: countStatuses(invoices.rows), invoices: { data: invoices.rows, pagination: { page: 1, pageSize: 100, total: invoices.total } } };
  }

  private async assertMember(user: AuthenticatedPrincipal, query: ProviderReportQueryDto) {
    if (user.role !== "provider_admin" && user.role !== "provider_staff") throw new ForbiddenException("Provider role required");
    await this.authorization.assertOrganizationMember(user.userId, query.organizationId);
  }

  private validateWindow(query: ProviderReportQueryDto) {
    if (!query.from || !query.to) return;
    const from = new Date(query.from).getTime();
    const to = new Date(query.to).getTime();
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) throw new BadRequestException("The reporting window must satisfy from < to");
    if (to - from > 366 * 24 * 60 * 60 * 1000) throw new BadRequestException("The reporting window cannot exceed 366 days");
  }
}

function countStatuses(rows: Array<{ status: string }>) {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return counts;
}
