import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const constraintsFile = path.join(__dirname, '..', '..', 'prisma', 'sql', 'constraints.sql');
  const sql = fs.readFileSync(constraintsFile, 'utf8');

  // Strip single-line comments first, then split on semicolon
  const cleanSql = sql.replace(/--.*$/gm, '');
  const stmts = cleanSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of stmts) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log(`[Applied] ${stmt.split('\n')[0]}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        console.log(`[Skipped - Already exists] ${stmt.split('\n')[0]}`);
      } else {
        console.warn(`[Warning/Error] ${stmt.split('\n')[0]}: ${msg}`);
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
