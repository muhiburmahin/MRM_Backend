import { AdminAuditService } from './admin-audit.service';
import { QueryAuditLogsDto } from './dto/admin-query.dto';

describe('AdminAuditService', () => {
  const prisma = {
    auditLog: { findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('serializes BigInt log ids and returns pagination metadata', async () => {
    const entry = {
      id: 42n,
      action: 'user.updated',
      entityType: 'user',
      entityId: 'user-id',
      diff: { name: 'Updated' },
      ipHash: null,
      createdAt: new Date('2026-10-11T00:00:00.000Z'),
      actor: { id: 'actor-id', email: 'admin@example.com', name: 'Admin' },
      actorId: 'actor-id',
    };
    prisma.$transaction.mockResolvedValue([[entry], 1]);
    const service = new AdminAuditService(prisma as never);

    const result = await service.findAll(new QueryAuditLogsDto());

    expect(result).toEqual({
      data: [{ ...entry, id: '42' }],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});
