export enum ConflictStrategy {
  LAST_WRITE_WINS = 'LWW',
  MERGE = 'MERGE',
  MANUAL = 'MANUAL'
}

export class ConflictResolver {
  constructor(private strategy: ConflictStrategy) {}

  resolve(clientChange: any, serverChange: any): any {
    switch (this.strategy) {
      case ConflictStrategy.LAST_WRITE_WINS:
        return this.lastWriteWins(clientChange, serverChange);
      case ConflictStrategy.MERGE:
        return this.merge(clientChange, serverChange);
      default:
        return { ...clientChange, needsManualResolution: true };
    }
  }

  private lastWriteWins(client: any, server: any): any {
    const clientTime = new Date(client.updatedAt).getTime();
    const serverTime = new Date(server.updatedAt).getTime();
    
    return clientTime > serverTime ? client : server;
  }

  private merge(client: any, server: any): any {
    // Basic shallow merge, in production this would be more complex
    // potentially using Operational Transformation or CRDTs
    return {
      ...server,
      ...client,
      meta: {
        merged: true,
        originalServerVersion: server.version,
        resolvedAt: new Date()
      }
    };
  }
}