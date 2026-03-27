import * as crypto from 'crypto';
import { EncryptedData } from './HomomorphicEncryption';

export class EncryptionUtils {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;

  /**
   * Generate a random encryption key
   */
  static generateKey(): Buffer {
    return crypto.randomBytes(this.KEY_LENGTH);
  }

  /**
   * Generate a random initialization vector
   */
  static generateIV(): Buffer {
    return crypto.randomBytes(this.IV_LENGTH);
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  static encryptAES(data: string, key: Buffer): { encrypted: string; iv: string; tag: string } {
    const iv = this.generateIV();
    const cipher = crypto.createCipher(this.ALGORITHM, key);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  static decryptAES(encrypted: string, key: Buffer, iv: string, tag: string): string {
    const decipher = crypto.createDecipher(this.ALGORITHM, key);
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    decipher.setAAD(Buffer.from(iv, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Hash data using SHA-256
   */
  static hashSHA256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Hash data using SHA-512
   */
  static hashSHA512(data: string): string {
    return crypto.createHash('sha512').update(data).digest('hex');
  }

  /**
   * Generate HMAC
   */
  static generateHMAC(data: string, key: string): string {
    return crypto.createHmac('sha256', key).update(data).digest('hex');
  }

  /**
   * Verify HMAC
   */
  static verifyHMAC(data: string, key: string, hmac: string): boolean {
    const computed = this.generateHMAC(data, key);
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hmac, 'hex'));
  }

  /**
   * Generate a secure random string
   */
  static generateSecureToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Convert encrypted data to base64 for storage
   */
  static serializeEncryptedData(data: EncryptedData): string {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  /**
   * Parse encrypted data from base64
   */
  static deserializeEncryptedData(data: string): EncryptedData {
    return JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
  }

  /**
   * Validate encrypted data structure
   */
  static validateEncryptedData(data: any): data is EncryptedData {
    return (
      typeof data === 'object' &&
      data !== null &&
      typeof data.ciphertext === 'string' &&
      data.ciphertext.length > 0
    );
  }

  /**
   * Calculate data entropy
   */
  static calculateEntropy(data: string): number {
    const charCount = new Map<string, number>();
    for (const char of data) {
      charCount.set(char, (charCount.get(char) || 0) + 1);
    }

    let entropy = 0;
    const length = data.length;

    for (const count of charCount.values()) {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  /**
   * Check if data has sufficient entropy for encryption
   */
  static hasSufficientEntropy(data: string, threshold = 3.0): boolean {
    return this.calculateEntropy(data) >= threshold;
  }

  /**
   * Generate a key derivation function (PBKDF2)
   */
  static deriveKey(password: string, salt: string, iterations = 10000): Buffer {
    return crypto.pbkdf2Sync(password, salt, iterations, this.KEY_LENGTH, 'sha256');
  }

  /**
   * Generate a salt for key derivation
   */
  static generateSalt(length = 16): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Compress data before encryption (simplified)
   */
  static compressData(data: string): Buffer {
    // In a real implementation, you'd use a compression library like zlib
    // For now, just convert to buffer
    return Buffer.from(data, 'utf8');
  }

  /**
   * Decompress data after decryption (simplified)
   */
  static decompressData(data: Buffer): string {
    // In a real implementation, you'd use a compression library like zlib
    // For now, just convert to string
    return data.toString('utf8');
  }

  /**
   * Validate encryption key strength
   */
  static validateKeyStrength(key: Buffer): { isValid: boolean; strength: string } {
    if (key.length < 16) {
      return { isValid: false, strength: 'weak' };
    }

    if (key.length < 24) {
      return { isValid: true, strength: 'medium' };
    }

    return { isValid: true, strength: 'strong' };
  }

  /**
   * Generate a key fingerprint for identification
   */
  static generateKeyFingerprint(key: Buffer): string {
    return this.hashSHA256(key.toString('hex')).substring(0, 16);
  }

  /**
   * Securely compare two buffers
   */
  static secureCompare(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  }

  /**
   * Generate a cryptographically secure random number
   */
  static secureRandom(min: number, max: number): number {
    const range = max - min;
    const bytes = Math.ceil(Math.log2(range) / 8);
    const randomBytes = crypto.randomBytes(bytes);
    let result = 0;

    for (let i = 0; i < bytes; i++) {
      result = (result << 8) + randomBytes[i];
    }

    return min + (result % range);
  }

  /**
   * Create a digital signature
   */
  static signData(data: string, privateKey: string): string {
    const sign = crypto.createSign('SHA256');
    sign.update(data);
    return sign.sign(privateKey, 'hex');
  }

  /**
   * Verify a digital signature
   */
  static verifySignature(data: string, signature: string, publicKey: string): boolean {
    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    return verify.verify(publicKey, signature, 'hex');
  }

  /**
   * Generate RSA key pair
   */
  static generateRSAKeyPair(): { publicKey: string; privateKey: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return { publicKey, privateKey };
  }

  /**
   * Encrypt with RSA public key
   */
  static encryptRSA(data: string, publicKey: string): string {
    const buffer = Buffer.from(data, 'utf8');
    const encrypted = crypto.publicEncrypt(publicKey, buffer);
    return encrypted.toString('base64');
  }

  /**
   * Decrypt with RSA private key
   */
  static decryptRSA(encryptedData: string, privateKey: string): string {
    const buffer = Buffer.from(encryptedData, 'base64');
    const decrypted = crypto.privateDecrypt(privateKey, buffer);
    return decrypted.toString('utf8');
  }
}