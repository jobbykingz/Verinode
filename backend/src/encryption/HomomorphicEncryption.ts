import { Injectable, Logger } from '@nestjs/common';
import * as SEAL from 'node-seal';
import { promises as fs } from 'fs';
import * as path from 'path';
import { EncryptionConfig } from '../config/encryption';

export interface EncryptionKeys {
  publicKey: string;
  secretKey: string;
  relinKeys?: string;
  galoisKeys?: string;
}

export interface EncryptedData {
  ciphertext: string;
  scale?: number;
  chainIndex?: number;
}

export interface HomomorphicResult {
  result: EncryptedData;
  computationTime: number;
  noiseBudget: number;
}

@Injectable()
export class HomomorphicEncryption {
  private readonly logger = new Logger(HomomorphicEncryption.name);
  private seal: typeof SEAL;
  private context: SEAL.Context;
  private encoder: SEAL.CKKSEncoder;
  private encryptor: SEAL.Encryptor;
  private decryptor: SEAL.Decryptor;
  private evaluator: SEAL.Evaluator;
  private keygen: SEAL.KeyGenerator;

  private publicKey: SEAL.PublicKey;
  private secretKey: SEAL.SecretKey;
  private relinKeys: SEAL.RelinKeys;
  private galoisKeys: SEAL.GaloisKeys;

  constructor(private config: EncryptionConfig) {}

  async onModuleInit() {
    await this.initializeSEAL();
    await this.initializeKeys();
  }

  private async initializeSEAL() {
    try {
      this.seal = await SEAL();

      // Create encryption parameters
      const schemeType = this.seal.SchemeType.CKKS;
      const securityLevel = this.seal.SecurityLevel.tc128;
      const polyModulusDegree = this.config.polyModulusDegree || 8192;

      const encParms = this.seal.EncryptionParameters(schemeType);
      encParms.setPolyModulusDegree(polyModulusDegree);
      encParms.setCoeffModulus(
        this.seal.CoeffModulus.Create(polyModulusDegree, [
          60, 40, 40, 40, 40, 40, 40, 60
        ])
      );

      // Create context
      this.context = this.seal.Context(encParms, true, securityLevel);

      // Create encoder
      this.encoder = this.seal.CKKSEncoder(this.context);

      this.logger.log('SEAL homomorphic encryption initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize SEAL:', error);
      throw error;
    }
  }

  private async initializeKeys() {
    try {
      // Try to load existing keys
      const keysPath = path.join(process.cwd(), 'keys');
      const publicKeyPath = path.join(keysPath, 'public.key');
      const secretKeyPath = path.join(keysPath, 'secret.key');
      const relinKeysPath = path.join(keysPath, 'relin.key');
      const galoisKeysPath = path.join(keysPath, 'galois.key');

      let keysExist = false;
      try {
        await fs.access(publicKeyPath);
        await fs.access(secretKeyPath);
        keysExist = true;
      } catch {
        keysExist = false;
      }

      if (keysExist && !this.config.forceKeyRegeneration) {
        // Load existing keys
        this.logger.log('Loading existing encryption keys');
        const publicKeyData = await fs.readFile(publicKeyPath);
        const secretKeyData = await fs.readFile(secretKeyPath);

        this.publicKey = this.seal.PublicKey();
        this.publicKey.load(this.context, publicKeyData);

        this.secretKey = this.seal.SecretKey();
        this.secretKey.load(this.context, secretKeyData);

        // Load relinearization keys if they exist
        try {
          const relinKeyData = await fs.readFile(relinKeysPath);
          this.relinKeys = this.seal.RelinKeys();
          this.relinKeys.load(this.context, relinKeyData);
        } catch {
          this.logger.warn('Relin keys not found, generating new ones');
        }

        // Load Galois keys if they exist
        try {
          const galoisKeyData = await fs.readFile(galoisKeysPath);
          this.galoisKeys = this.seal.GaloisKeys();
          this.galoisKeys.load(this.context, galoisKeyData);
        } catch {
          this.logger.warn('Galois keys not found, generating new ones');
        }
      } else {
        // Generate new keys
        this.logger.log('Generating new encryption keys');
        this.keygen = this.seal.KeyGenerator(this.context);

        this.publicKey = this.keygen.createPublicKey();
        this.secretKey = this.keygen.secretKey();

        this.relinKeys = this.keygen.createRelinKeys();
        this.galoisKeys = this.keygen.createGaloisKeys();
      }

      // Create encryptor, decryptor, and evaluator
      this.encryptor = this.seal.Encryptor(this.context, this.publicKey);
      this.decryptor = this.seal.Decryptor(this.context, this.secretKey);
      this.evaluator = this.seal.Evaluator(this.context);

      // Save keys if they were newly generated
      if (!keysExist || this.config.forceKeyRegeneration) {
        await this.saveKeys();
      }

      this.logger.log('Encryption keys initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize keys:', error);
      throw error;
    }
  }

  private async saveKeys() {
    try {
      const keysPath = path.join(process.cwd(), 'keys');
      await fs.mkdir(keysPath, { recursive: true });

      const publicKeyData = this.publicKey.save();
      const secretKeyData = this.secretKey.save();
      const relinKeyData = this.relinKeys.save();
      const galoisKeyData = this.galoisKeys.save();

      await fs.writeFile(path.join(keysPath, 'public.key'), Buffer.from(publicKeyData));
      await fs.writeFile(path.join(keysPath, 'secret.key'), Buffer.from(secretKeyData));
      await fs.writeFile(path.join(keysPath, 'relin.key'), Buffer.from(relinKeyData));
      await fs.writeFile(path.join(keysPath, 'galois.key'), Buffer.from(galoisKeyData));

      this.logger.log('Encryption keys saved successfully');
    } catch (error) {
      this.logger.error('Failed to save keys:', error);
      throw error;
    }
  }

  async encrypt(data: number[]): Promise<EncryptedData> {
    const startTime = Date.now();

    try {
      // Create plaintext
      const plaintext = this.seal.Plaintext();
      const scale = Math.pow(2, 40); // Scale for CKKS
      this.encoder.encode(data, scale, plaintext);

      // Encrypt
      const ciphertext = this.seal.Ciphertext();
      this.encryptor.encrypt(plaintext, ciphertext);

      const encryptedData: EncryptedData = {
        ciphertext: Buffer.from(ciphertext.save()).toString('base64'),
        scale,
      };

      const encryptionTime = Date.now() - startTime;
      this.logger.debug(`Data encrypted in ${encryptionTime}ms`);

      return encryptedData;
    } catch (error) {
      this.logger.error('Encryption failed:', error);
      throw error;
    }
  }

  async decrypt(encryptedData: EncryptedData): Promise<number[]> {
    const startTime = Date.now();

    try {
      // Load ciphertext
      const ciphertext = this.seal.Ciphertext();
      const ciphertextData = Buffer.from(encryptedData.ciphertext, 'base64');
      ciphertext.load(this.context, ciphertextData);

      // Decrypt
      const plaintext = this.seal.Plaintext();
      this.decryptor.decrypt(ciphertext, plaintext);

      // Decode
      const result = [];
      this.encoder.decode(plaintext, result);

      const decryptionTime = Date.now() - startTime;
      this.logger.debug(`Data decrypted in ${decryptionTime}ms`);

      return result;
    } catch (error) {
      this.logger.error('Decryption failed:', error);
      throw error;
    }
  }

  async add(ciphertext1: EncryptedData, ciphertext2: EncryptedData): Promise<HomomorphicResult> {
    const startTime = Date.now();

    try {
      const ct1 = this.loadCiphertext(ciphertext1);
      const ct2 = this.loadCiphertext(ciphertext2);

      const result = this.seal.Ciphertext();
      this.evaluator.add(ct1, ct2, result);

      const computationTime = Date.now() - startTime;
      const noiseBudget = this.decryptor.invariantNoiseBudget(result);

      return {
        result: {
          ciphertext: Buffer.from(result.save()).toString('base64'),
          scale: ciphertext1.scale,
        },
        computationTime,
        noiseBudget,
      };
    } catch (error) {
      this.logger.error('Homomorphic addition failed:', error);
      throw error;
    }
  }

  async multiply(ciphertext1: EncryptedData, ciphertext2: EncryptedData): Promise<HomomorphicResult> {
    const startTime = Date.now();

    try {
      const ct1 = this.loadCiphertext(ciphertext1);
      const ct2 = this.loadCiphertext(ciphertext2);

      const result = this.seal.Ciphertext();
      this.evaluator.multiply(ct1, ct2, result);

      // Relinearize to reduce noise
      if (this.relinKeys) {
        this.evaluator.relinearizeInplace(result, this.relinKeys);
      }

      // Rescale
      this.evaluator.rescaleToNextInplace(result);

      const computationTime = Date.now() - startTime;
      const noiseBudget = this.decryptor.invariantNoiseBudget(result);

      return {
        result: {
          ciphertext: Buffer.from(result.save()).toString('base64'),
          scale: ciphertext1.scale ? ciphertext1.scale / Math.pow(2, 40) : undefined,
        },
        computationTime,
        noiseBudget,
      };
    } catch (error) {
      this.logger.error('Homomorphic multiplication failed:', error);
      throw error;
    }
  }

  async rotate(ciphertext: EncryptedData, steps: number): Promise<HomomorphicResult> {
    const startTime = Date.now();

    try {
      const ct = this.loadCiphertext(ciphertext);

      const result = this.seal.Ciphertext();
      this.evaluator.rotateVector(ct, steps, this.galoisKeys, result);

      const computationTime = Date.now() - startTime;
      const noiseBudget = this.decryptor.invariantNoiseBudget(result);

      return {
        result: {
          ciphertext: Buffer.from(result.save()).toString('base64'),
          scale: ciphertext.scale,
        },
        computationTime,
        noiseBudget,
      };
    } catch (error) {
      this.logger.error('Homomorphic rotation failed:', error);
      throw error;
    }
  }

  private loadCiphertext(encryptedData: EncryptedData): SEAL.Ciphertext {
    const ciphertext = this.seal.Ciphertext();
    const ciphertextData = Buffer.from(encryptedData.ciphertext, 'base64');
    ciphertext.load(this.context, ciphertextData);
    return ciphertext;
  }

  getKeys(): EncryptionKeys {
    return {
      publicKey: Buffer.from(this.publicKey.save()).toString('base64'),
      secretKey: Buffer.from(this.secretKey.save()).toString('base64'),
      relinKeys: this.relinKeys ? Buffer.from(this.relinKeys.save()).toString('base64') : undefined,
      galoisKeys: this.galoisKeys ? Buffer.from(this.galoisKeys.save()).toString('base64') : undefined,
    };
  }

  async rotateKeys(): Promise<void> {
    this.logger.log('Rotating encryption keys');
    this.config.forceKeyRegeneration = true;
    await this.initializeKeys();
    this.logger.log('Encryption keys rotated successfully');
  }

  getContextInfo(): any {
    return {
      scheme: 'CKKS',
      polyModulusDegree: this.context.getContextData().parms().polyModulusDegree(),
      coeffModulusSize: this.context.getContextData().parms().coeffModulus().length,
      securityLevel: this.context.getContextData().qualifiers().securityLevel,
    };
  }

  async benchmark(operation: string, iterations: number = 100): Promise<any> {
    const results = {
      operation,
      iterations,
      totalTime: 0,
      averageTime: 0,
      minTime: Infinity,
      maxTime: 0,
    };

    // Generate test data
    const testData1 = Array.from({ length: 10 }, () => Math.random());
    const testData2 = Array.from({ length: 10 }, () => Math.random());

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();

      try {
        switch (operation) {
          case 'encrypt':
            await this.encrypt(testData1);
            break;
          case 'decrypt':
            const encrypted = await this.encrypt(testData1);
            await this.decrypt(encrypted);
            break;
          case 'add':
            const enc1 = await this.encrypt(testData1);
            const enc2 = await this.encrypt(testData2);
            await this.add(enc1, enc2);
            break;
          case 'multiply':
            const enc3 = await this.encrypt(testData1);
            const enc4 = await this.encrypt(testData2);
            await this.multiply(enc3, enc4);
            break;
        }

        const time = Date.now() - startTime;
        results.totalTime += time;
        results.minTime = Math.min(results.minTime, time);
        results.maxTime = Math.max(results.maxTime, time);
      } catch (error) {
        this.logger.error(`Benchmark iteration ${i} failed:`, error);
      }
    }

    results.averageTime = results.totalTime / iterations;

    this.logger.log(`Benchmark results for ${operation}:`, results);
    return results;
  }
}