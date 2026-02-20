import crypto from 'crypto';
import { ClientEncryptionService } from './clientEncryption';

/**
 * Key management system for secure encryption key handling and rotation
 */
export interface KeyMetadata {
  id: string;
  type: 'symmetric' | 'asymmetric';
  algorithm: string;
  createdAt: string;
  expiresAt?: string;
  status: 'active' | 'deprecated' | 'compromised';
  usage: 'encryption' | 'signing' | 'both';
  version: number;
}

export interface KeyPair {
  publicKey: string;
  privateKey: string;
  metadata: KeyMetadata;
}

export interface EncryptedKey {
  encryptedData: string;
  iv: string;
  salt: string;
  authTag: string;
  keyId: string;
}

/**
 * Key management service with secure rotation capabilities
 */
export class KeyManagementService {
  private static masterKey: string | null = null;
  private static keyPairs: Map<string, KeyPair> = new Map();
  private static encryptedKeys: Map<string, EncryptedKey> = new Map();
  private static keyRotationSchedule: Map<string, string> = new Map(); // keyId -> rotationDate

  /**
   * Initialize the key management system
   */
  static async initialize(masterPassword: string): Promise<void> {
    if (!this.masterKey) {
      // Generate master key from password
      const salt = await ClientEncryptionService.generateRandomBytes(32);
      const key = await ClientEncryptionService.generateKey(masterPassword, Buffer.from(salt, 'hex'));
      this.masterKey = key.toString('hex');
    }
  }

  /**
   * Generate a new key pair
   */
  static async generateKeyPair(
    usage: 'encryption' | 'signing' | 'both' = 'encryption',
    expiresInDays?: number
  ): Promise<string> {
    if (!this.masterKey) {
      throw new Error('Key management system not initialized');
    }

    const keyPair = ClientEncryptionService.generateKeyPair();
    const keyId = await ClientEncryptionService.generateRandomBytes(16);
    
    const metadata: KeyMetadata = {
      id: keyId,
      type: 'asymmetric',
      algorithm: 'RSA-4096',
      createdAt: new Date().toISOString(),
      expiresAt: expiresInDays ? 
        new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString() : 
        undefined,
      status: 'active',
      usage,
      version: 1
    };

    const keyEntry: KeyPair = {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      metadata
    };

    // Encrypt private key before storage
    const encryptedPrivateKey = await this.encryptPrivateKey(keyPair.privateKey);
    this.encryptedKeys.set(keyId, encryptedPrivateKey);
    
    // Store only public key and metadata
    this.keyPairs.set(keyId, {
      publicKey: keyPair.publicKey,
      privateKey: '', // Don't store actual private key
      metadata
    });

    // Schedule key rotation if expiration is set
    if (expiresInDays) {
      const rotationDate = new Date(Date.now() + (expiresInDays - 7) * 24 * 60 * 60 * 1000);
      this.keyRotationSchedule.set(keyId, rotationDate.toISOString());
    }

    return keyId;
  }

  /**
   * Encrypt private key using master key
   */
  private static async encryptPrivateKey(privateKey: string): Promise<EncryptedKey> {
    if (!this.masterKey) {
      throw new Error('Master key not available');
    }

    const masterKeyBuffer = Buffer.from(this.masterKey, 'hex');
    const salt = await ClientEncryptionService.generateRandomBytes(32);
    const iv = await ClientEncryptionService.generateRandomBytes(12);
    
    const key = await ClientEncryptionService.generateKey(
      this.masterKey,
      Buffer.from(salt, 'hex')
    );

    const cipher = crypto.createCipherGCM('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    const keyId = await ClientEncryptionService.generateRandomBytes(16);
    
    return {
      encryptedData: encrypted,
      iv,
      salt,
      authTag: authTag.toString('hex'),
      keyId
    };
  }

  /**
   * Decrypt private key using master key
   */
  private static async decryptPrivateKey(encryptedKey: EncryptedKey): Promise<string> {
    if (!this.masterKey) {
      throw new Error('Master key not available');
    }

    const key = await ClientEncryptionService.generateKey(
      this.masterKey,
      Buffer.from(encryptedKey.salt, 'hex')
    );

    const decipher = crypto.createDecipherGCM('aes-256-gcm', key, Buffer.from(encryptedKey.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(encryptedKey.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedKey.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Get public key by ID
   */
  static getPublicKey(keyId: string): string | null {
    const keyPair = this.keyPairs.get(keyId);
    return keyPair ? keyPair.publicKey : null;
  }

  /**
   * Get decrypted private key by ID (requires authorization)
   */
  static async getPrivateKey(keyId: string, authorizationToken: string): Promise<string> {
    // In practice, would verify authorization token
    // This is a simplified implementation
    
    const encryptedKey = this.encryptedKeys.get(keyId);
    if (!encryptedKey) {
      throw new Error('Key not found');
    }

    const keyPair = this.keyPairs.get(keyId);
    if (!keyPair || keyPair.metadata.status !== 'active') {
      throw new Error('Key not available or not active');
    }

    // Check expiration
    if (keyPair.metadata.expiresAt && new Date() > new Date(keyPair.metadata.expiresAt)) {
      throw new Error('Key has expired');
    }

    return await this.decryptPrivateKey(encryptedKey);
  }

  /**
   * Rotate encryption keys
   */
  static async rotateKey(keyId: string): Promise<string> {
    const oldKey = this.keyPairs.get(keyId);
    if (!oldKey) {
      throw new Error('Key not found');
    }

    // Mark old key as deprecated
    oldKey.metadata.status = 'deprecated';
    oldKey.metadata.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 1 week grace period

    // Generate new key pair
    const newKeyId = await this.generateKeyPair(
      oldKey.metadata.usage,
      oldKey.metadata.expiresAt ? 
        Math.ceil((new Date(oldKey.metadata.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) :
        365 // Default 1 year
    );

    // Update rotation schedule
    this.keyRotationSchedule.delete(keyId);
    
    return newKeyId;
  }

  /**
   * Re-encrypt data with new key during rotation
   */
  static async reencryptData(
    data: string,
    oldKeyId: string,
    newKeyId: string,
    authorizationToken: string
  ): Promise<string> {
    // Get both keys
    const oldPrivateKey = await this.getPrivateKey(oldKeyId, authorizationToken);
    const newPublicKey = this.getPublicKey(newKeyId);
    
    if (!newPublicKey) {
      throw new Error('New key not found');
    }

    // Decrypt with old key
    const decryptedData = ClientEncryptionService.decryptWithPrivateKey(data, oldPrivateKey);
    
    // Encrypt with new key
    return ClientEncryptionService.encryptWithPublicKey(decryptedData, newPublicKey);
  }

  /**
   * Check and perform automatic key rotation
   */
  static async performAutomaticRotation(): Promise<string[]> {
    const rotatedKeys: string[] = [];
    const now = new Date();

    for (const [keyId, rotationDate] of this.keyRotationSchedule.entries()) {
      if (now >= new Date(rotationDate)) {
        try {
          const newKeyId = await this.rotateKey(keyId);
          rotatedKeys.push(`${keyId} -> ${newKeyId}`);
        } catch (error) {
          console.error(`Failed to rotate key ${keyId}:`, error);
        }
      }
    }

    return rotatedKeys;
  }

  /**
   * Compromise a key (mark as compromised and generate replacement)
   */
  static async compromiseKey(keyId: string): Promise<string> {
    const key = this.keyPairs.get(keyId);
    if (!key) {
      throw new Error('Key not found');
    }

    // Mark as compromised
    key.metadata.status = 'compromised';
    key.metadata.expiresAt = new Date().toISOString(); // Immediate expiration

    // Generate replacement key
    const newKeyId = await this.generateKeyPair(key.metadata.usage);
    
    return newKeyId;
  }

  /**
   * Get key metadata
   */
  static getKeyMetadata(keyId: string): KeyMetadata | null {
    const keyPair = this.keyPairs.get(keyId);
    return keyPair ? { ...keyPair.metadata } : null;
  }

  /**
   * List all active keys
   */
  static listActiveKeys(): KeyMetadata[] {
    return Array.from(this.keyPairs.values())
      .filter(key => key.metadata.status === 'active')
      .map(key => ({ ...key.metadata }));
  }

  /**
   * Generate key derivation for specific purposes
   */
  static async deriveKey(
    purpose: string,
    keyId: string,
    authorizationToken: string
  ): Promise<string> {
    const privateKey = await this.getPrivateKey(keyId, authorizationToken);
    
    // Derive key based on purpose
    const purposeKey = crypto
      .createHash('sha256')
      .update(privateKey + purpose)
      .digest('hex');
    
    return purposeKey;
  }

  /**
   * Backup key management system
   */
  static async createBackup(backupPassword: string): Promise<string> {
    if (!this.masterKey) {
      throw new Error('Key management system not initialized');
    }

    // Create backup data
    const backupData = {
      masterKey: this.masterKey,
      keyPairs: Array.from(this.keyPairs.entries()),
      encryptedKeys: Array.from(this.encryptedKeys.entries()),
      createdAt: new Date().toISOString()
    };

    // Encrypt backup with backup password
    const backupString = JSON.stringify(backupData);
    const encryptedBackup = await ClientEncryptionService.encrypt(backupString, backupPassword);
    
    return JSON.stringify(encryptedBackup);
  }

  /**
   * Restore key management system from backup
   */
  static async restoreFromBackup(backupData: string, backupPassword: string): Promise<void> {
    const encryptedBackup = JSON.parse(backupData);
    const decryptedBackup = await ClientEncryptionService.decrypt(encryptedBackup, backupPassword);
    const backup = JSON.parse(decryptedBackup);

    // Restore master key
    this.masterKey = backup.masterKey;

    // Restore key pairs
    this.keyPairs = new Map(backup.keyPairs);
    
    // Restore encrypted keys
    this.encryptedKeys = new Map(backup.encryptedKeys);
  }

  /**
   * Clean up expired keys
   */
  static cleanupExpiredKeys(): number {
    const now = new Date();
    let cleanedCount = 0;

    for (const [keyId, keyPair] of this.keyPairs.entries()) {
      if (keyPair.metadata.expiresAt && now > new Date(keyPair.metadata.expiresAt)) {
        if (keyPair.metadata.status === 'deprecated' || keyPair.metadata.status === 'compromised') {
          this.keyPairs.delete(keyId);
          this.encryptedKeys.delete(keyId);
          this.keyRotationSchedule.delete(keyId);
          cleanedCount++;
        }
      }
    }

    return cleanedCount;
  }
}