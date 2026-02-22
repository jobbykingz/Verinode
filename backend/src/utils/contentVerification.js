const crypto = require('crypto');
const { CID } = require('cids');
const { fromString: uint8arrayFromString, toString: uint8arrayToString } = require('uint8arrays');

class ContentVerification {
  constructor() {
    this.algorithms = {
      SHA256: 'sha256',
      SHA512: 'sha512',
      MD5: 'md5'
    };
    
    this.config = {
      defaultAlgorithm: process.env.VERIFICATION_ALGORITHM || 'SHA256',
      timeout: parseInt(process.env.VERIFICATION_TIMEOUT) || 30000,
      maxRetries: parseInt(process.env.VERIFICATION_MAX_RETRIES) || 3,
      retryDelay: parseInt(process.env.VERIFICATION_RETRY_DELAY) || 1000,
      enableDeepVerification: process.env.VERIFICATION_DEEP === 'true',
      enableContentAnalysis: process.env.VERIFICATION_ANALYSIS === 'true'
    };
  }

  /**
   * Calculate hash of content using specified algorithm
   */
  calculateHash(content, algorithm = this.config.defaultAlgorithm) {
    try {
      const hash = crypto.createHash(this.algorithms[algorithm]);
      
      if (typeof content === 'string') {
        hash.update(content, 'utf8');
      } else if (Buffer.isBuffer(content)) {
        hash.update(content);
      } else if (content instanceof Uint8Array) {
        hash.update(Buffer.from(content));
      } else {
        // Convert object to JSON string
        hash.update(JSON.stringify(content), 'utf8');
      }
      
      return hash.digest('hex');
    } catch (error) {
      throw new Error(`Hash calculation failed: ${error.message}`);
    }
  }

  /**
   * Verify content integrity against expected hash
   */
  async verifyContentIntegrity(content, expectedHash, algorithm = this.config.defaultAlgorithm) {
    try {
      const actualHash = this.calculateHash(content, algorithm);
      return {
        verified: actualHash === expectedHash,
        expectedHash,
        actualHash,
        algorithm,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Content integrity verification failed: ${error.message}`);
    }
  }

  /**
   * Verify CID format and validity
   */
  verifyCID(cid) {
    try {
      const parsedCID = new CID(cid);
      return {
        valid: true,
        cid: cid,
        version: parsedCID.version,
        codec: parsedCID.codec,
        multihash: parsedCID.multihash,
        base32: parsedCID.toBase32(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        valid: false,
        cid: cid,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Deep verification of IPFS content
   */
  async verifyIPFSContent(ipfsService, cid, expectedHash = null, options = {}) {
    const {
      timeout = this.config.timeout,
      maxRetries = this.config.maxRetries,
      retryDelay = this.config.retryDelay,
      algorithm = this.config.defaultAlgorithm
    } = options;

    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Verify CID format first
        const cidVerification = this.verifyCID(cid);
        if (!cidVerification.valid) {
          throw new Error(`Invalid CID format: ${cidVerification.error}`);
        }

        // Retrieve content from IPFS
        const content = await this.withTimeout(
          ipfsService.getContent(cid),
          timeout
        );

        // Calculate content hash
        const contentHash = this.calculateHash(content, algorithm);

        // Verify against expected hash if provided
        let hashMatch = true;
        if (expectedHash) {
          hashMatch = contentHash === expectedHash;
        }

        // Perform deep content analysis if enabled
        let contentAnalysis = null;
        if (this.config.enableContentAnalysis) {
          contentAnalysis = await this.analyzeContent(content);
        }

        return {
          verified: true,
          cid,
          contentHash,
          expectedHash,
          hashMatch,
          algorithm,
          contentSize: content.length,
          contentType: this.detectContentType(content),
          contentAnalysis,
          cidVerification,
          attempt,
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        lastError = error;
        console.log(`Verification attempt ${attempt} failed for ${cid}: ${error.message}`);
        
        if (attempt < maxRetries) {
          await this.delay(retryDelay * attempt); // Exponential backoff
        }
      }
    }

    throw new Error(`IPFS content verification failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Batch verification of multiple CIDs
   */
  async verifyBatch(ipfsService, cidList, options = {}) {
    const {
      concurrency = parseInt(process.env.VERIFICATION_BATCH_CONCURRENCY) || 5,
      timeout = this.config.timeout,
      progressCallback = null
    } = options;

    const results = [];
    const errors = [];
    let completed = 0;

    // Process in batches to control concurrency
    for (let i = 0; i < cidList.length; i += concurrency) {
      const batch = cidList.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (item) => {
        try {
          const result = await this.verifyIPFSContent(
            ipfsService,
            item.cid,
            item.expectedHash,
            { ...options, timeout }
          );
          
          completed++;
          if (progressCallback) {
            progressCallback(completed, cidList.length, result);
          }
          
          return result;
        } catch (error) {
          errors.push({
            cid: item.cid,
            error: error.message,
            timestamp: new Date().toISOString()
          });
          
          completed++;
          if (progressCallback) {
            progressCallback(completed, cidList.length, { error: error.message, cid: item.cid });
          }
          
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(r => r !== null));
    }

    return {
      results,
      errors,
      total: cidList.length,
      verified: results.length,
      failed: errors.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Analyze content for additional verification
   */
  async analyzeContent(content) {
    try {
      const analysis = {
        size: content.length,
        entropy: this.calculateEntropy(content),
        isText: this.isTextContent(content),
        isJSON: this.isJSONContent(content),
        patterns: this.detectPatterns(content),
        metadata: {}
      };

      // Additional analysis for text content
      if (analysis.isText) {
        const textContent = uint8arrayToString(content);
        analysis.metadata.lineCount = textContent.split('\n').length;
        analysis.metadata.wordCount = textContent.split(/\s+/).length;
        analysis.metadata.charCount = textContent.length;
      }

      // Additional analysis for JSON content
      if (analysis.isJSON) {
        try {
          const jsonContent = JSON.parse(uint8arrayToString(content));
          analysis.metadata.jsonKeys = Object.keys(jsonContent).length;
          analysis.metadata.jsonDepth = this.getJSONDepth(jsonContent);
        } catch (e) {
          analysis.isJSON = false;
        }
      }

      return analysis;
    } catch (error) {
      throw new Error(`Content analysis failed: ${error.message}`);
    }
  }

  /**
   * Calculate entropy of content for randomness detection
   */
  calculateEntropy(content) {
    const frequency = {};
    let entropy = 0;

    // Count frequency of each byte
    for (let i = 0; i < content.length; i++) {
      const byte = content[i];
      frequency[byte] = (frequency[byte] || 0) + 1;
    }

    // Calculate Shannon entropy
    for (const byte in frequency) {
      const probability = frequency[byte] / content.length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  /**
   * Detect if content is text
   */
  isTextContent(content) {
    try {
      const text = uint8arrayToString(content);
      // Check for null bytes and high percentage of printable characters
      const nullBytes = (text.match(/\0/g) || []).length;
      const printableChars = (text.match(/[\x20-\x7E]/g) || []).length;
      
      return nullBytes === 0 && (printableChars / text.length) > 0.7;
    } catch (e) {
      return false;
    }
  }

  /**
   * Detect if content is valid JSON
   */
  isJSONContent(content) {
    try {
      JSON.parse(uint8arrayToString(content));
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Detect common patterns in content
   */
  detectPatterns(content) {
    const patterns = {
      hasURLs: false,
      hasEmails: false,
      hasDates: false,
      hasPhoneNumbers: false,
      hasHashes: false
    };

    try {
      const text = uint8arrayToString(content);
      
      patterns.hasURLs = /https?:\/\/[^\s]+/.test(text);
      patterns.hasEmails = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(text);
      patterns.hasDates = /\d{4}-\d{2}-\d{2}/.test(text);
      patterns.hasPhoneNumbers = /\b\d{3}-\d{3}-\d{4}\b/.test(text);
      patterns.hasHashes = /\b[a-fA-F0-9]{32,}\b/.test(text);
    } catch (e) {
      // Ignore errors in pattern detection
    }

    return patterns;
  }

  /**
   * Get depth of JSON object
   */
  getJSONDepth(obj, currentDepth = 0) {
    if (typeof obj !== 'object' || obj === null) {
      return currentDepth;
    }
    
    let maxDepth = currentDepth;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const depth = this.getJSONDepth(obj[key], currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    }
    
    return maxDepth;
  }

  /**
   * Detect content type from content
   */
  detectContentType(content) {
    // Check for common file signatures
    const signatures = {
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/gif': [0x47, 0x49, 0x46, 0x38],
      'application/pdf': [0x25, 0x50, 0x44, 0x46],
      'application/zip': [0x50, 0x4B, 0x03, 0x04]
    };

    for (const [mimeType, signature] of Object.entries(signatures)) {
      if (content.length >= signature.length) {
        let matches = true;
        for (let i = 0; i < signature.length; i++) {
          if (content[i] !== signature[i]) {
            matches = false;
            break;
          }
        }
        if (matches) {
          return mimeType;
        }
      }
    }

    // Fallback to text detection
    if (this.isTextContent(content)) {
      if (this.isJSONContent(content)) {
        return 'application/json';
      }
      return 'text/plain';
    }

    return 'application/octet-stream';
  }

  /**
   * Verify content signature if available
   */
  async verifySignature(content, signature, publicKey) {
    try {
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(content);
      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      throw new Error(`Signature verification failed: ${error.message}`);
    }
  }

  /**
   * Generate verification report
   */
  generateVerificationReport(verificationResults) {
    const report = {
      summary: {
        total: verificationResults.length,
        verified: verificationResults.filter(r => r.verified).length,
        failed: verificationResults.filter(r => !r.verified).length,
        timestamp: new Date().toISOString()
      },
      details: verificationResults,
      statistics: {
        averageContentSize: this.calculateAverage(verificationResults.map(r => r.contentSize)),
        commonContentTypes: this.getMostCommon(verificationResults.map(r => r.contentType)),
        verificationTime: this.calculateAverage(verificationResults.map(r => r.verificationTime || 0))
      }
    };

    return report;
  }

  /**
   * Utility functions
   */
  calculateAverage(numbers) {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  getMostCommon(items) {
    const frequency = {};
    items.forEach(item => {
      frequency[item] = (frequency[item] || 0) + 1;
    });
    
    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([item, count]) => ({ item, count }));
  }

  async withTimeout(promise, timeout) {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), timeout)
      )
    ]);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate verification configuration
   */
  validateConfig() {
    const errors = [];

    if (!this.algorithms[this.config.defaultAlgorithm]) {
      errors.push(`Invalid default algorithm: ${this.config.defaultAlgorithm}`);
    }

    if (this.config.timeout < 1000) {
      errors.push('Timeout must be at least 1000ms');
    }

    if (this.config.maxRetries < 0) {
      errors.push('Max retries must be non-negative');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }

    return true;
  }
}

module.exports = { ContentVerification };
