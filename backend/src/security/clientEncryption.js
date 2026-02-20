const crypto = require('crypto');

/**
 * Client-side encryption service for sensitive proof data
 * Implements AES-256-GCM encryption with secure key derivation
 */
class ClientEncryptionService {
  static ALGORITHM = 'aes-256-gcm';
  static IV_LENGTH = 12;
  static SALT_LENGTH = 32;
  static KEY_LENGTH = 32;
  static SCRYPT_PARAMS = { N: 32768, r: 8, p: 1 };

  /**
   * Generate a secure encryption key from password
   */
  static generateKey(password, salt) {
    return crypto.scryptSync(password, salt, this.KEY_LENGTH, this.SCRYPT_PARAMS);
  }

  /**
   * Encrypt sensitive proof data client-side
   * @param {string} data - The data to encrypt
   * @param {string} password - User's password for key derivation
   * @returns {Object} Encrypted data with metadata
   */
  static encrypt(data, password) {
    try {
      // Generate random salt and IV
      const salt = crypto.randomBytes(this.SALT_LENGTH);
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      // Generate key from password
      const key = this.generateKey(password, salt);
      
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
   * @param {Object} encryptedData - Encrypted data object
   * @param {string} password - User's password for key derivation
   * @returns {string} Decrypted data
   */
  static decrypt(encryptedData, password) {
    try {
      const { encryptedData: data, iv, salt, authTag } = encryptedData;
      
      // Convert hex strings back to buffers
      const key = this.generateKey(password, Buffer.from(salt, 'hex'));
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
   * @returns {Object} Public and private key pair
   */
  static generateKeyPair() {
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
  static encryptWithPublicKey(data, publicKey) {
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
  static decryptWithPrivateKey(encryptedData, privateKey) {
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
  static hashData(data) {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }

  /**
   * Verify data integrity
   */
  static verifyHash(data, hash) {
    return this.hashData(data) === hash;
  }

  /**
   * Generate secure random bytes for various cryptographic needs
   */
  static generateRandomBytes(length) {
    const bytes = crypto.randomBytes(length);
    return bytes.toString('hex');
  }
}

module.exports = { ClientEncryptionService };