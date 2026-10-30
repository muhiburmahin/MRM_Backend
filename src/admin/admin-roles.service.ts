import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

const ROLE_SELECT = {
  id: true,
  key: true,
  name: true,
  description: true,
  isSystem: true,
  permissions: {
    select: { permission: { select: { key: true, group: true, description: true } } },
  },
  _count: { select: { users: true, invites: true } },
} satisfies Prisma.RoleSelect;

@Injectable()
export class AdminRolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const roles = await this.prisma.role.findMany({
      select: ROLE_SELECT,
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return roles.map(({ permissions, ...role }) => ({
      ...role,
      permissionKeys: permissions.map(({ permission }) => permission.key).sort(),
      permissions: permissions.map(({ permission }) => permission),
    }));
  }

  findPermissions() {
    return this.prisma.permission.findMany({
      select: { id: true, key: true, group: true, description: true },
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
  }

  async create(dto: CreateRoleDto, actor: AuthenticatedUser) {
    if (dto.key === 'owner' && actor.role.key !== 'owner') {
      throw new ForbiddenException('Only an owner can create the owner role');
    }
    return this.prisma.$transaction(async (tx) => {
      const permissions = await this.resolvePermissions(tx, dto.permissionKeys);
      this.assertGrantable(
        permissions.map(({ key }) => key),
        actor,
      );
      const created = await tx.role.create({
        data: {
          key: dto.key,
          name: dto.name,
          description: dto.description,
        },
        select: { id: true },
      });
      if (permissions.length) {
        await tx.rolePermission.createMany({
          data: permissions.map(({ id: permissionId }) => ({ roleId: created.id, permissionId })),
        });
      }
      const role = await tx.role.findUniqueOrThrow({
        where: { id: created.id },
        select: ROLE_SELECT,
      });
      await this.writeAudit(tx, actor.id, 'role.created', role.id, {
        key: dto.key,
        permissionKeys: dto.permissionKeys,
      });
      return this.mapRole(role);
    });
  }

  async update(id: string, dto: UpdateRoleDto, actor: AuthenticatedUser) {
    if (Object.keys(dto).length === 0)
      throw new BadRequestException('Provide at least one field to update');
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.role.findUnique({ where: { id }, select: { id: true, key: true } });
      if (!current) throw new NotFoundException('Role not found');
      if (current.key === 'owner' && actor.role.key !== 'owner') {
        throw new ForbiddenException('Only an owner can manage the owner role');
      }
      const permissions =
        dto.permissionKeys === undefined
          ? undefined
          : await this.resolvePermissions(tx, dto.permissionKeys);
      if (permissions)
        this.assertGrantable(
          permissions.map(({ key }) => key),
          actor,
        );
      if (
        current.key === 'owner' &&
        permissions &&
        actor.permissions.some((key) => !permissions.some((permission) => permission.key === key))
      ) {
        throw new ConflictException('The owner role must retain all of its current permissions');
      }
      if (permissions) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        if (permissions.length) {
          await tx.rolePermission.createMany({
            data: permissions.map(({ id: permissionId }) => ({ roleId: id, permissionId })),
          });
        }
      }
      const role = await tx.role.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
        },
        select: ROLE_SELECT,
      });
      await this.writeAudit(tx, actor.id, 'role.updated', id, {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.permissionKeys !== undefined ? { permissionKeys: dto.permissionKeys } : {}),
      });
      return this.mapRole(role);
    });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({
        where: { id },
        select: {
          id: true,
          key: true,
          isSystem: true,
          _count: { select: { users: true, invites: true } },
        },
      });
      if (!role) throw new NotFoundException('Role not found');
      if (role.isSystem) throw new ConflictException('System roles cannot be deleted');
      if (role._count.users || role._count.invites) {
        throw new ConflictException('A role assigned to users or invitations cannot be deleted');
      }

      await tx.role.delete({ where: { id } });
      await this.writeAudit(tx, actor.id, 'role.deleted', id, { key: role.key });
      return { message: 'Role deleted' };
    });
  }

  private async resolvePermissions(tx: Prisma.TransactionClient, keys: string[]) {
    const permissions = await tx.permission.findMany({
      where: { key: { in: keys } },
      select: { id: true, key: true },
    });
    if (permissions.length !== keys.length) {
      const found = new Set(permissions.map(({ key }) => key));
      const unknown = keys.filter((key) => !found.has(key));
      throw new BadRequestException({ message: 'Unknown permission keys', unknown });
    }
    return permissions;
  }

  private mapRole(role: Prisma.RoleGetPayload<{ select: typeof ROLE_SELECT }>) {
    const { permissions, ...details } = role;
    return {
      ...details,
      permissionKeys: permissions.map(({ permission }) => permission.key).sort(),
      permissions: permissions.map(({ permission }) => permission),
    };
  }

  private writeAudit(
    tx: Prisma.TransactionClient,
    actorId: string,
    action: string,
    entityId: string,
    diff?: Record<string, unknown>,
  ) {
    return tx.auditLog.create({
      data: {
        actorId,
        action,
        entityType: 'role',
        entityId,
        ...(diff ? { diff: diff as Prisma.InputJsonValue } : {}),
      },
    });
  }

  private assertGrantable(permissionKeys: string[], actor: AuthenticatedUser): void {
    if (
      actor.role.key !== 'owner' &&
      permissionKeys.some((key) => !actor.permissions.includes(key))
    ) {
      throw new ForbiddenException('You cannot grant permissions you do not have');
    }
  }
}
