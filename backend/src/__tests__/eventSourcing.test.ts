import { EventSourcingService } from '../services/eventsourcing/EventSourcingService';
import { Event, IEvent } from '../models/Event';
import { Snapshot, ISnapshot } from '../models/Snapshot';
import mongoose from 'mongoose';

describe('Event Sourcing Implementation', () => {
  let eventSourcingService: EventSourcingService;
  let testAggregateId: string;
  let testAggregateType: string;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/verinode-test');
    
    // Initialize event sourcing service
    eventSourcingService = new EventSourcingService({
      enableSnapshots: true,
      enableEventStreams: true,
      enableReplay: true,
      autoSnapshotInterval: 5,
      snapshotManager: {
        retentionDays: 7,
        maxSnapshotsPerAggregate: 3
      }
    });
    
    await eventSourcingService.initialize();
    
    testAggregateId = 'test-aggregate-123';
    testAggregateType = 'Proof';
  });

  afterAll(async () => {
    await eventSourcingService.close();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await Event.deleteMany({ aggregateId: testAggregateId });
    await Snapshot.deleteMany({ aggregateId: testAggregateId });
  });

  describe('Event Storage', () => {
    it('should save a single event', async () => {
      const eventData: Partial<IEvent> = {
        aggregateId: testAggregateId,
        aggregateType: testAggregateType,
        eventType: 'Created',
        eventData: {
          title: 'Test Proof',
          description: 'Test Description',
          proofType: 'identity'
        },
        eventMetadata: {
          userId: 'user-123',
          correlationId: 'corr-123'
        }
      };

      const savedEvent = await eventSourcingService.saveEvent(eventData);
      
      expect(savedEvent).toBeDefined();
      expect(savedEvent.eventId).toBeDefined();
      expect(savedEvent.aggregateId).toBe(testAggregateId);
      expect(savedEvent.aggregateType).toBe(testAggregateType);
      expect(savedEvent.eventType).toBe('Created');
      expect(savedEvent.sequenceNumber).toBe(1);
    });

    it('should save multiple events in sequence', async () => {
      const events = [
        {
          aggregateId: testAggregateId,
          aggregateType: testAggregateType,
          eventType: 'Created',
          eventData: { title: 'Test Proof', status: 'draft' }
        },
        {
          aggregateId: testAggregateId,
          aggregateType: testAggregateType,
          eventType: 'Updated',
          eventData: { status: 'verified' }
        },
        {
          aggregateId: testAggregateId,
          aggregateType: testAggregateType,
          eventType: 'StatusChanged',
          eventData: { status: 'active' }
        }
      ];

      const savedEvents = await eventSourcingService.saveEvents(events);
      
      expect(savedEvents).toHaveLength(3);
      expect(savedEvents[0].sequenceNumber).toBe(1);
      expect(savedEvents[1].sequenceNumber).toBe(2);
      expect(savedEvents[2].sequenceNumber).toBe(3);
    });

    it('should prevent duplicate events', async () => {
      const eventId = 'test-event-123';
      const eventData = {
        eventId,
        aggregateId: testAggregateId,
        aggregateType: testAggregateType,
        eventType: 'Created',
        eventData: { title: 'Test Proof' }
      };

      await eventSourcingService.saveEvent(eventData);
      
      // Try to save the same event again
      const duplicateEvents = await eventSourcingService.saveEvents([eventData]);
      
      expect(duplicateEvents).toHaveLength(0); // Should be deduplicated
    });
  });

  describe('Aggregate State Management', () => {
    it('should rebuild aggregate state from events', async () => {
      const events = [
        {
          aggregateId: testAggregateId,
          aggregateType: testAggregateType,
          eventType: 'Created',
          eventData: { title: 'Test Proof', status: 'draft' }
        },
        {
          aggregateId: testAggregateId,
          aggregateType: testAggregateType,
          eventType: 'Updated',
          eventData: { status: 'verified' }
        }
      ];

      await eventSourcingService.saveEvents(events);
      
      const state = await eventSourcingService.getAggregateState(testAggregateId, testAggregateType);
      
      expect(state).toBeDefined();
      expect(state.aggregateId).toBe(testAggregateId);
      expect(state.version).toBe(2);
      expect(state.state.status).toBe('verified');
      expect(state.eventCount).toBe(2);
    });

    it('should get state at specific point in time', async () => {
      const baseTime = new Date();
      
      const events = [
        {
          aggregateId: testAggregateId,
          aggregateType: testAggregateType,
          eventType: 'Created',
          eventData: { title: 'Test Proof', status: 'draft' }
        }
      ];

      await eventSourcingService.saveEvents(events);
      
      // Wait a bit and add more events
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const laterEvents = [
        {
          aggregateId: testAggregateId,
          aggregateType: testAggregateType,
          eventType: 'Updated',
          eventData: { status: 'verified' }
        }
      ];

      await eventSourcingService.saveEvents(laterEvents);
      
      const stateAtBaseTime = await eventSourcingService.getStateAtTime({
        aggregateId: testAggregateId,
        aggregateType: testAggregateType,
        atTimestamp: baseTime
      });
      
      expect(stateAtBaseTime.state.status).toBe('draft');
      expect(stateAtBaseTime.version).toBe(1);
    });
  });

  describe('Snapshot Management', () => {
    it('should create snapshot automatically', async () => {
      // Create enough events to trigger snapshot
      const events = Array.from({ length: 6 }, (_, i) => ({
        aggregateId: testAggregateId,
        aggregateType: testAggregateType,
        eventType: 'Updated',
        eventData: { version: i + 1 }
      }));

      await eventSourcingService.saveEvents(events);
      
      const snapshots = await eventSourcingService.getSnapshots(testAggregateId);
      
      expect(snapshots.length).toBeGreaterThan(0);
      expect(snapshots[0].aggregateId).toBe(testAggregateId);
      expect(snapshots[0].snapshotMetadata.sequenceNumber).toBeGreaterThan(0);
    });

    it('should manually create snapshot', async () => {
      const events = [
        {
          aggregateId: testAggregateId,
          aggregateType: testAggregateType,
          eventType: 'Created',
          eventData: { title: 'Test Proof', status: 'draft' }
        }
      ];

      await eventSourcingService.saveEvents(events);
      
      const snapshot = await eventSourcingService.createSnapshot(
        testAggregateId,
        testAggregateType,
        true // force creation
      );
      
      expect(snapshot).toBeDefined();
      expect(snapshot.aggregateId).toBe(testAggregateId);
      expect(snapshot.snapshotMetadata.sequenceNumber).toBe(1);
    });
  });

  describe('Event Replay', () => {
    it('should replay events from snapshot', async () => {
      // Create initial events
      const initialEvents = [
        {
          aggregateId: testAggregateId,
          aggregateType: testAggregateType,
          eventType: 'Created',
          eventData: { title: 'Test Proof', status: 'draft' }
        }
      ];

      await eventSourcingService.saveEvents(initialEvents);
      
      // Create snapshot
      await eventSourcingService.createSnapshot(testAggregateId, testAggregateType, true);
      
      // Add more events after snapshot
      const laterEvents = [
        {
          aggregateId: testAggregateId,
          aggregateType: testAggregateType,
          eventType: 'Updated',
          eventData: { status: 'verified' }
        }
      ];

      await eventSourcingService.saveEvents(laterEvents);
      
      // Get current state (should use snapshot + replay)
      const state = await eventSourcingService.getAggregateState(testAggregateId, testAggregateType);
      
      expect(state.state.status).toBe('verified');
      expect(state.version).toBe(2);
    });
  });

  describe('Event Streaming', () => {
    it('should create event stream', async () => {
      const events = [
        {
          aggregateId: testAggregateId,
          aggregateType: testAggregateType,
          eventType: 'Created',
          eventData: { title: 'Test Proof' }
        }
      ];

      await eventSourcingService.saveEvents(events);
      
      const stream = await eventSourcingService.getEventStream({
        aggregateId: testAggregateId,
        aggregateType: testAggregateType,
        liveMode: false
      });
      
      expect(stream).toBeDefined();
      expect(stream.getOptions().aggregateId).toBe(testAggregateId);
      
      await stream.destroy();
    });
  });

  describe('Validation', () => {
    it('should validate aggregate integrity', async () => {
      const events = [
        {
          aggregateId: testAggregateId,
          aggregateType: testAggregateType,
          eventType: 'Created',
          eventData: { title: 'Test Proof' }
        }
      ];

      await eventSourcingService.saveEvents(events);
      
      const validation = await eventSourcingService.validateAggregate(
        testAggregateId,
        testAggregateType
      );
      
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });
  });

  describe('Metrics', () => {
    it('should provide system metrics', async () => {
      const events = [
        {
          aggregateId: testAggregateId,
          aggregateType: testAggregateType,
          eventType: 'Created',
          eventData: { title: 'Test Proof' }
        }
      ];

      await eventSourcingService.saveEvents(events);
      
      const metrics = await eventSourcingService.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.totalEvents).toBe(1);
      expect(metrics.totalAggregates).toBe(1);
      expect(metrics.systemHealth).toBe('healthy');
    });
  });
});
