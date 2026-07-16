/**
 * 7.15 — source-registry pure helpers: id scheme + the query-time exclusion
 * predicate ContentSearchService filters with.
 */

jest.mock('@/lib/prisma', () => ({ prisma: {} }));

import {
  docSourceId,
  entitySourceId,
  isDocSourceId,
  isEntitySourceId,
  isEntityExcluded,
  SourceExclusions,
} from '../source-registry';

describe('source id scheme', () => {
  it('round-trips doc and entity ids', () => {
    expect(docSourceId('resume-kirill')).toBe('doc:resume-kirill');
    expect(isDocSourceId('doc:resume-kirill')).toBe(true);
    expect(entitySourceId('CUSTOM', 'about-ai')).toBe('entity:CUSTOM:about-ai');
    expect(isEntitySourceId('entity:CUSTOM:about-ai')).toBe(true);
    expect(isDocSourceId('projects')).toBe(false);
    expect(isEntitySourceId('projects')).toBe(false);
  });
});

describe('isEntityExcluded', () => {
  const exclusions: SourceExclusions = {
    entityTypes: new Set(['PROJECT']),
    entities: new Set(['RESUME:resume-kirill']),
    hasAny: true,
  };

  it('excludes by whole entity type (projects master toggle)', () => {
    expect(isEntityExcluded(exclusions, 'PROJECT', 'e-commerce-platform')).toBe(true);
  });

  it('excludes a single unticked source', () => {
    expect(isEntityExcluded(exclusions, 'RESUME', 'resume-kirill')).toBe(true);
    expect(isEntityExcluded(exclusions, 'RESUME', 'other-resume')).toBe(false);
  });

  it('passes everything through when nothing is disabled', () => {
    const none: SourceExclusions = { entityTypes: new Set(), entities: new Set(), hasAny: false };
    expect(isEntityExcluded(none, 'PROJECT', 'x')).toBe(false);
  });
});
