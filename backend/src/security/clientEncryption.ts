import crypto from 'crypto';
import { promisify } from 'util';

const randomBytes = promisify(crypto.randomBytes);
const scrypt = promisify(crypto.scrypt);

/**
 * Client-side encryption service for sensitive proof data
 * Implements AES-256-GCM encryption with secure key derivation
 */
export class ClientEncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 12;
  private static readonly SALT_LENGTH = 32;
  private static readonly KEY_LENGTH = 32;
  private static readonly SCRYPT_PARAMS = { N: 32768, r: 8, p: 1 };

  /**
   * Generate a secure encryption key from password
   */
  static async generateKey(password: string, salt: Buffer): Promise<Buffer> {
    return await scrypt(
      password, 
      salt, 
      this.KEY_LENGTH, 
      this.SCRYPT_PARAMS
    ) as Buffer;
  }

  /**
   * Encrypt sensitive proof data client-side
   * @param data - The data to encrypt
   * @param password - User's password for key derivation
   * @returns Encrypted data with metadata
   */
  static async encrypt(data: string, password: string): Promise<{
    encryptedData: string;
    iv: string;
    salt: string;
    authTag: string;
    timestamp: string;
  }> {
    try {
      // Generate random salt and IV
      const salt = await randomBytes(this.SALT_LENGTH);
      const iv = await randomBytes(this.IV_LENGTH);
      
      // Generate key from password
      const key = await this.generateKey(password, salt);
      
      // Create cipher
      const cipher = crypto.createCipherGCM(this.ALGORITHM, key, iv);
      
      // Encrypt data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      return {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        authTag: authTag.toString('hex'),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt encrypted proof data
   * @param encryptedData - Encrypted data object
   * @param password - User's password for key derivation
   * @returns Decrypted data
   */
  static async decrypt(
    encryptedData: {
      encryptedData: string;
      iv: string;
      salt: string;
      authTag: string;
    },
    password: string
  ): Promise<string> {
    try {
      const { encryptedData: data, iv, salt, authTag } = encryptedData;
      
      // Convert hex strings back to buffers
      const key = await this.generateKey(password, Buffer.from(salt, 'hex'));
      const ivBuffer = Buffer.from(iv, 'hex');
      const authTagBuffer = Buffer.from(authTag, 'hex');
      
      // Create decipher
      const decipher = crypto.createDecipherGCM(this.ALGORITHM, key, ivBuffer);
      decipher.setAuthTag(authTagBuffer);
      
      // Decrypt data
      let decrypted = decipher.update(data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Generate key pair for asymmetric encryption
   * @returns Public and private key pair
   */
  static generateKeyPair(): { publicKey: string; privateKey: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    return { publicKey, privateKey };
  }

  /**
   * Encrypt data with public key (asymmetric)
   */
  static encryptWithPublicKey(data: string, publicKey: string): string {
    return crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      Buffer.from(data)
    ).toString('base64');
  }

  /**
   * Decrypt data with private key (asymmetric)
   */
  static decryptWithPrivateKey(encryptedData: string, privateKey: string): string {
    return crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      Buffer.from(encryptedData, 'base64')
    ).toString();
  }

  /**
   * Hash data for integrity verification
   */
  static hashData(data: string): string {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }

  /**
   * Verify data integrity
   */
  static verifyHash(data: string, hash: string): boolean {
    return this.hashData(data) === hash;
  }

  /**
   * Generate secure random bytes for various cryptographic needs
   */
  static async generateRandomBytes(length: number): Promise<string> {
    const bytes = await randomBytes(length);
    return bytes.toString('hex');
  }
}