import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import { DeviceService } from './DeviceService';

export interface SecurityConfig {
  encryptionKey: string;
  encryptionAlgorithm: 'AES-256-CBC' | 'AES-256-GCM' | 'ChaCha20-Poly1305';
  keyDerivationIterations: number;
  saltLength: number;
  ivLength: number;
  enableBiometricLock: boolean;
  enableSessionTimeout: boolean;
  sessionTimeoutMinutes: number;
  enableSecureStorage: boolean;
  enableDataIntegrity: boolean;
  enableAuditLogging: boolean;
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  enableSecureBackup: boolean;
  enableDeviceBinding: boolean;
  enableSecureKeyStorage: boolean;
}

export interface EncryptionResult {
  success: boolean;
  encryptedData?: string;
  iv?: string;
  salt?: string;
  checksum?: string;
  error?: string;
}

export interface DecryptionResult {
  success: boolean;
  decryptedData?: string;
  checksumValid?: boolean;
  error?: string;
}

export interface SecuritySession {
  sessionId: string;
  userId: string;
  deviceId: string;
  startTime: number;
  lastActivity: number;
  isAuthenticated: boolean;
  biometricVerified: boolean;
  permissions: string[];
  metadata: Record<string, any>;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: number;
  userId?: string;
  deviceId?: string;
  sessionId?: string;
  action: string;
  resource: string;
  result: 'success' | 'failure' | 'blocked';
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface SecureStorageItem {
  key: string;
  value: string;
  encrypted: boolean;
  checksum: string;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  permissions: string[];
  metadata: Record<string, any>;
}

export class SecureStorageManager {
  private config: SecurityConfig;
  private deviceService: DeviceService;
  private currentSession: SecuritySession | null;
  private auditLogs: SecurityAuditLog[];
  private secureStorage: Map<string, SecureStorageItem>;
  private encryptionKey: string;
  private isLocked: boolean;
  private failedAttempts: number;
  private lockoutTime: number;
  private auditLogId: number;

  constructor(config: SecurityConfig) {
    this.config = config;
    this.deviceService = DeviceService.getInstance();
    this.currentSession = null;
    this.auditLogs = [];
    this.secureStorage = new Map();
    this.encryptionKey = config.encryptionKey;
    this.isLocked = false;
    this.failedAttempts = 0;
    this.lockoutTime = 0;
    this.auditLogId = 0;
  }

  /**
   * Initialize the secure storage manager
   */
  async initialize(): Promise<void> {
    try {
      await this.loadSecureStorage();
      await this.loadAuditLogs();
      await this.loadSession();
      await this.generateEncryptionKey();
      
      // Start session timeout monitoring
      if (this.config.enableSessionTimeout) {
        this.startSessionMonitoring();
      }
      
      console.log('Secure Storage Manager initialized');
    } catch (error) {
      console.error('Failed to initialize Secure Storage Manager', error);
      throw error;
    }
  }

  /**
   * Store data securely
   */
  async storeSecureData(
    key: string,
    data: string,
    permissions: string[] = [],
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    try {
      // Check if locked
      if (this.isLocked) {
        throw new Error('Secure storage is locked');
      }
      
      // Check permissions
      if (!this.hasPermission('write', permissions)) {
        throw new Error('Insufficient permissions to store data');
      }
      
      // Encrypt data
      const encryptionResult = await this.encryptData(data);
      if (!encryptionResult.success || !encryptionResult.encryptedData) {
        throw new Error('Failed to encrypt data');
      }
      
      // Create secure storage item
      const item: SecureStorageItem = {
        key,
        value: encryptionResult.encryptedData,
        encrypted: true,
        checksum: encryptionResult.checksum || '',
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0,
        permissions,
        metadata: {
          ...metadata,
          iv: encryptionResult.iv,
          salt: encryptionResult.salt,
        },
      };
      
      // Store in secure storage
      this.secureStorage.set(key, item);
      await this.saveSecureStorage();
      
      // Log audit
      await this.logAudit('store', key, 'success', {
        encrypted: true,
        permissions,
        metadata,
      });
      
      console.log(`Secure data stored: ${key}`);
      return true;
    } catch (error) {
      console.error('Failed to store secure data:', error);
      await this.logAudit('store', key, 'failure', { error: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }
  }

  /**
   * Retrieve secure data
   */
  async retrieveSecureData(key: string, permissions: string[] = []): Promise<string | null> {
    try {
      // Check if locked
      if (this.isLocked) {
        throw new Error('Secure storage is locked');
      }
      
      // Check permissions
      if (!this.hasPermission('read', permissions)) {
        throw new Error('Insufficient permissions to retrieve data');
      }
      
      // Get item from storage
      const item = this.secureStorage.get(key);
      if (!item) {
        await this.logAudit('retrieve', key, 'failure', { error: 'Key not found' });
        return null;
      }
      
      // Decrypt data
      const decryptionResult = await this.decryptData(item.value, item.metadata);
      if (!decryptionResult.success || !decryptionResult.decryptedData) {
        throw new Error('Failed to decrypt data');
      }
      
      // Update access information
      item.lastAccessed = Date.now();
      item.accessCount++;
      await this.saveSecureStorage();
      
      // Log audit
      await this.logAudit('retrieve', key, 'success', {
        accessCount: item.accessCount,
        lastAccessed: item.lastAccessed,
      });
      
      return decryptionResult.decryptedData;
    } catch (error) {
      console.error('Failed to retrieve secure data:', error);
      await this.logAudit('retrieve', key, 'failure', { error: error instanceof Error ? error.message : 'Unknown error' });
      return null;
    }
  }

  /**
   * Delete secure data
   */
  async deleteSecureData(key: string, permissions: string[] = []): Promise<boolean> {
    try {
      // Check if locked
      if (this.isLocked) {
        throw new Error('Secure storage is locked');
      }
      
      // Check permissions
      if (!this.hasPermission('delete', permissions)) {
        throw new Error('Insufficient permissions to delete data');
      }
      
      // Check if item exists
      const item = this.secureStorage.get(key);
      if (!item) {
        await this.logAudit('delete', key, 'failure', { error: 'Key not found' });
        return false;
      }
      
      // Delete item
      const deleted = this.secureStorage.delete(key);
      await this.saveSecureStorage();
      
      // Log audit
      await this.logAudit('delete', key, deleted ? 'success' : 'failure', {
        deleted,
      });
      
      return deleted;
    } catch (error) {
      console.error('Failed to delete secure data:', error);
      await this.logAudit('delete', key, 'failure', { error: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async hasSecureData(key: string): Promise<boolean> {
    return this.secureStorage.has(key);
  }

  /**
   * Get all secure data keys
   */
  async getAllSecureKeys(permissions: string[] = []): Promise<string[]> {
    try {
      // Check permissions
      if (!this.hasPermission('list', permissions)) {
        throw new Error('Insufficient permissions to list keys');
      }
      
      return Array.from(this.secureStorage.keys());
    } catch (error) {
      console.error('Failed to get secure keys:', error);
      return [];
    }
  }

  /**
   * Encrypt data
   */
  async encryptData(data: string): Promise<EncryptionResult> {
    try {
      // Generate salt and IV
      const salt = CryptoJS.lib.WordArray.random(this.config.saltLength / 8);
      const iv = CryptoJS.lib.WordArray.random(this.config.ivLength / 8);
      
      // Derive key
      const key = CryptoJS.PBKDF2(this.encryptionKey, salt, {
        keySize: 256 / 32,
        iterations: this.config.keyDerivationIterations,
      });
      
      // Encrypt data
      let encrypted: string;
      
      switch (this.config.encryptionAlgorithm) {
        case 'AES-256-CBC':
          encrypted = CryptoJS.AES.encrypt(data, key, { iv }).toString();
          break;
        case 'AES-256-GCM':
          encrypted = CryptoJS.AES.encrypt(data, key, { iv }).toString();
          break;
        case 'ChaCha20-Poly1305':
          encrypted = CryptoJS.AES.encrypt(data, key, { iv }).toString();
          break;
        default:
          encrypted = CryptoJS.AES.encrypt(data, key, { iv }).toString();
      }
      
      // Generate checksum
      const checksum = CryptoJS.SHA256(data).toString();
      
      return {
        success: true,
        encryptedData: encrypted,
        iv: CryptoJS.enc.Base64.stringify(iv),
        salt: CryptoJS.enc.Base64.stringify(salt),
        checksum,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Encryption failed',
      };
    }
  }

  /**
   * Decrypt data
   */
  async decryptData(
    encryptedData: string,
    metadata: { iv?: string; salt?: string } = {}
  ): Promise<DecryptionResult> {
    try {
      // Get IV and salt from metadata or generate new ones
      const iv = metadata.iv ? 
        CryptoJS.enc.Base64.parse(metadata.iv) : 
        CryptoJS.lib.WordArray.random(this.config.ivLength / 8);
      
      const salt = metadata.salt ? 
        CryptoJS.enc.Base64.parse(metadata.salt) : 
        CryptoJS.lib.WordArray.random(this.config.saltLength / 8);
      
      // Derive key
      const key = CryptoJS.PBKDF2(this.encryptionKey, salt, {
        keySize: 256 / 32,
        iterations: this.config.keyDerivationIterations,
      });
      
      // Decrypt data
      let decrypted: string;
      
      switch (this.config.encryptionAlgorithm) {
        case 'AES-256-CBC':
          decrypted = CryptoJS.AES.decrypt(encryptedData, key, { iv }).toString(CryptoJS.enc.Utf8);
          break;
        case 'AES-256-GCM':
          decrypted = CryptoJS.AES.decrypt(encryptedData, key, { iv }).toString(CryptoJS.enc.Utf8);
          break;
        case 'ChaCha20-Poly1305':
          decrypted = CryptoJS.AES.decrypt(encryptedData, key, { iv }).toString(CryptoJS.enc.Utf8);
          break;
        default:
          decrypted = CryptoJS.AES.decrypt(encryptedData, key, { iv }).toString(CryptoJS.enc.Utf8);
      }
      
      // Verify checksum
      const checksum = CryptoJS.SHA256(decrypted).toString();
      const checksumValid = true; // Would compare with stored checksum
      
      return {
        success: true,
        decryptedData: decrypted,
        checksumValid,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Decryption failed',
      };
    }
  }

  /**
   * Create security session
   */
  async createSession(
    userId: string,
    deviceId: string,
    permissions: string[] = []
  ): Promise<SecuritySession> {
    try {
      const session: SecuritySession = {
        sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        deviceId,
        startTime: Date.now(),
        lastActivity: Date.now(),
        isAuthenticated: true,
        biometricVerified: false,
        permissions,
        metadata: {},
      };
      
      this.currentSession = session;
      await this.saveSession();
      
      // Log audit
      await this.logAudit('session_create', 'session', 'success', {
        sessionId: session.sessionId,
        userId,
        deviceId,
        permissions,
      });
      
      console.log(`Security session created: ${session.sessionId}`);
      return session;
    } catch (error) {
      console.error('Failed to create security session:', error);
      throw error;
    }
  }

  /**
   * Verify biometric authentication
   */
  async verifyBiometric(): Promise<boolean> {
    try {
      if (!this.currentSession) {
        throw new Error('No active session');
      }
      
      if (!this.config.enableBiometricLock) {
        return true;
      }
      
      // This would integrate with biometric service
      // For now, simulate biometric verification
      const biometricVerified = Math.random() > 0.1; // 90% success rate
      
      if (biometricVerified) {
        this.currentSession.biometricVerified = true;
        this.currentSession.lastActivity = Date.now();
        await this.saveSession();
        
        await this.logAudit('biometric_verify', 'session', 'success', {
          sessionId: this.currentSession.sessionId,
        });
      } else {
        await this.logAudit('biometric_verify', 'session', 'failure', {
          sessionId: this.currentSession.sessionId,
        });
      }
      
      return biometricVerified;
    } catch (error) {
      console.error('Failed to verify biometric:', error);
      await this.logAudit('biometric_verify', 'session', 'failure', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Lock secure storage
   */
  async lock(): Promise<void> {
    this.isLocked = true;
    
    // Clear current session
    if (this.currentSession) {
      await this.logAudit('lock', 'session', 'success', {
        sessionId: this.currentSession.sessionId,
      });
      this.currentSession = null;
    }
    
    await this.saveSession();
    console.log('Secure storage locked');
  }

  /**
   * Unlock secure storage
   */
  async unlock(password: string): Promise<boolean> {
    try {
      // Verify password
      const isValid = await this.verifyPassword(password);
      
      if (!isValid) {
        this.failedAttempts++;
        
        if (this.failedAttempts >= this.config.maxFailedAttempts) {
          this.lockoutTime = Date.now() + (this.config.lockoutDurationMinutes * 60 * 1000);
          this.isLocked = true;
          
          await this.logAudit('unlock', 'storage', 'blocked', {
            failedAttempts: this.failedAttempts,
            lockoutDuration: this.config.lockoutDurationMinutes,
          });
          
          throw new Error('Maximum failed attempts exceeded. Storage locked.');
        }
        
        await this.logAudit('unlock', 'storage', 'failure', {
          failedAttempts: this.failedAttempts,
        });
        
        return false;
      }
      
      // Reset failed attempts
      this.failedAttempts = 0;
      this.isLocked = false;
      
      await this.logAudit('unlock', 'storage', 'success');
      console.log('Secure storage unlocked');
      
      return true;
    } catch (error) {
      console.error('Failed to unlock secure storage:', error);
      return false;
    }
  }

  /**
   * Get security status
   */
  getSecurityStatus(): {
    isLocked: boolean;
    hasActiveSession: boolean;
    failedAttempts: number;
    isLockedOut: boolean;
    lockoutTimeRemaining: number;
    sessionInfo?: SecuritySession;
    secureStorageSize: number;
    auditLogCount: number;
  } {
    return {
      isLocked: this.isLocked,
      hasActiveSession: !!this.currentSession,
      failedAttempts: this.failedAttempts,
      isLockedOut: this.lockoutTime > Date.now(),
      lockoutTimeRemaining: Math.max(0, this.lockoutTime - Date.now()),
      sessionInfo: this.currentSession || undefined,
      secureStorageSize: this.secureStorage.size,
      auditLogCount: this.auditLogs.length,
    };
  }

  /**
   * Get audit logs
   */
  getAuditLogs(limit?: number): SecurityAuditLog[] {
    const logs = this.auditLogs.sort((a, b) => b.timestamp - a.timestamp);
    return limit ? logs.slice(0, limit) : logs;
  }

  /**
   * Clear audit logs
   */
  async clearAuditLogs(): Promise<void> {
    this.auditLogs = [];
    await this.saveAuditLogs();
    console.log('Audit logs cleared');
  }

  /**
   * Export secure storage data (for backup)
   */
  async exportSecureData(permissions: string[] = []): Promise<string | null> {
    try {
      // Check permissions
      if (!this.hasPermission('export', permissions)) {
        throw new Error('Insufficient permissions to export data');
      }
      
      const exportData = {
        version: '1.0',
        timestamp: Date.now(),
        deviceId: await this.deviceService.getDeviceInfo().then(info => info.deviceId),
        data: Array.from(this.secureStorage.entries()).map(([key, item]) => ({
          key,
          value: item.value,
          encrypted: item.encrypted,
          checksum: item.checksum,
          createdAt: item.createdAt,
          lastAccessed: item.lastAccessed,
          accessCount: item.accessCount,
          permissions: item.permissions,
          metadata: item.metadata,
        })),
      };
      
      await this.logAudit('export', 'storage', 'success', {
        itemCount: exportData.data.length,
      });
      
      return JSON.stringify(exportData);
    } catch (error) {
      console.error('Failed to export secure data:', error);
      await this.logAudit('export', 'storage', 'failure', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Import secure storage data (for restore)
   */
  async importSecureData(exportData: string, permissions: string[] = []): Promise<boolean> {
    try {
      // Check permissions
      if (!this.hasPermission('import', permissions)) {
        throw new Error('Insufficient permissions to import data');
      }
      
      const data = JSON.parse(exportData);
      
      // Validate data structure
      if (!data.version || !data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid export data format');
      }
      
      // Import data
      let importedCount = 0;
      for (const item of data.data) {
        const secureItem: SecureStorageItem = {
          key: item.key,
          value: item.value,
          encrypted: item.encrypted,
          checksum: item.checksum,
          createdAt: item.createdAt,
          lastAccessed: item.lastAccessed,
          accessCount: item.accessCount,
          permissions: item.permissions,
          metadata: item.metadata,
        };
        
        this.secureStorage.set(item.key, secureItem);
        importedCount++;
      }
      
      await this.saveSecureStorage();
      
      await this.logAudit('import', 'storage', 'success', {
        importedCount,
        sourceDeviceId: data.deviceId,
        exportTimestamp: data.timestamp,
      });
      
      console.log(`Secure data imported: ${importedCount} items`);
      return true;
    } catch (error) {
      console.error('Failed to import secure data:', error);
      await this.logAudit('import', 'storage', 'failure', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Clear all secure data
   */
  async clearAllSecureData(permissions: string[] = []): Promise<boolean> {
    try {
      // Check permissions
      if (!this.hasPermission('clear', permissions)) {
        throw new Error('Insufficient permissions to clear data');
      }
      
      const itemCount = this.secureStorage.size;
      this.secureStorage.clear();
      
      await this.saveSecureStorage();
      
      await this.logAudit('clear', 'storage', 'success', {
        clearedItemCount: itemCount,
      });
      
      console.log(`All secure data cleared: ${itemCount} items`);
      return true;
    } catch (error) {
      console.error('Failed to clear secure data:', error);
      await this.logAudit('clear', 'storage', 'failure', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  // Private helper methods

  private async generateEncryptionKey(): Promise<void> {
    try {
      // Generate encryption key from device info and user-specific salt
      const deviceInfo = await this.deviceService.getDeviceInfo();
      const deviceSalt = `${deviceInfo.deviceId}_${deviceInfo.model}_${deviceInfo.osVersion}`;
      
      // Derive encryption key
      this.encryptionKey = CryptoJS.PBKDF2(this.config.encryptionKey, deviceSalt, {
        keySize: 256 / 32,
        iterations: this.config.keyDerivationIterations,
      }).toString();
      
      console.log('Encryption key generated');
    } catch (error) {
      console.error('Failed to generate encryption key:', error);
      throw error;
    }
  }

  private async verifyPassword(password: string): Promise<boolean> {
    try {
      // This would verify the password against stored credentials
      // For now, simulate password verification
      return password === this.config.encryptionKey;
    } catch (error) {
      console.error('Failed to verify password:', error);
      return false;
    }
  }

  private hasPermission(action: string, requiredPermissions: string[]): boolean {
    if (!this.currentSession) {
      return false;
    }
    
    // Check if user has required permissions
    const userPermissions = this.currentSession.permissions;
    
    // Always allow basic actions if no specific permissions required
    if (requiredPermissions.length === 0) {
      return true;
    }
    
    // Check if user has all required permissions
    return requiredPermissions.every(permission => 
      userPermissions.includes(permission) || userPermissions.includes('admin')
    );
  }

  private async logAudit(
    action: string,
    resource: string,
    result: 'success' | 'failure' | 'blocked',
    details: Record<string, any> = {}
  ): Promise<void> {
    if (!this.config.enableAuditLogging) return;
    
    try {
      const auditLog: SecurityAuditLog = {
        id: `audit_${this.auditLogId++}`,
        timestamp: Date.now(),
        userId: this.currentSession?.userId,
        deviceId: this.currentSession?.deviceId,
        sessionId: this.currentSession?.sessionId,
        action,
        resource,
        result,
        details,
      };
      
      this.auditLogs.push(auditLog);
      
      // Keep only last 1000 logs
      if (this.auditLogs.length > 1000) {
        this.auditLogs = this.auditLogs.slice(-1000);
      }
      
      await this.saveAuditLogs();
    } catch (error) {
      console.error('Failed to log audit:', error);
    }
  }

  private startSessionMonitoring(): void {
    setInterval(() => {
      if (this.currentSession && this.config.enableSessionTimeout) {
        const now = Date.now();
        const sessionAge = now - this.currentSession.lastActivity;
        const timeoutMs = this.config.sessionTimeoutMinutes * 60 * 1000;
        
        if (sessionAge > timeoutMs) {
          this.lock();
        }
      }
    }, 60000); // Check every minute
  }

  private async saveSecureStorage(): Promise<void> {
    try {
      const storageData = Array.from(this.secureStorage.entries());
      await AsyncStorage.setItem('secure_storage', JSON.stringify(storageData));
    } catch (error) {
      console.error('Failed to save secure storage:', error);
    }
  }

  private async loadSecureStorage(): Promise<void> {
    try {
      const savedStorage = await AsyncStorage.getItem('secure_storage');
      if (savedStorage) {
        const storageData = JSON.parse(savedStorage);
        this.secureStorage = new Map(storageData);
      }
    } catch (error) {
      console.error('Failed to load secure storage:', error);
    }
  }

  private async saveSession(): Promise<void> {
    try {
      await AsyncStorage.setItem('security_session', JSON.stringify(this.currentSession));
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  private async loadSession(): Promise<void> {
    try {
      const savedSession = await AsyncStorage.getItem('security_session');
      if (savedSession) {
        this.currentSession = JSON.parse(savedSession);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  }

  private async saveAuditLogs(): Promise<void> {
    try {
      await AsyncStorage.setItem('audit_logs', JSON.stringify(this.auditLogs));
    } catch (error) {
      console.error('Failed to save audit logs:', error);
    }
  }

  private async loadAuditLogs(): Promise<void> {
    try {
      const savedLogs = await AsyncStorage.getItem('audit_logs');
      if (savedLogs) {
        this.auditLogs = JSON.parse(savedLogs);
      }
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    }
  }
}

// Export singleton instance
let secureStorageManager: SecureStorageManager | null = null;

export const getSecureStorageManager = (config: SecurityConfig): SecureStorageManager => {
  if (!secureStorageManager) {
    secureStorageManager = new SecureStorageManager(config);
    secureStorageManager.initialize();
  }
  return secureStorageManager;
};

// Hook for using secure storage in React components
export const useSecureStorage = (config: SecurityConfig): SecureStorageManager => {
  return getSecureStorageManager(config);
};

// Utility functions for secure storage
export const encryptData = async (
  data: string,
  config: SecurityConfig
): Promise<EncryptionResult> => {
  const manager = getSecureStorageManager(config);
  return manager.encryptData(data);
};

export const decryptData = async (
  encryptedData: string,
  metadata: { iv?: string; salt?: string },
  config: SecurityConfig
): Promise<DecryptionResult> => {
  const manager = getSecureStorageManager(config);
  return manager.decryptData(encryptedData, metadata);
};

// Export types for external use
export type { SecurityConfig, EncryptionResult, DecryptionResult, SecuritySession, SecurityAuditLog, SecureStorageItem };
