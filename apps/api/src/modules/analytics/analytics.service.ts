import { ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "../../common/auth/authenticated-principal.js";
import { AuthorizationService } from "../identity/services/authorization.service.js";
import { ProviderRepository } from "../provider/provider.repository.js";
import { ProviderService } from "../provider/provider.service.js";
import type { ProviderReportQueryDto } from "../provider/dto/provider.dto.js";
import { validateProviderReportWindow } from "../provider/report-window.js";

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
    const [invoices, invoiceStatusCounts] = await Promise.all([
      this.repo.invoiceAllocations(query.organizationId, query, query.page, query.pageSize),
      this.repo.invoiceStatusCounts(query.organizationId, query),
    ]);
    return { byCurrency: await this.repo.financialSummary(query.organizationId, query), invoiceStatusCounts, invoices: { data: invoices.rows, pagination: { page: query.page, pageSize: query.pageSize, total: invoices.total } } };
  }

  private async assertMember(user: AuthenticatedPrincipal, query: ProviderReportQueryDto) {
    if (user.role !== "provider_admin" && user.role !== "provider_staff") throw new ForbiddenException("Provider role required");
    await this.authorization.assertOrganizationMember(user.userId, query.organizationId);
  }

  private validateWindow(query: ProviderReportQueryDto) {
    validateProviderReportWindow(query.from, query.to);
  }
}
