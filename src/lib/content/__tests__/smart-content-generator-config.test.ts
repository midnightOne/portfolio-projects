const indexProjectHierarchical = jest.fn();
const generateT3Chunks = jest.fn((_project: unknown, _index: unknown) => []);
const getDefaultConfig = jest.fn();
const chunkerConstructor = jest.fn();

jest.mock('../HierarchicalContentParser', () => ({
  HierarchicalContentParser: {
    getInstance: () => ({ indexProjectHierarchical }),
  },
}));

jest.mock('../T3HeadingBoundedChunking', () => ({
  T3HeadingBoundedChunking: class {
    constructor(config: unknown) {
      chunkerConstructor(config);
    }

    generateT3Chunks(project: unknown, index: unknown) {
      return generateT3Chunks(project, index);
    }
  },
}));

jest.mock('../ChunkingConfigService', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({ getDefaultConfig }),
  },
}));

import { SmartContentGenerator } from '../SmartContentGenerator';

describe('SmartContentGenerator chunking configuration', () => {
  const persistedConfig = {
    targetChunkSize: 650,
    maxSectionSize: 900,
    minSectionSize: 80,
    sectionBoundaryOverlap: 35,
    splitStrategy: 'paragraph' as const,
    t2MaxLength: 180,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getDefaultConfig.mockResolvedValue(persistedConfig);
    indexProjectHierarchical.mockResolvedValue({ hierarchicalSections: [] });
  });

  it('loads the persisted admin chunking settings for every scaffold run', async () => {
    const generator = new SmartContentGenerator();

    await generator.generateScaffoldOnly({ id: 'project-1', title: 'Project', tags: [] });
    await generator.generateScaffoldOnly({ id: 'project-2', title: 'Project 2', tags: [] });

    expect(getDefaultConfig).toHaveBeenCalledTimes(2);
    expect(chunkerConstructor).toHaveBeenNthCalledWith(1, {
      targetChunkSize: 650,
      maxSectionSize: 900,
      minSectionSize: 80,
      sectionBoundaryOverlap: 35,
      splitStrategy: 'paragraph',
    });
    expect(chunkerConstructor).toHaveBeenNthCalledWith(2, expect.objectContaining({
      splitStrategy: 'paragraph',
      maxSectionSize: 900,
    }));
  });

  it('applies explicit call-site overrides on top of persisted settings', async () => {
    const generator = new SmartContentGenerator({ maxSectionSize: 1200 });

    await generator.generateScaffoldOnly({ id: 'project-1', title: 'Project', tags: [] });

    expect(chunkerConstructor).toHaveBeenCalledWith(expect.objectContaining({
      targetChunkSize: 650,
      maxSectionSize: 1200,
      splitStrategy: 'paragraph',
    }));
  });
});
