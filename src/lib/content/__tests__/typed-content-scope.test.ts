jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => ({})) }));
jest.mock('../VectorOperations', () => jest.fn());
jest.mock('../EmbeddingCache', () => ({ embeddingCache: {} }));

import { assertValidContentScope, matchesContentScope } from '../ContentSearchService';

describe('typed content search scope', () => {
  const project = { entityType: 'PROJECT', slug: 'about' };
  const bio = { entityType: 'BIO', slug: 'about' };

  it('treats projectId as project-only when another type has the same slug', () => {
    expect(matchesContentScope(project, { projectId: 'about' })).toBe(true);
    expect(matchesContentScope(bio, { projectId: 'about' })).toBe(false);
  });

  it('selects a non-project source by both type and slug', () => {
    expect(matchesContentScope(bio, { entityType: 'BIO', entitySlug: 'about' })).toBe(true);
    expect(matchesContentScope(project, { entityType: 'BIO', entitySlug: 'about' })).toBe(false);
  });

  it('fails closed when an entity slug has no type or conflicts with project scope', () => {
    expect(matchesContentScope(bio, { entitySlug: 'about' })).toBe(false);
    expect(matchesContentScope(project, { projectId: 'about', entityType: 'BIO' })).toBe(false);
  });
});

describe('assertValidContentScope (7.19 — malformed scope errors instead of silent emptiness)', () => {
  it('accepts well-formed scopes', () => {
    expect(() => assertValidContentScope()).not.toThrow();
    expect(() => assertValidContentScope({})).not.toThrow();
    expect(() => assertValidContentScope({ projectId: 'about' })).not.toThrow();
    expect(() => assertValidContentScope({ projectId: 'about', entityType: 'PROJECT' })).not.toThrow();
    expect(() => assertValidContentScope({ entityType: 'BIO' })).not.toThrow();
    expect(() => assertValidContentScope({ entityType: 'BIO', entitySlug: 'about' })).not.toThrow();
  });

  it('rejects entitySlug without entityType with an actionable message', () => {
    expect(() => assertValidContentScope({ entitySlug: 'about' })).toThrow('entitySlug requires entityType');
  });

  it('rejects projectId combined with entity fields', () => {
    expect(() => assertValidContentScope({ projectId: 'about', entitySlug: 'about' }))
      .toThrow('projectId cannot combine with entityType/entitySlug');
    expect(() => assertValidContentScope({ projectId: 'about', entityType: 'BIO' }))
      .toThrow('projectId cannot combine with entityType/entitySlug');
  });
});
