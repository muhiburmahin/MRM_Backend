import { HealthService } from './health.service';
import { PrismaService } from '../database/prisma.service';

describe('HealthService', () => {
  const make = (impl: () => Promise<unknown>) =>
    new HealthService(
      { $queryRaw: jest.fn(impl) } as unknown as PrismaService,
      { setContext: jest.fn(), warn: jest.fn() } as never,
    );

  it('reports the database as up when the query succeeds', async () => {
    await expect(make(() => Promise.resolve([1])).isDatabaseUp()).resolves.toBe(true);
  });

  it('reports the database as down when the query fails', async () => {
    await expect(make(() => Promise.reject(new Error('down'))).isDatabaseUp()).resolves.toBe(false);
  });
});
