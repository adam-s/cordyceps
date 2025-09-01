/**
 * Markdown extraction utility using browser-use approach with turndown
 *
 * This module provides comprehensive webpage-to-markdown conversion functionality
 * using the same patterns and libraries as the browser-use project.
 */

import TurndownService from 'turndown';
import DOMPurify from 'dompurify';
import { Page } from '@src/services/cordyceps/page';

/**
 * Configuration options for markdown extraction
 */
export interface MarkdownExtractionOptions {
  /** Maximum content size before truncation (default: 15000) */
  maxContentSize?: number;

  /** Whether to remove images completely (default: true) */
  removeImages?: boolean;

  /** Whether to remove links but keep text (default: true) */
  removeLinks?: boolean;

  /** Whether to sanitize HTML before conversion (default: true) */
  sanitizeHtml?: boolean;

  /** Custom tags to remove (default: ['script', 'style', 'meta', 'link', 'noscript']) */
  tagsToRemove?: string[];

  /** Whether to preserve code blocks (default: true) */
  preserveCodeBlocks?: boolean;

  /** Whether to preserve tables (default: true) */
  preserveTables?: boolean;

  /** Custom turndown rules */
  customRules?: Array<{
    name: string;
    filter: TurndownService.Filter;
    replacement: TurndownService.ReplacementFunction;
  }>;
}

/**
 * Result of markdown extraction
 */
export interface MarkdownExtractionResult {
  /** The extracted markdown content */
  markdown: string;

  /** Original HTML content length */
  originalLength: number;

  /** Final markdown length */
  markdownLength: number;

  /** Whether content was truncated */
  wasTruncated: boolean;

  /** Statistics about the extraction */
  stats: {
    removedTags: string[];
    imageCount: number;
    linkCount: number;
    codeBlockCount: number;
    tableCount: number;
  };
}

/**
 * Advanced markdown extractor using browser-use patterns
 */
export class MarkdownExtractor {
  private options: Required<MarkdownExtractionOptions>;

  constructor(options: MarkdownExtractionOptions = {}) {
    this.options = {
      maxContentSize: options.maxContentSize ?? 15000,
      removeImages: options.removeImages ?? true,
      removeLinks: options.removeLinks ?? true,
      sanitizeHtml: options.sanitizeHtml ?? true,
      tagsToRemove: options.tagsToRemove ?? ['script', 'style', 'meta', 'link', 'noscript'],
      preserveCodeBlocks: options.preserveCodeBlocks ?? true,
      preserveTables: options.preserveTables ?? true,
      customRules: options.customRules ?? [],
    };
  }

  /**
   * Extract markdown from a Cordyceps page using browser-use approach
   */
  async extractFromPage(page: Page): Promise<MarkdownExtractionResult> {
    // Get the page content (HTML)
    const pageContent = await page.content();

    return this.extractFromHtml(pageContent);
  }

  /**
   * Extract markdown from HTML string using browser-use approach
   */
  extractFromHtml(html: string): MarkdownExtractionResult {
    const originalLength = html.length;
    let processedHtml = html;

    // Sanitize HTML if requested
    if (this.options.sanitizeHtml) {
      processedHtml = DOMPurify.sanitize(processedHtml, {
        ALLOWED_TAGS: this.getAllowedTags(),
        ALLOWED_ATTR: ['href', 'src', 'title', 'alt', 'class', 'id'],
        KEEP_CONTENT: true,
      });
    }

    // Create turndown service (equivalent to Python's markdownify)
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full',
    });

    // Statistics tracking
    const stats = {
      removedTags: [...this.options.tagsToRemove],
      imageCount: 0,
      linkCount: 0,
      codeBlockCount: 0,
      tableCount: 0,
    };

    // Configure turndown based on browser-use patterns
    this.configureTurndownService(turndownService, stats);

    // Convert HTML to markdown
    let markdown = turndownService.turndown(processedHtml);

    // Apply post-processing
    markdown = this.postProcessMarkdown(markdown);

    // Handle truncation (like browser-use does)
    const wasTruncated = markdown.length > this.options.maxContentSize;
    if (wasTruncated) {
      markdown =
        markdown.substring(0, this.options.maxContentSize) +
        '\n\n[... content truncated to fit token limit ...]';
    }

    return {
      markdown,
      originalLength,
      markdownLength: markdown.length,
      wasTruncated,
      stats,
    };
  }

  /**
   * Configure turndown service with browser-use patterns
   */
  private configureTurndownService(
    turndownService: TurndownService,
    stats: {
      removedTags: string[];
      imageCount: number;
      linkCount: number;
      codeBlockCount: number;
      tableCount: number;
    }
  ): void {
    // Remove unwanted tags completely (browser-use pattern)
    if (this.options.tagsToRemove.length > 0) {
      this.options.tagsToRemove.forEach(tag => {
        turndownService.remove(tag as keyof HTMLElementTagNameMap);
      });
    }

    // Remove images if configured (browser-use default)
    if (this.options.removeImages) {
      turndownService.remove('img');
      turndownService.addRule('trackImages', {
        filter: 'img',
        replacement: () => {
          stats.imageCount++;
          return '';
        },
      });
    }

    // Remove link URLs but keep text content (browser-use pattern)
    if (this.options.removeLinks) {
      turndownService.addRule('plainLink', {
        filter: 'a',
        replacement: content => {
          stats.linkCount++;
          return content; // Just the text, no markdown URL syntax
        },
      });
    }

    // Preserve code blocks if configured
    if (this.options.preserveCodeBlocks) {
      turndownService.addRule('trackCodeBlocks', {
        filter: ['pre', 'code'],
        replacement: (content, node) => {
          stats.codeBlockCount++;
          // Return the content as-is, turndown will handle the conversion
          if ((node as HTMLElement).tagName === 'PRE') {
            return `\n\`\`\`\n${(node as HTMLElement).textContent}\n\`\`\`\n`;
          }
          return `\`${content}\``;
        },
      });
    }

    // Preserve tables if configured
    if (this.options.preserveTables) {
      turndownService.addRule('trackTables', {
        filter: 'table',
        replacement: content => {
          stats.tableCount++;
          // Let turndown handle table conversion normally
          return content;
        },
      });
    }

    // Add custom rules
    this.options.customRules.forEach((rule, index) => {
      turndownService.addRule(`custom_${index}`, {
        filter: rule.filter as TurndownService.Filter,
        replacement: rule.replacement as TurndownService.ReplacementFunction,
      });
    });

    // Browser-use specific: Clean up common noise elements
    turndownService.addRule('removeNavigation', {
      filter: node => {
        if (typeof node === 'string') return false;
        const element = node as HTMLElement;
        if (!element.classList || !element.id) return false;

        const classList = element.classList;
        const id = element.id;

        // Remove common navigation, footer, and sidebar elements
        return (
          classList.contains('nav') ||
          classList.contains('navigation') ||
          classList.contains('footer') ||
          classList.contains('sidebar') ||
          classList.contains('header') ||
          id === 'nav' ||
          id === 'navigation' ||
          id === 'footer' ||
          id === 'sidebar' ||
          id === 'header'
        );
      },
      replacement: () => '',
    });

    // Remove empty paragraphs and redundant whitespace
    turndownService.addRule('cleanEmptyElements', {
      filter: node => {
        if (typeof node === 'string') return false;
        const element = node as HTMLElement;
        return (
          element.tagName === 'P' && (!element.textContent || element.textContent.trim() === '')
        );
      },
      replacement: () => '',
    });
  }

  /**
   * Get allowed HTML tags for sanitization
   */
  private getAllowedTags(): string[] {
    const baseTags = [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'br',
      'div',
      'span',
      'strong',
      'b',
      'em',
      'i',
      'u',
      'ul',
      'ol',
      'li',
      'blockquote',
      'pre',
      'code',
      'a',
      'img',
    ];

    if (this.options.preserveTables) {
      baseTags.push('table', 'thead', 'tbody', 'tr', 'th', 'td');
    }

    // Remove tags that we want to exclude
    return baseTags.filter(tag => !this.options.tagsToRemove.includes(tag));
  }

  /**
   * Post-process markdown content
   */
  private postProcessMarkdown(markdown: string): string {
    return (
      markdown
        // Clean up excessive whitespace
        .replace(/\n{3,}/g, '\n\n')
        // Remove leading/trailing whitespace
        .trim()
        // Fix common markdown formatting issues
        .replace(/\*\*\s+/g, '**')
        .replace(/\s+\*\*/g, '**')
        .replace(/\*\s+/g, '*')
        .replace(/\s+\*/g, '*')
        // Clean up list formatting
        .replace(/^[\s]*-[\s]+/gm, '- ')
        .replace(/^[\s]*\*[\s]+/gm, '* ')
        // Clean up heading formatting
        .replace(/^#+\s+/gm, match => match.replace(/\s+/g, ' '))
    );
  }

  /**
   * Static method for quick extraction using default options
   */
  static async extractFromPage(
    page: Page,
    options?: MarkdownExtractionOptions
  ): Promise<MarkdownExtractionResult> {
    const extractor = new MarkdownExtractor(options);
    return extractor.extractFromPage(page);
  }

  /**
   * Static method for quick HTML extraction using default options
   */
  static extractFromHtml(
    html: string,
    options?: MarkdownExtractionOptions
  ): MarkdownExtractionResult {
    const extractor = new MarkdownExtractor(options);
    return extractor.extractFromHtml(html);
  }
}

/**
 * Utility function to extract markdown with browser-use approach for Stagehand pages
 */
export async function extractMarkdownFromStagehandPage(
  page: Page,
  goal?: string,
  options?: MarkdownExtractionOptions
): Promise<{
  markdown: string;
  extractionResult: MarkdownExtractionResult;
  prompt?: string;
}> {
  const extractor = new MarkdownExtractor(options);
  const extractionResult = await extractor.extractFromPage(page);

  let prompt: string | undefined;
  if (goal) {
    // Create browser-use style prompt
    prompt = `Your task is to extract the content of the page. You will be given a page and a goal and you should extract all relevant information around this goal from the page. If the goal is vague, summarize the page. Respond in json format.

Extraction goal: ${goal}

Page content:
${extractionResult.markdown}`;
  }

  return {
    markdown: extractionResult.markdown,
    extractionResult,
    prompt,
  };
}

/**
 * Export individual extraction functions for specific use cases
 */
export const markdownExtractors = {
  /**
   * Extract clean text content as markdown (removes all formatting)
   */
  extractCleanText: (html: string): string => {
    return MarkdownExtractor.extractFromHtml(html, {
      removeImages: true,
      removeLinks: true,
      preserveCodeBlocks: false,
      preserveTables: false,
      tagsToRemove: ['script', 'style', 'meta', 'link', 'noscript', 'nav', 'footer', 'header'],
    }).markdown;
  },

  /**
   * Extract structured content (preserves headings, lists, etc.)
   */
  extractStructured: (html: string): string => {
    return MarkdownExtractor.extractFromHtml(html, {
      removeImages: true,
      removeLinks: false,
      preserveCodeBlocks: true,
      preserveTables: true,
    }).markdown;
  },

  /**
   * Extract for AI processing (optimized for token efficiency)
   */
  extractForAI: (html: string, maxTokens: number = 4000): string => {
    const maxSize = maxTokens * 4; // Rough token-to-character ratio
    return MarkdownExtractor.extractFromHtml(html, {
      maxContentSize: maxSize,
      removeImages: true,
      removeLinks: true,
      preserveCodeBlocks: true,
      preserveTables: false,
      tagsToRemove: [
        'script',
        'style',
        'meta',
        'link',
        'noscript',
        'nav',
        'footer',
        'header',
        'aside',
      ],
    }).markdown;
  },

  /**
   * Extract article content (optimized for readability)
   */
  extractArticle: (html: string): string => {
    return MarkdownExtractor.extractFromHtml(html, {
      removeImages: false,
      removeLinks: false,
      preserveCodeBlocks: true,
      preserveTables: true,
      tagsToRemove: ['script', 'style', 'meta', 'link', 'noscript'],
    }).markdown;
  },
};
