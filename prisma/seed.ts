import { PrismaClient } from '@prisma/client';

type PermissionSeed = {
  key: string;
  group: string;
  description: string;
};

const prisma = new PrismaClient();

const contentScopes = ['page', 'product', 'service', 'post', 'casestudy'] as const;
const contentActions = ['read', 'write', 'publish', 'delete'] as const;

function scopedPermissions(
  scope: string,
  group: string,
  actions: readonly string[],
): PermissionSeed[] {
  return actions.map((action) => ({
    key: `${scope}:${action}`,
    group,
    description: `${action} ${scope} content`,
  }));
}

const permissions: PermissionSeed[] = [
  ...scopedPermissions('content', 'content', contentActions),
  ...contentScopes.flatMap((scope) => scopedPermissions(scope, 'content', contentActions)),
  { key: 'media:upload', group: 'media', description: 'Upload media assets' },
  { key: 'media:delete', group: 'media', description: 'Delete media assets' },
  { key: 'nav:write', group: 'site', description: 'Manage navigation menus' },
  { key: 'theme:write', group: 'site', description: 'Manage themes' },
  { key: 'theme:publish', group: 'site', description: 'Publish themes' },
  { key: 'settings:write', group: 'site', description: 'Manage site settings' },
  { key: 'lead:read', group: 'leads', description: 'View leads' },
  { key: 'lead:write', group: 'leads', description: 'Manage leads' },
  { key: 'lead:export', group: 'leads', description: 'Export leads' },
  { key: 'lead:delete', group: 'leads', description: 'Delete leads' },
  { key: 'subscriber:read', group: 'leads', description: 'View subscribers' },
  { key: 'subscriber:export', group: 'leads', description: 'Export subscribers' },
  { key: 'user:read', group: 'users', description: 'View users' },
  { key: 'user:invite', group: 'users', description: 'Invite users' },
  { key: 'user:write', group: 'users', description: 'Manage users' },
  { key: 'user:delete', group: 'users', description: 'Delete users' },
  { key: 'role:write', group: 'users', description: 'Manage roles and role permissions' },
  { key: 'audit:read', group: 'audit', description: 'View audit logs' },
  { key: 'form:write', group: 'leads', description: 'Manage form definitions' },
  {
    key: 'email_template:write',
    group: 'communications',
    description: 'Manage email templates',
  },
  { key: 'redirect:write', group: 'site', description: 'Manage redirects' },
  { key: 'announcement:write', group: 'site', description: 'Manage announcements' },
];

const allPermissionKeys = permissions.map(({ key }) => key);
const publicContentReadKeys = ['content:read', ...contentScopes.map((scope) => `${scope}:read`)];
const editorPermissionKeys = [
  'content:read',
  'content:write',
  'content:publish',
  ...contentScopes.flatMap((scope) =>
    ['read', 'write', 'publish'].map((action) => `${scope}:${action}`),
  ),
  'media:upload',
  'nav:write',
];

const roles = [
  {
    key: 'owner',
    name: 'Owner',
    description: 'Full system access.',
    permissionKeys: allPermissionKeys,
  },
  {
    key: 'admin',
    name: 'Administrator',
    description: 'Administrative access without role management or user deletion.',
    permissionKeys: allPermissionKeys.filter(
      (key) => key !== 'user:delete' && key !== 'role:write',
    ),
  },
  {
    key: 'editor',
    name: 'Editor',
    description: 'Create and publish content without access to private lead or user data.',
    permissionKeys: editorPermissionKeys,
  },
  {
    key: 'sales',
    name: 'Sales',
    description: 'Work with leads and view site content.',
    permissionKeys: ['content:read', 'lead:read', 'lead:write', 'subscriber:read'],
  },
  {
    key: 'viewer',
    name: 'Viewer',
    description: 'Read published-content areas only; no private lead or user data.',
    permissionKeys: publicContentReadKeys,
  },
] as const;

async function seedSystemData(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.language.updateMany({
      where: { isDefault: true, code: { not: 'en' } },
      data: { isDefault: false },
    });
    await tx.language.upsert({
      where: { code: 'en' },
      update: { name: 'English', isDefault: true, isEnabled: true, rtl: false, sortOrder: 0 },
      create: { code: 'en', name: 'English', isDefault: true, isEnabled: true, rtl: false },
    });
    await tx.language.upsert({
      where: { code: 'bn' },
      update: { name: 'বাংলা', isDefault: false, isEnabled: true, rtl: false, sortOrder: 1 },
      create: {
        code: 'bn',
        name: 'বাংলা',
        isDefault: false,
        isEnabled: true,
        rtl: false,
        sortOrder: 1,
      },
    });

    const permissionIds = new Map<string, string>();
    for (const permission of permissions) {
      const saved = await tx.permission.upsert({
        where: { key: permission.key },
        update: { group: permission.group, description: permission.description },
        create: permission,
      });
      permissionIds.set(permission.key, saved.id);
    }

    const roleIds = new Map<string, string>();
    for (const role of roles) {
      const saved = await tx.role.upsert({
        where: { key: role.key },
        update: { name: role.name, description: role.description, isSystem: true },
        create: { key: role.key, name: role.name, description: role.description, isSystem: true },
      });
      roleIds.set(role.key, saved.id);
    }

    for (const role of roles) {
      const roleId = roleIds.get(role.key);
      if (!roleId) throw new Error(`Seed role was not persisted: ${role.key}`);
      const data = role.permissionKeys.map((key) => {
        const permissionId = permissionIds.get(key);
        if (!permissionId) throw new Error(`Seed permission was not persisted: ${key}`);
        return { roleId, permissionId };
      });
      await tx.rolePermission.createMany({ data, skipDuplicates: true });

      const existingGrants = await tx.rolePermission.findMany({
        where: { roleId },
        select: { permission: { select: { key: true } } },
      });
      const allowedKeys = new Set<string>(role.permissionKeys);
      const unexpectedKeys = existingGrants
        .map(({ permission }) => permission.key)
        .filter((key) => !allowedKeys.has(key));
      if (unexpectedKeys.length > 0) {
        throw new Error(
          `Role ${role.key} has grants outside the seed policy; review and revoke them explicitly: ${unexpectedKeys.join(', ')}`,
        );
      }
    }

    for (const key of ['header', 'footer-company', 'footer-legal']) {
      await tx.navMenu.upsert({ where: { key }, update: {}, create: { key } });
    }
  });
}

async function main(): Promise<void> {
  try {
    await seedSystemData();
    process.stdout.write('System data seed completed.\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const detail =
    error instanceof Error ? (error.stack ?? error.message) : `Unknown error: ${String(error)}`;
  process.stderr.write(`System data seed failed:\n${detail}\n`);
  process.exitCode = 1;
});
