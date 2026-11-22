import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser, Roles } from "../../../common/decorators/index.js";
import type { AuthenticatedPrincipal } from "../../../common/auth/authenticated-principal.js";
import { AvailabilityQueryDto, CreateCapacityPoolDto, ProviderOrganizationQueryDto, UpdateCapacityPoolDto } from "../dto/catalog.dto.js";
import { CapacityService } from "../services/capacity.service.js";

@Controller("provider/capacity-pools")
@Roles("provider_admin", "provider_staff")
export class CapacityController {
  constructor(private readonly capacity: CapacityService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: ProviderOrganizationQueryDto) { return this.capacity.list(user, query.organizationId, query.page, query.pageSize); }

  @Post()
  create(@CurrentUser() user: AuthenticatedPrincipal, @Body() dto: CreateCapacityPoolDto) { return this.capacity.create(user, dto); }

  @Get(":id")
  get(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Query() query: ProviderOrganizationQueryDto) { return this.capacity.get(user, query.organizationId, id); }

  @Patch(":id")
  update(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Query() query: ProviderOrganizationQueryDto, @Body() dto: UpdateCapacityPoolDto) { return this.capacity.update(user, query.organizationId, id, dto); }

  @Get(":id/availability")
  availability(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Query() query: AvailabilityQueryDto) {
    return this.capacity.availability(user, query.organizationId, id, { organizationId: query.organizationId, region: query.region, cpuCores: query.cpuCores, ramGb: query.ramGb, storageGb: query.storageGb });
  }
}
