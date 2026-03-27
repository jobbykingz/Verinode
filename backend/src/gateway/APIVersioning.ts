import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface VersioningConfig {
  enableVersioning: boolean;
  defaultVersion: string;
  supportedVersions: string[];
  versioningStrategy: 'url_path' | 'header' | 'query_param' | 'subdomain';
  versionHeader: string;
  versionQueryParam: string;
  deprecatedVersions: string[];
  sunsetVersions: string[];
  enableVersionRouting: boolean;
  enableVersionCompatibility: boolean;
  enableVersionDeprecation: boolean;
  enableVersionMigration: boolean;
}

export interface APIVersion {
  version: string;
  status: 'active' | 'deprecated' | 'sunset' | 'experimental';
  releaseDate: number;
  deprecationDate?: number;
  sunsetDate?: number;
  description?: string;
  breakingChanges: string[];
  migrationGuide?: string;
  endpoints: VersionedEndpoint[];
  compatibility: {
    minCompatibleVersion?: string;
    maxCompatibleVersion?: string;
    backwardCompatible: boolean;
    forwardCompatible: boolean;
  };
}

export interface VersionedEndpoint {
  path: string;
  method: string;
  version: string;
  handler: string;
  middleware?: string[];
  deprecated?: boolean;
  sunset?: boolean;
  migration?: {
    fromVersion: string;
    toVersion: string;
    transformation: string;
  };
  compatibility: {
    minVersion?: string;
    maxVersion?: string;
    alternatives: Array<{
      version: string;
      path: string;
      method: string;
    }>;
  };
}

export interface RouteConfig {
  path: string;
  method: string;
  versions: Record<string, VersionedEndpoint>;
  defaultVersion: string;
  middleware?: string[];
  enableVersioning: boolean;
  versioningStrategy: 'url_path' | 'header' | 'query_param';
}

export interface RoutingResult {
  version: string;
  endpoint: VersionedEndpoint;
  originalPath: string;
  versionedPath: string;
  versionSource: 'url' | 'header' | 'query' | 'default';
  isDeprecated: boolean;
  isSunset: boolean;
  deprecationWarnings: string[];
  migrationInfo?: {
    available: boolean;
    targetVersion: string;
    migrationPath: string;
    deadline: number;
  };
}

export class APIVersioningService {
  private config: VersioningConfig;
  private versions: Map<string, APIVersion> = new Map();
  private routes: Map<string, RouteConfig> = new Map();
  private versionStats: Map<string, { requests: number; lastUsed: number }> = new Map();

  constructor(config: Partial<VersioningConfig> = {}) {
    this.config = {
      enableVersioning: true,
      defaultVersion: 'v1',
      supportedVersions: ['v1', 'v2'],
      versioningStrategy: 'url_path',
      versionHeader: 'API-Version',
      versionQueryParam: 'version',
      deprecatedVersions: [],
      sunsetVersions: [],
      enableVersionRouting: true,
      enableVersionCompatibility: true,
      enableVersionDeprecation: true,
      enableVersionMigration: true,
      ...config,
    };

    this.initializeDefaultVersions();
  }

  private initializeDefaultVersions(): void {
    // Add default v1 version
    this.addVersion({
      version: 'v1',
      status: 'active',
      releaseDate: Date.now(),
      description: 'Initial API version',
      breakingChanges: [],
      compatibility: {
        backwardCompatible: false,
        forwardCompatible: false,
      },
      endpoints: [],
    });

    // Add v2 version if supported
    if (this.config.supportedVersions.includes('v2')) {
      this.addVersion({
        version: 'v2',
        status: 'active',
        releaseDate: Date.now(),
        description: 'Enhanced API version with new features',
        breakingChanges: ['Updated response format', 'Modified authentication'],
        compatibility: {
          minCompatibleVersion: 'v1',
          backwardCompatible: true,
          forwardCompatible: false,
        },
        endpoints: [],
      });
    }
  }

  public addVersion(version: APIVersion): void {
    this.versions.set(version.version, version);
    this.versionStats.set(version.version, { requests: 0, lastUsed: 0 });
    
    logger.info(`API version added: ${version.version}`);
  }

  public removeVersion(version: string): void {
    if (this.versions.delete(version)) {
      this.versionStats.delete(version);
      logger.info(`API version removed: ${version}`);
    }
  }

  public getVersion(version: string): APIVersion | undefined {
    return this.versions.get(version);
  }

  public getAllVersions(): APIVersion[] {
    return Array.from(this.versions.values());
  }

  public getActiveVersions(): APIVersion[] {
    return Array.from(this.versions.values()).filter(v => v.status === 'active');
  }

  public getDeprecatedVersions(): APIVersion[] {
    return Array.from(this.versions.values()).filter(v => v.status === 'deprecated');
  }

  public addRoute(routeConfig: RouteConfig): void {
    const routeKey = `${routeConfig.method}:${routeConfig.path}`;
    this.routes.set(routeKey, routeConfig);
    
    logger.info(`Route added: ${routeKey}`);
  }

  public removeRoute(method: string, path: string): void {
    const routeKey = `${method}:${path}`;
    if (this.routes.delete(routeKey)) {
      logger.info(`Route removed: ${routeKey}`);
    }
  }

  public middleware(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableVersioning) {
        return next();
      }

      try {
        const routingResult = this.resolveVersion(req);
        
        if (!routingResult) {
          return res.status(404).json({
            error: 'Version not supported',
            supportedVersions: this.config.supportedVersions,
            defaultVersion: this.config.defaultVersion,
          });
        }

        // Add version information to request
        (req as any).version = routingResult.version;
        (req as any).versionedEndpoint = routingResult.endpoint;
        (req as any).routingResult = routingResult;

        // Update version stats
        this.updateVersionStats(routingResult.version);

        // Add deprecation warnings
        if (routingResult.isDeprecated || routingResult.isSunset) {
          this.addVersionWarnings(res, routingResult);
        }

        // Add version headers
        this.addVersionHeaders(res, routingResult);

        next();

      } catch (error) {
        logger.error('Versioning middleware error:', error);
        res.status(500).json({
          error: 'Versioning error',
          message: error.message,
        });
      }
    };
  }

  private resolveVersion(req: Request): RoutingResult | null {
    let version: string | undefined;
    let versionSource: 'url' | 'header' | 'query' | 'default' = 'default';

    // Try URL path versioning
    if (this.config.versioningStrategy === 'url_path' || this.config.enableVersionRouting) {
      const urlVersion = this.extractVersionFromPath(req.path);
      if (urlVersion && this.isVersionSupported(urlVersion)) {
        version = urlVersion;
        versionSource = 'url';
      }
    }

    // Try header versioning
    if (!version && (this.config.versioningStrategy === 'header' || this.config.enableVersionRouting)) {
      const headerVersion = req.headers[this.config.versionHeader.toLowerCase()] as string;
      if (headerVersion && this.isVersionSupported(headerVersion)) {
        version = headerVersion;
        versionSource = 'header';
      }
    }

    // Try query parameter versioning
    if (!version && (this.config.versioningStrategy === 'query_param' || this.config.enableVersionRouting)) {
      const queryVersion = req.query[this.config.versionQueryParam] as string;
      if (queryVersion && this.isVersionSupported(queryVersion)) {
        version = queryVersion;
        versionSource = 'query';
      }
    }

    // Use default version
    if (!version) {
      version = this.config.defaultVersion;
      versionSource = 'default';
    }

    // Check if version is supported
    if (!this.isVersionSupported(version)) {
      return null;
    }

    // Find matching endpoint
    const endpoint = this.findEndpoint(req, version);
    if (!endpoint) {
      return null;
    }

    const apiVersion = this.versions.get(version);
    const isDeprecated = apiVersion?.status === 'deprecated' || endpoint.deprecated;
    const isSunset = apiVersion?.status === 'sunset' || endpoint.sunset;

    return {
      version,
      endpoint,
      originalPath: req.path,
      versionedPath: this.buildVersionedPath(req.path, version),
      versionSource,
      isDeprecated,
      isSunset,
      deprecationWarnings: this.getDeprecationWarnings(apiVersion, endpoint),
      migrationInfo: this.getMigrationInfo(apiVersion, endpoint),
    };
  }

  private extractVersionFromPath(path: string): string | null {
    // Extract version from path like /api/v1/users
    const match = path.match(/\/(v\d+)\/?/);
    return match ? match[1] : null;
  }

  private isVersionSupported(version: string): boolean {
    return this.config.supportedVersions.includes(version);
  }

  private findEndpoint(req: Request, version: string): VersionedEndpoint | null {
    // Find route configuration
    const routeKey = `${req.method}:${this.normalizePath(req.path)}`;
    const routeConfig = this.routes.get(routeKey);
    
    if (routeConfig && routeConfig.versions[version]) {
      return routeConfig.versions[version];
    }

    // Try to find endpoint by scanning all versions
    for (const [routeKey, routeConfig] of this.routes.entries()) {
      if (routeConfig.versions[version] && this.pathMatches(req.path, routeConfig.path)) {
        return routeConfig.versions[version];
      }
    }

    return null;
  }

  private normalizePath(path: string): string {
    // Remove version from path for matching
    return path.replace(/\/v\d+/, '');
  }

  private pathMatches(requestPath: string, routePath: string): boolean {
    // Simple path matching - can be enhanced with regex
    const normalizedRequest = this.normalizePath(requestPath);
    const normalizedRoute = routePath.replace(/\/:([^\/]+)/g, '/[^/]+');
    
    if (normalizedRoute.includes(':')) {
      const regex = new RegExp(normalizedRoute.replace(/:[^/]+/g, '[^/]+'));
      return regex.test(normalizedRequest);
    }
    
    return normalizedRequest === normalizedRoute;
  }

  private buildVersionedPath(originalPath: string, version: string): string {
    if (this.config.versioningStrategy === 'url_path') {
      // Add version to path if not present
      if (!originalPath.includes(`/v${version.replace('v', '')}`)) {
        return originalPath.replace(/\/api/, `/api/${version}`);
      }
    }
    return originalPath;
  }

  private getDeprecationWarnings(apiVersion?: APIVersion, endpoint?: VersionedEndpoint): string[] {
    const warnings: string[] = [];

    if (apiVersion?.status === 'deprecated') {
      warnings.push(`API version ${apiVersion.version} is deprecated`);
      if (apiVersion.deprecationDate) {
        warnings.push(`Deprecated on: ${new Date(apiVersion.deprecationDate).toISOString()}`);
      }
      if (apiVersion.sunsetDate) {
        warnings.push(`Will be sunset on: ${new Date(apiVersion.sunsetDate).toISOString()}`);
      }
    }

    if (endpoint?.deprecated) {
      warnings.push(`Endpoint ${endpoint.method} ${endpoint.path} is deprecated`);
    }

    if (apiVersion?.status === 'sunset') {
      warnings.push(`API version ${apiVersion.version} is sunset and will be removed soon`);
    }

    if (endpoint?.sunset) {
      warnings.push(`Endpoint ${endpoint.method} ${endpoint.path} is sunset and will be removed soon`);
    }

    return warnings;
  }

  private getMigrationInfo(apiVersion?: APIVersion, endpoint?: VersionedEndpoint): any {
    if (!this.config.enableVersionMigration) {
      return null;
    }

    let migrationAvailable = false;
    let targetVersion = '';
    let migrationPath = '';
    let deadline = 0;

    if (apiVersion?.status === 'deprecated' && apiVersion.sunsetDate) {
      // Find next available version
      const activeVersions = this.getActiveVersions();
      const nextVersion = activeVersions.find(v => 
        v.version > apiVersion.version && 
        apiVersion.compatibility.maxCompatibleVersion !== v.version
      );

      if (nextVersion) {
        migrationAvailable = true;
        targetVersion = nextVersion.version;
        migrationPath = `/api/${nextVersion.version}${endpoint?.path || ''}`;
        deadline = apiVersion.sunsetDate;
      }
    }

    return migrationAvailable ? {
      available: migrationAvailable,
      targetVersion,
      migrationPath,
      deadline,
    } : null;
  }

  private addVersionWarnings(res: Response, routingResult: RoutingResult): void {
    const warnings = routingResult.deprecationWarnings;
    
    if (warnings.length > 0) {
      res.set('X-API-Deprecation-Warnings', warnings.join('; '));
    }

    if (routingResult.migrationInfo?.available) {
      res.set('X-API-Migration-Info', JSON.stringify(routingResult.migrationInfo));
    }
  }

  private addVersionHeaders(res: Response, routingResult: RoutingResult): void {
    res.set('X-API-Version', routingResult.version);
    res.set('X-API-Version-Source', routingResult.versionSource);
    
    if (routingResult.isDeprecated) {
      res.set('X-API-Deprecated', 'true');
    }
    
    if (routingResult.isSunset) {
      res.set('X-API-Sunset', 'true');
    }

    // Add supported versions header
    res.set('X-API-Supported-Versions', this.config.supportedVersions.join(', '));
  }

  private updateVersionStats(version: string): void {
    const stats = this.versionStats.get(version);
    if (stats) {
      stats.requests++;
      stats.lastUsed = Date.now();
    }
  }

  // Version compatibility and migration
  public isVersionCompatible(fromVersion: string, toVersion: string): boolean {
    const fromAPIVersion = this.versions.get(fromVersion);
    const toAPIVersion = this.versions.get(toVersion);

    if (!fromAPIVersion || !toAPIVersion) {
      return false;
    }

    // Check forward compatibility
    if (fromAPIVersion.compatibility.maxCompatibleVersion === toVersion) {
      return true;
    }

    // Check backward compatibility
    if (toAPIVersion.compatibility.minCompatibleVersion === fromVersion) {
      return true;
    }

    // Check if versions are in the same compatibility range
    return this.isVersionInCompatibilityRange(fromVersion, toAPIVersion) &&
           this.isVersionInCompatibilityRange(toVersion, fromAPIVersion);
  }

  private isVersionInCompatibilityRange(version: string, apiVersion: APIVersion): boolean {
    const versionNum = parseInt(version.replace('v', ''));
    const minVersion = apiVersion.compatibility.minCompatibleVersion 
      ? parseInt(apiVersion.compatibility.minCompatibleVersion.replace('v', ''))
      : 0;
    const maxVersion = apiVersion.compatibility.maxCompatibleVersion 
      ? parseInt(apiVersion.compatibility.maxCompatibleVersion.replace('v', ''))
      : Infinity;

    return versionNum >= minVersion && versionNum <= maxVersion;
  }

  public getMigrationPath(fromVersion: string, toVersion: string): string | null {
    const fromAPIVersion = this.versions.get(fromVersion);
    
    if (!fromAPIVersion) {
      return null;
    }

    // Check if there's a direct migration guide
    if (fromAPIVersion.migrationGuide) {
      return fromAPIVersion.migrationGuide;
    }

    // Generate basic migration path
    return `/docs/migration/${fromVersion}-to-${toVersion}`;
  }

  public deprecateVersion(version: string, deprecationDate?: number, sunsetDate?: number): void {
    const apiVersion = this.versions.get(version);
    if (apiVersion) {
      apiVersion.status = 'deprecated';
      if (deprecationDate) {
        apiVersion.deprecationDate = deprecationDate;
      }
      if (sunsetDate) {
        apiVersion.sunsetDate = sunsetDate;
        apiVersion.status = 'sunset';
      }
      
      logger.info(`API version ${version} deprecated`, { deprecationDate, sunsetDate });
    }
  }

  public sunsetVersion(version: string, sunsetDate: number): void {
    const apiVersion = this.versions.get(version);
    if (apiVersion) {
      apiVersion.status = 'sunset';
      apiVersion.sunsetDate = sunsetDate;
      
      logger.info(`API version ${version} sunset`, { sunsetDate });
    }
  }

  // Analytics and monitoring
  public getVersionStats(): Record<string, { requests: number; lastUsed: number; percentage: number }> {
    const totalRequests = Array.from(this.versionStats.values())
      .reduce((sum, stats) => sum + stats.requests, 0);

    const result: Record<string, { requests: number; lastUsed: number; percentage: number }> = {};

    for (const [version, stats] of this.versionStats.entries()) {
      result[version] = {
        ...stats,
        percentage: totalRequests > 0 ? (stats.requests / totalRequests) * 100 : 0,
      };
    }

    return result;
  }

  public getUsageReport(timeRange?: { start: number; end: number }): any {
    return {
      versions: this.getAllVersions().map(version => ({
        version: version.version,
        status: version.status,
        releaseDate: version.releaseDate,
        deprecationDate: version.deprecationDate,
        sunsetDate: version.sunsetDate,
        stats: this.versionStats.get(version.version),
      })),
      usage: this.getVersionStats(),
      supportedVersions: this.config.supportedVersions,
      deprecatedVersions: this.getDeprecatedVersions().map(v => v.version),
      sunsetVersions: this.getAllVersions().filter(v => v.status === 'sunset').map(v => v.version),
    };
  }

  // Configuration management
  public getConfig(): VersioningConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<VersioningConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('APIVersioningService configuration updated');
  }

  public addSupportedVersion(version: string): void {
    if (!this.config.supportedVersions.includes(version)) {
      this.config.supportedVersions.push(version);
      logger.info(`Supported version added: ${version}`);
    }
  }

  public removeSupportedVersion(version: string): void {
    const index = this.config.supportedVersions.indexOf(version);
    if (index > -1) {
      this.config.supportedVersions.splice(index, 1);
      logger.info(`Supported version removed: ${version}`);
    }
  }

  // Cleanup and maintenance
  public cleanup(): void {
    // Clean up old version stats
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    for (const [version, stats] of this.versionStats.entries()) {
      if (stats.lastUsed < oneWeekAgo && !this.config.supportedVersions.includes(version)) {
        this.versionStats.delete(version);
        logger.info(`Cleaned up stats for unused version: ${version}`);
      }
    }
  }
}
