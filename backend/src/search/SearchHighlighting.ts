/**
 * Search Result Highlighting
 * Advanced highlighting and snippet generation for search results
 */

import { SearchIndexDocument } from '../models/SearchIndex';
import { logger } from '../utils/logger';

export interface HighlightConfig {
  enabled: boolean;
  maxSnippets: number;
  snippetSize: number;
  fragmentSize: number;
  highlightTag: string;
  highlightClass: string;
  requireFieldMatch: boolean;
  order: 'score' | 'none';
  encoder: 'html' | 'default';
  preTags: string[];
  postTags: string[];
  boundaryChars: string[];
  boundaryScanner: 'chars' | 'word' | 'sentence';
  boundaryMaxScan: number;
}

export interface HighlightRequest {
  query: string;
  fields: string[];
  config?: Partial<HighlightConfig>;
  options?: HighlightOptions;
}

export interface HighlightOptions {
  numberOfFragments?: number;
  fragmentSize?: number;
  maxAnalyzedChars?: number;
  preTags?: string[];
  postTags?: string[];
  requireFieldMatch?: boolean;
  highlightQuery?: string;
}

export interface HighlightResult {
  field: string;
  snippets: string[];
  highlighted: string;
  score: number;
  matchedTerms: string[];
  fragmentCount: number;
}

export interface DocumentHighlight {
  documentId: string;
  highlights: Record<string, HighlightResult>;
  totalMatches: number;
  bestField: string;
  bestScore: number;
}

export interface SnippetGenerator {
  generateSnippets(content: string, query: string, maxSnippets: number, fragmentSize: number): string[];
}

export class SearchHighlighter {
  private config: HighlightConfig;
  private snippetGenerator: SnippetGenerator;

  constructor(config?: Partial<HighlightConfig>) {
    this.config = {
      enabled: true,
      maxSnippets: 3,
      snippetSize: 150,
      fragmentSize: 150,
      highlightTag: 'mark',
      highlightClass: 'search-highlight',
      requireFieldMatch: false,
      order: 'score',
      encoder: 'html',
      preTags: ['<mark>'],
      postTags: ['</mark>'],
      boundaryChars: '.,!? \t\n\r;:'.split(''),
      boundaryScanner: 'word',
      boundaryMaxScan: 20,
      ...config
    };

    this.snippetGenerator = new DefaultSnippetGenerator();
  }

  /**
   * Highlight search results
   */
  highlightResults(documents: SearchIndexDocument[], request: HighlightRequest): DocumentHighlight[] {
    if (!this.config.enabled) {
      return documents.map(doc => ({
        documentId: doc.id,
        highlights: {},
        totalMatches: 0,
        bestField: '',
        bestScore: 0
      }));
    }

    const results: DocumentHighlight[] = [];

    for (const document of documents) {
      const highlight = this.highlightDocument(document, request);
      results.push(highlight);
    }

    return results;
  }

  /**
   * Highlight single document
   */
  private highlightDocument(document: SearchIndexDocument, request: HighlightRequest): DocumentHighlight {
    const highlights: Record<string, HighlightResult> = {};
    let totalMatches = 0;
    let bestField = '';
    let bestScore = 0;

    for (const field of request.fields) {
      const fieldValue = this.getFieldValue(document, field);
      if (!fieldValue) continue;

      const highlightResult = this.highlightField(fieldValue, request.query, field, request.options);
      highlights[field] = highlightResult;

      totalMatches += highlightResult.matchedTerms.length;

      if (highlightResult.score > bestScore) {
        bestScore = highlightResult.score;
        bestField = field;
      }
    }

    return {
      documentId: document.id,
      highlights,
      totalMatches,
      bestField,
      bestScore
    };
  }

  /**
   * Highlight field content
   */
  private highlightField(
    content: string,
    query: string,
    field: string,
    options?: HighlightOptions
  ): HighlightResult {
    const queryTerms = this.extractQueryTerms(query);
    const matchedTerms = this.findMatchedTerms(content, queryTerms);
    
    if (matchedTerms.length === 0) {
      return {
        field,
        snippets: [],
        highlighted: content,
        score: 0,
        matchedTerms: [],
        fragmentCount: 0
      };
    }

    // Generate snippets
    const snippetCount = options?.numberOfFragments || this.config.maxSnippets;
    const fragmentSize = options?.fragmentSize || this.config.fragmentSize;
    const snippets = this.snippetGenerator.generateSnippets(content, query, snippetCount, fragmentSize);

    // Highlight content
    const highlighted = this.highlightText(content, queryTerms, options);

    // Calculate highlight score
    const score = this.calculateHighlightScore(content, matchedTerms, field);

    return {
      field,
      snippets,
      highlighted,
      score,
      matchedTerms,
      fragmentCount: snippets.length
    };
  }

  /**
   * Extract query terms
   */
  private extractQueryTerms(query: string): string[] {
    // Remove special characters and split into terms
    const cleanQuery = query.toLowerCase().replace(/[^\w\s]/g, ' ');
    const terms = cleanQuery.split(/\s+/).filter(term => term.length >= 2);
    
    // Remove duplicates
    return Array.from(new Set(terms));
  }

  /**
   * Find matched terms in content
   */
  private findMatchedTerms(content: string, queryTerms: string[]): string[] {
    const contentLower = content.toLowerCase();
    const matchedTerms: string[] = [];

    for (const term of queryTerms) {
      if (contentLower.includes(term)) {
        matchedTerms.push(term);
      }
    }

    return matchedTerms;
  }

  /**
   * Highlight text with query terms
   */
  private highlightText(text: string, queryTerms: string[], options?: HighlightOptions): string {
    const preTags = options?.preTags || this.config.preTags;
    const postTags = options?.postTags || this.config.postTags;
    
    let highlighted = text;

    for (const term of queryTerms) {
      const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
      highlighted = highlighted.replace(regex, preTags[0] + '$1' + postTags[0]);
    }

    return highlighted;
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Calculate highlight score
   */
  private calculateHighlightScore(content: string, matchedTerms: string[], field: string): number {
    let score = 0;
    const contentLength = content.length;

    // Base score for number of matches
    score += matchedTerms.length * 10;

    // Bonus for term density
    const termDensity = matchedTerms.length / (contentLength / 100); // terms per 100 chars
    score += termDensity * 5;

    // Bonus for field importance
    const fieldWeights: Record<string, number> = {
      'title': 3,
      'description': 2,
      'content': 1,
      'tags': 2
    };
    score *= fieldWeights[field] || 1;

    // Bonus for early matches
    for (const term of matchedTerms) {
      const index = content.toLowerCase().indexOf(term);
      if (index < contentLength * 0.3) { // In first 30% of content
        score += 5;
      }
    }

    return score;
  }

  /**
   * Get field value from document
   */
  private getFieldValue(document: SearchIndexDocument, field: string): string {
    switch (field) {
      case 'title':
        return document.title;
      case 'description':
        return document.description;
      case 'content':
        return document.content;
      case 'tags':
        return document.tags?.join(' ') || '';
      default:
        return (document as any)[field] || '';
    }
  }

  /**
   * Generate highlighted snippets only
   */
  generateSnippets(document: SearchIndexDocument, query: string, field: string, maxSnippets: number = 3): string[] {
    const content = this.getFieldValue(document, field);
    if (!content) return [];

    return this.snippetGenerator.generateSnippets(content, query, maxSnippets, this.config.snippetSize);
  }

  /**
   * Get highlight statistics
   */
  getStatistics(highlights: DocumentHighlight[]): {
    totalDocuments: number;
    totalMatches: number;
    averageMatches: number;
    topFields: Array<{ field: string; count: number }>;
    averageSnippets: number;
  } {
    const totalDocuments = highlights.length;
    const totalMatches = highlights.reduce((sum, h) => sum + h.totalMatches, 0);
    const averageMatches = totalDocuments > 0 ? totalMatches / totalDocuments : 0;

    // Count field usage
    const fieldCounts = new Map<string, number>();
    for (const highlight of highlights) {
      for (const field of Object.keys(highlight.highlights)) {
        fieldCounts.set(field, (fieldCounts.get(field) || 0) + 1);
      }
    }

    const topFields = Array.from(fieldCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([field, count]) => ({ field, count }));

    const totalSnippets = highlights.reduce((sum, h) => 
      sum + Object.values(h.highlights).reduce((fieldSum, fieldHighlight) => 
        fieldSum + fieldHighlight.fragmentCount, 0), 0
    );
    const averageSnippets = totalDocuments > 0 ? totalSnippets / totalDocuments : 0;

    return {
      totalDocuments,
      totalMatches,
      averageMatches,
      topFields,
      averageSnippets
    };
  }
}

/**
 * Default snippet generator implementation
 */
class DefaultSnippetGenerator implements SnippetGenerator {
  generateSnippets(content: string, query: string, maxSnippets: number, fragmentSize: number): string[] {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length >= 2);
    const snippets: string[] = [];
    const contentLower = content.toLowerCase();

    // Find all match positions
    const matches: Array<{ term: string; position: number; length: number }> = [];

    for (const term of queryTerms) {
      let position = contentLower.indexOf(term);
      while (position !== -1) {
        matches.push({ term, position, length: term.length });
        position = contentLower.indexOf(term, position + 1);
      }
    }

    // Sort matches by position
    matches.sort((a, b) => a.position - b.position);

    // Generate snippets around matches
    for (let i = 0; i < Math.min(matches.length, maxSnippets); i++) {
      const match = matches[i];
      const start = Math.max(0, match.position - fragmentSize / 3);
      const end = Math.min(content.length, match.position + fragmentSize * 2 / 3);

      let snippet = content.substring(start, end);

      // Add ellipsis if needed
      if (start > 0) snippet = '...' + snippet;
      if (end < content.length) snippet = snippet + '...';

      // Highlight the matched term
      const highlightedSnippet = this.highlightSnippet(snippet, match.term, match.position - start);

      snippets.push(highlightedSnippet);
    }

    return snippets;
  }

  private highlightSnippet(snippet: string, term: string, offset: number): string {
    const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
    return snippet.replace(regex, '<mark>$1</mark>');
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

/**
 * Advanced snippet generator with context awareness
 */
export class AdvancedSnippetGenerator implements SnippetGenerator {
  private boundaryChars: string[];
  private maxScan: number;

  constructor(boundaryChars: string[] = '.,!? \t\n\r;:'.split(' '), maxScan: number = 20) {
    this.boundaryChars = boundaryChars;
    this.maxScan = maxScan;
  }

  generateSnippets(content: string, query: string, maxSnippets: number, fragmentSize: number): string[] {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length >= 2);
    const snippets: string[] = [];
    const usedPositions = new Set<number>();

    for (const term of queryTerms) {
      const termSnippets = this.generateTermSnippets(content, term, fragmentSize, usedPositions);
      snippets.push(...termSnippets);

      if (snippets.length >= maxSnippets) {
        break;
      }
    }

    return snippets.slice(0, maxSnippets);
  }

  private generateTermSnippets(content: string, term: string, fragmentSize: number, usedPositions: Set<number>): string[] {
    const snippets: string[] = [];
    const contentLower = content.toLowerCase();
    let position = contentLower.indexOf(term);

    while (position !== -1 && snippets.length < 3) {
      // Check if this position is too close to already used positions
      if (this.isPositionTooClose(position, usedPositions)) {
        position = contentLower.indexOf(term, position + 1);
        continue;
      }

      const snippet = this.extractContextualSnippet(content, position, term, fragmentSize);
      snippets.push(snippet);
      usedPositions.add(position);

      position = contentLower.indexOf(term, position + 1);
    }

    return snippets;
  }

  private isPositionTooClose(position: number, usedPositions: Set<number>): boolean {
    for (const usedPos of usedPositions) {
      if (Math.abs(position - usedPos) < 100) { // Within 100 characters
        return true;
      }
    }
    return false;
  }

  private extractContextualSnippet(content: string, position: number, term: string, fragmentSize: number): string {
    // Find sentence boundaries
    const start = this.findSentenceStart(content, position, fragmentSize);
    const end = this.findSentenceEnd(content, position + term.length, fragmentSize);

    let snippet = content.substring(start, end);

    // Add ellipsis if needed
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    // Highlight the term
    const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
    snippet = snippet.replace(regex, '<mark>$1</mark>');

    return snippet;
  }

  private findSentenceStart(content: string, position: number, maxFragmentSize: number): number {
    let start = Math.max(0, position - maxFragmentSize / 3);

    // Look for sentence boundary
    for (let i = position - 1; i >= start && i >= 0; i--) {
      if (this.boundaryChars.includes(content[i])) {
        return i + 1;
      }
    }

    return start;
  }

  private findSentenceEnd(content: string, position: number, maxFragmentSize: number): number {
    let end = Math.min(content.length, position + maxFragmentSize * 2 / 3);

    // Look for sentence boundary
    for (let i = position; i < end && i < content.length; i++) {
      if (this.boundaryChars.includes(content[i])) {
        return i + 1;
      }
    }

    return end;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

/**
 * Highlight utilities
 */
export class HighlightUtils {
  /**
   * Strip HTML tags from highlighted text
   */
  static stripHighlights(text: string): string {
    return text.replace(/<[^>]*>/g, '');
  }

  /**
   * Extract highlighted terms
   */
  static extractHighlightedTerms(highlightedText: string): string[] {
    const regex = /<mark>(.*?)<\/mark>/gi;
    const terms: string[] = [];
    let match;

    while ((match = regex.exec(highlightedText)) !== null) {
      terms.push(match[1]);
    }

    return terms;
  }

  /**
   * Count highlighted terms
   */
  static countHighlightedTerms(highlightedText: string): number {
    const regex = /<mark>/g;
    const matches = highlightedText.match(regex);
    return matches ? matches.length : 0;
  }

  /**
   * Convert highlights to different format
   */
  static convertHighlights(
    text: string, 
    fromFormat: 'html' | 'markdown' | 'ansi', 
    toFormat: 'html' | 'markdown' | 'ansi'
  ): string {
    // Remove existing highlights
    let cleanText = this.stripHighlights(text);

    // Re-apply highlights in new format (simplified)
    if (toFormat === 'markdown') {
      return cleanText.replace(/\b(term)\b/g, '**$1**'); // Simplified
    } else if (toFormat === 'ansi') {
      return cleanText.replace(/\b(term)\b/g, '\x1b[1m$1\x1b[0m'); // Simplified
    }

    return cleanText; // Default to HTML
  }

  /**
   * Merge multiple highlight results
   */
  static mergeHighlights(highlights: HighlightResult[]): HighlightResult {
    if (highlights.length === 0) {
      return {
        field: '',
        snippets: [],
        highlighted: '',
        score: 0,
        matchedTerms: [],
        fragmentCount: 0
      };
    }

    if (highlights.length === 1) {
      return highlights[0];
    }

    const merged: HighlightResult = {
      field: highlights[0].field,
      snippets: [],
      highlighted: '',
      score: 0,
      matchedTerms: [],
      fragmentCount: 0
    };

    // Merge snippets
    for (const highlight of highlights) {
      merged.snippets.push(...highlight.snippets);
    }

    // Remove duplicate snippets
    merged.snippets = Array.from(new Set(merged.snippets));

    // Merge matched terms
    const termSet = new Set<string>();
    for (const highlight of highlights) {
      for (const term of highlight.matchedTerms) {
        termSet.add(term);
      }
    }
    merged.matchedTerms = Array.from(termSet);

    // Sum scores
    merged.score = highlights.reduce((sum, h) => sum + h.score, 0);

    // Sum fragment counts
    merged.fragmentCount = highlights.reduce((sum, h) => sum + h.fragmentCount, 0);

    return merged;
  }
}

export default SearchHighlighter;
