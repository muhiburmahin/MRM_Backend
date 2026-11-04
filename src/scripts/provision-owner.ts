import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

interface UserSeedConfig {
  email: string;
  name: string;
  password: string;
}

async function provisionUser(cfg: UserSeedConfig, roleId: string): Promise<void> {
  const normalizedEmail = cfg.email.trim().toLowerCase();
  const passwordHash = await argon2.hash(cfg.password, ARGON2_OPTIONS);

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        roleId,
        isActive: true,
        mustChangePassword: false,
      },
    });
    console.log(`[OK] Admin user "${normalizedEmail}" updated successfully.`);
  } else {
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: cfg.name,
        passwordHash,
        roleId,
        isActive: true,
        mustChangePassword: false,
      },
      select: { id: true, email: true, name: true },
    });
    console.log(`[OK] Admin user "${normalizedEmail}" created successfully:`, user);
  }

  console.log(`--------------------------------------------------`);
  console.log(`Credentials for: ${cfg.name}`);
  console.log(`Email:    ${normalizedEmail}`);
  console.log(`Password: ${cfg.password}`);
  console.log(`Role:     owner (Super Admin)`);
  console.log(`--------------------------------------------------`);
}

async function main(): Promise<void> {
  const role = await prisma.role.findUnique({ where: { key: 'owner' } });
  if (!role) {
    throw new Error('Role "owner" not found. Run "npm run prisma:seed" first.');
  }

  const usersToSeed: UserSeedConfig[] = [
    {
      email: (process.env.ADMIN_INITIAL_EMAIL ?? 'admin@mrminfotech.com').trim().toLowerCase(),
      name: process.env.ADMIN_INITIAL_NAME ?? 'MRM Super Admin',
      password: process.env.ADMIN_INITIAL_PASSWORD ?? 'MrmAdmin@2026!',
    },
    {
      email: 'mrminfotechofficial@gmail.com',
      name: 'Md Muhibur Rahman Mahin',
      password: 'mrm123mrm@',
    },
  ];

  for (const u of usersToSeed) {
    await provisionUser(u, role.id);
  }
}

main()
  .catch((e) => {
    console.error('Failed to provision owner:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
