import { VectorOperations } from '../VectorOperations';
import type { SourceExclusions } from '../source-registry';

describe('vector source visibility', () => {
  it('adds disabled-source predicates before ordering and limiting', async () => {
    const queryRawUnsafe = jest.fn().mockResolvedValue([]);
    const vectorOps = new VectorOperations({ $queryRawUnsafe: queryRawUnsafe } as any);
    const exclusions: SourceExclusions = {
      entityTypes: new Set(['PROJECT']),
      entities: new Set(['RESUME:private-resume']),
      hasAny: true,
    };

    await vectorOps.semanticSearch([0.1, 0.2], 5, 3, false, exclusions);

    const [sql, ...params] = queryRawUnsafe.mock.calls[0];
    expect(sql).toContain('e."entityType"::text = ANY($2::text[])');
    expect(sql).toContain("(e.\"entityType\"::text || ':' || e.slug) = ANY($3::text[])");
    expect(sql.indexOf('AND NOT')).toBeLessThan(sql.indexOf('ORDER BY'));
    expect(sql.indexOf('AND NOT')).toBeLessThan(sql.indexOf('LIMIT'));
    expect(params).toEqual(['[0.1,0.2]', ['PROJECT'], ['RESUME:private-resume'], 3, 5]);
  });
});
