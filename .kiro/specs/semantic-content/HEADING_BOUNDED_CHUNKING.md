> **Status:** current (supporting reference — semantic-content — chunking design deep-dive). Predates the 2026-07-02 spec rewrite; where this conflicts with code or the owning spec's requirements/design, those win.
> **Last verified against code:** carried over 2026-07-02 (e2d75b4) without line-by-line reverification.

# Heading-Bounded Chunking Strategy

## Overview

The Semantic Content Management System uses a **heading-bounded hybrid chunking strategy** that ties T3 chunks to document structure (H1/H2/H3 headings). This architectural decision enables surgical section updates, dramatically reduces costs, and maintains semantic coherence.

## Core Principle

**T3 chunks never cross heading boundaries.**

This simple rule has profound implications for efficiency, cost, and maintainability.

## The Problem with Uniform Grid Chunking

### Traditional Approach (What We're NOT Doing)

```
Article: 1000 lines
Chunk size: 300 tokens
Overlap: 50 tokens

[Chunk 1: lines 1-150]      â† Spans H1 and H2
[Chunk 2: lines 100-250]    â† Overlap, crosses H2 boundary
[Chunk 3: lines 200-350]    â† Spans H2 and H3
[Chunk 4: lines 300-450]    â† Crosses H3 boundary
```

**Problems**:
1. Edit H2 â†’ Invalidates chunks 1, 2, 3 (even though H1 and H3 unchanged)
2. Embeddings for unchanged content get regenerated unnecessarily
3. Difficult to determine which chunks to regenerate
4. High API costs for small edits

## Heading-Bounded Approach with Section-Relative Line Numbering

### Core Concept: Section-Relative Positioning

**Key Innovation**: Each heading section uses its own line numbering system starting from 0, making chunks completely independent of other sections.

**Example Article Structure**:
```
H1: Introduction                    â† Section A
Line 0: # Introduction              â† Heading (always line 0)
Line 1: This project demonstrates   â† Content starts
Line 2: advanced AI techniques
...
Line 14: leading to great results   â† Section A ends (15 lines total)

H1: Implementation                  â† Section B  
Line 0: # Implementation            â† Heading (new section = new line 0)
Line 1: The technical approach      â† Content starts
...
Line 9: resulting in success        â† Section B ends (10 lines total)

H1: Advanced Features               â† Section C
Line 0: # Advanced Features         â† Heading (new section = new line 0)
Line 1: The system includes
...
Line 89: comprehensive analytics    â† Section C ends (90 lines total)
```

**Chunking Strategy** (20-line chunks):
- **Section A (15 lines)**: 1 chunk (lines 0-14)
- **Section B (10 lines)**: 1 chunk (lines 0-9)  
- **Section C (90 lines)**: 5 chunks (0-19, 20-39, 40-59, 60-79, 80-89)

**Database Records**:
```typescript
// Section A - Single chunk
{
  sectionGroup: "introduction",
  chunkIndexInSection: 0,
  sectionStartLine: 0,    // Includes heading
  sectionEndLine: 14,     // Last line of section
  content: "# Introduction\nThis project demonstrates..."
}

// Section C - Multiple chunks
{
  sectionGroup: "advanced-features",
  chunkIndexInSection: 0,
  sectionStartLine: 0,    // First chunk includes heading
  sectionEndLine: 19,     // First 20 lines
  content: "# Advanced Features\nThe system includes..."
},
{
  sectionGroup: "advanced-features", 
  chunkIndexInSection: 1,
  sectionStartLine: 20,   // Continues from previous chunk
  sectionEndLine: 39,     // Next 20 lines
  content: "...middle content of advanced features section..."
}
```

### Structure-Aware Chunking

```
H1: Introduction (lines 1-50, 200 tokens)
  [T3-1: entire section]

H2: Background (lines 51-120, 300 tokens)
  [T3-2: entire section]

H2: Motivation (lines 121-180, 250 tokens)
  [T3-3: entire section]

H1: Implementation (lines 181-500, 800 tokens)
  [T3-4: lines 181-350]     â† Split within section
  [T3-5: lines 325-500]     â† 25 token overlap, still within section
```

**Benefits of Section-Relative Line Numbering**:
1. **Section Isolation**: Edit Section A â†’ Only Section A chunks need updating
2. **Stable References**: Section B chunks always start at line 0, regardless of Section A changes  
3. **No Cascade Updates**: Adding 50 lines to Section A doesn't affect Section B or C line numbers
4. **Predictable Chunking**: Each section chunks independently with consistent 20-line logic
5. **Surgical Updates**: Only regenerate chunks for the section that actually changed
6. **Cost Efficiency**: 50-75% cost reduction for partial updates

## Hybrid Strategy

The system intelligently handles sections of different sizes:

### 1. Tiny Sections (< 50 tokens)

**Strategy**: Create single chunk or merge with parent

```typescript
H3: Quick Note (30 tokens)
â†’ [T3 chunk: entire section]
// Or merge with parent H2's last chunk
```

**Rationale**: Avoid creating too many tiny chunks that fragment context

### 2. Small-Medium Sections (50-500 tokens)

**Strategy**: Single chunk per section

```typescript
H2: Background (300 tokens)
â†’ [T3 chunk: entire section]
```

**Rationale**: Optimal size for semantic search, no splitting needed

### 3. Large Sections (> 500 tokens)

**Strategy**: Split within section boundaries using natural breaks

```typescript
H1: Technical Implementation (1200 tokens)
â†’ [T3 chunk 1: paragraphs 1-3, ~400 tokens]
â†’ [T3 chunk 2: paragraphs 3-6, ~425 tokens]  // 25 token overlap
â†’ [T3 chunk 3: paragraphs 6-9, ~400 tokens]  // 25 token overlap
```

**Rationale**: Maintain manageable chunk sizes while respecting section boundaries

### 4. Optional Overlap

**Strategy**: Add small overlap between chunks in same section

```typescript
Chunk 1: "...end of paragraph 3."
Overlap: "end of paragraph 3. Start of paragraph 4..."
Chunk 2: "Start of paragraph 4. Rest of content..."
```

**Rationale**: Provides context continuity for semantic search

## Change Detection with Heading-Bounded Chunks

### Section-Level Hashing

```typescript
// On save, hash each section independently
const sections = [
  { id: 'h1-intro', hash: 'abc123', content: '...' },
  { id: 'h2-background', hash: 'def456', content: '...' },
  { id: 'h2-motivation', hash: 'ghi789', content: '...' },
  { id: 'h1-implementation', hash: 'jkl012', content: '...' }
];

// Compare with stored hashes
const changes = sections.map(section => ({
  sectionId: section.id,
  changed: section.hash !== storedHashes[section.id]
}));

// Result: Only 'h2-background' changed
// Action: Regenerate only T3 chunks for that section
```

### Cost Comparison

**Scenario**: 10-section article, edit 1 section

#### Before (Uniform Grid)
```
Total chunks: 30 (overlapping grid)
Affected by edit: 3-4 chunks (overlap causes cascade)
Regeneration cost: $0.0005
Time: 8 seconds
```

#### After (Heading-Bounded)
```
Total sections: 10
Affected by edit: 1 section (2 chunks within it)
Regeneration cost: $0.0001
Time: 2 seconds
Savings: 80% cost reduction
```

## Implementation Details

### Chunking Algorithm

```typescript
function generateHeadingBoundedChunks(
  section: Section,
  config: ChunkingConfig
): T3Chunk[] {
  const sectionTokens = estimateTokens(section.content);
  
  // Case 1: Tiny section
  if (sectionTokens < config.minSectionSize) {
    return [createSingleChunk(section)];
  }
  
  // Case 2: Small-medium section
  if (sectionTokens <= config.maxSectionSize) {
    return [createSingleChunk(section)];
  }
  
  // Case 3: Large section - split intelligently
  return splitLargeSection(section, config);
}

function splitLargeSection(
  section: Section,
  config: ChunkingConfig
): T3Chunk[] {
  const paragraphs = splitByParagraphs(section.content);
  const chunks: T3Chunk[] = [];
  
  let currentChunk = '';
  let currentTokens = 0;
  
  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);
    
    // If adding paragraph exceeds target, save current chunk
    if (currentTokens + paragraphTokens > config.targetChunkSize) {
      chunks.push(createChunk(currentChunk, section));
      
      // Start new chunk with optional overlap
      const overlap = getLastNTokens(currentChunk, config.sectionBoundaryOverlap);
      currentChunk = overlap + paragraph;
      currentTokens = config.sectionBoundaryOverlap + paragraphTokens;
    } else {
      currentChunk += paragraph;
      currentTokens += paragraphTokens;
    }
  }
  
  // Save final chunk
  if (currentChunk) {
    chunks.push(createChunk(currentChunk, section));
  }
  
  return chunks;
}
```

### Change Detection Algorithm

```typescript
function detectSectionChanges(
  oldSections: Section[],
  newSections: Section[]
): SectionChange[] {
  const changes: SectionChange[] = [];
  
  for (const newSection of newSections) {
    const oldSection = findMatchingSection(oldSections, newSection.id);
    
    if (!oldSection) {
      changes.push({
        sectionId: newSection.id,
        changeType: 'added',
        regenerationRequired: true
      });
      continue;
    }
    
    // Hash section content
    const oldHash = hashContent(oldSection.content);
    const newHash = hashContent(newSection.content);
    
    if (oldHash === newHash) {
      changes.push({
        sectionId: newSection.id,
        changeType: 'unchanged',
        regenerationRequired: false  // Preserve existing chunks!
      });
    } else {
      changes.push({
        sectionId: newSection.id,
        changeType: 'modified',
        regenerationRequired: true   // Regenerate this section only
      });
    }
  }
  
  return changes;
}
```

### Selective Regeneration

```typescript
async function regenerateAffectedSections(
  projectId: string,
  sectionChanges: SectionChange[]
): Promise<RegenerationResult> {
  const result = {
    preserved: [],
    regenerated: [],
    deleted: []
  };
  
  for (const change of sectionChanges) {
    if (!change.regenerationRequired) {
      // Preserve existing chunks (no API calls!)
      const existingChunks = await getExistingChunks(projectId, change.sectionId);
      result.preserved.push(...existingChunks);
      continue;
    }
    
    if (change.changeType === 'removed') {
      // Delete chunks for removed section
      await deleteChunks(projectId, change.sectionId);
      result.deleted.push(change.sectionId);
      continue;
    }
    
    // Regenerate chunks for modified/added section
    const newChunks = await generateHeadingBoundedChunks(
      change.section,
      config
    );
    
    const embeddings = await generateEmbeddings(newChunks);
    await saveChunks(newChunks, embeddings);
    
    result.regenerated.push(...newChunks);
  }
  
  return result;
}
```

## Real-World Scenarios

### Scenario 1: Typo Fix

```
User: Fixes typos in "H2: Background" section
Change Detection: 1 section modified (content hash changed)
Action: Regenerate 1-2 T3 chunks for that section only
Cost: $0.0001
Time: 2 seconds
Other 9 sections: Completely untouched, embeddings preserved
```

### Scenario 2: Add New Section

```
User: Adds "H2: Performance Optimization" section
Change Detection: 1 section added
Action: Generate T2 summary + T3 chunks for new section
Cost: $0.0002
Time: 3 seconds
Existing sections: Completely untouched
```

### Scenario 3: Rewrite Multiple Sections

```
User: Rewrites 3 sections significantly
Change Detection: 3 sections modified
Action: Regenerate T2 + T3 for 3 sections only
Cost: $0.0003 (vs $0.0011 for full regeneration)
Time: 6 seconds (vs 30 seconds)
Other 7 sections: Preserved with existing embeddings
Savings: 73% cost reduction
```

### Scenario 4: Major Restructure

```
User: Reorganizes entire article, changes 8+ sections
Change Detection: 8 sections modified (major change)
Action: Full regeneration recommended (more efficient than selective)
Cost: $0.0011
Time: 30 seconds
Reason: Most sections changed, full regeneration more efficient
```

## Configuration

### Default Settings

```typescript
const defaultConfig: ChunkingConfig = {
  // Heading-bounded strategy
  respectHeadingBoundaries: true,
  
  // Chunk sizing
  targetChunkSize: 300,        // Ideal tokens per chunk
  maxSectionSize: 500,         // Split if section exceeds
  minSectionSize: 50,          // Merge if section is smaller
  
  // Context continuity
  sectionBoundaryOverlap: 25,  // Overlap within sections
  
  // Splitting strategy
  splitStrategy: 'paragraph',  // Prefer natural boundaries
  
  // Embedding model
  embeddingModel: 'text-embedding-3-small',
  
  // Summary generation
  summaryMaxLength: {
    T1: 200,
    T2: 150
  }
};
```

### Tuning for Different Content Types

**Technical Documentation** (long sections):
```typescript
{
  targetChunkSize: 400,
  maxSectionSize: 600,
  sectionBoundaryOverlap: 50  // More overlap for technical context
}
```

**Blog Posts** (short sections):
```typescript
{
  targetChunkSize: 250,
  maxSectionSize: 400,
  minSectionSize: 30  // Allow smaller sections
}
```

**Case Studies** (mixed lengths):
```typescript
{
  targetChunkSize: 300,
  maxSectionSize: 500,
  splitStrategy: 'paragraph'  // Respect narrative flow
}
```

## Benefits Summary

### 1. Cost Efficiency
- **50-75% reduction** in API costs for partial updates
- Only pay for sections that actually changed
- Embeddings preserved for unchanged sections

### 2. Performance
- **Faster updates**: 2-6 seconds vs 10-30 seconds
- Parallel section processing possible
- No unnecessary API calls

### 3. Semantic Coherence
- Each chunk contains content from single logical section
- Better semantic search results
- Clearer context boundaries

### 4. Maintainability
- Clear regeneration boundaries
- Easy to understand which chunks need updating
- Predictable cost estimation

### 5. User Experience
- Faster save operations
- Lower costs for iterative editing
- Transparent cost estimation

## Migration from Uniform Grid

Existing implementations using uniform grid chunking can migrate to heading-bounded approach:

1. **Parse existing chunks**: Identify which sections they belong to
2. **Regenerate with boundaries**: Create new heading-bounded chunks
3. **Preserve embeddings**: Reuse embeddings where possible
4. **Update metadata**: Add section IDs and boundaries
5. **Test change detection**: Verify section-level detection works

The migration script is included in the spec (Task 15).

## Conclusion

Heading-bounded chunking is a significant architectural improvement that:
- Reduces costs by 50-75% for partial updates
- Improves performance with surgical section updates
- Maintains semantic coherence with structure-aware chunks
- Simplifies change detection and regeneration logic

This approach transforms semantic content management from an expensive, all-or-nothing operation into a precise, cost-effective system that respects document structure and user editing patterns.
