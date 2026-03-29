import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../redisService';
import { MonitoringService } from '../monitoringService';
import { IContractEvent } from '../../models/ContractEvent';
import { EventEmitter } from 'events';

export interface EventSchema {
  version: string;
  schemaHash: string;
  fields: SchemaField[];
  compatibility: CompatibilityInfo;
  createdAt: Date;
  deprecatedAt?: Date;
  migrationPath?: string;
}

export interface SchemaField {
  name: string;
  type: FieldType;
  required: boolean;
  indexed: boolean;
  nullable: boolean;
  defaultValue?: any;
  validation?: ValidationRule[];
}

export enum FieldType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object',
  DATE = 'date',
  BYTES = 'bytes',
  ADDRESS = 'address',
}

export interface ValidationRule {
  type: 'min' | 'max' | 'pattern' | 'enum' | 'custom';
  value: any;
  message?: string;
}

export interface CompatibilityInfo {
  backwardCompatible: boolean;
  forwardCompatible: boolean;
  breakingChanges: string[];
  migrationRequired: boolean;
}

export interface EventMigration {
  id: string;
  fromVersion: string;
  toVersion: string;
  migrationFunction: string; // Serialized function
  description: string;
  createdAt: Date;
  appliedAt?: Date;
  status: MigrationStatus;
}

export enum MigrationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

export interface VersionCompatibilityMatrix {
  [fromVersion: string]: {
    [toVersion: string]: boolean;
  };
}

export interface EventVersioningConfig {
  enableAutoMigration: boolean;
  enableSchemaValidation: boolean;
  enableVersionTracking: boolean;
  maxSupportedVersions: number;
  defaultVersion: string;
  migrationTimeout: number;
}

@Injectable()
export class EventVersioningService extends EventEmitter implements OnModuleInit {
  private readonly logger = new Logger(EventVersioningService.name);
  private readonly config: EventVersioningConfig;
  private schemas: Map<string, EventSchema> = new Map();
  private migrations: Map<string, EventMigration> = new Map();
  private compatibilityMatrix: VersionCompatibilityMatrix = {};
  private currentVersion: string;

  constructor(
    private redisService: RedisService,
    private monitoringService: MonitoringService,
  ) {
    super();
    
    this.config = {
      enableAutoMigration: true,
      enableSchemaValidation: true,
      enableVersionTracking: true,
      maxSupportedVersions: 10,
      defaultVersion: '1.0.0',
      migrationTimeout: 30000, // 30 seconds
    };
    
    this.currentVersion = this.config.defaultVersion;
  }

  async onModuleInit() {
    this.logger.log('Initializing Event Versioning Service');
    
    // Load existing schemas
    await this.loadSchemas();
    
    // Load existing migrations
    await this.loadMigrations();
    
    // Build compatibility matrix
    this.buildCompatibilityMatrix();
    
    // Initialize default schema if none exists
    if (this.schemas.size === 0) {
      await this.initializeDefaultSchema();
    }
    
    this.logger.log('Event Versioning Service initialized successfully');
  }

  /**
   * Register a new event schema version
   */
  async registerSchema(schema: EventSchema): Promise<void> {
    try {
      // Validate schema
      this.validateSchema(schema);
      
      // Check for conflicts
      if (this.schemas.has(schema.version)) {
        throw new Error(`Schema version ${schema.version} already exists`);
      }
      
      // Store schema
      this.schemas.set(schema.version, schema);
      await this.saveSchema(schema);
      
      // Update compatibility matrix
      this.updateCompatibilityMatrix(schema);
      
      // Update current version if newer
      if (this.isNewerVersion(schema.version, this.currentVersion)) {
        this.currentVersion = schema.version;
        await this.redisService.set('current_event_version', this.currentVersion);
      }
      
      this.logger.log(`Registered event schema version: ${schema.version}`);
      this.emit('schemaRegistered', schema);
      
    } catch (error) {
      this.logger.error(`Failed to register schema version ${schema.version}:`, error);
      throw error;
    }
  }

  /**
   * Validate event against schema
   */
  async validateEvent(event: IContractEvent, version?: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const targetVersion = version || this.currentVersion;
    const schema = this.schemas.get(targetVersion);
    
    if (!schema) {
      return {
        valid: false,
        errors: [`Schema version ${targetVersion} not found`],
        warnings: [],
      };
    }
    
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate required fields
    for (const field of schema.fields) {
      if (field.required && !this.hasField(event, field.name)) {
        errors.push(`Required field '${field.name}' is missing`);
      }
      
      if (this.hasField(event, field.name)) {
        const fieldValue = this.getFieldValue(event, field.name);
        const fieldValidation = this.validateField(fieldValue, field);
        
        errors.push(...fieldValidation.errors);
        warnings.push(...fieldValidation.warnings);
      }
    }
    
    // Check for unknown fields
    const knownFields = new Set(schema.fields.map(f => f.name));
    const eventFields = this.getAllFieldNames(event);
    
    for (const fieldName of eventFields) {
      if (!knownFields.has(fieldName)) {
        warnings.push(`Unknown field '${fieldName}' found in event`);
      }
    }
    
    const isValid = errors.length === 0;
    
    if (isValid) {
      this.logger.debug(`Event validated successfully against schema ${targetVersion}`);
    } else {
      this.logger.warn(`Event validation failed: ${errors.join(', ')}`);
    }
    
    return { valid: isValid, errors, warnings };
  }

  /**
   * Migrate event to target version
   */
  async migrateEvent(event: IContractEvent, targetVersion: string): Promise<IContractEvent> {
    const currentEventVersion = event.version || this.config.defaultVersion;
    
    if (currentEventVersion === targetVersion) {
      return event;
    }
    
    // Check if migration is needed
    if (this.isCompatible(currentEventVersion, targetVersion)) {
      // No migration needed, just update version
      return { ...event, version: targetVersion };
    }
    
    // Find migration path
    const migrationPath = this.findMigrationPath(currentEventVersion, targetVersion);
    
    if (!migrationPath) {
      throw new Error(`No migration path found from ${currentEventVersion} to ${targetVersion}`);
    }
    
    // Apply migrations
    let migratedEvent = { ...event };
    
    for (const migrationId of migrationPath) {
      const migration = this.migrations.get(migrationId);
      
      if (!migration) {
        throw new Error(`Migration ${migrationId} not found`);
      }
      
      migratedEvent = await this.applyMigration(migratedEvent, migration);
    }
    
    // Validate migrated event
    const validation = await this.validateEvent(migratedEvent, targetVersion);
    
    if (!validation.valid) {
      throw new Error(`Migrated event failed validation: ${validation.errors.join(', ')}`);
    }
    
    this.logger.log(`Event migrated from ${currentEventVersion} to ${targetVersion}`);
    
    return migratedEvent;
  }

  /**
   * Create migration between versions
   */
  async createMigration(
    fromVersion: string,
    toVersion: string,
    migrationFunction: (event: IContractEvent) => IContractEvent,
    description: string
  ): Promise<EventMigration> {
    const migrationId = this.generateMigrationId(fromVersion, toVersion);
    
    const migration: EventMigration = {
      id: migrationId,
      fromVersion,
      toVersion,
      migrationFunction: migrationFunction.toString(),
      description,
      createdAt: new Date(),
      status: MigrationStatus.PENDING,
    };
    
    // Validate migration
    await this.validateMigration(migration);
    
    // Store migration
    this.migrations.set(migrationId, migration);
    await this.saveMigration(migration);
    
    // Update compatibility matrix
    this.updateCompatibilityMatrixForMigration(migration);
    
    this.logger.log(`Created migration: ${migrationId}`);
    this.emit('migrationCreated', migration);
    
    return migration;
  }

  /**
   * Get current version
   */
  getCurrentVersion(): string {
    return this.currentVersion;
  }

  /**
   * Get supported versions
   */
  getSupportedVersions(): string[] {
    return Array.from(this.schemas.keys()).sort((a, b) => this.compareVersions(a, b));
  }

  /**
   * Get schema for version
   */
  getSchema(version: string): EventSchema | undefined {
    return this.schemas.get(version);
  }

  /**
   * Check version compatibility
   */
  isCompatible(fromVersion: string, toVersion: string): boolean {
    return this.compatibilityMatrix[fromVersion]?.[toVersion] || false;
  }

  /**
   * Get versioning statistics
   */
  getVersioningStats(): {
    totalSchemas: number;
    totalMigrations: number;
    currentVersion: string;
    supportedVersions: string[];
    compatibilityMatrix: VersionCompatibilityMatrix;
  } {
    return {
      totalSchemas: this.schemas.size,
      totalMigrations: this.migrations.size,
      currentVersion: this.currentVersion,
      supportedVersions: this.getSupportedVersions(),
      compatibilityMatrix: { ...this.compatibilityMatrix },
    };
  }

  /**
   * Deprecate schema version
   */
  async deprecateSchema(version: string, reason?: string): Promise<void> {
    const schema = this.schemas.get(version);
    
    if (!schema) {
      throw new Error(`Schema version ${version} not found`);
    }
    
    schema.deprecatedAt = new Date();
    await this.saveSchema(schema);
    
    this.logger.warn(`Deprecated schema version: ${version}${reason ? ` - ${reason}` : ''}`);
    this.emit('schemaDeprecated', { version, reason });
  }

  /**
   * Auto-migrate event to latest version
   */
  async autoMigrateEvent(event: IContractEvent): Promise<IContractEvent> {
    if (!this.config.enableAutoMigration) {
      return event;
    }
    
    const eventVersion = event.version || this.config.defaultVersion;
    
    if (eventVersion === this.currentVersion) {
      return event;
    }
    
    try {
      return await this.migrateEvent(event, this.currentVersion);
    } catch (error) {
      this.logger.error(`Auto-migration failed for event:`, error);
      return event; // Return original event if migration fails
    }
  }

  /**
   * Validate schema structure
   */
  private validateSchema(schema: EventSchema): void {
    if (!schema.version || !this.isValidVersionFormat(schema.version)) {
      throw new Error('Invalid version format');
    }
    
    if (!schema.fields || schema.fields.length === 0) {
      throw new Error('Schema must have at least one field');
    }
    
    // Validate fields
    for (const field of schema.fields) {
      if (!field.name || !field.type) {
        throw new Error('Field must have name and type');
      }
      
      if (field.validation) {
        for (const rule of field.validation) {
          if (!rule.type || rule.value === undefined) {
            throw new Error('Validation rule must have type and value');
          }
        }
      }
    }
  }

  /**
   * Validate field value
   */
  private validateField(value: any, field: SchemaField): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check nullability
    if (value === null && !field.nullable) {
      errors.push(`Field '${field.name}' cannot be null`);
      return { errors, warnings };
    }
    
    if (value === null) {
      return { errors, warnings }; // Null is allowed
    }
    
    // Type validation
    if (!this.isValidFieldType(value, field.type)) {
      errors.push(`Field '${field.name}' must be of type ${field.type}`);
    }
    
    // Validation rules
    if (field.validation) {
      for (const rule of field.validation) {
        const ruleResult = this.applyValidationRule(value, rule);
        errors.push(...ruleResult.errors);
        warnings.push(...ruleResult.warnings);
      }
    }
    
    return { errors, warnings };
  }

  /**
   * Check if value matches field type
   */
  private isValidFieldType(value: any, type: FieldType): boolean {
    switch (type) {
      case FieldType.STRING:
        return typeof value === 'string';
      case FieldType.NUMBER:
        return typeof value === 'number';
      case FieldType.BOOLEAN:
        return typeof value === 'boolean';
      case FieldType.ARRAY:
        return Array.isArray(value);
      case FieldType.OBJECT:
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case FieldType.DATE:
        return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
      case FieldType.BYTES:
        return value instanceof Buffer || (typeof value === 'string' && /^0x[0-9a-fA-F]*$/.test(value));
      case FieldType.ADDRESS:
        return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
      default:
        return false;
    }
  }

  /**
   * Apply validation rule
   */
  private applyValidationRule(value: any, rule: ValidationRule): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    switch (rule.type) {
      case 'min':
        if (typeof value === 'number' && value < rule.value) {
          errors.push(rule.message || `Value must be at least ${rule.value}`);
        }
        break;
      case 'max':
        if (typeof value === 'number' && value > rule.value) {
          errors.push(rule.message || `Value must be at most ${rule.value}`);
        }
        break;
      case 'pattern':
        if (typeof value === 'string' && !new RegExp(rule.value).test(value)) {
          errors.push(rule.message || `Value does not match pattern ${rule.value}`);
        }
        break;
      case 'enum':
        if (!Array.isArray(rule.value) || !rule.value.includes(value)) {
          errors.push(rule.message || `Value must be one of: ${rule.value.join(', ')}`);
        }
        break;
      case 'custom':
        // Custom validation would be implemented here
        break;
    }
    
    return { errors, warnings };
  }

  /**
   * Apply migration to event
   */
  private async applyMigration(event: IContractEvent, migration: EventMigration): Promise<IContractEvent> {
    try {
      // Deserialize migration function
      const migrationFunction = new Function('event', migration.migrationFunction) as (event: IContractEvent) => IContractEvent;
      
      // Apply migration with timeout
      const result = await Promise.race([
        Promise.resolve(migrationFunction(event)),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Migration timeout')), this.config.migrationTimeout)
        ),
      ]);
      
      // Update migration status
      migration.appliedAt = new Date();
      migration.status = MigrationStatus.COMPLETED;
      await this.saveMigration(migration);
      
      return result;
      
    } catch (error) {
      migration.status = MigrationStatus.FAILED;
      await this.saveMigration(migration);
      
      this.logger.error(`Migration ${migration.id} failed:`, error);
      throw error;
    }
  }

  /**
   * Find migration path between versions
   */
  private findMigrationPath(fromVersion: string, toVersion: string): string[] | null {
    // Simple BFS to find shortest path
    const queue: { version: string; path: string[] }[] = [{ version: fromVersion, path: [] }];
    const visited = new Set<string>();
    
    while (queue.length > 0) {
      const { version, path } = queue.shift()!;
      
      if (version === toVersion) {
        return path;
      }
      
      if (visited.has(version)) {
        continue;
      }
      
      visited.add(version);
      
      // Find migrations from current version
      for (const migration of this.migrations.values()) {
        if (migration.fromVersion === version) {
          queue.push({
            version: migration.toVersion,
            path: [...path, migration.id],
          });
        }
      }
    }
    
    return null;
  }

  /**
   * Compare versions
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart < bPart) return -1;
      if (aPart > bPart) return 1;
    }
    
    return 0;
  }

  /**
   * Check if version is newer
   */
  private isNewerVersion(version: string, current: string): boolean {
    return this.compareVersions(version, current) > 0;
  }

  /**
   * Validate version format
   */
  private isValidVersionFormat(version: string): boolean {
    return /^\d+\.\d+\.\d+$/.test(version);
  }

  /**
   * Generate migration ID
   */
  private generateMigrationId(fromVersion: string, toVersion: string): string {
    return `migration_${fromVersion}_to_${toVersion}`;
  }

  /**
   * Check if event has field
   */
  private hasField(event: IContractEvent, fieldName: string): boolean {
    return fieldName in event || fieldName in (event.data || {});
  }

  /**
   * Get field value from event
   */
  private getFieldValue(event: IContractEvent, fieldName: string): any {
    return (event as any)[fieldName] || (event.data || {})[fieldName];
  }

  /**
   * Get all field names from event
   */
  private getAllFieldNames(event: IContractEvent): string[] {
    const fields = new Set(Object.keys(event));
    
    if (event.data) {
      Object.keys(event.data).forEach(field => fields.add(field));
    }
    
    return Array.from(fields);
  }

  /**
   * Build compatibility matrix
   */
  private buildCompatibilityMatrix(): void {
    this.compatibilityMatrix = {};
    
    const versions = Array.from(this.schemas.keys());
    
    for (const fromVersion of versions) {
      this.compatibilityMatrix[fromVersion] = {};
      
      for (const toVersion of versions) {
        if (fromVersion === toVersion) {
          this.compatibilityMatrix[fromVersion][toVersion] = true;
        } else {
          this.compatibilityMatrix[fromVersion][toVersion] = this.checkCompatibility(fromVersion, toVersion);
        }
      }
    }
  }

  /**
   * Check compatibility between versions
   */
  private checkCompatibility(fromVersion: string, toVersion: string): boolean {
    const fromSchema = this.schemas.get(fromVersion);
    const toSchema = this.schemas.get(toVersion);
    
    if (!fromSchema || !toSchema) {
      return false;
    }
    
    // Check if migration exists
    for (const migration of this.migrations.values()) {
      if (migration.fromVersion === fromVersion && migration.toVersion === toVersion) {
        return true;
      }
    }
    
    // Check backward compatibility
    return fromSchema.compatibility.backwardCompatible;
  }

  /**
   * Update compatibility matrix for new schema
   */
  private updateCompatibilityMatrix(schema: EventSchema): void {
    const version = schema.version;
    
    if (!this.compatibilityMatrix[version]) {
      this.compatibilityMatrix[version] = {};
    }
    
    // Self compatibility
    this.compatibilityMatrix[version][version] = true;
    
    // Update compatibility with other versions
    for (const otherVersion of this.schemas.keys()) {
      if (otherVersion !== version) {
        this.compatibilityMatrix[version][otherVersion] = this.checkCompatibility(version, otherVersion);
        this.compatibilityMatrix[otherVersion][version] = this.checkCompatibility(otherVersion, version);
      }
    }
  }

  /**
   * Update compatibility matrix for migration
   */
  private updateCompatibilityMatrixForMigration(migration: EventMigration): void {
    if (!this.compatibilityMatrix[migration.fromVersion]) {
      this.compatibilityMatrix[migration.fromVersion] = {};
    }
    
    this.compatibilityMatrix[migration.fromVersion][migration.toVersion] = true;
  }

  /**
   * Initialize default schema
   */
  private async initializeDefaultSchema(): Promise<void> {
    const defaultSchema: EventSchema = {
      version: this.config.defaultVersion,
      schemaHash: this.generateSchemaHash(this.config.defaultVersion),
      fields: [
        {
          name: 'eventId',
          type: FieldType.STRING,
          required: true,
          indexed: true,
          nullable: false,
        },
        {
          name: 'eventType',
          type: FieldType.STRING,
          required: true,
          indexed: true,
          nullable: false,
        },
        {
          name: 'emitter',
          type: FieldType.ADDRESS,
          required: true,
          indexed: true,
          nullable: false,
        },
        {
          name: 'timestamp',
          type: FieldType.DATE,
          required: true,
          indexed: true,
          nullable: false,
        },
        {
          name: 'data',
          type: FieldType.OBJECT,
          required: false,
          indexed: false,
          nullable: true,
        },
      ],
      compatibility: {
        backwardCompatible: true,
        forwardCompatible: false,
        breakingChanges: [],
        migrationRequired: false,
      },
      createdAt: new Date(),
    };
    
    await this.registerSchema(defaultSchema);
  }

  /**
   * Generate schema hash
   */
  private generateSchemaHash(version: string): string {
    // Simple hash generation - in practice, use proper hashing
    return `hash_${version}_${Date.now()}`;
  }

  /**
   * Validate migration
   */
  private async validateMigration(migration: EventMigration): Promise<void> {
    // Check if source and target schemas exist
    if (!this.schemas.has(migration.fromVersion)) {
      throw new Error(`Source schema ${migration.fromVersion} not found`);
    }
    
    if (!this.schemas.has(migration.toVersion)) {
      throw new Error(`Target schema ${migration.toVersion} not found`);
    }
    
    // Test migration function
    try {
      const testEvent: IContractEvent = {
        eventId: 'test',
        eventType: 'Test',
        emitter: '0x0000000000000000000000000000000000000000',
        timestamp: new Date(),
        data: {},
        version: migration.fromVersion,
      } as any;
      
      const migrationFunction = new Function('event', migration.migrationFunction) as (event: IContractEvent) => IContractEvent;
      const result = migrationFunction(testEvent);
      
      // Validate result
      const validation = await this.validateEvent(result, migration.toVersion);
      
      if (!validation.valid) {
        throw new Error(`Migration produces invalid events: ${validation.errors.join(', ')}`);
      }
      
    } catch (error) {
      throw new Error(`Migration validation failed: ${error.message}`);
    }
  }

  /**
   * Save schema to storage
   */
  private async saveSchema(schema: EventSchema): Promise<void> {
    await this.redisService.set(
      `event_schema:${schema.version}`,
      JSON.stringify(schema),
      24 * 60 * 60 // 24 hours TTL
    );
  }

  /**
   * Save migration to storage
   */
  private async saveMigration(migration: EventMigration): Promise<void> {
    await this.redisService.set(
      `event_migration:${migration.id}`,
      JSON.stringify(migration),
      24 * 60 * 60 // 24 hours TTL
    );
  }

  /**
   * Load schemas from storage
   */
  private async loadSchemas(): Promise<void> {
    try {
      const keys = await this.redisService.keys('event_schema:*');
      
      for (const key of keys) {
        const cached = await this.redisService.get(key);
        if (cached) {
          const schema = JSON.parse(cached) as EventSchema;
          this.schemas.set(schema.version, schema);
        }
      }
      
      // Load current version
      const currentVersion = await this.redisService.get('current_event_version');
      if (currentVersion) {
        this.currentVersion = currentVersion;
      }
      
      this.logger.log(`Loaded ${this.schemas.size} schemas from storage`);
      
    } catch (error) {
      this.logger.error('Failed to load schemas:', error);
    }
  }

  /**
   * Load migrations from storage
   */
  private async loadMigrations(): Promise<void> {
    try {
      const keys = await this.redisService.keys('event_migration:*');
      
      for (const key of keys) {
        const cached = await this.redisService.get(key);
        if (cached) {
          const migration = JSON.parse(cached) as EventMigration;
          this.migrations.set(migration.id, migration);
        }
      }
      
      this.logger.log(`Loaded ${this.migrations.size} migrations from storage`);
      
    } catch (error) {
      this.logger.error('Failed to load migrations:', error);
    }
  }
}
