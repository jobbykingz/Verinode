/**
 * Relevance Scorer
 * Advanced relevance scoring and ranking algorithms for search results
 */

import { SearchIndexDocument } from '../models/SearchIndex';
import { SearchQuery } from './SearchEngine';
import { ParsedQuery } from './QueryProcessor';
import { logger } from '../utils/logger';

export interface ScoringFactors {
  termFrequency: number;
  inverseDocumentFrequency: number;
  fieldLength: number;
  termProximity: number;
  exactMatch: number;
  phraseMatch: number;
  fuzzyMatch: number;
  boost: number;
  freshness: number;
  popularity: number;
  rating: number;
  clickThroughRate: number;
  userPersonalization: number;
  semanticSimilarity: number;
  diversity: number;
  novelty: number;
}

export interface ScoringConfig {
  weights: Record<keyof ScoringFactors, number>;
  enablePersonalization: boolean;
  enableSemanticScoring: boolean;
  enableDiversityBoost: boolean;
  enableNoveltyBoost: boolean;
  freshnessDecay: number;
  popularityDecay: number;
  minScore: number;
  maxScore: number;
  normalizeScores: boolean;
}

export interface ScoredDocument extends SearchIndexDocument {
  relevanceScore: number;
  scoringFactors: ScoringFactors;
  rankingReasons: string[];
  confidence: number;
}

export interface RankingMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  ndcg: number;
  clickThroughRate: number;
  userSatisfaction: number;
  diversityScore: number;
  noveltyScore: number;
}

export class RelevanceScorer {
  private config: ScoringConfig;
  private documentFrequencies: Map<string, number> = new Map();
  private totalDocuments: number = 0;
  private userProfiles: Map<string, UserProfile> = new Map();
  private clickData: Map<string, ClickData> = new Map();

  constructor(config?: Partial<ScoringConfig>) {
    this.config = {
      weights: {
        termFrequency: 0.25,
        inverseDocumentFrequency: 0.20,
        fieldLength: 0.10,
        termProximity: 0.05,
        exactMatch: 0.15,
        phraseMatch: 0.10,
        fuzzyMatch: 0.05,
        boost: 0.20,
        freshness: 0.10,
        popularity: 0.15,
        rating: 0.10,
        clickThroughRate: 0.20,
        userPersonalization: 0.15,
        semanticSimilarity: 0.10,
        diversity: 0.05,
        novelty: 0.05
      },
      enablePersonalization: true,
      enableSemanticScoring: true,
      enableDiversityBoost: true,
      enableNoveltyBoost: true,
      freshnessDecay: 0.1,
      popularityDecay: 0.05,
      minScore: 0.0,
      maxScore: 1.0,
      normalizeScores: true,
      ...config
    };
  }

  /**
   * Score search results
   */
  scoreResults(documents: SearchIndexDocument[], query: SearchQuery, parsedQuery?: ParsedQuery): ScoredDocument[] {
    const startTime = Date.now();

    try {
      // Update document statistics
      this.updateDocumentStatistics(documents);

      // Score each document
      const scoredDocuments = documents.map(doc => 
        this.scoreDocument(doc, query, parsedQuery)
      );

      // Apply diversity and novelty boosts
      if (this.config.enableDiversityBoost) {
        this.applyDiversityBoost(scoredDocuments);
      }

      if (this.config.enableNoveltyBoost) {
        this.applyNoveltyBoost(scoredDocuments);
      }

      // Normalize scores if enabled
      if (this.config.normalizeScores) {
        this.normalizeScores(scoredDocuments);
      }

      // Sort by relevance score
      scoredDocuments.sort((a, b) => b.relevanceScore - a.relevanceScore);

      const processingTime = Date.now() - startTime;
      logger.debug(`Scored ${documents.length} documents in ${processingTime}ms`);

      return scoredDocuments;
    } catch (error) {
      logger.error('Scoring failed:', error);
      return documents.map(doc => this.createDefaultScoredDocument(doc));
    }
  }

  /**
   * Score individual document
   */
  private scoreDocument(document: SearchIndexDocument, query: SearchQuery, parsedQuery?: ParsedQuery): ScoredDocument {
    const factors: ScoringFactors = {
      termFrequency: 0,
      inverseDocumentFrequency: 0,
      fieldLength: 0,
      termProximity: 0,
      exactMatch: 0,
      phraseMatch: 0,
      fuzzyMatch: 0,
      boost: 0,
      freshness: 0,
      popularity: 0,
      rating: 0,
      clickThroughRate: 0,
      userPersonalization: 0,
      semanticSimilarity: 0,
      diversity: 0,
      novelty: 0
    };

    const reasons: string[] = [];

    // Calculate TF-IDF scores
    if (query.query) {
      const tfidfScore = this.calculateTFIDF(document, query.query);
      factors.termFrequency = tfidfScore.termFrequency;
      factors.inverseDocumentFrequency = tfidfScore.inverseDocumentFrequency;
      factors.fieldLength = tfidfScore.fieldLength;

      if (factors.termFrequency > 0.5) {
        reasons.push('High term frequency');
      }
      if (factors.inverseDocumentFrequency > 0.3) {
        reasons.push('Rare terms found');
      }
    }

    // Calculate exact match bonus
    if (query.query) {
      const exactScore = this.calculateExactMatch(document, query.query);
      factors.exactMatch = exactScore;
      if (exactScore > 0.7) {
        reasons.push('Exact match found');
      }
    }

    // Calculate phrase match bonus
    if (parsedQuery && parsedQuery.phrases.length > 0) {
      const phraseScore = this.calculatePhraseMatch(document, parsedQuery.phrases);
      factors.phraseMatch = phraseScore;
      if (phraseScore > 0.5) {
        reasons.push('Phrase match found');
      }
    }

    // Calculate fuzzy match bonus
    if (query.fuzzy && query.query) {
      const fuzzyScore = this.calculateFuzzyMatch(document, query.query);
      factors.fuzzyMatch = fuzzyScore;
      if (fuzzyScore > 0.3) {
        reasons.push('Fuzzy match found');
      }
    }

    // Apply field boosts
    if (query.boost) {
      const boostScore = this.calculateFieldBoost(document, query.boost);
      factors.boost = boostScore;
      if (boostScore > 0.1) {
        reasons.push('Field boost applied');
      }
    }

    // Calculate freshness score
    const freshnessScore = this.calculateFreshnessScore(document);
    factors.freshness = freshnessScore;
    if (freshnessScore > 0.5) {
      reasons.push('Recent content');
    }

    // Calculate popularity score
    const popularityScore = this.calculatePopularityScore(document);
    factors.popularity = popularityScore;
    if (popularityScore > 0.5) {
      reasons.push('Popular content');
    }

    // Calculate rating score
    const ratingScore = this.calculateRatingScore(document);
    factors.rating = ratingScore;
    if (ratingScore > 0.5) {
      reasons.push('High rating');
    }

    // Calculate click-through rate score
    const ctrScore = this.calculateClickThroughRateScore(document);
    factors.clickThroughRate = ctrScore;
    if (ctrScore > 0.5) {
      reasons.push('High engagement');
    }

    // Calculate personalization score
    if (this.config.enablePersonalization) {
      const personalizationScore = this.calculatePersonalizationScore(document);
      factors.userPersonalization = personalizationScore;
      if (personalizationScore > 0.3) {
        reasons.push('Personalized match');
      }
    }

    // Calculate semantic similarity score
    if (this.config.enableSemanticScoring) {
      const semanticScore = this.calculateSemanticSimilarity(document, query.query || '');
      factors.semanticSimilarity = semanticScore;
      if (semanticScore > 0.4) {
        reasons.push('Semantically similar');
      }
    }

    // Calculate final relevance score
    const relevanceScore = this.calculateFinalScore(factors);
    const confidence = this.calculateConfidence(factors);

    return {
      ...document,
      relevanceScore,
      scoringFactors: factors,
      rankingReasons: reasons,
      confidence
    };
  }

  /**
   * Calculate TF-IDF scores
   */
  private calculateTFIDF(document: SearchIndexDocument, query: string): {
    termFrequency: number;
    inverseDocumentFrequency: number;
    fieldLength: number;
  } {
    const terms = query.toLowerCase().split(/\s+/);
    const content = `${document.title} ${document.description} ${document.content}`.toLowerCase();

    let termFrequency = 0;
    let totalTerms = 0;

    // Calculate term frequency
    for (const term of terms) {
      const termCount = (content.match(new RegExp(term, 'g')) || []).length;
      termFrequency += termCount;
      totalTerms += content.split(/\s+/).length;
    }

    // Normalize term frequency
    const normalizedTF = totalTerms > 0 ? termFrequency / totalTerms : 0;

    // Calculate inverse document frequency
    let inverseDocumentFrequency = 0;
    for (const term of terms) {
      const docFreq = this.documentFrequencies.get(term) || 0;
      const idf = this.totalDocuments > 0 && docFreq > 0 
        ? Math.log(this.totalDocuments / docFreq) 
        : 0;
      inverseDocumentFrequency += idf;
    }
    inverseDocumentFrequency /= terms.length;

    // Calculate field length normalization
    const avgFieldLength = 100; // Average content length
    const fieldLength = content.length;
    const fieldLengthNorm = avgFieldLength / (avgFieldLength + fieldLength * 0.25);

    return {
      termFrequency: Math.min(normalizedTF, 1.0),
      inverseDocumentFrequency: Math.min(inverseDocumentFrequency / 10, 1.0),
      fieldLength: fieldLengthNorm
    };
  }

  /**
   * Calculate exact match score
   */
  private calculateExactMatch(document: SearchIndexDocument, query: string): number {
    const queryLower = query.toLowerCase();
    const titleLower = document.title.toLowerCase();
    const descriptionLower = document.description.toLowerCase();

    let score = 0;

    // Exact title match
    if (titleLower === queryLower) {
      score += 1.0;
    } else if (titleLower.includes(queryLower)) {
      score += 0.7;
    }

    // Exact description match
    if (descriptionLower.includes(queryLower)) {
      score += 0.5;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate phrase match score
   */
  private calculatePhraseMatch(document: SearchIndexDocument, phrases: string[]): number {
    const content = `${document.title} ${document.description} ${document.content}`.toLowerCase();
    let score = 0;

    for (const phrase of phrases) {
      const phraseLower = phrase.toLowerCase();
      if (content.includes(phraseLower)) {
        score += 1.0;
      }
    }

    return Math.min(score / phrases.length, 1.0);
  }

  /**
   * Calculate fuzzy match score
   */
  private calculateFuzzyMatch(document: SearchIndexDocument, query: string): number {
    const terms = query.toLowerCase().split(/\s+/);
    const content = `${document.title} ${document.description} ${document.content}`.toLowerCase();
    let score = 0;

    for (const term of terms) {
      const bestMatch = this.findBestFuzzyMatch(term, content);
      score += bestMatch;
    }

    return Math.min(score / terms.length, 1.0);
  }

  /**
   * Find best fuzzy match
   */
  private findBestFuzzyMatch(term: string, content: string): number {
    const words = content.split(/\s+/);
    let bestScore = 0;

    for (const word of words) {
      const distance = this.calculateLevenshteinDistance(term, word);
      const maxLength = Math.max(term.length, word.length);
      const similarity = maxLength > 0 ? 1 - (distance / maxLength) : 0;
      
      if (similarity > bestScore) {
        bestScore = similarity;
      }
    }

    return bestScore;
  }

  /**
   * Calculate Levenshtein distance
   */
  private calculateLevenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate field boost score
   */
  private calculateFieldBoost(document: SearchIndexDocument, boosts: Record<string, number>): number {
    let score = 0;

    for (const [field, boost] of Object.entries(boosts)) {
      const fieldValue = (document as any)[field];
      if (fieldValue && typeof fieldValue === 'string') {
        // Simple check if field contains query terms
        score += boost * 0.1;
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate freshness score
   */
  private calculateFreshnessScore(document: SearchIndexDocument): number {
    const now = new Date();
    const documentAge = now.getTime() - document.timestamp.getTime();
    const daysOld = documentAge / (1000 * 60 * 60 * 24);

    // Exponential decay
    const freshnessScore = Math.exp(-this.config.freshnessDecay * daysOld);
    return Math.min(freshnessScore, 1.0);
  }

  /**
   * Calculate popularity score
   */
  private calculatePopularityScore(document: SearchIndexDocument): number {
    const popularity = document.popularity || 0;
    const maxPopularity = 1000; // Assumed maximum popularity

    // Logarithmic scaling to prevent dominance
    const normalizedPopularity = popularity > 0 ? Math.log(popularity + 1) / Math.log(maxPopularity + 1) : 0;
    return Math.min(normalizedPopularity, 1.0);
  }

  /**
   * Calculate rating score
   */
  private calculateRatingScore(document: SearchIndexDocument): number {
    const rating = document.rating || 0;
    return Math.min(rating / 5, 1.0); // Assuming 5-star rating
  }

  /**
   * Calculate click-through rate score
   */
  private calculateClickThroughRateScore(document: SearchIndexDocument): number {
    const clickData = this.clickData.get(document.id);
    if (!clickData) return 0;

    const ctr = clickData.clicks / Math.max(clickData.impressions, 1);
    return Math.min(ctr, 1.0);
  }

  /**
   * Calculate personalization score
   */
  private calculatePersonalizationScore(document: SearchIndexDocument): number {
    // Simplified personalization based on user profile
    // In a real implementation, this would use sophisticated user modeling
    let score = 0;

    // Check if document matches user interests
    if (document.tags && document.tags.length > 0) {
      score += 0.3; // Simple boost for tagged content
    }

    // Check if document is from user's preferred category
    if (document.category) {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate semantic similarity score
   */
  private calculateSemanticSimilarity(document: SearchIndexDocument, query: string): number {
    // Simplified semantic similarity
    // In a real implementation, this would use word embeddings or transformers
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const contentWords = new Set(
      `${document.title} ${document.description} ${document.content}`.toLowerCase().split(/\s+/)
    );

    const intersection = new Set([...queryWords].filter(word => contentWords.has(word)));
    const union = new Set([...queryWords, ...contentWords]);

    const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 0;
    return Math.min(jaccardSimilarity * 2, 1.0); // Boost to account for simplicity
  }

  /**
   * Calculate final relevance score
   */
  private calculateFinalScore(factors: ScoringFactors): number {
    let score = 0;

    for (const [factor, value] of Object.entries(factors)) {
      const weight = this.config.weights[factor as keyof ScoringFactors] || 0;
      score += value * weight;
    }

    return Math.max(this.config.minScore, Math.min(score, this.config.maxScore));
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(factors: ScoringFactors): number {
    const significantFactors = Object.values(factors).filter(value => value > 0.1).length;
    const totalFactors = Object.keys(factors).length;
    
    return totalFactors > 0 ? significantFactors / totalFactors : 0;
  }

  /**
   * Apply diversity boost
   */
  private applyDiversityBoost(scoredDocuments: ScoredDocument[]): void {
    const seenCategories = new Set<string>();
    const seenTags = new Set<string>();

    for (const doc of scoredDocuments) {
      let diversityBoost = 0;

      // Category diversity
      if (doc.category && !seenCategories.has(doc.category)) {
        seenCategories.add(doc.category);
        diversityBoost += 0.1;
      }

      // Tag diversity
      if (doc.tags) {
        for (const tag of doc.tags) {
          if (!seenTags.has(tag)) {
            seenTags.add(tag);
            diversityBoost += 0.05;
          }
        }
      }

      doc.scoringFactors.diversity = Math.min(diversityBoost, 0.3);
      doc.relevanceScore += diversityBoost;
      doc.rankingReasons.push('Diversity boost applied');
    }
  }

  /**
   * Apply novelty boost
   */
  private applyNoveltyBoost(scoredDocuments: ScoredDocument[]): void {
    // Boost documents that are less frequently clicked
    const avgCtr = this.calculateAverageCTR();

    for (const doc of scoredDocuments) {
      const ctr = this.calculateClickThroughRateScore(doc);
      const noveltyBoost = Math.max(0, (avgCtr - ctr) * 0.5);

      doc.scoringFactors.novelty = noveltyBoost;
      doc.relevanceScore += noveltyBoost;
      
      if (noveltyBoost > 0.1) {
        doc.rankingReasons.push('Novelty boost applied');
      }
    }
  }

  /**
   * Normalize scores
   */
  private normalizeScores(scoredDocuments: ScoredDocument[]): void {
    if (scoredDocuments.length === 0) return;

    const scores = scoredDocuments.map(doc => doc.relevanceScore);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const range = maxScore - minScore;

    if (range === 0) return;

    for (const doc of scoredDocuments) {
      doc.relevanceScore = (doc.relevanceScore - minScore) / range;
    }
  }

  /**
   * Update document statistics
   */
  private updateDocumentStatistics(documents: SearchIndexDocument[]): void {
    this.totalDocuments = documents.length;

    // Calculate document frequencies for all terms
    const allTerms = new Set<string>();
    
    for (const doc of documents) {
      const content = `${doc.title} ${doc.description} ${doc.content} ${doc.tags?.join(' ')}`.toLowerCase();
      const terms = content.split(/\s+/);
      terms.forEach(term => allTerms.add(term));
    }

    for (const term of allTerms) {
      let docCount = 0;
      for (const doc of documents) {
        const content = `${doc.title} ${doc.description} ${doc.content} ${doc.tags?.join(' ')}`.toLowerCase();
        if (content.includes(term)) {
          docCount++;
        }
      }
      this.documentFrequencies.set(term, docCount);
    }
  }

  /**
   * Calculate average click-through rate
   */
  private calculateAverageCTR(): number {
    if (this.clickData.size === 0) return 0;

    let totalCtr = 0;
    for (const clickData of this.clickData.values()) {
      totalCtr += clickData.clicks / Math.max(clickData.impressions, 1);
    }

    return totalCtr / this.clickData.size;
  }

  /**
   * Create default scored document
   */
  private createDefaultScoredDocument(document: SearchIndexDocument): ScoredDocument {
    return {
      ...document,
      relevanceScore: 0.5,
      scoringFactors: {
        termFrequency: 0,
        inverseDocumentFrequency: 0,
        fieldLength: 0,
        termProximity: 0,
        exactMatch: 0,
        phraseMatch: 0,
        fuzzyMatch: 0,
        boost: 0,
        freshness: 0,
        popularity: 0,
        rating: 0,
        clickThroughRate: 0,
        userPersonalization: 0,
        semanticSimilarity: 0,
        diversity: 0,
        novelty: 0
      },
      rankingReasons: ['Default scoring'],
      confidence: 0
    };
  }

  /**
   * Update click data
   */
  updateClickData(documentId: string, clicked: boolean): void {
    const existing = this.clickData.get(documentId);
    if (existing) {
      existing.impressions++;
      if (clicked) {
        existing.clicks++;
      }
    } else {
      this.clickData.set(documentId, {
        impressions: 1,
        clicks: clicked ? 1 : 0
      });
    }
  }

  /**
   * Get ranking metrics
   */
  getRankingMetrics(scoredDocuments: ScoredDocument[]): RankingMetrics {
    // Simplified metrics calculation
    const avgScore = scoredDocuments.reduce((sum, doc) => sum + doc.relevanceScore, 0) / scoredDocuments.length;
    
    return {
      precision: avgScore,
      recall: avgScore * 0.8, // Simplified
      f1Score: avgScore * 0.9,
      ndcg: avgScore,
      clickThroughRate: this.calculateAverageCTR(),
      userSatisfaction: avgScore,
      diversityScore: scoredDocuments.reduce((sum, doc) => sum + doc.scoringFactors.diversity, 0) / scoredDocuments.length,
      noveltyScore: scoredDocuments.reduce((sum, doc) => sum + doc.scoringFactors.novelty, 0) / scoredDocuments.length
    };
  }
}

interface UserProfile {
  id: string;
  interests: string[];
  preferences: Record<string, any>;
  history: string[];
}

interface ClickData {
  impressions: number;
  clicks: number;
}

export default RelevanceScorer;
