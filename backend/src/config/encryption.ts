export interface EncryptionConfig {
  // Homomorphic encryption settings
  polyModulusDegree: number;
  coeffModulusBits: number[];
  scale: number;
  securityLevel: 'tc128' | 'tc192' | 'tc256';

  // Key management
  keyRotationInterval: number; // in days
  forceKeyRegeneration: boolean;
  keyBackupEnabled: boolean;

  // Performance settings
  maxConcurrency: number;
  operationTimeout: number; // in milliseconds
  batchSize: number;

  // Security settings
  enableAuditLogging: boolean;
  requireAuthentication: boolean;
  maxAccessAttempts: number;

  // Storage settings
  encryptedDataRetention: number; // in days
  backupFrequency: number; // in hours

  // Compliance settings
  fipsCompliant: boolean;
  gdprCompliant: boolean;
  hipaaCompliant: boolean;
}

export const defaultEncryptionConfig: EncryptionConfig = {
  // CKKS scheme parameters for homomorphic encryption
  polyModulusDegree: 8192,
  coeffModulusBits: [60, 40, 40, 40, 40, 40, 40, 60],
  scale: Math.pow(2, 40),
  securityLevel: 'tc128',

  // Key management - rotate keys every 30 days
  keyRotationInterval: 30,
  forceKeyRegeneration: false,
  keyBackupEnabled: true,

  // Performance - allow up to 10 concurrent operations
  maxConcurrency: 10,
  operationTimeout: 30000, // 30 seconds
  batchSize: 50,

  // Security - enable all security features
  enableAuditLogging: true,
  requireAuthentication: true,
  maxAccessAttempts: 3,

  // Storage - retain encrypted data for 1 year
  encryptedDataRetention: 365,
  backupFrequency: 24, // daily backups

  // Compliance - enable all compliance modes
  fipsCompliant: true,
  gdprCompliant: true,
  hipaaCompliant: false, // Can be enabled if needed
};

export class EncryptionConfigValidator {
  static validate(config: Partial<EncryptionConfig>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate poly modulus degree
    if (config.polyModulusDegree && config.polyModulusDegree < 1024) {
      errors.push('Poly modulus degree must be at least 1024');
    }

    // Validate coefficient modulus bits
    if (config.coeffModulusBits) {
      if (config.coeffModulusBits.length < 3) {
        errors.push('Coefficient modulus must have at least 3 primes');
      }
      if (config.coeffModulusBits.some(bits => bits < 20 || bits > 60)) {
        errors.push('Coefficient modulus bits must be between 20 and 60');
      }
    }

    // Validate scale
    if (config.scale && config.scale < Math.pow(2, 20)) {
      errors.push('Scale must be at least 2^20');
    }

    // Validate key rotation interval
    if (config.keyRotationInterval && config.keyRotationInterval < 1) {
      errors.push('Key rotation interval must be at least 1 day');
    }

    // Validate performance settings
    if (config.maxConcurrency && config.maxConcurrency < 1) {
      errors.push('Max concurrency must be at least 1');
    }

    if (config.operationTimeout && config.operationTimeout < 1000) {
      errors.push('Operation timeout must be at least 1000ms');
    }

    // Validate security settings
    if (config.maxAccessAttempts && config.maxAccessAttempts < 1) {
      errors.push('Max access attempts must be at least 1');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static mergeWithDefaults(partialConfig: Partial<EncryptionConfig>): EncryptionConfig {
    return { ...defaultEncryptionConfig, ...partialConfig };
  }
}

export class EncryptionComplianceChecker {
  static checkFIPSCompliance(config: EncryptionConfig): { compliant: boolean; issues: string[] } {
    const issues: string[] = [];

    if (config.securityLevel !== 'tc256') {
      issues.push('FIPS compliance requires tc256 security level');
    }

    if (config.polyModulusDegree < 4096) {
      issues.push('FIPS compliance requires poly modulus degree of at least 4096');
    }

    if (!config.enableAuditLogging) {
      issues.push('FIPS compliance requires audit logging');
    }

    return {
      compliant: issues.length === 0,
      issues,
    };
  }

  static checkGDPRCompliance(config: EncryptionConfig): { compliant: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!config.requireAuthentication) {
      issues.push('GDPR compliance requires user authentication');
    }

    if (config.encryptedDataRetention > 2555) { // ~7 years
      issues.push('GDPR limits data retention to reasonable periods');
    }

    if (!config.keyBackupEnabled) {
      issues.push('GDPR requires data backup and recovery capabilities');
    }

    return {
      compliant: issues.length === 0,
      issues,
    };
  }

  static checkHIPAACompliance(config: EncryptionConfig): { compliant: boolean; issues: string[] } {
    const issues: string[] = [];

    if (config.securityLevel !== 'tc256') {
      issues.push('HIPAA compliance requires tc256 security level');
    }

    if (!config.enableAuditLogging) {
      issues.push('HIPAA compliance requires comprehensive audit logging');
    }

    if (config.keyRotationInterval > 365) {
      issues.push('HIPAA requires more frequent key rotation');
    }

    return {
      compliant: issues.length === 0,
      issues,
    };
  }
}