/**
 * Query Processor
 * Advanced query parsing, processing, and optimization for search
 */

import { logger } from '../utils/logger';

export interface ParsedQuery {
  original: string;
  processed: string;
  terms: string[];
  phrases: string[];
  excluded: string[];
  required: string[];
  filters: QueryFilter[];
  operators: QueryOperator[];
  boostings: QueryBoosting[];
  range: QueryRange[];
  fuzzy: QueryFuzzy[];
  wildcard: QueryWildcard[];
  fielded: QueryFielded[];
  boolean: QueryBoolean;
  intent: QueryIntent;
  language: string;
  confidence: number;
  suggestions: string[];
}

export interface QueryFilter {
  field: string;
  value: any;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'exists';
  type: 'term' | 'range' | 'exists' | 'wildcard';
}

export interface QueryOperator {
  type: 'and' | 'or' | 'not';
  position: number;
  terms: string[];
}

export interface QueryBoosting {
  field: string;
  value: string;
  boost: number;
}

export interface QueryRange {
  field: string;
  min?: any;
  max?: any;
  inclusive: boolean;
}

export interface QueryFuzzy {
  term: string;
  distance: number;
  prefix_length: number;
}

export interface QueryWildcard {
  field: string;
  pattern: string;
}

export interface QueryFielded {
  field: string;
  query: string;
  operator?: string;
}

export interface QueryBoolean {
  must: string[];
  should: string[];
  must_not: string[];
  minimum_should_match: string;
}

export interface QueryIntent {
  type: 'search' | 'filter' | 'facet' | 'sort' | 'aggregate' | 'suggest';
  confidence: number;
  entities: QueryEntity[];
  context: Record<string, any>;
}

export interface QueryEntity {
  type: 'keyword' | 'category' | 'date' | 'number' | 'location' | 'person' | 'organization';
  value: string;
  confidence: number;
  position: number;
}

export interface QuerySuggestion {
  text: string;
  type: 'completion' | 'correction' | 'expansion';
  score: number;
  source: string;
}

export interface QueryProcessorConfig {
  language: string;
  enableStemming: boolean;
  enableStopWords: boolean;
  enableSynonyms: boolean;
  enableSpellCheck: boolean;
  enableEntityExtraction: boolean;
  enableIntentDetection: boolean;
  maxQueryLength: number;
  minTermLength: number;
  fuzzyThreshold: number;
  boostFields: Record<string, number>;
  stopWords: string[];
  synonyms: Record<string, string[]>;
  fieldMappings: Record<string, string[]>;
}

export class QueryProcessor {
  private config: QueryProcessorConfig;
  private stopWords: Set<string>;
  private synonyms: Map<string, string[]>;
  private fieldMappings: Map<string, string>;

  constructor(config?: Partial<QueryProcessorConfig>) {
    this.config = {
      language: 'en',
      enableStemming: true,
      enableStopWords: true,
      enableSynonyms: true,
      enableSpellCheck: true,
      enableEntityExtraction: true,
      enableIntentDetection: true,
      maxQueryLength: 1000,
      minTermLength: 2,
      fuzzyThreshold: 0.7,
      boostFields: {
        title: 3,
        description: 2,
        tags: 2,
        content: 1
      },
      stopWords: [
        'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by',
        'for', 'if', 'in', 'into', 'is', 'it', 'no', 'not',
        'of', 'on', 'or', 'such', 'that', 'the', 'their',
        'then', 'there', 'these', 'they', 'this', 'to', 'was',
        'will', 'with', 'the', 'is', 'at', 'which', 'on'
      ],
      synonyms: {},
      fieldMappings: {
        'title': ['name', 'heading', 'header'],
        'description': ['desc', 'summary', 'abstract'],
        'content': ['body', 'text', 'fulltext'],
        'category': ['type', 'kind', 'class'],
        'tags': ['keywords', 'labels', 'topics']
      },
      ...config
    };

    this.stopWords = new Set(this.config.stopWords);
    this.synonyms = new Map(Object.entries(this.config.synonyms));
    this.fieldMappings = new Map(
      Object.entries(this.config.fieldMappings).flatMap(([field, aliases]) => 
        aliases.map((alias: string) => [alias, field])
      )
    );
  }

  /**
   * Process search query
   */
  process(query: string): ParsedQuery {
    try {
      const startTime = Date.now();
      
      // Basic validation
      if (!query || query.trim().length === 0) {
        return this.createEmptyParsedQuery(query);
      }

      if (query.length > this.config.maxQueryLength) {
        throw new Error(`Query too long: ${query.length} > ${this.config.maxQueryLength}`);
      }

      // Parse and process the query
      const parsedQuery = this.parseQuery(query);
      
      // Apply enhancements
      if (this.config.enableStemming) {
        this.applyStemming(parsedQuery);
      }

      if (this.config.enableSynonyms) {
        this.applySynonyms(parsedQuery);
      }

      if (this.config.enableSpellCheck) {
        this.applySpellCheck(parsedQuery);
      }

      if (this.config.enableEntityExtraction) {
        this.extractEntities(parsedQuery);
      }

      if (this.config.enableIntentDetection) {
        this.detectIntent(parsedQuery);
      }

      // Generate suggestions
      parsedQuery.suggestions = this.generateSuggestions(parsedQuery);

      const processingTime = Date.now() - startTime;
      logger.debug(`Query processed in ${processingTime}ms: ${query}`);

      return parsedQuery;
    } catch (error) {
      logger.error('Query processing failed:', error);
      return this.createEmptyParsedQuery(query);
    }
  }

  /**
   * Parse query into components
   */
  private parseQuery(query: string): ParsedQuery {
    const parsed: ParsedQuery = {
      original: query,
      processed: query.toLowerCase(),
      terms: [],
      phrases: [],
      excluded: [],
      required: [],
      filters: [],
      operators: [],
      boostings: [],
      range: [],
      fuzzy: [],
      wildcard: [],
      fielded: [],
      boolean: {
        must: [],
        should: [],
        must_not: [],
        minimum_should_match: '1'
      },
      intent: {
        type: 'search',
        confidence: 0.5,
        entities: [],
        context: {}
      },
      language: this.config.language,
      confidence: 0.5,
      suggestions: []
    };

    // Extract quoted phrases
    const phraseRegex = /"([^"]+)"/g;
    let match;
    while ((match = phraseRegex.exec(query)) !== null) {
      parsed.phrases.push(match[1]);
      parsed.processed = parsed.processed.replace(`"${match[1]}"`, '');
    }

    // Extract fielded queries (field:value)
    const fieldRegex = /(\w+):("([^"]+)"|(\S+))/g;
    while ((match = fieldRegex.exec(query)) !== null) {
      const field = this.normalizeField(match[1]);
      const value = match[3] || match[4];
      parsed.fielded.push({
        field,
        query: value,
        operator: ':'
      });
      parsed.processed = parsed.processed.replace(match[0], '');
    }

    // Extract range queries (field:[min TO max])
    const rangeRegex = /(\w+):\[([^\s]+)\s+TO\s+([^\s]+)\]/g;
    while ((match = rangeRegex.exec(query)) !== null) {
      const field = this.normalizeField(match[1]);
      parsed.range.push({
        field,
        min: match[2],
        max: match[3],
        inclusive: true
      });
      parsed.processed = parsed.processed.replace(match[0], '');
    }

    // Extract excluded terms (-term)
    const excludeRegex = /-(\w+)/g;
    while ((match = excludeRegex.exec(query)) !== null) {
      parsed.excluded.push(match[1]);
      parsed.processed = parsed.processed.replace(match[0], '');
    }

    // Extract required terms (+term)
    const requireRegex = /\+(\w+)/g;
    while ((match = requireRegex.exec(query)) !== null) {
      parsed.required.push(match[1]);
      parsed.processed = parsed.processed.replace(match[0], '');
    }

    // Extract fuzzy terms (term~)
    const fuzzyRegex = /(\w+)~/g;
    while ((match = fuzzyRegex.exec(query)) !== null) {
      parsed.fuzzy.push({
        term: match[1],
        distance: 1,
        prefix_length: 0
      });
      parsed.processed = parsed.processed.replace(match[0], '');
    }

    // Extract wildcard terms (term*)
    const wildcardRegex = /(\w+)\*/g;
    while ((match = wildcardRegex.exec(query)) !== null) {
      parsed.wildcard.push({
        field: '_all',
        pattern: match[1] + '*'
      });
      parsed.processed = parsed.processed.replace(match[0], '');
    }

    // Clean up and extract remaining terms
    parsed.processed = parsed.processed.replace(/\s+/g, ' ').trim();
    parsed.terms = this.extractTerms(parsed.processed);

    // Build boolean structure
    this.buildBooleanStructure(parsed);

    return parsed;
  }

  /**
   * Extract terms from processed query
   */
  private extractTerms(text: string): string[] {
    const terms = text
      .split(/\s+/)
      .filter(term => 
        term.length >= this.config.minTermLength &&
        !this.stopWords.has(term)
      );

    return [...new Set(terms)]; // Remove duplicates
  }

  /**
   * Build boolean query structure
   */
  private buildBooleanStructure(parsed: ParsedQuery): void {
    parsed.boolean.must = [...parsed.required];
    parsed.boolean.should = [...parsed.terms, ...parsed.phrases];
    parsed.boolean.must_not = [...parsed.excluded];

    // Set minimum should match based on query complexity
    if (parsed.boolean.should.length > 3) {
      parsed.boolean.minimum_should_match = '50%';
    } else if (parsed.boolean.should.length > 1) {
      parsed.boolean.minimum_should_match = '1';
    }
  }

  /**
   * Apply stemming to terms
   */
  private applyStemming(parsed: ParsedQuery): void {
    // Simple stemming implementation - in production, use a proper stemmer
    const stemRules = [
      { regex: /ing$/, replacement: '' },
      { regex: /ed$/, replacement: '' },
      { regex: /s$/, replacement: '' },
      { regex: /ies$/, replacement: 'y' },
      { regex: /ied$/, replacement: 'y' }
    ];

    const stemTerm = (term: string): string => {
      for (const rule of stemRules) {
        if (rule.regex.test(term)) {
          return term.replace(rule.regex, rule.replacement);
        }
      }
      return term;
    };

    parsed.terms = parsed.terms.map(stemTerm);
    parsed.phrases = parsed.phrases.map(phrase => 
      phrase.split(/\s+/).map(stemTerm).join(' ')
    );
  }

  /**
   * Apply synonyms to terms
   */
  private applySynonyms(parsed: ParsedQuery): void {
    const expandedTerms: string[] = [];

    for (const term of parsed.terms) {
      const synonyms = this.synonyms.get(term) || [];
      expandedTerms.push(term, ...synonyms);
    }

    parsed.terms = [...new Set(expandedTerms)];
  }

  /**
   * Apply spell checking
   */
  private applySpellCheck(parsed: ParsedQuery): void {
    // Simple spell check implementation - in production, use a proper spell checker
    const commonMisspellings: Record<string, string> = {
      'verfiy': 'verify',
      'proff': 'proof',
      'cource': 'course',
      'templat': 'template',
      'serch': 'search'
    };

    const correctTerm = (term: string): string => {
      return commonMisspellings[term] || term;
    };

    parsed.terms = parsed.terms.map(correctTerm);
  }

  /**
   * Extract entities from query
   */
  private extractEntities(parsed: ParsedQuery): void {
    // Simple entity extraction - in production, use NLP libraries
    const entityPatterns = {
      date: /\b(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/,
      number: /\b(\d+(?:\.\d+)?)\b/,
      location: /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/,
      category: /\b(blockchain|crypto|web3|defi|nft|dao)\b/i
    };

    for (const [type, pattern] of Object.entries(entityPatterns)) {
      let match;
      while ((match = pattern.exec(parsed.original)) !== null) {
        parsed.intent.entities.push({
          type: type as any,
          value: match[1],
          confidence: 0.8,
          position: match.index
        });
      }
    }
  }

  /**
   * Detect query intent
   */
  private detectIntent(parsed: ParsedQuery): void {
    const query = parsed.original.toLowerCase();

    // Check for different intent types
    if (query.includes('filter') || query.includes('where') || parsed.fielded.length > 0) {
      parsed.intent.type = 'filter';
      parsed.intent.confidence = 0.8;
    } else if (query.includes('sort') || query.includes('order')) {
      parsed.intent.type = 'sort';
      parsed.intent.confidence = 0.8;
    } else if (query.includes('suggest') || query.includes('recommend')) {
      parsed.intent.type = 'suggest';
      parsed.intent.confidence = 0.8;
    } else if (query.includes('count') || query.includes('total') || query.includes('aggregate')) {
      parsed.intent.type = 'aggregate';
      parsed.intent.confidence = 0.8;
    } else {
      parsed.intent.type = 'search';
      parsed.intent.confidence = 0.6;
    }

    // Adjust confidence based on query complexity
    if (parsed.terms.length > 3 || parsed.filters.length > 0) {
      parsed.intent.confidence = Math.min(0.9, parsed.intent.confidence + 0.2);
    }
  }

  /**
   * Generate query suggestions
   */
  private generateSuggestions(parsed: ParsedQuery): string[] {
    const suggestions: string[] = [];

    // Add completion suggestions
    for (const term of parsed.terms) {
      if (term.length >= 3) {
        suggestions.push(`${term}*`);
      }
    }

    // Add correction suggestions
    for (const term of parsed.terms) {
      if (term.length > 5) {
        suggestions.push(term.slice(0, -1)); // Remove last character
      }
    }

    // Add expansion suggestions
    if (parsed.terms.length === 1) {
      suggestions.push(`${parsed.terms[0]} tutorial`);
      suggestions.push(`${parsed.terms[0]} guide`);
      suggestions.push(`${parsed.terms[0]} examples`);
    }

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }

  /**
   * Normalize field name
   */
  private normalizeField(field: string): string {
    return this.fieldMappings.get(field) || field;
  }

  /**
   * Create empty parsed query
   */
  private createEmptyParsedQuery(query: string): ParsedQuery {
    return {
      original: query,
      processed: '',
      terms: [],
      phrases: [],
      excluded: [],
      required: [],
      filters: [],
      operators: [],
      boostings: [],
      range: [],
      fuzzy: [],
      wildcard: [],
      fielded: [],
      boolean: {
        must: [],
        should: [],
        must_not: [],
        minimum_should_match: '1'
      },
      intent: {
        type: 'search',
        confidence: 0.0,
        entities: [],
        context: {}
      },
      language: this.config.language,
      confidence: 0.0,
      suggestions: []
    };
  }

  /**
   * Validate query syntax
   */
  validateQuery(query: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for balanced quotes
    const quoteCount = (query.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      errors.push('Unbalanced quotes in query');
    }

    // Check for balanced brackets
    const bracketCount = (query.match(/\[/g) || []).length;
    const closingBracketCount = (query.match(/\]/g) || []).length;
    if (bracketCount !== closingBracketCount) {
      errors.push('Unbalanced brackets in query');
    }

    // Check for invalid characters
    const invalidChars = query.match(/[<>|\\]/g);
    if (invalidChars) {
      errors.push(`Invalid characters found: ${invalidChars.join(', ')}`);
    }

    // Check query length
    if (query.length > this.config.maxQueryLength) {
      errors.push(`Query too long: ${query.length} characters`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Optimize query for performance
   */
  optimizeQuery(parsed: ParsedQuery): ParsedQuery {
    // Remove redundant terms
    parsed.terms = [...new Set(parsed.terms)];

    // Prioritize important terms
    parsed.terms.sort((a, b) => b.length - a.length);

    // Limit number of terms for performance
    if (parsed.terms.length > 10) {
      parsed.terms = parsed.terms.slice(0, 10);
    }

    // Adjust minimum should match for performance
    if (parsed.boolean.should.length > 5) {
      parsed.boolean.minimum_should_match = '75%';
    }

    return parsed;
  }

  /**
   * Get query statistics
   */
  getQueryStats(parsed: ParsedQuery): Record<string, any> {
    return {
      originalLength: parsed.original.length,
      processedLength: parsed.processed.length,
      termCount: parsed.terms.length,
      phraseCount: parsed.phrases.length,
      filterCount: parsed.filters.length,
      fieldedCount: parsed.fielded.length,
      intent: parsed.intent.type,
      confidence: parsed.confidence,
      language: parsed.language,
      hasWildcards: parsed.wildcard.length > 0,
      hasFuzzy: parsed.fuzzy.length > 0,
      hasRange: parsed.range.length > 0
    };
  }
}

export default QueryProcessor;
