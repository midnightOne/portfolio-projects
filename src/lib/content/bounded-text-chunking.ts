/**
 * Paragraph-first text chunking with a strict estimated-token ceiling.
 *
 * Normal prose is kept paragraph-bounded. A paragraph that exceeds the hard
 * ceiling falls back to sentences, then words, then character slices for
 * pathological inputs such as minified text, long URLs, and base64 strings.
 */

export interface BoundedChunkingOptions {
  targetTokens: number;
  maxTokens: number;
}

export function estimateTextTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function normalizedLimits(options: BoundedChunkingOptions): BoundedChunkingOptions {
  const maxTokens = Math.max(1, Math.floor(options.maxTokens));
  return {
    maxTokens,
    targetTokens: Math.min(maxTokens, Math.max(1, Math.floor(options.targetTokens))),
  };
}

function packPieces(
  pieces: string[],
  separator: string,
  options: BoundedChunkingOptions,
): string[] {
  const chunks: string[] = [];
  let current = '';

  for (const rawPiece of pieces) {
    const piece = rawPiece.trim();
    if (!piece) continue;
    if (estimateTextTokens(piece) > options.maxTokens) {
      throw new Error('Internal chunking invariant violated: atomic piece exceeds maxTokens');
    }

    const candidate = current ? `${current}${separator}${piece}` : piece;
    if (current && estimateTextTokens(candidate) > options.targetTokens) {
      chunks.push(current);
      current = piece;
    } else {
      current = candidate;
    }

    // A single boundary-preserving piece may exceed the target, but never max.
    if (estimateTextTokens(current) > options.maxTokens) {
      throw new Error('Internal chunking invariant violated: packed chunk exceeds maxTokens');
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function hardSlice(value: string, maxTokens: number): string[] {
  const maxChars = maxTokens * 4;
  const slices: string[] = [];
  for (let start = 0; start < value.length; start += maxChars) {
    slices.push(value.slice(start, start + maxChars));
  }
  return slices;
}

function splitOversizedParagraph(
  paragraph: string,
  options: BoundedChunkingOptions,
): string[] {
  const sentences = paragraph
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);

  const atomicPieces: string[] = [];
  for (const sentence of sentences.length > 0 ? sentences : [paragraph]) {
    if (estimateTextTokens(sentence) <= options.maxTokens) {
      atomicPieces.push(sentence);
      continue;
    }

    const words = sentence.split(/\s+/).filter(Boolean);
    for (const word of words.length > 0 ? words : [sentence]) {
      if (estimateTextTokens(word) <= options.maxTokens) {
        atomicPieces.push(word);
      } else {
        atomicPieces.push(...hardSlice(word, options.maxTokens));
      }
    }
  }

  return packPieces(atomicPieces, ' ', options);
}

export function chunkTextByParagraphs(
  body: string,
  rawOptions: BoundedChunkingOptions,
): string[] {
  const options = normalizedLimits(rawOptions);
  const paragraphs = body
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let normalParagraphs: string[] = [];

  const flushNormalParagraphs = () => {
    chunks.push(...packPieces(normalParagraphs, '\n\n', options));
    normalParagraphs = [];
  };

  for (const paragraph of paragraphs) {
    if (estimateTextTokens(paragraph) <= options.maxTokens) {
      normalParagraphs.push(paragraph);
      continue;
    }

    flushNormalParagraphs();
    chunks.push(...splitOversizedParagraph(paragraph, options));
  }
  flushNormalParagraphs();

  return chunks;
}
