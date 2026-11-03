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

async function main(): Promise<void> {
  const email = (process.env.ADMIN_INITIAL_EMAIL ?? 'admin@mrminfotech.com').trim().toLowerCase();
  const password = process.env.ADMIN_INITIAL_PASSWORD ?? 'MrmAdmin@2026!';
  const name = process.env.ADMIN_INITIAL_NAME ?? 'MRM Super Admin';

  const role = await prisma.role.findUnique({ where: { key: 'owner' } });
  if (!role) {
    throw new Error('Role "owner" not found. Run "npm run prisma:seed" first.');
  }

  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        roleId: role.id,
        isActive: true,
        mustChangePassword: false,
      },
    });
    console.log(`[OK] Owner user "${email}" already existed. Password and role updated.`);
  } else {
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        roleId: role.id,
        isActive: true,
        mustChangePassword: false,
      },
      select: { id: true, email: true, name: true },
    });
    console.log(`[OK] Super Admin / Owner user created successfully:`, user);
  }

  console.log(`--------------------------------------------------`);
  console.log(`Login Credentials:`);
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Role:     owner (Super Admin)`);
  console.log(`--------------------------------------------------`);
}

main()
  .catch((e) => {
    console.error('Failed to provision owner:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

