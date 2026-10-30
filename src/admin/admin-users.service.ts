import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PasswordService } from '../auth/password.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { generateSessionToken, hashToken } from '../auth/utils/token.util';
import { QueryUsersDto } from './dto/admin-query.dto';
import { InviteUserDto, QueryInvitesDto } from './dto/invite-user.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { ChangeUserRoleDto, UpdateUserDto, UpdateUserStatusDto } from './dto/update-user.dto';

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  uiLocale: true,
  isActive: true,
  twoFactorEnabled: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, key: true, name: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async acceptInvite(dto: AcceptInviteDto) {
    const tokenHashValue = hashToken(dto.token);
    const invite = await this.prisma.userInvite.findUnique({
      where: { tokenHash: tokenHashValue },
      select: { id: true, email: true, roleId: true, expiresAt: true, acceptedAt: true },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt <= new Date()) {
      throw new BadRequestException('Invitation is invalid or expired');
    }

    const problems = this.passwords.validatePolicy(dto.password, { email: invite.email });
    if (problems.length) {
      throw new BadRequestException({ message: 'Password does not meet the policy', problems });
    }
    const passwordHash = await this.passwords.hash(dto.password);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findFirst({
        where: { email: { equals: invite.email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existingUser) throw new ConflictException('An account with this email already exists');
      const claimed = await tx.userInvite.updateMany({
        where: { id: invite.id, acceptedAt: null, expiresAt: { gt: now } },
        data: { acceptedAt: now },
      });
      if (claimed.count !== 1) throw new BadRequestException('Invitation is invalid or expired');

      const user = await tx.user.create({
        data: {
          email: invite.email,
          name: dto.name.trim(),
          passwordHash,
          roleId: invite.roleId,
        },
        select: SAFE_USER_SELECT,
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'user.invite_accepted',
          entityType: 'user',
          entityId: user.id,
        },
      });
      return user;
    });
  }

  async invite(dto: InviteUserDto, actor: AuthenticatedUser) {
    const email = dto.email.trim().toLowerCase();
    const [existing, role] = await Promise.all([
      this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      }),
      this.prisma.role.findUnique({
        where: { id: dto.roleId },
        select: {
          id: true,
          key: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      }),
    ]);
    if (existing) throw new ConflictException('A user with this email already exists');
    if (!role) throw new NotFoundException('Role not found');
    this.assertRoleGrantable(
      role.key,
      role.permissions.map(({ permission }) => permission.key),
      actor,
    );

    const token = generateSessionToken();
    const invitation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.userInvite.create({
        data: {
          email,
          roleId: role.id,
          invitedById: actor.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + dto.expiresInHours * 3_600_000),
        },
        select: {
          id: true,
          email: true,
          role: { select: { id: true, key: true, name: true } },
          expiresAt: true,
          createdAt: true,
        },
      });
      await this.writeAudit(tx, actor.id, 'user.invited', created.id, {
        email,
        roleId: role.id,
        expiresAt: created.expiresAt.toISOString(),
      });
      return created;
    });

    return { ...invitation, token };
  }

  async findInvites(query: QueryInvitesDto) {
    const now = new Date();
    const where: Prisma.UserInviteWhereInput = {
      ...(query.status === 'pending'
        ? { acceptedAt: null, expiresAt: { gt: now } }
        : query.status === 'accepted'
          ? { acceptedAt: { not: null } }
          : query.status === 'expired'
            ? { acceptedAt: null, expiresAt: { lte: now } }
            : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.userInvite.findMany({
        where,
        select: {
          id: true,
          email: true,
          expiresAt: true,
          acceptedAt: true,
          createdAt: true,
          role: { select: { id: true, key: true, name: true } },
          invitedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: query.sortOrder },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.userInvite.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async revokeInvite(id: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const invite = await tx.userInvite.findUnique({
        where: { id },
        select: { id: true, email: true, acceptedAt: true },
      });
      if (!invite) throw new NotFoundException('Invitation not found');
      if (invite.acceptedAt)
        throw new ConflictException('An accepted invitation cannot be revoked');
      await tx.userInvite.delete({ where: { id } });
      await this.writeAudit(tx, actor.id, 'user.invitation_revoked', id, { email: invite.email });
      return { message: 'Invitation revoked' };
    });
  }

  async findAll(query: QueryUsersDto) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.roleId ? { roleId: query.roleId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: SAFE_USER_SELECT,
        orderBy: { createdAt: query.sortOrder },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: SAFE_USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthenticatedUser) {
    if (Object.keys(dto).length === 0)
      throw new BadRequestException('Provide at least one field to update');
    await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: dto,
        select: SAFE_USER_SELECT,
      });
      await this.writeAudit(tx, actor.id, 'user.updated', id, { ...dto });
      return user;
    });
  }

  async updateStatus(id: string, dto: UpdateUserStatusDto, actor: AuthenticatedUser) {
    const current = await this.findOne(id);
    if (actor.id === id && !dto.isActive) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }
    if (current.isActive === dto.isActive) return current;

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.user.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, roleId: true, role: { select: { key: true } } },
      });
      if (!row) throw new NotFoundException('User not found');
      if (!dto.isActive && row.role.key === 'owner' && actor.role.key !== 'owner') {
        throw new ForbiddenException('Only an owner can deactivate another owner');
      }
      if (!dto.isActive) await this.assertAnotherOwnerExists(tx, row.roleId, row.role.key);

      const [user] = await Promise.all([
        tx.user.update({
          where: { id },
          data: { isActive: dto.isActive },
          select: SAFE_USER_SELECT,
        }),
        !dto.isActive
          ? tx.session.updateMany({
              where: { userId: id, revokedAt: null },
              data: { revokedAt: new Date() },
            })
          : Promise.resolve(null),
      ]);
      await this.writeAudit(tx, actor.id, dto.isActive ? 'user.activated' : 'user.deactivated', id);
      return user;
    });
  }

  async changeRole(id: string, dto: ChangeUserRoleDto, actor: AuthenticatedUser) {
    if (actor.id === id) throw new ForbiddenException('You cannot change your own role');
    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
      select: {
        id: true,
        key: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });
    if (!role) throw new NotFoundException('Role not found');
    this.assertRoleGrantable(
      role.key,
      role.permissions.map(({ permission }) => permission.key),
      actor,
    );

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, roleId: true, role: { select: { key: true } } },
      });
      if (!current) throw new NotFoundException('User not found');
      if (current.role.key === 'owner' && actor.role.key !== 'owner') {
        throw new ForbiddenException('Only an owner can change another owner role');
      }
      if (current.roleId === role.id)
        return tx.user.findUniqueOrThrow({ where: { id }, select: SAFE_USER_SELECT });
      await this.assertAnotherOwnerExists(tx, current.roleId, current.role.key);

      const user = await tx.user.update({
        where: { id },
        data: { roleId: role.id },
        select: SAFE_USER_SELECT,
      });
      await this.writeAudit(tx, actor.id, 'user.role_changed', id, {
        fromRoleId: current.roleId,
        toRoleId: role.id,
      });
      return user;
    });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    if (actor.id === id) throw new ForbiddenException('You cannot delete your own account');
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, roleId: true, role: { select: { key: true } } },
      });
      if (!current) throw new NotFoundException('User not found');
      if (current.role.key === 'owner' && actor.role.key !== 'owner') {
        throw new ForbiddenException('Only an owner can delete another owner');
      }
      await this.assertAnotherOwnerExists(tx, current.roleId, current.role.key);

      const now = new Date();
      await tx.user.update({ where: { id }, data: { isActive: false, deletedAt: now } });
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.writeAudit(tx, actor.id, 'user.deleted', id);
      return { message: 'User deleted' };
    });
  }

  async revokeSessions(id: string, actor: AuthenticatedUser) {
    if (actor.id === id) throw new ForbiddenException('You cannot revoke your own current session');
    const user = await this.findOne(id);
    if (user.role.key === 'owner' && actor.role.key !== 'owner') {
      throw new ForbiddenException("Only an owner can revoke another owner's sessions");
    }
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.writeAudit(tx, actor.id, 'user.sessions_revoked', id, { count: result.count });
      return { revoked: result.count };
    });
  }

  private async assertAnotherOwnerExists(
    tx: Prisma.TransactionClient,
    roleId: string,
    roleKey: string,
  ): Promise<void> {
    if (roleKey !== 'owner') return;
    const owners = await tx.user.count({ where: { roleId, isActive: true, deletedAt: null } });
    if (owners <= 1)
      throw new ConflictException('The last active owner cannot be removed or deactivated');
  }

  private assertRoleGrantable(
    roleKey: string,
    permissionKeys: string[],
    actor: AuthenticatedUser,
  ): void {
    if (actor.role.key === 'owner') return;
    if (roleKey === 'owner' || permissionKeys.some((key) => !actor.permissions.includes(key))) {
      throw new ForbiddenException(
        'You cannot assign a role with greater privileges than your own',
      );
    }
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    actorId: string,
    action: string,
    entityId: string,
    diff?: Record<string, unknown>,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorId,
        action,
        entityType: 'user',
        entityId,
        ...(diff ? { diff: diff as Prisma.InputJsonValue } : {}),
      },
    });
  }
}
