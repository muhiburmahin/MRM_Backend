import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  const health = { isDatabaseUp: jest.fn() };
  const controller = new HealthController(health as unknown as HealthService);

  beforeEach(() => health.isDatabaseUp.mockReset());

  it('returns liveness without querying the database', () => {
    expect(controller.liveness()).toMatchObject({
      status: 'ok',
      timestamp: expect.any(String),
    });
    expect(health.isDatabaseUp).not.toHaveBeenCalled();
  });

  it('returns readiness when the database is available', async () => {
    health.isDatabaseUp.mockResolvedValue(true);
    await expect(controller.readiness()).resolves.toEqual({
      status: 'ok',
      checks: { database: 'up' },
    });
  });
});
