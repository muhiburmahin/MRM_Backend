import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { PrismaService } from '../../../database/prisma.service';
import type {
  CreateNavigationItemDto,
  CreateNavigationMenuDto,
  ReorderNavigationItemsDto,
  UpdateNavigationItemDto,
  UpdateNavigationMenuDto,
} from './navigation.dto';

const RESERVED_MENU_KEYS = new Set(['header', 'footer-company', 'footer-legal']);
const MAX_LABEL_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 1000;
const localizedTextSchema = (maxLength: number) =>
  z
    .record(z.string().min(1).max(10), z.string().trim().min(1).max(maxLength))
    .refine((translations) => Object.keys(translations).length > 0);
const jsonObjectSchema = z.record(z.string(), z.unknown());
const prismaCode = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;

type NavigationRow = {
  id: string;
  menuId: string;
  parentId: string | null;
  label: Prisma.JsonValue;
  description: Prisma.JsonValue | null;
  badge: Prisma.JsonValue | null;
  iconKey: string | null;
  href: string | null;
  pageId: string | null;
  productId: string | null;
  serviceId: string | null;
  newTab: boolean;
  isButton: boolean;
  isVisible: boolean;
  sortOrder: number;
};

type NavigationTreeItem = NavigationRow & { children: NavigationTreeItem[] };
type NavigationItemInput = {
  label?: unknown;
  description?: unknown;
  badge?: unknown;
  href?: string | null;
  iconKey?: string | null;
  pageId?: string | null;
  productId?: string | null;
  serviceId?: string | null;
  parentId?: string | null;
  newTab?: boolean | null;
  isButton?: boolean | null;
  isVisible?: boolean | null;
  sortOrder?: number | null;
};

@Injectable()
export class NavigationService {
  private readonly logger = new Logger(NavigationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listMenus() {
    const menus = await this.prisma.navMenu.findMany({
      orderBy: { key: 'asc' },
      select: { id: true, key: true, _count: { select: { items: true } } },
    });
    return { data: menus };
  }

  async getMenu(key: string) {
    const menu = await this.prisma.navMenu.findUnique({
      where: { key },
      select: { id: true, key: true },
    });
    if (!menu) throw new NotFoundException('Navigation menu not found');
    const items = (await this.prisma.navItem.findMany({
      where: { menuId: menu.id },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        menuId: true,
        parentId: true,
        label: true,
        description: true,
        badge: true,
        iconKey: true,
        href: true,
        pageId: true,
        productId: true,
        serviceId: true,
        newTab: true,
        isButton: true,
        isVisible: true,
        sortOrder: true,
      },
    })) as NavigationRow[];
    return { ...menu, items: this.buildTree(items) };
  }

  async createMenu(dto: CreateNavigationMenuDto, actor: AuthenticatedUser) {
    this.validateMenuKey(dto.key);
    try {
      const menu = await this.prisma.navMenu.create({
        data: { key: dto.key },
        select: { id: true, key: true },
      });
      await this.audit(actor, 'navigation.menu.create', menu.id);
      return menu;
    } catch (error) {
      this.handleDbError(error);
    }
  }

  async updateMenu(key: string, dto: UpdateNavigationMenuDto, actor: AuthenticatedUser) {
    const current = await this.prisma.navMenu.findUnique({
      where: { key },
      select: { id: true, key: true },
    });
    if (!current) throw new NotFoundException('Navigation menu not found');
    if (dto.key === undefined || dto.key === current.key) return current;
    if (RESERVED_MENU_KEYS.has(current.key)) {
      throw new ConflictException('Seeded navigation menu keys cannot be changed');
    }
    this.validateMenuKey(dto.key);
    try {
      const menu = await this.prisma.navMenu.update({
        where: { key },
        data: { key: dto.key },
        select: { id: true, key: true },
      });
      await this.audit(actor, 'navigation.menu.update', menu.id);
      return menu;
    } catch (error) {
      this.handleDbError(error);
    }
  }

  async createItem(key: string, dto: CreateNavigationItemDto, actor: AuthenticatedUser) {
    const menu = await this.requireMenu(key);
    await this.validateItem(dto, menu.id);
    try {
      const item = await this.prisma.navItem.create({
        data: {
          menuId: menu.id,
          parentId: dto.parentId ?? null,
          label: this.toJson(dto.label),
          ...(!dto.description ? {} : { description: this.toJson(dto.description) }),
          ...(!dto.badge ? {} : { badge: this.toJson(dto.badge) }),
          iconKey: dto.iconKey ?? null,
          href: dto.href ?? null,
          pageId: dto.pageId ?? null,
          productId: dto.productId ?? null,
          serviceId: dto.serviceId ?? null,
          newTab: dto.newTab ?? false,
          isButton: dto.isButton ?? false,
          isVisible: dto.isVisible ?? true,
          sortOrder: dto.sortOrder ?? 0,
        },
        select: { id: true },
      });
      await this.audit(actor, 'navigation.item.create', item.id);
      return this.getMenu(key);
    } catch (error) {
      this.handleDbError(error);
    }
  }

  async updateItem(
    key: string,
    itemId: string,
    dto: UpdateNavigationItemDto,
    actor: AuthenticatedUser,
  ) {
    const menu = await this.requireMenu(key);
    const current = await this.prisma.navItem.findFirst({
      where: { id: itemId, menuId: menu.id },
      select: {
        id: true,
        parentId: true,
        label: true,
        description: true,
        badge: true,
        iconKey: true,
        href: true,
        pageId: true,
        productId: true,
        serviceId: true,
        newTab: true,
        isButton: true,
        isVisible: true,
        sortOrder: true,
      },
    });
    if (!current) throw new NotFoundException('Navigation item not found');
    const merged = { ...current, ...dto };
    await this.validateItem(merged, menu.id, itemId);
    try {
      await this.prisma.navItem.update({
        where: { id: itemId },
        data: {
          parentId: dto.parentId,
          label: dto.label === undefined ? undefined : this.toJson(dto.label),
          description:
            dto.description === undefined
              ? undefined
              : dto.description === null
                ? Prisma.DbNull
                : this.toJson(dto.description),
          badge:
            dto.badge === undefined
              ? undefined
              : dto.badge === null
                ? Prisma.DbNull
                : this.toJson(dto.badge),
          iconKey: dto.iconKey,
          href: dto.href,
          pageId: dto.pageId,
          productId: dto.productId,
          serviceId: dto.serviceId,
          newTab: dto.newTab,
          isButton: dto.isButton,
          isVisible: dto.isVisible,
          sortOrder: dto.sortOrder,
        },
      });
      await this.audit(actor, 'navigation.item.update', itemId);
      return this.getMenu(key);
    } catch (error) {
      this.handleDbError(error);
    }
  }

  async reorderItems(key: string, dto: ReorderNavigationItemsDto, actor: AuthenticatedUser) {
    const menu = await this.requireMenu(key);
    const ids = dto.items.map(({ id }) => id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Each navigation item may only appear once in a reorder request',
      );
    }
    const items = await this.prisma.navItem.findMany({
      where: { menuId: menu.id, id: { in: ids } },
      select: { id: true },
    });
    if (items.length !== ids.length) {
      throw new BadRequestException('Every reordered item must belong to the selected menu');
    }
    await this.prisma.$transaction(
      dto.items.map(({ id, sortOrder }) =>
        this.prisma.navItem.update({ where: { id }, data: { sortOrder } }),
      ),
    );
    await this.audit(actor, 'navigation.item.reorder', menu.id);
    return this.getMenu(key);
  }

  async deleteItem(key: string, itemId: string, actor: AuthenticatedUser) {
    const menu = await this.requireMenu(key);
    const item = await this.prisma.navItem.findFirst({
      where: { id: itemId, menuId: menu.id },
      select: { id: true, _count: { select: { children: true } } },
    });
    if (!item) throw new NotFoundException('Navigation item not found');
    if (item._count.children > 0) {
      throw new ConflictException('Move or delete child navigation items first');
    }
    await this.prisma.navItem.delete({ where: { id: itemId } });
    await this.audit(actor, 'navigation.item.delete', itemId);
    return { message: 'Navigation item deleted' };
  }

  private async requireMenu(key: string) {
    const menu = await this.prisma.navMenu.findUnique({
      where: { key },
      select: { id: true, key: true },
    });
    if (!menu) throw new NotFoundException('Navigation menu not found');
    return menu;
  }

  private async validateItem(
    item: NavigationItemInput,
    menuId: string,
    itemId?: string,
  ): Promise<void> {
    await this.validateLocalized(item.label, localizedTextSchema(MAX_LABEL_LENGTH), 'label');
    if (item.description !== undefined && item.description !== null) {
      await this.validateLocalized(
        item.description,
        localizedTextSchema(MAX_DESCRIPTION_LENGTH),
        'description',
      );
    }
    if (item.badge !== undefined && item.badge !== null) {
      await this.validateLocalized(item.badge, localizedTextSchema(MAX_LABEL_LENGTH), 'badge');
    }
    if (
      item.iconKey !== undefined &&
      item.iconKey !== null &&
      (typeof item.iconKey !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.iconKey))
    ) {
      throw new BadRequestException('Navigation icon key is invalid');
    }
    for (const [field, value] of [
      ['newTab', item.newTab],
      ['isButton', item.isButton],
      ['isVisible', item.isVisible],
    ] as const) {
      if (value !== undefined && typeof value !== 'boolean') {
        throw new BadRequestException(`Navigation ${field} must be a boolean`);
      }
    }
    const sortOrder = item.sortOrder;
    if (
      sortOrder !== undefined &&
      (typeof sortOrder !== 'number' ||
        !Number.isInteger(sortOrder) ||
        sortOrder < 0 ||
        sortOrder > 100000)
    ) {
      throw new BadRequestException('Navigation sort order must be between 0 and 100000');
    }
    const targets = [item.href, item.pageId, item.productId, item.serviceId].filter(
      (target) => typeof target === 'string' && target.length > 0,
    );
    if (targets.length !== 1) {
      throw new BadRequestException(
        'Specify exactly one href, pageId, productId, or serviceId target',
      );
    }
    if (typeof item.href === 'string') this.validateHref(item.href);
    if (item.pageId) await this.requireTarget('page', item.pageId, 'Page');
    if (item.productId) await this.requireTarget('product', item.productId, 'Product');
    if (item.serviceId) await this.requireTarget('service', item.serviceId, 'Service');

    if (item.parentId !== undefined && item.parentId !== null) {
      if (item.parentId === itemId)
        throw new BadRequestException('An item cannot be its own parent');
      const parent = await this.prisma.navItem.findFirst({
        where: { id: item.parentId, menuId },
        select: { id: true },
      });
      if (!parent) {
        throw new BadRequestException('Parent navigation item must belong to the same menu');
      }
      if (itemId) await this.assertNoParentCycle(itemId, item.parentId, menuId);
    }
  }

  private async validateLocalized(value: unknown, schema: z.ZodType, field: string): Promise<void> {
    const result = schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(
        `Invalid navigation ${field}: ${result.error.issues[0].message}`,
      );
    }
    const locales = await this.prisma.language.findMany({
      where: { code: { in: Object.keys(result.data as Record<string, unknown>) }, isEnabled: true },
      select: { code: true },
    });
    if (locales.length !== Object.keys(result.data as Record<string, unknown>).length) {
      throw new BadRequestException(`Navigation ${field} contains an unknown or disabled locale`);
    }
  }

  private async requireTarget(
    model: 'page' | 'product' | 'service',
    id: string,
    label: string,
  ): Promise<void> {
    const query = { where: { id }, select: { id: true } };
    const result =
      model === 'page'
        ? await this.prisma.page.findUnique(query)
        : model === 'product'
          ? await this.prisma.product.findUnique(query)
          : await this.prisma.service.findUnique(query);
    if (!result) throw new BadRequestException(`Navigation target ${label} does not exist`);
  }

  private validateHref(href: string): void {
    if (href.startsWith('/') && !href.startsWith('//')) {
      if (/[?#\\\s]/.test(href) || /%(?:2f|5c)/i.test(href)) {
        throw new BadRequestException('Custom navigation path is invalid');
      }
      let decoded: string;
      try {
        decoded = decodeURIComponent(href);
      } catch {
        throw new BadRequestException('Custom navigation path has invalid URL encoding');
      }
      if (
        decoded.includes('//') ||
        decoded.includes('\\') ||
        decoded.split('/').some((segment) => segment === '.' || segment === '..')
      ) {
        throw new BadRequestException('Custom navigation path is invalid');
      }
      return;
    }
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      throw new BadRequestException('Navigation href must be a local path or absolute HTTP(S) URL');
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new BadRequestException('Navigation href must use HTTP(S) and contain no credentials');
    }
  }

  private async assertNoParentCycle(
    itemId: string,
    proposedParentId: string,
    menuId: string,
  ): Promise<void> {
    const items = (await this.prisma.navItem.findMany({
      where: { menuId },
      select: { id: true, parentId: true },
    })) as Array<{ id: string; parentId: string | null }>;
    const parentById = new Map(items.map(({ id, parentId }) => [id, parentId]));
    const visited = new Set<string>();
    let ancestor: string | null | undefined = proposedParentId;
    while (ancestor) {
      if (ancestor === itemId)
        throw new BadRequestException('Navigation hierarchy cannot contain a cycle');
      if (visited.has(ancestor)) {
        throw new ConflictException('Existing navigation hierarchy contains a cycle');
      }
      visited.add(ancestor);
      ancestor = parentById.get(ancestor);
    }
  }

  private buildTree(items: NavigationRow[]): NavigationTreeItem[] {
    const nodes = new Map<string, NavigationTreeItem>(
      items.map((item) => [item.id, { ...item, children: [] }]),
    );
    const roots: NavigationTreeItem[] = [];
    for (const item of items) {
      const node = nodes.get(item.id);
      if (!node) continue;
      const parent = item.parentId ? nodes.get(item.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  private validateMenuKey(key: string): void {
    if (typeof key !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) || key.length > 80) {
      throw new BadRequestException(
        'Navigation menu key must be a lowercase kebab-case identifier',
      );
    }
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    const result = jsonObjectSchema.safeParse(value);
    if (!result.success) throw new BadRequestException('Navigation data must be a JSON object');
    this.assertJson(result.data);
    return result.data as Prisma.InputJsonValue;
  }

  private assertJson(value: unknown, depth = 0): void {
    if (depth > 20) throw new BadRequestException('Navigation JSON is nested too deeply');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (Array.isArray(value)) {
      for (const item of value) this.assertJson(item, depth + 1);
      return;
    }
    if (
      typeof value === 'object' &&
      value !== null &&
      Object.getPrototypeOf(value) === Object.prototype
    ) {
      for (const [key, item] of Object.entries(value)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) {
          throw new BadRequestException('Navigation JSON contains a forbidden property');
        }
        this.assertJson(item, depth + 1);
      }
      return;
    }
    throw new BadRequestException('Navigation data must be valid JSON');
  }

  private async audit(actor: AuthenticatedUser, action: string, entityId: string): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { actorId: actor.id, action, entityType: 'navigation', entityId },
      });
    } catch (error) {
      this.logger.warn(
        `Could not write ${action} audit event: ${prismaCode(error) ?? 'database error'}`,
      );
    }
  }

  private handleDbError(error: unknown): never {
    const code = prismaCode(error);
    if (code === 'P2002') throw new ConflictException('Navigation menu key already exists');
    if (code === 'P2003')
      throw new ConflictException('Navigation item is referenced by another item');
    if (code === 'P2025') throw new NotFoundException('Navigation record not found');
    throw error;
  }
}
