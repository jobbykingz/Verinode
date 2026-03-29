import { QueryOptimizer } from '../graphql/QueryOptimizer.ts';
import { PersistedQueries } from '../graphql/PersistedQueries.ts';
import { ResponseCache } from '../graphql/ResponseCache.ts';
import { parse, DocumentNode } from 'graphql';

export class GraphQLPerformanceService {
  private static instance: GraphQLPerformanceService;
  private optimizer = QueryOptimizer.getInstance();
  private persistedQueries = PersistedQueries.getInstance();
  private responseCache = ResponseCache.getInstance();

  private constructor() {}

  public static getInstance(): GraphQLPerformanceService {
    if (!GraphQLPerformanceService.instance) {
      GraphQLPerformanceService.instance = new GraphQLPerformanceService();
    }
    return GraphQLPerformanceService.instance;
  }

  public async processGraphQLQuery(query: string, hash?: string): Promise<{
    document: DocumentNode;
    complexity: number;
    depth: number;
    cachedResponse?: any;
    suggestions: string[];
  }> {
    let finalQuery = query;

    // 1. Handle Persisted Queries
    if (hash && !query) {
      const persisted = await this.persistedQueries.getQuery(hash);
      if (!persisted) {
        throw new Error('Persisted query not found');
      }
      finalQuery = persisted;
    } else if (hash && query) {
      const isValid = await this.persistedQueries.validateHash(hash, query);
      if (!isValid) {
        throw new Error('Query hash mismatch');
      }
      await this.persistedQueries.saveQuery(query);
    }

    // 2. Parse Query
    const document = parse(finalQuery);

    // 3. Complexity Analysis
    const { complexity, depth } = this.optimizer.analyzeQueryComplexity(document);
    const suggestions = this.optimizer.suggestOptimization(complexity, depth);

    // 4. Response Caching
    const cacheKey = hash || query; // In production, unique key per query and vars
    const cachedResponse = await this.responseCache.getCachedResponse(cacheKey);

    return {
      document,
      complexity,
      depth,
      cachedResponse,
      suggestions
    };
  }

  public async trackQueryPerformance(query: string, durationInMs: number, success: boolean): Promise<void> {
    // Mock logic: send to analytics / monitoring
    console.debug(`GraphQL Query: ${query.substring(0, 50)}... | Duration: ${durationInMs}ms | Success: ${success}`);
  }
}
