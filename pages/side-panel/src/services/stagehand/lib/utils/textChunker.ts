/**
 * Text Chunking Utilities for AI Processing
 *
 * Provides functionality to split large text content into manageable chunks
 * that stay under token limits for AI model processing.
 */

export interface TextChunk {
  content: string;
  index: number;
  startPosition: number;
  endPosition: number;
  tokenCount: number;
  structureType?: 'heading' | 'section' | 'paragraph' | 'list' | 'form' | 'iframe' | 'unknown';
  headingLevel?: number;
  semanticPath?: string[];
}

export interface ChunkingOptions {
  maxTokens?: number;
  overlap?: number;
  preserveStructure?: boolean;
  estimatedCharactersPerToken?: number;
  smartSnapshotChunking?: boolean;
}

/**
 * Simple token estimation based on character count
 * Roughly 4 characters per token for most text
 */
export function estimateTokenCount(text: string, charactersPerToken: number = 4): number {
  return Math.ceil(text.length / charactersPerToken);
}

/**
 * Parse snapshot structure to identify semantic boundaries
 */
interface SnapshotSection {
  content: string;
  startIndex: number;
  endIndex: number;
  type: 'heading' | 'section' | 'paragraph' | 'list' | 'form' | 'iframe' | 'unknown';
  level?: number;
  path: string[];
}

/**
 * Intelligent chunking for snapshot content that respects semantic boundaries
 */
export function chunkSnapshotText(text: string, options: ChunkingOptions = {}): TextChunk[] {
  const {
    maxTokens = 15000,
    overlap = 200,
    estimatedCharactersPerToken = 4,
    smartSnapshotChunking = true,
  } = options;

  if (!smartSnapshotChunking) {
    return chunkText(text, options);
  }

  const sections = parseSnapshotStructure(text);
  const chunks: TextChunk[] = [];
  const maxChars = maxTokens * estimatedCharactersPerToken;

  let currentChunk = '';
  let currentChunkStart = 0;
  let chunkIndex = 0;
  let currentPath: string[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const sectionText = section.content;

    // Check if adding this section would exceed the limit
    if (currentChunk.length + sectionText.length > maxChars && currentChunk.length > 0) {
      // Create chunk from current content
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex++,
        startPosition: currentChunkStart,
        endPosition: currentChunkStart + currentChunk.length,
        tokenCount: estimateTokenCount(currentChunk, estimatedCharactersPerToken),
        structureType: inferStructureType(currentChunk),
        semanticPath: [...currentPath],
      });

      // Start new chunk, potentially with overlap
      if (overlap > 0 && currentChunk.length > overlap) {
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + sectionText;
        currentChunkStart = sections[Math.max(0, i - 1)].startIndex;
      } else {
        currentChunk = sectionText;
        currentChunkStart = section.startIndex;
      }
    } else {
      // Add section to current chunk
      if (currentChunk.length === 0) {
        currentChunkStart = section.startIndex;
      }
      currentChunk += sectionText;
    }

    // Update current path based on section type
    if (section.type === 'heading') {
      currentPath = [...section.path];
    }
  }

  // Add final chunk if there's remaining content
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunkIndex,
      startPosition: currentChunkStart,
      endPosition: currentChunkStart + currentChunk.length,
      tokenCount: estimateTokenCount(currentChunk, estimatedCharactersPerToken),
      structureType: inferStructureType(currentChunk),
      semanticPath: [...currentPath],
    });
  }

  return chunks;
}

/**
 * Parse snapshot text to identify structural elements
 */
function parseSnapshotStructure(text: string): SnapshotSection[] {
  const lines = text.split('\n');
  const sections: SnapshotSection[] = [];
  let currentSection = '';
  let currentStartIndex = 0;
  let currentPath: string[] = [];
  let lineIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Detect headings by looking for patterns like 'heading "Title" [level=X]'
    const headingMatch = trimmedLine.match(/^-?\s*heading\s+"([^"]+)"\s*\[level=(\d+)\]/);
    if (headingMatch) {
      // Finish previous section
      if (currentSection.trim()) {
        sections.push({
          content: currentSection,
          startIndex: currentStartIndex,
          endIndex: lineIndex,
          type: 'section',
          path: [...currentPath],
        });
      }

      const title = headingMatch[1];
      const level = parseInt(headingMatch[2]);

      // Update path based on heading level
      currentPath = currentPath.slice(0, level - 1);
      currentPath[level - 1] = title;

      // Start new section with heading
      currentSection = line + '\n';
      currentStartIndex = lineIndex;

      sections.push({
        content: line,
        startIndex: lineIndex,
        endIndex: lineIndex + line.length,
        type: 'heading',
        level: level,
        path: [...currentPath],
      });

      currentSection = '';
      currentStartIndex = lineIndex + line.length + 1;
    } else if (trimmedLine.includes('iframe [ref=')) {
      // Handle iframe sections specially
      if (currentSection.trim()) {
        sections.push({
          content: currentSection,
          startIndex: currentStartIndex,
          endIndex: lineIndex,
          type: 'section',
          path: [...currentPath],
        });
      }

      currentSection = line + '\n';
      currentStartIndex = lineIndex;
    } else if (
      trimmedLine.includes('button ') ||
      trimmedLine.includes('textbox ') ||
      trimmedLine.includes('checkbox ') ||
      trimmedLine.includes('radio ')
    ) {
      // Form elements - keep them together
      currentSection += line + '\n';
    } else {
      // Regular content
      currentSection += line + '\n';
    }

    lineIndex += line.length + 1; // +1 for newline
  }

  // Add final section
  if (currentSection.trim()) {
    sections.push({
      content: currentSection,
      startIndex: currentStartIndex,
      endIndex: lineIndex,
      type: 'section',
      path: [...currentPath],
    });
  }

  return sections;
}

/**
 * Infer structure type from content
 */
function inferStructureType(content: string): TextChunk['structureType'] {
  if (content.includes('heading ')) return 'heading';
  if (content.includes('iframe ')) return 'iframe';
  if (
    content.includes('button ') ||
    content.includes('textbox ') ||
    content.includes('checkbox ') ||
    content.includes('radio ')
  )
    return 'form';
  if (content.includes('- ') || content.includes('* ')) return 'list';
  if (content.includes('paragraph ')) return 'paragraph';
  return 'unknown';
}

/**
 * Split text into chunks that stay under the token limit
 */
export function chunkText(text: string, options: ChunkingOptions = {}): TextChunk[] {
  const {
    maxTokens = 15000,
    overlap = 200,
    preserveStructure = true,
    estimatedCharactersPerToken = 4,
    smartSnapshotChunking = false,
  } = options;

  // Use smart snapshot chunking if enabled and content appears to be a snapshot
  if (smartSnapshotChunking && (text.includes('[ref=') || text.includes('heading "'))) {
    return chunkSnapshotText(text, options);
  }

  const chunks: TextChunk[] = [];
  const maxChars = maxTokens * estimatedCharactersPerToken;

  if (text.length <= maxChars) {
    // Text fits in a single chunk
    return [
      {
        content: text,
        index: 0,
        startPosition: 0,
        endPosition: text.length,
        tokenCount: estimateTokenCount(text, estimatedCharactersPerToken),
        structureType: 'unknown',
      },
    ];
  }

  let position = 0;
  let chunkIndex = 0;

  while (position < text.length) {
    let chunkEnd = Math.min(position + maxChars, text.length);

    // If we're not at the end and preserveStructure is enabled,
    // try to find a good breaking point
    if (chunkEnd < text.length && preserveStructure) {
      // Look for natural break points in the last 500 characters
      const searchStart = Math.max(chunkEnd - 500, position);
      const searchText = text.slice(searchStart, chunkEnd);

      // Try to break on double newlines (paragraph breaks)
      let breakPoint = searchText.lastIndexOf('\n\n');
      if (breakPoint === -1) {
        // Try single newlines
        breakPoint = searchText.lastIndexOf('\n');
      }
      if (breakPoint === -1) {
        // Try periods followed by space
        breakPoint = searchText.lastIndexOf('. ');
      }
      if (breakPoint === -1) {
        // Try any space
        breakPoint = searchText.lastIndexOf(' ');
      }

      if (breakPoint > 0) {
        chunkEnd = searchStart + breakPoint + 1;
      }
    }

    const chunkContent = text.slice(position, chunkEnd);

    chunks.push({
      content: chunkContent,
      index: chunkIndex,
      startPosition: position,
      endPosition: chunkEnd,
      tokenCount: estimateTokenCount(chunkContent, estimatedCharactersPerToken),
      structureType: inferStructureType(chunkContent),
    });

    // Move position forward, accounting for overlap
    position = chunkEnd - overlap;

    // Make sure we don't go backwards
    if (position <= chunks[chunkIndex].startPosition) {
      position = chunkEnd;
    }

    chunkIndex++;
  }

  return chunks;
}

/**
 * Find the most relevant chunk for a given query using enhanced scoring
 * Considers semantic paths, structure types, and keyword matching
 */
export function findMostRelevantChunk(chunks: TextChunk[], query: string): TextChunk | null {
  if (chunks.length === 0) return null;
  if (chunks.length === 1) return chunks[0];

  const scoredChunks = scoreChunks(chunks, query);
  return scoredChunks[0];
}

/**
 * Calculate enhanced relevance scores for all chunks using generic keyword matching
 */
export function scoreChunks(
  chunks: TextChunk[],
  query: string
): Array<TextChunk & { relevanceScore: number }> {
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2);

  return chunks
    .map(chunk => {
      let score = 0;
      const chunkText = chunk.content.toLowerCase();

      // Basic keyword matching
      for (const word of queryWords) {
        const matches = (chunkText.match(new RegExp(word, 'g')) || []).length;
        score += matches * 2; // Base score for matches
      }

      // Semantic path relevance - boost if query words appear in semantic path
      if (chunk.semanticPath) {
        for (const pathElement of chunk.semanticPath) {
          const pathLower = pathElement.toLowerCase();
          for (const word of queryWords) {
            if (pathLower.includes(word) || word.includes(pathLower)) {
              score += 5; // Boost for semantic path matches
            }
          }
        }
      }

      // Structure type relevance
      if (chunk.structureType === 'heading' && queryWords.some(word => chunkText.includes(word))) {
        score += 8; // Headings are important for topic relevance
      } else if (chunk.structureType === 'paragraph') {
        score += 3; // Paragraphs usually contain detailed content
      }

      // Position bias (earlier chunks might be more relevant, but less strong)
      score += (chunks.length - chunk.index) * 0.1;

      // Length bonus for substantial content (but not too much)
      if (chunk.tokenCount > 500 && chunk.tokenCount < 5000) {
        score += 2;
      }

      return {
        ...chunk,
        relevanceScore: score,
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Configuration for naive chunk scoring based on search terms
 */
export interface NaiveSearchConfig {
  /** Primary terms with high weight for exact matches */
  primaryTerms: string[];
  /** Secondary terms with lower weight */
  secondaryTerms: string[];
  /** Terms to look for in semantic paths for section relevance */
  semanticPathTerms: string[];
  /** Weight multiplier for primary terms (default: 5) */
  primaryWeight?: number;
  /** Weight multiplier for secondary terms (default: 2) */
  secondaryWeight?: number;
  /** Weight bonus for semantic path matches (default: 20) */
  semanticPathBonus?: number;
  /** Weight bonus for paragraph content (default: 5) */
  paragraphBonus?: number;
  /** Weight bonus for substantial content (default: 3) */
  substentialContentBonus?: number;
  /** Penalty for early chunks that might be navigation (default: 2) */
  earlyChunkPenalty?: number;
}

/**
 * Find the most relevant chunk using naive search term matching
 * Generic implementation that accepts domain-specific search configuration
 */
export function findRelevantChunkByTerms(
  chunks: TextChunk[],
  config: NaiveSearchConfig
): TextChunk | null {
  if (chunks.length === 0) return null;
  if (chunks.length === 1) return chunks[0];

  const {
    primaryTerms,
    secondaryTerms,
    semanticPathTerms,
    primaryWeight = 5,
    secondaryWeight = 2,
    semanticPathBonus = 20,
    paragraphBonus = 5,
    substentialContentBonus = 3,
    earlyChunkPenalty = 2,
  } = config;

  let bestChunk = chunks[0];
  let bestScore = 0;

  for (const chunk of chunks) {
    let score = 0;
    const chunkText = chunk.content.toLowerCase();

    // Count occurrences of primary terms
    for (const term of primaryTerms) {
      const termLower = term.toLowerCase();
      const matches = (
        chunkText.match(new RegExp(`\\b${termLower.replace(/\s+/g, '\\s+')}\\b`, 'g')) || []
      ).length;
      score += matches * primaryWeight;
    }

    // Count occurrences of secondary terms
    for (const term of secondaryTerms) {
      const termLower = term.toLowerCase();
      const matches = (
        chunkText.match(new RegExp(`\\b${termLower.replace(/\s+/g, '\\s+')}\\b`, 'g')) || []
      ).length;
      score += matches * secondaryWeight;
    }

    // Boost for semantic paths that indicate relevant sections
    if (chunk.semanticPath && semanticPathTerms.length > 0) {
      for (const pathElement of chunk.semanticPath) {
        const pathLower = pathElement.toLowerCase();
        for (const term of semanticPathTerms) {
          if (pathLower.includes(term.toLowerCase())) {
            score += semanticPathBonus;
            break; // Only count once per path element
          }
        }
      }
    }

    // Boost for paragraph content (likely to contain detailed information)
    if (chunk.structureType === 'paragraph') {
      score += paragraphBonus;
    }

    // Boost for substantial content
    if (chunk.tokenCount > 200 && chunk.tokenCount < 8000) {
      score += substentialContentBonus;
    }

    // Small penalty for very early chunks (often navigation/intro content)
    if (chunk.index < 2) {
      score -= earlyChunkPenalty;
    }

    if (score > bestScore) {
      bestScore = score;
      bestChunk = chunk;
    }
  }

  return bestChunk;
}

/**
 * Configuration for naive text extraction based on search terms
 */
export interface NaiveExtractionConfig {
  /** Categories with their associated search terms */
  categories: {
    [key: string]: string[];
  };
  /** Maximum sentences to extract per category (default: 3) */
  maxSentencesPerCategory?: number;
  /** Maximum sentences for summary (default: 5) */
  maxSummaryContent?: number;
}

/**
 * Extract information from text using simple pattern matching
 * Generic implementation that accepts domain-specific extraction configuration
 */
export function extractInformationNaive(
  text: string,
  config: NaiveExtractionConfig
): Record<string, string> {
  const { categories, maxSentencesPerCategory = 3, maxSummaryContent = 5 } = config;

  // Extract sentences that mention key topics
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);

  const result: Record<string, string> = {};
  const allExtractedSentences: string[] = [];

  // Process each category
  for (const [categoryKey, terms] of Object.entries(categories)) {
    const categorySentences = sentences.filter(s =>
      terms.some(term => s.toLowerCase().includes(term.toLowerCase()))
    );

    const selectedSentences = categorySentences.slice(0, maxSentencesPerCategory);
    result[categoryKey] = selectedSentences.join('. ').trim();

    // Collect for summary (take only first sentence per category to avoid duplication)
    if (selectedSentences.length > 0) {
      allExtractedSentences.push(selectedSentences[0]);
    }
  }

  // Create a summary from collected sentences
  result.summary = allExtractedSentences.slice(0, maxSummaryContent).join('. ').trim();

  return result;
}
