import { DocumentNode, FieldNode, OperationDefinitionNode } from 'graphql';

export class QueryOptimizer {
  private static instance: QueryOptimizer;
  private readonly MAX_COMPLEXITY = 1000;
  private readonly MAX_DEPTH = 10;

  private constructor() {}

  public static getInstance(): QueryOptimizer {
    if (!QueryOptimizer.instance) {
      QueryOptimizer.instance = new QueryOptimizer();
    }
    return QueryOptimizer.instance;
  }

  public analyzeQueryComplexity(document: DocumentNode): { complexity: number; depth: number } {
    const operation = document.definitions.find(d => d.kind === 'OperationDefinition') as OperationDefinitionNode;
    if (!operation) return { complexity: 0, depth: 0 };

    const complexity = this.calculateComplexity(operation.selectionSet.selections as FieldNode[]);
    const depth = this.calculateDepth(operation.selectionSet.selections as FieldNode[]);

    if (complexity > this.MAX_COMPLEXITY || depth > this.MAX_DEPTH) {
      throw new Error(`Query exceeds allowed complexity (${complexity}/${this.MAX_COMPLEXITY}) or depth (${depth}/${this.MAX_DEPTH})`);
    }

    return { complexity, depth };
  }

  private calculateComplexity(selections: FieldNode[], baseComplexity = 1): number {
    let total = 0;
    for (const selection of selections) {
      let fieldComplexity = 1;
      // Mock logic: give more weight to fields with arguments or nested selections
      if (selection.arguments && selection.arguments.length > 0) fieldComplexity += 2;
      if (selection.selectionSet) {
        fieldComplexity += this.calculateComplexity(selection.selectionSet.selections as FieldNode[], baseComplexity + 1);
      }
      total += fieldComplexity;
    }
    return total;
  }

  private calculateDepth(selections: FieldNode[]): number {
    let maxDepth = 0;
    for (const selection of selections) {
      if (selection.selectionSet) {
        maxDepth = Math.max(maxDepth, 1 + this.calculateDepth(selection.selectionSet.selections as FieldNode[]));
      } else {
        maxDepth = Math.max(maxDepth, 1);
      }
    }
    return maxDepth;
  }

  public suggestOptimization(complexity: number, depth: number): string[] {
    const suggestions: string[] = [];
    if (complexity > this.MAX_COMPLEXITY * 0.8) suggestions.push('Consider using pagination for large datasets.');
    if (depth > this.MAX_DEPTH * 0.8) suggestions.push('Reduce fragment nesting to improve query performance.');
    return suggestions;
  }
}
