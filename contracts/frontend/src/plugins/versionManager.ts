import { PluginMetadata } from './pluginAPI';

export interface VersionConstraint {
  operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | '~' | '^';
  version: string;
}

export interface VersionInfo {
  current: string;
  latest?: string;
  updateAvailable: boolean;
  securityUpdate?: boolean;
}

export class VersionManager {
  private currentVerinodeVersion = '0.1.0';
  private versionCache = new Map<string, VersionInfo>();

  async checkCompatibility(metadata: PluginMetadata): Promise<boolean> {
    if (!metadata.verinodeVersion) {
      return true;
    }

    const constraint = this.parseVersionConstraint(metadata.verinodeVersion);
    return this.satisfiesVersion(this.currentVerinodeVersion, constraint);
  }

  async canUpdate(currentMetadata: PluginMetadata, newMetadata: PluginMetadata): Promise<boolean> {
    const currentVersion = currentMetadata.version;
    const newVersion = newMetadata.version;

    if (this.compareVersions(newVersion, currentVersion) <= 0) {
      return false;
    }

    if (!await this.checkCompatibility(newMetadata)) {
      return false;
    }

    return this.isCompatibleUpdate(currentVersion, newVersion);
  }

  async checkForUpdates(pluginId: string, currentVersion: string): Promise<VersionInfo> {
    if (this.versionCache.has(pluginId)) {
      return this.versionCache.get(pluginId)!;
    }

    const latestVersion = await this.fetchLatestVersion(pluginId);
    const updateAvailable = this.compareVersions(latestVersion, currentVersion) > 0;
    const securityUpdate = await this.isSecurityUpdate(pluginId, currentVersion, latestVersion);

    const versionInfo: VersionInfo = {
      current: currentVersion,
      latest: latestVersion,
      updateAvailable,
      securityUpdate
    };

    this.versionCache.set(pluginId, versionInfo);
    return versionInfo;
  }

  compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  }

  satisfiesVersion(version: string, constraint: VersionConstraint): boolean {
    switch (constraint.operator) {
      case '=':
        return version === constraint.version;
      case '!=':
        return version !== constraint.version;
      case '>':
        return this.compareVersions(version, constraint.version) > 0;
      case '>=':
        return this.compareVersions(version, constraint.version) >= 0;
      case '<':
        return this.compareVersions(version, constraint.version) < 0;
      case '<=':
        return this.compareVersions(version, constraint.version) <= 0;
      case '~':
        return this.satisfiesTildeVersion(version, constraint.version);
      case '^':
        return this.satisfiesCaretVersion(version, constraint.version);
      default:
        return false;
    }
  }

  parseVersionConstraint(constraintString: string): VersionConstraint {
    const match = constraintString.match(/^([=!<>~^]*)\s*(.+)$/);
    if (!match) {
      throw new Error(`Invalid version constraint: ${constraintString}`);
    }

    const operator = match[1] || '=';
    const version = match[2];

    if (!this.isValidVersion(version)) {
      throw new Error(`Invalid version: ${version}`);
    }

    return { operator: operator as VersionConstraint['operator'], version };
  }

  isValidVersion(version: string): boolean {
    const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9\-]+)?(\+[a-zA-Z0-9\-]+)?$/;
    return versionRegex.test(version);
  }

  getVerinodeVersion(): string {
    return this.currentVerinodeVersion;
  }

  setVerinodeVersion(version: string): void {
    if (!this.isValidVersion(version)) {
      throw new Error(`Invalid Verinode version: ${version}`);
    }
    this.currentVerinodeVersion = version;
  }

  clearVersionCache(): void {
    this.versionCache.clear();
  }

  private async fetchLatestVersion(pluginId: string): Promise<string> {
    try {
      const response = await fetch(`/api/plugins/${pluginId}/latest-version`);
      if (!response.ok) {
        return '0.0.0';
      }
      const data = await response.json();
      return data.version || '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  private async isSecurityUpdate(pluginId: string, currentVersion: string, latestVersion: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/plugins/${pluginId}/security-updates`);
      if (!response.ok) {
        return false;
      }
      const data = await response.json();
      return data.securityUpdates?.some((update: any) => 
        this.compareVersions(update.version, currentVersion) > 0 &&
        this.compareVersions(update.version, latestVersion) <= 0
      ) || false;
    } catch {
      return false;
    }
  }

  private isCompatibleUpdate(currentVersion: string, newVersion: string): boolean {
    const currentParts = currentVersion.split('.').map(Number);
    const newParts = newVersion.split('.').map(Number);

    if (newParts[0] > currentParts[0]) {
      return false;
    }

    if (newParts[0] === currentParts[0] && newParts[1] > currentParts[1]) {
      return false;
    }

    return true;
  }

  private satisfiesTildeVersion(version: string, constraintVersion: string): boolean {
    const vParts = version.split('.').map(Number);
    const cParts = constraintVersion.split('.').map(Number);

    if (vParts[0] !== cParts[0] || vParts[1] !== cParts[1]) {
      return false;
    }

    return this.compareVersions(version, constraintVersion) >= 0;
  }

  private satisfiesCaretVersion(version: string, constraintVersion: string): boolean {
    const vParts = version.split('.').map(Number);
    const cParts = constraintVersion.split('.').map(Number);

    if (vParts[0] !== cParts[0]) {
      return false;
    }

    if (cParts[0] === 0) {
      if (cParts[1] === 0) {
        return vParts[0] === 0 && vParts[1] === 0 && vParts[2] === cParts[2];
      }
      return vParts[0] === 0 && vParts[1] === cParts[1] && 
             this.compareVersions(version, constraintVersion) >= 0;
    }

    return this.compareVersions(version, constraintVersion) >= 0;
  }

  generateVersionReport(): Record<string, VersionInfo> {
    const report: Record<string, VersionInfo> = {};
    
    for (const [pluginId, versionInfo] of this.versionCache.entries()) {
      report[pluginId] = { ...versionInfo };
    }
    
    return report;
  }

  async batchCheckUpdates(pluginIds: string[]): Promise<Record<string, VersionInfo>> {
    const results: Record<string, VersionInfo> = {};
    
    await Promise.all(
      pluginIds.map(async (pluginId) => {
        const currentVersion = await this.getCurrentPluginVersion(pluginId);
        results[pluginId] = await this.checkForUpdates(pluginId, currentVersion);
      })
    );
    
    return results;
  }

  private async getCurrentPluginVersion(pluginId: string): Promise<string> {
    try {
      const response = await fetch(`/api/plugins/${pluginId}/version`);
      if (!response.ok) {
        return '0.0.0';
      }
      const data = await response.json();
      return data.version || '0.0.0';
    } catch {
      return '0.0.0';
    }
  }
}
