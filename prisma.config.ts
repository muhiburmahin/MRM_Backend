import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Multi-file Prisma schema: every model lives in its own file under prisma/schema/.
export default defineConfig({
  schema: path.join('prisma', 'schema'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'ts-node prisma/seed.ts',
  },
});
