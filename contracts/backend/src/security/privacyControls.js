const { ClientEncryptionService } = require('./clientEncryption');

/**
 * Privacy controls for managing data sharing permissions and access restrictions
 */
class PrivacyControlsService {
  constructor() {
    this.consentRecords = new Map();
    this.accessRequests = new Map();
  }

  /**
   * Create privacy settings for a proof
   */
  createPrivacySettings(settings) {
    return {
      visibility: 'private',
      allowedViewers: [],
      allowedActions: ['view'],
      requireConsent: true,
      dataMinimization: true,
      encryptionRequired: true,
      ...settings
    };
  }

  /**
   * Check if a user can access a proof based on privacy settings
   */
  canAccess(privacySettings, userAddress, requestedActions) {
    // Check if proof is public
    if (privacySettings.visibility === 'public') {
      return { allowed: true };
    }

    // Check if user is the owner
    // This would be verified against the actual proof owner in real implementation
    const isOwner = false; // Placeholder - would check against proof data

    // Check if user is in allowed viewers list
    const isAllowedViewer = privacySettings.allowedViewers.includes(userAddress);

    if (!isAllowedViewer && !isOwner) {
      return { 
        allowed: false, 
        reason: 'User not authorized to access this proof' 
      };
    }

    // Check if requested actions are allowed
    const unauthorizedActions = requestedActions.filter(
      action => !privacySettings.allowedActions.includes(action)
    );

    if (unauthorizedActions.length > 0) {
      return { 
        allowed: false, 
        reason: `Unauthorized actions: ${unauthorizedActions.join(', ')}` 
      };
    }

    // Check expiration
    if (privacySettings.expirationDate) {
      const now = new Date();
      const expiration = new Date(privacySettings.expirationDate);
      if (now > expiration) {
        return { 
          allowed: false, 
          reason: 'Proof access has expired' 
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Request access to a proof
   */
  async requestAccess(proofId, requester, requestedActions, reason) {
    const requestId = ClientEncryptionService.generateRandomBytes(16);
    
    const accessRequest = {
      requester,
      proofId,
      requestedActions,
      reason,
      timestamp: new Date().toISOString()
    };

    this.accessRequests.set(requestId, accessRequest);
    return requestId;
  }

  /**
   * Grant consent for proof access
   */
  async grantConsent(proofId, granter, grantee, permissions, expirationDate) {
    const consentId = ClientEncryptionService.generateRandomBytes(16);
    
    const consentRecord = {
      id: consentId,
      proofId,
      granter,
      grantee,
      permissions,
      expirationDate,
      grantedAt: new Date().toISOString()
    };

    this.consentRecords.set(consentId, consentRecord);
    return consentId;
  }

  /**
   * Revoke consent
   */
  revokeConsent(consentId) {
    const consent = this.consentRecords.get(consentId);
    if (consent) {
      consent.revokedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Check if consent exists and is valid
   */
  checkConsent(proofId, granter, grantee, requestedActions) {
    // Find valid consent records
    for (const [consentId, consent] of this.consentRecords.entries()) {
      if (
        consent.proofId === proofId &&
        consent.granter === granter &&
        consent.grantee === grantee &&
        !consent.revokedAt
      ) {
        // Check expiration
        if (consent.expirationDate) {
          const now = new Date();
          const expiration = new Date(consent.expirationDate);
          if (now > expiration) {
            return { 
              valid: false, 
              reason: 'Consent has expired' 
            };
          }
        }

        // Check if all requested actions are permitted
        const unauthorizedActions = requestedActions.filter(
          action => !consent.permissions.includes(action)
        );

        if (unauthorizedActions.length > 0) {
          return { 
            valid: false, 
            reason: `Unauthorized actions: ${unauthorizedActions.join(', ')}` 
          };
        }

        return { valid: true, consentId };
      }
    }

    return { 
      valid: false, 
      reason: 'No valid consent found' 
    };
  }

  /**
   * Get all access requests for a proof
   */
  getAccessRequests(proofId) {
    return Array.from(this.accessRequests.values()).filter(
      request => request.proofId === proofId
    );
  }

  /**
   * Get all consent records for a user
   */
  getUserConsents(userAddress) {
    return Array.from(this.consentRecords.values()).filter(
      consent => consent.grantee === userAddress && !consent.revokedAt
    );
  }

  /**
   * Apply privacy filtering to proof data
   */
  applyPrivacyFilter(proofData, privacySettings, viewerAddress) {
    if (!privacySettings.dataMinimization) {
      return proofData;
    }

    // Apply data minimization - only return essential fields
    const filteredData = {
      id: proofData.id,
      issuer: proofData.issuer,
      timestamp: proofData.timestamp,
      verified: proofData.verified
    };

    // Add additional fields based on privacy settings and viewer permissions
    if (privacySettings.visibility === 'public' || 
        privacySettings.allowedViewers.includes(viewerAddress)) {
      filteredData.hash = proofData.hash;
    }

    return filteredData;
  }

  /**
   * Validate privacy settings
   */
  validatePrivacySettings(settings) {
    const errors = [];

    if (!['public', 'private', 'shared'].includes(settings.visibility)) {
      errors.push('Invalid visibility setting');
    }

    if (settings.expirationDate) {
      const expiration = new Date(settings.expirationDate);
      if (isNaN(expiration.getTime())) {
        errors.push('Invalid expiration date');
      }
    }

    if (settings.allowedActions.length === 0) {
      errors.push('At least one allowed action must be specified');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = { PrivacyControlsService };