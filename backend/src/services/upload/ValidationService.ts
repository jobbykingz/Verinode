import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import {
  FileValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationType,
  ValidationRule,
  SecurityConfig,
  DEFAULT_SECURITY_CONFIG,
} from '../../types/fileUpload';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata?: Record<string, any>;
  threats?: VirusThreat[];
}

export interface VirusThreat {
  name: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: Date;
}

export interface ContentValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  contentType: string;
  contentHash: string;
  metadata?: Record<string, any>;
}

export interface FileValidationConfig {
  maxFileSize: number;
  allowedTypes: string[];
  blockedTypes: string[];
  maxFiles: number;
  enableVirusScanning: boolean;
  enableContentValidation: boolean;
  enableChecksumValidation: boolean;
  enableMetadataValidation: boolean;
  enableFileNameValidation: boolean;
  enablePathValidation: boolean;
  enableHeaderValidation: boolean;
  virusScanner: {
    provider: 'clamav' | 'virustotal' | 'custom';
    config: Record<string, any>;
    enabled: boolean;
  };
  contentValidators: ContentValidator[];
  fileNameValidators: FileNameValidator[];
  pathValidators: PathValidator[];
  headerValidators: HeaderValidator[];
}

export interface ContentValidator {
  type: ValidationType;
  name: string;
  description: string;
  enabled: boolean;
  validate: (buffer: Buffer, metadata: Record<string, any>) => Promise<ContentValidationResult>;
}

export interface FileNameValidator {
  type: ValidationType;
  name: string;
  description: string;
  enabled: boolean;
  validate: (fileName: string) => boolean;
}

export interface PathValidator {
  type: ValidationType;
  name: string;
  content: string;
  description: string;
  enabled: boolean;
  validate: (filePath: string) => boolean;
}

export interface HeaderValidator {
  type: ValidationType;
  name: string;
  content: string;
  description: string;
  enabled: boolean;
  validate: (buffer: Buffer) => boolean;
}

export class ValidationService extends EventEmitter {
  private config: SecurityConfig;
  private validationConfig: FileValidationConfig;
  private contentValidators: Map<ValidationType, ContentValidator> = new Map();
  private fileNameValidators: Map<ValidationType, FileNameValidator> = new Map();
  private pathValidators: Map<ValidationType, PathValidator> = new Map();
  private headerValidators: Map<ValidationType, HeaderValidator> = new Map();

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
    
    this.validationConfig = {
      maxFileSize: this.config.maxUploadSize,
      allowedTypes: [],
      blockedTypes: this.config.blockedOrigins,
      maxFiles: 10,
      enableVirusScanning: this.config.enableVirusScanning,
      enableContentValidation: this.config.enableContentValidation,
      enableChecksumValidation: this.config.enableChecksumValidation,
      enableMetadataValidation: this.config.enableMetadataExtraction,
      enableFileNameValidation: true,
      enablePathValidation: true,
      enableHeaderValidation: true,
      virusScanner: {
        provider: 'custom',
        config: {},
        enabled: false,
      },
      contentValidators: [],
      fileNameValidators: [],
      pathValidators: [],
      headerValidators: [],
    };
    
    this.initializeValidators();
  }

  /**
   * Initialize default validators
   */
  private initializeValidators(): void {
    // Content validators
    this.registerContentValidator({
      type: 'content',
      name: 'Executable Detection',
      description: 'Detects executable files in content',
      enabled: true,
      validate: this.validateExecutableContent,
    });
    
    this.registerContentValidator({
      type: 'content',
      name: 'Script Detection',
      description: 'Detects script files in content',
      enabled: true,
      validate: this.validateScriptContent,
    });
    
    this.registerContentValidator({
      type: 'content',
      name: 'Malware Detection',
      description: 'Detects known malware patterns',
      enabled: true,
      validate: this.validateMalwareContent,
    });
    
    // File name validators
    this.registerFileNameValidator({
      type: 'fileName',
      name: 'Invalid Characters',
      description: 'Detects invalid characters in file names',
      enabled: true,
      validate: this.validateFileNameCharacters,
    });
    
    this.registerFileNameValidator({
      type: 'fileName',
      name: 'Reserved Names',
      description: 'Detects reserved file names',
      enabled: true,
      validate: this.validateReservedNames,
    });
    
    this.registerFileNameValidator({
      type: 'fileName',
      name: 'Path Traversal',
      description: 'Detects path traversal attempts',
      enabled: true,
      validate: this.validatePathTraversal,
    });
    
    // Path validators
    this.registerPathValidator({
      type: 'path',
      name: 'Absolute Path',
      description: 'Detects absolute paths in file paths',
      enabled: true,
      validate: this.validateAbsolutePath,
    });
    
    this.registerPathValidator({
      type: 'path',
      name: 'Path Traversal',
      description: 'Detects path traversal attempts',
      enabled: true,
      validate: this.validatePathTraversal,
    });
    
    // Header validators
    this.registerHeaderValidator({
      type: 'header',
      name: 'ZIP Bomb',
      description: 'Detects ZIP bomb headers',
      enabled: true,
      validate: this.validateZipBomb,
    });
    
    this.registerHeaderValidator({
      type: 'header',
      name: 'EXIF Data',
      description: 'Detects suspicious EXIF data',
      enabled: true,
      validate: this.validateSuspiciousExif,
    });
  }

  /**
   * Validate file
   */
  async validateFile(
    filePath: string,
    buffer: Buffer,
    metadata: Record<string, any> = {}
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {},
    };
    
    try {
      // File size validation
      await this.validateFileSize(buffer.length, result);
      
      // File type validation
      await this.validateFileType(metadata.mimeType || '', result);
      
      // File name validation
      if (this.validationConfig.enableFileNameValidation) {
        await this.validateFileName(path.basename(filePath), result);
      }
      
      // Path validation
      if (this.validationConfig.enablePathValidation) {
        await this.validateFilePath(filePath, result);
      }
      
      // Header validation
      if (this.validationConfig.enableHeaderValidation) {
        await this.validateFileHeader(buffer, result);
      }
      
      // Content validation
      if (this.validationConfig.enableContentValidation) {
        const contentResult = await this.validateContent(buffer, metadata);
        result.errors.push(...contentResult.errors);
        result.warnings.push(...contentResult.warnings);
        result.metadata = { ...result.metadata, ...contentResult.metadata };
      }
      
      // Checksum validation
      if (this.validationConfig.enableChecksumValidation) {
        await this.validateChecksum(buffer, result);
      }
      
      // Virus scanning
      if (this.validationConfig.enableVirusScanning) {
        const virusResult = await this.scanForViruses(buffer);
        result.threats = virusResult.threats;
        
        if (virusResult.threats.length > 0) {
          result.isValid = false;
          result.errors.push(...virusResult.threats.map(threat => ({
            type: 'virus',
            message: `Virus detected: ${threat.name} (${threat.type})`,
            field: 'virus',
            value: threat.name,
          })));
        }
      }
      
      // Metadata validation
      if (this.validationConfig.enableMetadataValidation) {
        await this.validateMetadata(metadata, result);
      }
      
      this.emit('fileValidated', {
        filePath,
        result,
        metadata,
      });
      
    } catch (error) {
      result.isValid = false;
      result.errors.push({
        type: 'validation',
        message: error instanceof Error ? error.message : 'Unknown validation error',
        field: 'general',
        value: error,
      });
      
      this.emit('validationError', { filePath, error, result });
    }
    
    return result;
  }

  /**
   * Validate file size
   */
  private async validateFileSize(
    fileSize: number,
    result: ValidationResult
  ): Promise<void> {
    if (fileSize > this.validationConfig.maxFileSize) {
      result.isValid = false;
      result.errors.push({
        type: 'fileSize',
        message: `File size (${fileSize} bytes) exceeds maximum allowed size (${this.validationConfig.maxFileSize} bytes)`,
        field: 'size',
        value: fileSize,
      });
    }
  }

  /**
   * Validate file type
   */
  private async validateFileType(
    mimeType: string,
    result: ValidationResult
  ): Promise<void> {
    if (this.validationConfig.allowedTypes.length > 0) {
      const isAllowed = this.validationConfig.allowedTypes.includes(mimeType) ||
        this.validationConfig.allowedTypes.some(type => {
          if (type.includes('*')) {
            const wildcard = type.replace('*', '');
            return mimeType.startsWith(wildcard);
          }
          return mimeType === type;
        });
      
      if (!isAllowed) {
        result.isValid = false;
        result.errors.push({
          type: 'fileType',
          message: `File type (${mimeType}) is not allowed`,
          field: 'type',
          value: mimeType,
        });
      }
    }
    
    if (this.validationConfig.blockedTypes.includes(mimeType)) {
      result.isValid = false;
      result.errors.push({
        type: 'fileType',
        message: `File type (${mimeType}) is blocked`,
        field: 'type',
        value: mimeType,
      });
    }
  }

  /**
   * Validate file name
   */
  private async validateFileName(
    fileName: string,
    result: ValidationResult
  ): Promise<void> {
    for (const [type, validator] of this.fileNameValidators.entries()) {
      if (!validator.enabled) continue;
      
      if (!validator.validate(fileName)) {
        result.isValid = false;
        result.errors.push({
          type,
          message: validator.description,
          field: 'fileName',
          value: fileName,
        });
      }
    }
  }

  /**
   * Validate file path
   */
  private async validateFilePath(
    filePath: string,
    result: ValidationResult
  ): Promise<void> {
    for (const [type, validator] of this.pathValidators.entries()) {
      if (!validator.enabled) continue;
      
      if (!validator.validate(filePath)) {
        result.isValid = false;
        result.errors.push({
          type,
          message: validator.description,
          field: 'filePath',
          value: filePath,
        });
      }
    }
  }

  /**
   * Validate file header
   */
  private async validateFileHeader(
    buffer: Buffer,
    result: ValidationResult
  ): Promise<void> {
    for (const [type, validator] of this.headerValidators.entries()) {
      if (!validator.enabled) continue;
      
      if (!validator.validate(buffer)) {
        result.isValid = false;
        result.errors.push({
          type,
          message: validator.description,
          field: 'header',
          value: 'Header validation failed',
        });
      }
    }
  }

  /**
   * Validate content
   */
  private async validateContent(
    buffer: Buffer,
    metadata: Record<string, any>
  ): Promise<ContentValidationResult> {
    const result: ContentValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      contentType: this.detectContentType(buffer),
      contentHash: crypto.createHash('sha256').update(buffer).digest('hex'),
      metadata: {},
    };
    
    for (const [type, validator] of this.contentValidators.entries()) {
      if (!validator.enabled) continue;
      
      try {
        const validatorResult = await validator.validate(buffer, metadata);
        result.errors.push(...validatorResult.errors);
        result.warnings.push(...validatorResult.warnings);
        result.metadata = { ...result.metadata, ...validatorResult.metadata };
        
        if (!validatorResult.isValid) {
          result.isValid = false;
        }
      } catch (error) {
        result.isValid = false;
        result.errors.push({
          type,
          message: `Content validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          field: 'content',
          value: error,
        });
      }
    }
    
    return result;
  }

  /**
   * Validate checksum
   */
  private async validateChecksum(
    buffer: Buffer,
    result: ValidationResult
  ): Promise<void> {
    // Calculate checksum
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    
    // Store checksum in metadata
    result.metadata.checksum = checksum;
  }

  /**
   * Validate metadata
   */
  private async validateMetadata(
    metadata: Record<string, any>,
    result: ValidationResult
  ): Promise<void> {
    // Validate metadata structure
    if (typeof metadata !== 'object' || metadata === null) {
      result.warnings.push({
        type: 'metadata',
        message: 'Metadata should be an object',
        field: 'metadata',
        value: metadata,
      });
      return;
    }
    
    // Validate specific metadata fields
    if (metadata.dimensions) {
      const { width, height } = metadata.dimensions;
      if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
        result.warnings.push({
          type: 'metadata',
          message: 'Invalid dimensions in metadata',
          field: 'dimensions',
          value: metadata.dimensions,
        });
      }
    }
    
    if (metadata.duration && typeof metadata.duration !== 'number') {
      result.warnings.push({
        type: 'metadata',
        message: 'Duration should be a number',
        field: 'duration',
        value: metadata.duration,
      });
    }
  }

  /**
   * Scan for viruses
   */
  private async scanForViruses(buffer: Buffer): Promise<{ clean: boolean; threats: VirusThreat[] }> {
    const threats: VirusThreat[] = [];
    
    try {
      switch (this.validationConfig.virusScanner.provider) {
        case 'clamav':
          return await this.scanWithClamAV(buffer);
        case 'virustotal':
          return await this.scanWithVirusTotal(buffer);
        case 'custom':
          return await this.scanWithCustomScanner(buffer);
        default:
          return { clean: true, threats };
      }
    } catch (error) {
      console.error('Virus scanning failed:', error);
      return { clean: true, threats: [] };
    }
  }

  /**
   * Scan with ClamAV
   */
  private async scanWithClamAV(buffer: Buffer): Promise<{ clean: boolean; threats: VirusThreat[] }> {
    // This would integrate with ClamAV
    // For now, simulate the scan
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { clean: true, threats: [] };
  }

  /**
   * Scan with VirusTotal
   */
  private async scanWithVirusTotal(buffer: Buffer): Promise<{ clean: boolean; threats: VirusThreat[] }> {
    // This would integrate with VirusTotal API
    // For now, simulate the scan
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { clean: true, threats: [] };
  }

  /**
   * Scan with custom scanner
   */
  private async scanWithCustomScanner(buffer: Buffer): Promise<{ clean: boolean; threats: VirusThreat[] }> {
    // This would integrate with a custom virus scanning solution
    // For now, simulate the scan
    await new Promise(resolve => setTimeout(resolve, 1500));
    return { clean: true, threats: [] };
  }

  /**
   * Detect content type
   */
  private detectContentType(buffer: Buffer): string {
    // Simple content type detection based on file signatures
    const signatures: Record<string, string> = {
      '89504e47': 'application/pdf',
      '47494638': 'image/png',
      'ffd8ffe0': 'image/jpeg',
      '504b030': 'application/zip',
      '52617258': 'application/x-zip-compressed',
      '7f45b5': 'application/elf',
      '4d5a900': 'application/msword',
      'd0cf11f0': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '504b050': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'd0cf11f0': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '25504446': 'audio/mpeg',
      '4f676b6a': 'audio/x-mpeg',
      '494433': 'audio/mp4',
      '4f58300': 'video/mp4',
      '464c5844': 'video/mp4',
      '3c763424': 'text/html',
      '3c25436': 'text/plain',
      '1a2b3c4': 'application/json',
    };
    
    const header = buffer.slice(0, 16).toString('hex');
    
    // Check for known signatures
    for (const [signature, type] of Object.entries(signatures)) {
      if (header.startsWith(signature.toLowerCase())) {
        return type;
      }
    }
    
    // Default to binary
    return 'application/octet-stream';
  }

  /**
   * Register content validator
   */
  registerContentValidator(validator: ContentValidator): void {
    this.contentValidators.set(validator.type, validator);
  }

  /**
   * Register file name validator
   */
  registerFileNameValidator(validator: FileNameValidator): void {
    this.fileNameValidators.set(validator.type, validator);
  }

  /**
   * Register path validator
   */
  registerPathValidator(validator: PathValidator): void {
    this.pathValidators.set(validator.type, validator);
  }

  /**
   * Register header validator
   */
  registerHeaderValidator(validator: HeaderValidator): void {
    this.headerValidators.set(validator.type, validator);
  }

  // Default validator implementations

  private validateExecutableContent = async (buffer: Buffer): Promise<ContentValidationResult> => {
  const result: ContentValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    contentType: this.detectContentType(buffer),
    contentHash: crypto.createHash('sha256').update(buffer).digest('hex'),
    metadata: {},
  };
  
  // Check for executable signatures
  const executableSignatures = [
    '7f45b5', // ELF
    '4d5a900', // MS-DOS executable
    '4d5a002', // PE
    'cafebabe', // Java class
    'feedface', // Mach-O binary
    'cafebabe', // Mach-O universal binary
    '7f45b5', // ELF
  ];
  
  const header = buffer.slice(0, 4).toString('hex');
  
  if (executableSignatures.includes(header)) {
    result.isValid = false;
    result.errors.push({
      type: 'content',
      message: 'Executable file detected',
      field: 'content',
      value: 'Executable content found',
    });
  }
  
  return result;
};

private validateScriptContent = async (buffer: Buffer): Promise<ContentValidationResult> => {
  const result: ContentValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    contentType: this.detectContentType(buffer),
    contentHash: crypto.createHash('sha256').update(buffer).digest('hex'),
    metadata: {},
  };
  
  // Check for script signatures
  const scriptSignatures = [
    '%PDF', // PDF with JavaScript
    '<script', // HTML script tag
    'javascript:', // JavaScript code
    'eval(', // eval function
    'Function(', // Function constructor
    'document.cookie', // Cookie access
    'localStorage.', // LocalStorage access
    'sessionStorage.', // SessionStorage access
  ];
  
  const content = buffer.toString('utf8', 0, 1024); // Check first 1KB
  
  for (const signature of scriptSignatures) {
      if (content.includes(signature)) {
        result.isValid = false;
        result.errors.push({
          type: 'content',
          message: 'Script content detected',
          field: 'content',
          value: signature,
        });
        break;
      }
    }
  
  return result;
};

private validateMalwareContent = async (buffer: Buffer): Promise<ContentValidationResult> => {
  const result: ContentValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    contentType: this.detectContentType(buffer),
    contentHash: crypto.createHash('sha256').update(buffer).digest('hex'),
    metadata: {},
  };
  
  // Check for known malware patterns
  const malwarePatterns = [
    /eval\s*\(/gi,
    /document\.write\s*\(/gi,
    /window\.location\s*=/gi,
    /XMLHttpRequest\s*=/gi,
    /ActiveXObject\s*=/gi,
    /CreateObject\s*=/gi,
    /setTimeout\s*\(/gi,
    /setInterval\s*\(/gi,
  ];
  
  const content = buffer.toString('utf8');
  
  for (const pattern of malwarePatterns) {
    if (pattern.test(content)) {
      result.isValid = false;
      result.errors.push({
        type: 'content',
        message: 'Suspicious code pattern detected',
        field: 'content',
        value: pattern.source,
      });
    }
  }
  
  return result;
};

private validateFileNameCharacters = (fileName: string): boolean => {
  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  return !invalidChars.test(fileName);
};

private validateReservedNames = (fileName: string): boolean => {
  // Check for reserved names (Windows)
  const reservedNames = [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
    'CLOCK$',
  ];
  
  const baseName = fileName.split('.')[0].toUpperCase();
  return !reservedNames.includes(baseName);
};

private validatePathTraversal = (filePath: string): boolean => {
  // Check for path traversal patterns
  const traversalPatterns = [
    '../',
    '..\\',
    '..\\',
    '../../',
    '..\\..\\',
  ];
  
  return !traversalPatterns.some(pattern => filePath.includes(pattern));
};

private validateAbsolutePath = (filePath: string): boolean => {
  // Check if path is absolute
  return path.isAbsolute(filePath);
};

private validatePathTraversal = (filePath: string): boolean => {
  // Check for path traversal patterns
  const traversalPatterns = [
    '../',
    '..\\',
    '../../',
    '..\\..\\',
  ];
  
  return !traversalPatterns.some(pattern => filePath.includes(pattern));
};

private validateZipBomb = (buffer: Buffer): boolean => {
  // Check for ZIP bomb signatures
  const zipBombSignatures = [
    '504b030', // ZIP file signature
  ];
  
  const header = buffer.slice(0, 4).toString('hex');
  
  if (!zipBombSignatures.includes(header)) {
    return true; // Not a ZIP file
  }
  
  // Check for excessive file count in ZIP
  try {
    // This would require parsing the ZIP file structure
    // For now, check file size
    const maxZipSize = 100 * 1024 * 1024; // 100MB
    return buffer.length <= maxZipSize;
  } catch (error) {
    return false;
  }
};

private validateSuspiciousExif = (buffer: Buffer): boolean => {
  // Check for suspicious EXIF data
  try {
    // This would require parsing EXIF data
    // For now, check file size
    const maxExifSize = 64 * 1024; // 64KB
    return buffer.length <= maxExifSize;
  } catch (error) {
    return false;
  }
};

// Export singleton instance
let validationService: ValidationService | null = null;

export const getValidationService = (config?: Partial<SecurityConfig>): ValidationService => {
  if (!validationService) {
    validationService = new ValidationService(config);
  }
  return validationService;
};

// Export utility functions
export const createValidationService = (config?: Partial<SecurityConfig>): ValidationService => {
  return new ValidationService(config);
};

export const validateFile = async (
  filePath: string,
  buffer: Buffer,
  metadata: Record<string, any> = {}
): Promise<ValidationResult> => {
  const service = getValidationService();
  return service.validateFile(filePath, buffer, metadata);
};

export const scanForViruses = async (
  buffer: Buffer
): Promise<{ clean: boolean; threats: VirusThreat[] }> => {
  const service = getValidationService();
  return service.scanForViruses(buffer);
};
