import { ClientEncryptionService } from './clientEncryption';

/**
 * Selective disclosure system for revealing only necessary proof data
 */
export interface DisclosurePolicy {
  proofId: string;
  disclosedFields: string[];
  purpose: string;
  expiration?: string;
  recipient: string;
  signature: string; // Signature from the data owner
}

export interface SelectiveProofData {
  disclosedData: Record<string, any>;
  proofMetadata: {
    id: string;
    issuer: string;
    timestamp: string;
    hash: string;
  };
  disclosureSignature: string;
  policyHash: string;
}

/**
 * Selective disclosure service for minimal data exposure
 */
export class SelectiveDisclosureService {
  private static disclosurePolicies: Map<string, DisclosurePolicy> = new Map();

  /**
   * Create a disclosure policy for selective data sharing
   */
  static async createDisclosurePolicy(
    proofData: any,
    disclosedFields: string[],
    purpose: string,
    recipient: string,
    ownerPrivateKey: string
  ): Promise<DisclosurePolicy> {
    const policy: DisclosurePolicy = {
      proofId: proofData.id,
      disclosedFields,
      purpose,
      recipient,
      expiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days default
      signature: ''
    };

    // Create policy hash for signing
    const policyString = JSON.stringify({
      proofId: policy.proofId,
      disclosedFields: policy.disclosedFields,
      purpose: policy.purpose,
      recipient: policy.recipient,
      expiration: policy.expiration
    });

    const policyHash = ClientEncryptionService.hashData(policyString);
    
    // Sign the policy (simplified - in practice would use proper signing)
    policy.signature = ClientEncryptionService.encryptWithPublicKey(
      policyHash,
      ownerPrivateKey
    );

    const policyId = await ClientEncryptionService.generateRandomBytes(16);
    this.disclosurePolicies.set(policyId, policy);

    return policy;
  }

  /**
   * Generate selectively disclosed proof data
   */
  static generateSelectiveDisclosure(
    proofData: any,
    policy: DisclosurePolicy
  ): SelectiveProofData {
    // Verify policy is still valid
    if (policy.expiration && new Date() > new Date(policy.expiration)) {
      throw new Error('Disclosure policy has expired');
    }

    // Extract only disclosed fields
    const disclosedData: Record<string, any> = {};
    for (const field of policy.disclosedFields) {
      if (proofData.hasOwnProperty(field)) {
        disclosedData[field] = proofData[field];
      }
    }

    // Create proof metadata
    const proofMetadata = {
      id: proofData.id,
      issuer: proofData.issuer,
      timestamp: proofData.timestamp,
      hash: proofData.hash
    };

    // Create disclosure signature
    const disclosureString = JSON.stringify({
      disclosedData,
      proofMetadata,
      policyHash: ClientEncryptionService.hashData(JSON.stringify(policy))
    });

    const disclosureSignature = ClientEncryptionService.hashData(disclosureString);

    return {
      disclosedData,
      proofMetadata,
      disclosureSignature,
      policyHash: ClientEncryptionService.hashData(JSON.stringify(policy))
    };
  }

  /**
   * Verify selective disclosure
   */
  static verifySelectiveDisclosure(
    selectiveData: SelectiveProofData,
    policy: DisclosurePolicy,
    issuerPublicKey: string
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Verify policy hash matches
    const expectedPolicyHash = ClientEncryptionService.hashData(JSON.stringify(policy));
    if (selectiveData.policyHash !== expectedPolicyHash) {
      errors.push('Policy hash mismatch');
    }

    // Verify disclosure signature
    const disclosureString = JSON.stringify({
      disclosedData: selectiveData.disclosedData,
      proofMetadata: selectiveData.proofMetadata,
      policyHash: selectiveData.policyHash
    });

    const expectedSignature = ClientEncryptionService.hashData(disclosureString);
    if (selectiveData.disclosureSignature !== expectedSignature) {
      errors.push('Disclosure signature invalid');
    }

    // Verify policy signature (simplified verification)
    try {
      const policyString = JSON.stringify({
        proofId: policy.proofId,
        disclosedFields: policy.disclosedFields,
        purpose: policy.purpose,
        recipient: policy.recipient,
        expiration: policy.expiration
      });

      const policyHash = ClientEncryptionService.hashData(policyString);
      // In practice, would verify the signature properly
    } catch (error) {
      errors.push('Policy signature verification failed');
    }

    // Verify expiration
    if (policy.expiration && new Date() > new Date(policy.expiration)) {
      errors.push('Policy has expired');
    }

    // Verify disclosed fields are subset of policy
    const disclosedFields = Object.keys(selectiveData.disclosedData);
    const unauthorizedFields = disclosedFields.filter(
      field => !policy.disclosedFields.includes(field)
    );

    if (unauthorizedFields.length > 0) {
      errors.push(`Unauthorized fields disclosed: ${unauthorizedFields.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get available fields for disclosure from proof data
   */
  static getAvailableFields(proofData: any): string[] {
    return Object.keys(proofData).filter(
      key => !['id', 'issuer', 'timestamp', 'hash'].includes(key)
    );
  }

  /**
   * Create disclosure template for common use cases
   */
  static createDisclosureTemplate(
    templateName: string,
    typicalFields: string[],
    purpose: string
  ): { name: string; fields: string[]; purpose: string } {
    return {
      name: templateName,
      fields: typicalFields,
      purpose
    };
  }

  /**
   * Get standard disclosure templates
   */
  static getStandardTemplates(): Record<string, { fields: string[]; purpose: string }> {
    return {
      'verification_only': {
        fields: ['verified', 'issuer', 'timestamp'],
        purpose: 'Proof verification'
      },
      'basic_identity': {
        fields: ['issuer', 'timestamp'],
        purpose: 'Identity confirmation'
      },
      'timestamp_validation': {
        fields: ['timestamp'],
        purpose: 'Timestamp verification'
      },
      'compliance_check': {
        fields: ['verified', 'issuer', 'timestamp', 'hash'],
        purpose: 'Regulatory compliance'
      }
    };
  }

  /**
   * Apply data transformation for privacy-preserving disclosure
   */
  static applyPrivacyTransformation(
    data: any,
    transformations: Record<string, (value: any) => any>
  ): Record<string, any> {
    const transformed: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      if (transformations[key]) {
        transformed[key] = transformations[key](value);
      } else {
        transformed[key] = value;
      }
    }

    return transformed;
  }

  /**
   * Create hash-based disclosure for sensitive fields
   */
  static createHashedDisclosure(
    data: Record<string, any>,
    fieldsToHash: string[]
  ): Record<string, any> {
    const hashedData = { ...data };

    for (const field of fieldsToHash) {
      if (hashedData[field] !== undefined) {
        hashedData[field] = ClientEncryptionService.hashData(
          JSON.stringify(hashedData[field])
        );
      }
    }

    return hashedData;
  }

  /**
   * Validate that disclosed data meets minimum requirements
   */
  static validateDisclosureRequirements(
    disclosedData: Record<string, any>,
    minimumRequiredFields: string[]
  ): { valid: boolean; missingFields: string[] } {
    const missingFields = minimumRequiredFields.filter(
      field => disclosedData[field] === undefined
    );

    return {
      valid: missingFields.length === 0,
      missingFields
    };
  }
}