import { toPaginated, toSkipTake } from './pagination';

describe('pagination helpers', () => {
  it('computes skip/take', () => {
    expect(toSkipTake(1, 20)).toEqual({ skip: 0, take: 20 });
    expect(toSkipTake(3, 10)).toEqual({ skip: 20, take: 10 });
  });

  it('builds a paginated result with totalPages', () => {
    expect(toPaginated(['a'], 41, 2, 20)).toEqual({
      items: ['a'],
      meta: { total: 41, page: 2, pageSize: 20, totalPages: 3 },
    });
  });

  it('handles an empty collection', () => {
    expect(toPaginated([], 0, 1, 20).meta.totalPages).toBe(0);
  });
});
