import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser, Roles } from "../../../common/decorators/index.js";
import type { AuthenticatedPrincipal } from "../../../common/auth/authenticated-principal.js";
import { CatalogService } from "../services/catalog.service.js";
import { CatalogQueryDto, CreateVmTemplateDto, ProviderOrganizationQueryDto, UpdateVmTemplateDto } from "../dto/catalog.dto.js";

@Controller("vm-templates")
@Roles("customer")
export class CustomerCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Query() query: CatalogQueryDto) { return this.catalog.listCustomer(query); }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string) { return this.catalog.getCustomer(id); }
}

@Controller("provider/vm-templates")
@Roles("provider_admin", "provider_staff")
export class ProviderCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedPrincipal, @Query() query: ProviderOrganizationQueryDto) { return this.catalog.listProvider(user, query.organizationId, query.page, query.pageSize); }

  @Get(":id")
  get(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Query() query: ProviderOrganizationQueryDto) { return this.catalog.getProvider(user, query.organizationId, id); }

  @Post()
  create(@CurrentUser() user: AuthenticatedPrincipal, @Body() dto: CreateVmTemplateDto) { return this.catalog.create(user, dto); }

  @Patch(":id")
  update(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Query() query: ProviderOrganizationQueryDto, @Body() dto: UpdateVmTemplateDto) { return this.catalog.update(user, query.organizationId, id, dto); }

  @Post(":id/activate")
  activate(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Query() query: ProviderOrganizationQueryDto) { return this.catalog.state(user, query.organizationId, id, { active: true, availability: "available" }); }

  @Post(":id/deactivate")
  deactivate(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Query() query: ProviderOrganizationQueryDto) { return this.catalog.state(user, query.organizationId, id, { active: false }); }

  @Post(":id/retire")
  retire(@CurrentUser() user: AuthenticatedPrincipal, @Param("id", ParseUUIDPipe) id: string, @Query() query: ProviderOrganizationQueryDto) { return this.catalog.state(user, query.organizationId, id, { active: false, availability: "retired" }); }
}
