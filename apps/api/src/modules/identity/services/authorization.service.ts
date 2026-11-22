import { ForbiddenException, Injectable } from "@nestjs/common";
import { IdentityRepository } from "../repositories/identity.repository.js";

@Injectable()
export class AuthorizationService {
  constructor(private readonly repo: IdentityRepository) {}

  async assertOrganizationMember(userId: string, organizationId: string, allowedRoles?: string[]): Promise<void> {
    const membership = await this.repo.findMembership(userId, organizationId);
    if (!membership || (allowedRoles && !allowedRoles.includes(membership.member_role))) {
      throw new ForbiddenException("Organization access is not permitted");
    }
  }
}
