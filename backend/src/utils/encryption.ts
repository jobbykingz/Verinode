import crypto from 'crypto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(data: string, key: string): string {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(ENCRYPTION_ALGORITHM, Buffer.from(key, 'hex'));
    cipher.setAAD(Buffer.from('additional-data'));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine iv, authTag, and encrypted data
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  } catch (error) {
    throw new Error('Encryption failed: ' + error);
  }
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decrypt(encryptedData: string, key: string): string {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipher(ENCRYPTION_ALGORITHM, Buffer.from(key, 'hex'));
    decipher.setAAD(Buffer.from('additional-data'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed: ' + error);
  }
}

/**
 * Generate a secure random key
 */
export function generateKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash data using SHA-256
 */
export function hash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Verify data hash
 */
export function verifyHash(data: string, expectedHash: string): boolean {
  const actualHash = hash(data);
  return actualHash === expectedHash;
}
