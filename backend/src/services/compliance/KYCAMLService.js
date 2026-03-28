const axios = require('axios');

/**
 * KYC/AML Integration Service
 * Integrates with identity verification providers for Know Your Customer and Anti-Money Laundering checks
 */
class KYCAMLService {
  constructor() {
    this.providers = {
      ONFIDO: process.env.ONFIDO_API_KEY,
      JUMIO: process.env.JUMIO_API_KEY,
      COMPLYADVANTAGE: process.env.COMPLYADVANTAGE_API_KEY,
      SUMSUB: process.env.SUMSUB_API_KEY
    };
    
    this.verificationLevels = {
      BASIC: 'BASIC',
      ENHANCED: 'ENHANCED',
      PREMIUM: 'PREMIUM'
    };

    this.riskLevels = {
      LOW: 'LOW',
      MEDIUM: 'MEDIUM',
      HIGH: 'HIGH',
      CRITICAL: 'CRITICAL'
    };
  }

  /**
   * Initiate KYC verification process
   */
  async initiateKYC(userId, level = this.verificationLevels.BASIC, provider = 'ONFIDO') {
    const verificationId = `kyc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const kycSession = {
      verificationId,
      userId,
      provider,
      level,
      status: 'INITIATED',
      createdAt: new Date(),
      steps: {
        identityVerification: false,
        documentVerification: false,
        livenessCheck: false,
        addressVerification: false,
        sanctionsCheck: false,
        pepCheck: false
      },
      results: null,
      completedAt: null
    };

    // Initialize session with provider
    const providerSession = await this.createProviderSession(provider, kycSession);
    kycSession.providerSessionId = providerSession.id;
    kycSession.applicantUrl = providerSession.applicantUrl;

    // Store in database
    await this.storeKYCSession(kycSession);

    return kycSession;
  }

  /**
   * Verify identity document
   */
  async verifyIdentityDocument(userId, documentType, documentImages, provider = 'ONFIDO') {
    try {
      const response = await axios.post(
        `${this.getProviderEndpoint(provider)}/documents`,
        {
          type: documentType,
          images: documentImages,
          userId
        },
        {
          headers: {
            'Authorization': `Bearer ${this.providers[provider]}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        documentId: response.data.id,
        validity: response.data.validity,
        expiryDate: response.data.expiryDate,
        issuingCountry: response.data.issuing_country,
        confidence: response.data.confidence
      };
    } catch (error) {
      throw new Error(`Document verification failed: ${error.message}`);
    }
  }

  /**
   * Perform liveness check
   */
  async performLivenessCheck(userId, videoData, provider = 'ONFIDO') {
    try {
      const response = await axios.post(
        `${this.getProviderEndpoint(provider)}/liveness`,
        {
          userId,
          video: videoData
        },
        {
          headers: {
            'Authorization': `Bearer ${this.providers[provider]}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        livenessId: response.data.id,
        isLive: response.data.liveness,
        confidence: response.data.confidence,
        faceMatch: response.data.face_match
      };
    } catch (error) {
      throw new Error(`Liveness check failed: ${error.message}`);
    }
  }

  /**
   * Perform AML screening - sanctions, PEP, adverse media
   */
  async performAMLScreening(userId, personalData, provider = 'COMPLYADVANTAGE') {
    try {
      const response = await axios.post(
        `${this.getProviderEndpoint(provider)}/screen`,
        {
          first_name: personalData.firstName,
          last_name: personalData.lastName,
          date_of_birth: personalData.dateOfBirth,
          nationality: personalData.nationality,
          country_of_residence: personalData.countryOfResidence
        },
        {
          headers: {
            'Authorization': `Bearer ${this.providers[provider]}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const matches = response.data.matches || [];
      
      // Calculate risk score
      const riskScore = this.calculateAMLRiskScore(matches);
      const riskLevel = this.determineRiskLevel(riskScore);

      return {
        success: true,
        screeningId: response.data.id,
        matches: matches.map(m => ({
          name: m.name,
          type: m.type, // SANCTIONS, PEP, ADVERSE_MEDIA
          source: m.source,
          matchStrength: m.match_strength,
          details: m.details
        })),
        riskScore,
        riskLevel,
        cleared: riskLevel === this.riskLevels.LOW || riskLevel === this.riskLevels.MEDIUM
      };
    } catch (error) {
      throw new Error(`AML screening failed: ${error.message}`);
    }
  }

  /**
   * Verify address
   */
  async verifyAddress(userId, addressDocuments, provider = 'ONFIDO') {
    try {
      const response = await axios.post(
        `${this.getProviderEndpoint(provider)}/address`,
        {
          userId,
          documents: addressDocuments
        },
        {
          headers: {
            'Authorization': `Bearer ${this.providers[provider]}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        verified: response.data.verified,
        address: response.data.address,
        confidence: response.data.confidence
      };
    } catch (error) {
      throw new Error(`Address verification failed: ${error.message}`);
    }
  }

  /**
   * Complete KYC verification and update user status
   */
  async completeKYC(verificationId, results) {
    const kycSession = await this.getKYCSession(verificationId);
    
    if (!kycSession) {
      throw new Error('KYC session not found');
    }

    kycSession.results = results;
    kycSession.status = results.allPassed ? 'APPROVED' : 'REJECTED';
    kycSession.completedAt = new Date();

    // Update user KYC status
    await this.updateUserKYCStatus(kycSession.userId, {
      kycVerified: results.allPassed,
      kycLevel: kycSession.level,
      kycCompletedAt: new Date(),
      kycProvider: kycSession.provider,
      riskLevel: results.riskLevel
    });

    // Store comprehensive audit trail
    await this.logKYCAuditTrail(kycSession, results);

    await this.updateKYCSession(kycSession);

    return kycSession;
  }

  /**
   * Get KYC status for a user
   */
  async getKYCStatus(userId) {
    const sessions = await this.getUserKYCSessions(userId);
    const latestSession = sessions[0];

    if (!latestSession) {
      return {
        verified: false,
        level: null,
        status: 'NOT_STARTED'
      };
    }

    return {
      verified: latestSession.status === 'APPROVED',
      level: latestSession.level,
      status: latestSession.status,
      completedAt: latestSession.completedAt,
      provider: latestSession.provider,
      riskLevel: latestSession.results?.riskLevel
    };
  }

  /**
   * Monitor ongoing AML risk - periodic rescreening
   */
  async monitorOngoingRisk(userId) {
    const kycStatus = await this.getKYCStatus(userId);
    
    if (!kycStatus.verified) {
      return { requiresAction: false };
    }

    // Perform periodic AML rescreening
    const userData = await this.getUserData(userId);
    const amlResult = await this.performAMLScreening(userId, userData);

    // Check for risk level changes
    if (amlResult.riskLevel !== kycStatus.riskLevel) {
      return {
        requiresAction: true,
        reason: 'RISK_LEVEL_CHANGED',
        previousRisk: kycStatus.riskLevel,
        currentRisk: amlResult.riskLevel,
        recommendation: this.getRiskRecommendation(amlResult.riskLevel)
      };
    }

    return {
      requiresAction: false,
      lastScreening: new Date(),
      riskLevel: amlResult.riskLevel
    };
  }

  // Helper methods
  getProviderEndpoint(provider) {
    const endpoints = {
      ONFIDO: 'https://api.onfido.com/v3.6',
      JUMIO: 'https://netverify.com/api/v4',
      COMPLYADVANTAGE: 'https://api.complyadvantage.com/v1',
      SUMSUB: 'https://api.sumsub.com/resources'
    };
    return endpoints[provider];
  }

  async createProviderSession(provider, kycSession) {
    // Implementation would call actual provider API
    return {
      id: `provider_session_${Date.now()}`,
      applicantUrl: `https://${provider}.com/verify/${kycSession.verificationId}`
    };
  }

  calculateAMLRiskScore(matches) {
    let score = 0;
    
    matches.forEach(match => {
      switch (match.type) {
        case 'SANCTIONS':
          score += 100;
          break;
        case 'PEP':
          score += 50;
          break;
        case 'ADVERSE_MEDIA':
          score += 30;
          break;
      }
    });

    return Math.min(100, score);
  }

  determineRiskLevel(score) {
    if (score >= 80) return this.riskLevels.CRITICAL;
    if (score >= 50) return this.riskLevels.HIGH;
    if (score >= 20) return this.riskLevels.MEDIUM;
    return this.riskLevels.LOW;
  }

  getRiskRecommendation(riskLevel) {
    switch (riskLevel) {
      case 'CRITICAL':
        return 'IMMEDIATE_ACTION_REQUIRED';
      case 'HIGH':
        return 'ENHANCED_DUE_DILIGENCE_REQUIRED';
      case 'MEDIUM':
        return 'ADDITIONAL_MONITORING';
      case 'LOW':
        return 'CONTINUE_NORMAL_MONITORING';
    }
  }

  // Database integration methods
  async storeKYCSession(session) { /* Implementation */ }
  async getKYCSession(id) { /* Implementation */ }
  async updateKYCSession(session) { /* Implementation */ }
  async getUserKYCSessions(userId) { /* Implementation */ }
  async updateUserKYCStatus(userId, status) { /* Implementation */ }
  async logKYCAuditTrail(session, results) { /* Implementation */ }
  async getUserData(userId) { /* Implementation */ }
}

module.exports = KYCAMLService;
