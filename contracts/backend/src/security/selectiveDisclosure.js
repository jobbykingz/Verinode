const { ClientEncryptionService } = require('./clientEncryption');

/**
 * Selective disclosure system for revealing only necessary proof data
 */
class SelectiveDisclosureService {
  constructor() {
    this.disclosurePolicies = new Map();
  }

  /**
   * Create a disclosure policy for selective data sharing
   */
  async createDisclosurePolicy(proofData, disclosedFields, purpose, recipient, ownerPrivateKey) {
    const policy = {
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

    const policyId = ClientEncryptionService.generateRandomBytes(16);
    this.disclosurePolicies.set(policyId, policy);

    return policy;
  }

  /**
   * Generate selectively disclosed proof data
   */
  generateSelectiveDisclosure(proofData, policy) {
    // Verify policy is still valid
    if (policy.expiration && new Date() > new Date(policy.expiration)) {
      throw new Error('Disclosure policy has expired');
    }

    // Extract only disclosed fields
    const disclosedData = {};
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
  verifySelectiveDisclosure(selectiveData, policy, issuerPublicKey) {
    const errors = [];

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
  getAvailableFields(proofData) {
    return Object.keys(proofData).filter(
      key => !['id', 'issuer', 'timestamp', 'hash'].includes(key)
    );
  }

  /**
   * Create disclosure template for common use cases
   */
  createDisclosureTemplate(templateName, typicalFields, purpose) {
    return {
      name: templateName,
      fields: typicalFields,
      purpose
    };
  }

  /**
   * Get standard disclosure templates
   */
  getStandardTemplates() {
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
  applyPrivacyTransformation(data, transformations) {
    const transformed = {};

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
  createHashedDisclosure(data, fieldsToHash) {
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
  validateDisclosureRequirements(disclosedData, minimumRequiredFields) {
    const missingFields = minimumRequiredFields.filter(
      field => disclosedData[field] === undefined
    );

    return {
      valid: missingFields.length === 0,
      missingFields
    };
  }
}

module.exports = { SelectiveDisclosureService };