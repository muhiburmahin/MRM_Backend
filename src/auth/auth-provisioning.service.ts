import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PasswordService } from './password.service';

/** One-off, explicit provisioning of the FIRST owner. Never exposed over HTTP. */
@Injectable()
export class AuthProvisioningService {
  private readonly logger = new Logger(AuthProvisioningService.name);
  constructor(private readonly prisma: PrismaService, private readonly passwords: PasswordService) {}

  async provisionOwner(input: { email: string; password: string; name?: string }): Promise<{ created: boolean; reason?: string }> {
    const email = input.email.trim().toLowerCase();

    const existingUsers = await this.prisma.user.count({ where: { deletedAt: null } });
    if (existingUsers > 0) {
      return { created: false, reason: 'A user already exists; first-owner provisioning is disabled.' };
    }

    const role = await this.prisma.role.findUnique({ where: { key: 'owner' } });
    if (!role) throw new Error('Role "owner" not found. Run the database seed (roles/permissions) first.');

    // Never promote or modify an existing account.
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new Error('A user with this email already exists; refusing to change its role.');
    }

    const problems = this.passwords.validatePolicy(input.password, { email });
    if (problems.length) throw new Error(`Initial password rejected: ${problems.join('; ')}`);

    const user = await this.prisma.user.create({
      data: {
        email,
        name: input.name?.trim() || 'Owner',
        passwordHash: await this.passwords.hash(input.password),
        roleId: role.id,
        mustChangePassword: true,
      },
      select: { id: true },
    });
    await this.prisma.auditLog.create({ data: { actorId: null, action: 'user.owner_provisioned', entityType: 'user', entityId: user.id } });
    this.logger.log(`Owner account created (${user.id}). Password change is required at first login.`);
    return { created: true };
  }
}
