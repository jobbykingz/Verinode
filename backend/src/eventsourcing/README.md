# Event Sourcing Implementation

This implementation provides a comprehensive event sourcing pattern for the Verinode backend, enabling complete audit trails, temporal queries, and system reconstruction.

## Overview

Event sourcing is a pattern where state changes are recorded as a sequence of immutable events. Instead of storing the current state of an entity, we store the full history of events that led to that state. This provides powerful capabilities for auditing, debugging, and system reconstruction.

## Architecture

### Core Components

1. **Event Model** (`backend/src/models/Event.ts`)
   - Defines the structure for immutable events
   - Includes metadata for tracking, correlation, and causation
   - Supports event versioning and migration

2. **Snapshot Model** (`backend/src/models/Snapshot.ts`)
   - Provides performance optimization through state snapshots
   - Includes compression and integrity verification
   - Supports automatic expiration and cleanup

3. **EventStore** (`backend/src/eventsourcing/EventStore.ts`)
   - Handles persistence and retrieval of events
   - Provides deduplication and ordering guarantees
   - Includes batch processing and metrics

4. **EventStream** (`backend/src/eventsourcing/EventStream.ts`)
   - Manages event streams per aggregate
   - Supports live streaming and historical replay
   - Provides filtering and transformation capabilities

5. **SnapshotManager** (`backend/src/eventsourcing/SnapshotManager.ts`)
   - Manages snapshot creation and restoration
   - Handles compression and decompression
   - Provides automatic cleanup and retention policies

6. **EventReplay** (`backend/src/eventsourcing/EventReplay.ts`)
   - Reconstructs state from events and snapshots
   - Supports temporal queries and state history
   - Provides validation and integrity checking

7. **EventSourcingService** (`backend/src/services/eventsourcing/EventSourcingService.ts`)
   - Main service orchestrating all components
   - Provides high-level API for event operations
   - Handles background tasks and monitoring

## Features

### ✅ Immutable Event Storage
- All events are stored as immutable records
- Each event has a unique ID and sequence number
- Events cannot be modified once stored

### ✅ Event Stream Management
- Separate event streams per aggregate
- Supports live streaming and historical replay
- Provides filtering and transformation capabilities

### ✅ Snapshot Creation
- Automatic snapshot creation at configurable intervals
- Manual snapshot creation on demand
- Compression support for storage optimization

### ✅ Event Replay Capabilities
- Full state reconstruction from events
- Efficient replay using snapshots
- Support for temporal queries

### ✅ Temporal Queries
- Query state at any point in time
- Full audit trail of all changes
- Historical state analysis

### ✅ Event Versioning
- Support for event schema evolution
- Migration capabilities for event format changes
- Backward compatibility handling

### ✅ Performance Optimization
- Efficient indexing for fast queries
- Snapshot-based replay optimization
- Batch processing capabilities

### ✅ Database Integration
- Seamless integration with existing MongoDB/Mongoose setup
- Optimized indexes for event queries
- Transaction support for consistency

### ✅ Event Deduplication
- Automatic duplicate event detection
- Ordering guarantees for event processing
- Idempotent event handling

### ✅ Monitoring and Metrics
- Comprehensive metrics collection
- Performance monitoring
- Health status tracking

## Usage Examples

### Basic Event Sourcing

```typescript
import { EventSourcingService } from './services/eventsourcing/EventSourcingService';

// Initialize the service
const eventSourcing = new EventSourcingService({
  enableSnapshots: true,
  autoSnapshotInterval: 100,
  maxEventRetention: 365
});

await eventSourcing.initialize();

// Save events
const event = await eventSourcing.saveEvent({
  aggregateId: 'proof-123',
  aggregateType: 'Proof',
  eventType: 'Created',
  eventData: {
    title: 'Identity Proof',
    status: 'draft'
  },
  eventMetadata: {
    userId: 'user-123',
    correlationId: 'corr-123'
  }
});

// Get current state
const state = await eventSourcing.getAggregateState('proof-123', 'Proof');
console.log(state.state); // { title: 'Identity Proof', status: 'draft' }
```

### Temporal Queries

```typescript
// Get state at specific time
const historicalState = await eventSourcing.getStateAtTime({
  aggregateId: 'proof-123',
  aggregateType: 'Proof',
  atTimestamp: new Date('2024-01-15T10:00:00Z')
});

// Get state history
const history = await eventSourcing.eventReplay.getStateHistory(
  'proof-123',
  'Proof',
  {
    fromTimestamp: new Date('2024-01-01'),
    toTimestamp: new Date('2024-01-31'),
    interval: 60 // 1 hour intervals
  }
);
```

### Event Streaming

```typescript
// Create event stream
const stream = await eventSourcing.getEventStream({
  aggregateId: 'proof-123',
  aggregateType: 'Proof',
  liveMode: true
});

// Listen to events
stream.on('event', (event) => {
  console.log('New event:', event);
});

await stream.start();
```

### Snapshot Management

```typescript
// Create manual snapshot
const snapshot = await eventSourcing.createSnapshot(
  'proof-123',
  'Proof',
  true // force creation
);

// Get available snapshots
const snapshots = await eventSourcing.getSnapshots('proof-123');
```

## Configuration Options

### EventSourcingService Options

```typescript
const options = {
  eventStore: {
    batchSize: 100,
    enableSnapshots: true,
    snapshotInterval: 100,
    maxRetries: 3
  },
  snapshotManager: {
    compressionAlgorithm: 'gzip',
    retentionDays: 30,
    maxSnapshotsPerAggregate: 10,
    autoCleanup: true
  },
  enableSnapshots: true,
  enableEventStreams: true,
  enableReplay: true,
  autoSnapshotInterval: 100,
  maxEventRetention: 365
};
```

## Performance Considerations

### Indexing Strategy
- Compound indexes on `(aggregateId, sequenceNumber)` for fast event retrieval
- Indexes on `eventType` and `createdAt` for temporal queries
- TTL indexes for automatic snapshot cleanup

### Snapshot Optimization
- Snapshots are created at configurable intervals
- Compression reduces storage requirements
- Snapshots are used as starting points for replay

### Batch Processing
- Events can be saved in batches for better performance
- Batch size is configurable based on system requirements
- Parallel processing support for large datasets

## Monitoring and Metrics

The system provides comprehensive metrics:

```typescript
const metrics = await eventSourcing.getMetrics();
console.log(metrics);
// {
//   eventStore: { totalEvents: 1000, eventsPerSecond: 5.2 },
//   snapshotManager: { totalSnapshots: 10, compressionRatio: 0.3 },
//   eventReplay: { totalReplays: 50, averageReplayTime: 150 },
//   totalAggregates: 25,
//   totalEvents: 1000,
//   totalSnapshots: 10,
//   systemHealth: 'healthy'
// }
```

## Testing

Comprehensive test suite included:

```bash
npm test -- --testPathPattern=eventSourcing.test.ts
```

Test coverage includes:
- Event storage and retrieval
- Aggregate state management
- Snapshot creation and restoration
- Event replay functionality
- Temporal queries
- Event streaming
- Validation and integrity checking
- Metrics and monitoring

## Migration Guide

### From Existing System

1. **Initial Setup**
   ```typescript
   // Initialize event sourcing
   const eventSourcing = new EventSourcingService();
   await eventSourcing.initialize();
   ```

2. **Data Migration**
   ```typescript
   // Migrate existing entities to events
   for (const entity of existingEntities) {
     await eventSourcing.saveEvent({
       aggregateId: entity.id,
       aggregateType: entity.type,
       eventType: 'Migrated',
       eventData: entity
     });
   }
   ```

3. **Create Initial Snapshots**
   ```typescript
   // Create snapshots for all entities
   for (const entity of existingEntities) {
     await eventSourcing.createSnapshot(entity.id, entity.type, true);
   }
   ```

## Best Practices

1. **Event Design**
   - Keep events small and focused
   - Include all necessary data in events
   - Use descriptive event types

2. **Snapshot Strategy**
   - Configure appropriate snapshot intervals
   - Monitor snapshot performance
   - Set appropriate retention policies

3. **Error Handling**
   - Implement retry logic for event processing
   - Monitor system health metrics
   - Set up alerts for error rates

4. **Performance**
   - Use batch processing for large datasets
   - Monitor query performance
   - Optimize indexes based on usage patterns

## Troubleshooting

### Common Issues

1. **Event Ordering**
   - Ensure sequence numbers are sequential
   - Check for gaps in event sequences
   - Validate event ordering

2. **Snapshot Integrity**
   - Verify snapshot checksums
   - Check compression/decompression
   - Validate snapshot restoration

3. **Performance Issues**
   - Monitor query performance
   - Check index usage
   - Optimize snapshot intervals

### Debugging Tools

```typescript
// Validate aggregate integrity
const validation = await eventSourcing.validateAggregate('proof-123', 'Proof');
console.log('Issues:', validation.issues);

// Get detailed metrics
const metrics = await eventSourcing.getMetrics();
console.log('System health:', metrics.systemHealth);
```

## Contributing

When contributing to the event sourcing implementation:

1. Follow the existing code patterns
2. Add comprehensive tests
3. Update documentation
4. Consider performance implications
5. Maintain backward compatibility

## License

This implementation follows the same license as the Verinode project.
