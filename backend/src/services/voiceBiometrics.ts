import crypto from 'crypto';

export interface VoiceEnrollmentResult {
  success: boolean;
  voiceprintId?: string;
  confidenceScore?: number;
  error?: string;
}

export interface VoiceVerificationResult {
  success: boolean;
  matched: boolean;
  confidence: number;
  similarityScore: number;
  error?: string;
}

export interface VoiceAnalysisResult {
  success: boolean;
  features?: {
    pitch: number;
    tone: number;
    cadence: number;
    clarity: number;
    backgroundNoise: number;
  };
  isLiveVoice: boolean;
  livenessScore: number;
  error?: string;
}

export class VoiceBiometricsService {
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.75;
  private readonly MIN_SIMILARITY_THRESHOLD = 0.85;
  private readonly MIN_LIVENESS_SCORE = 0.7;

  /**
   * Enroll a new voice sample for biometric verification
   */
  async enrollVoice(
    userId: string,
    audioBuffer: Buffer,
    sampleRate: number = 16000
  ): Promise<VoiceEnrollmentResult> {
    try {
      // Extract voice features from audio
      const features = await this.extractVoiceFeatures(audioBuffer, sampleRate);
      
      // Generate voiceprint hash
      const voiceprintHash = this.generateVoiceprintHash(features);
      
      // Calculate confidence score based on audio quality
      const confidenceScore = this.calculateConfidenceScore(features);
      
      if (confidenceScore < this.MIN_CONFIDENCE_THRESHOLD) {
        return {
          success: false,
          error: 'Audio quality too low for enrollment. Please record in a quieter environment.'
        };
      }

      const voiceprintId = `voice_${crypto.randomBytes(8).toString('hex')}`;

      return {
        success: true,
        voiceprintId,
        confidenceScore
      };
    } catch (error) {
      console.error('Voice enrollment error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Enrollment failed'
      };
    }
  }

  /**
   * Verify voice against enrolled voiceprint
   */
  async verifyVoice(
    enrolledVoiceprintHash: string,
    audioBuffer: Buffer,
    sampleRate: number = 16000
  ): Promise<VoiceVerificationResult> {
    try {
      // Extract features from verification sample
      const features = await this.extractVoiceFeatures(audioBuffer, sampleRate);
      
      // Perform liveness detection
      const livenessResult = await this.detectLiveness(audioBuffer, features);
      
      if (!livenessResult.isLiveVoice) {
        return {
          success: true,
          matched: false,
          confidence: 0,
          similarityScore: 0,
          error: 'Liveness check failed. Please ensure you are speaking live.'
        };
      }

      // Generate voiceprint from current sample
      const currentVoiceprintHash = this.generateVoiceprintHash(features);
      
      // Compare voiceprints
      const similarityScore = this.compareVoiceprints(
        enrolledVoiceprintHash,
        currentVoiceprintHash,
        features
      );

      const matched = similarityScore >= this.MIN_SIMILARITY_THRESHOLD;
      const confidence = this.calculateVerificationConfidence(
        similarityScore,
        livenessResult.livenessScore,
        features
      );

      return {
        success: true,
        matched,
        confidence,
        similarityScore
      };
    } catch (error) {
      console.error('Voice verification error:', error);
      return {
        success: false,
        matched: false,
        confidence: 0,
        similarityScore: 0,
        error: error instanceof Error ? error.message : 'Verification failed'
      };
    }
  }

  /**
   * Analyze voice characteristics
   */
  async analyzeVoice(
    audioBuffer: Buffer,
    sampleRate: number = 16000
  ): Promise<VoiceAnalysisResult> {
    try {
      const features = await this.extractVoiceFeatures(audioBuffer, sampleRate);
      const livenessResult = await this.detectLiveness(audioBuffer, features);

      return {
        success: true,
        features: {
          pitch: features.pitch,
          tone: features.tone,
          cadence: features.cadence,
          clarity: features.clarity,
          backgroundNoise: features.backgroundNoise
        },
        isLiveVoice: livenessResult.isLiveVoice,
        livenessScore: livenessResult.livenessScore
      };
    } catch (error) {
      console.error('Voice analysis error:', error);
      return {
        success: false,
        isLiveVoice: false,
        livenessScore: 0,
        error: error instanceof Error ? error.message : 'Analysis failed'
      };
    }
  }

  /**
   * Extract voice features from audio buffer
   */
  private async extractVoiceFeatures(
    audioBuffer: Buffer,
    sampleRate: number
  ): Promise<{
    pitch: number;
    tone: number;
    cadence: number;
    clarity: number;
    backgroundNoise: number;
    spectralFeatures: number[];
    temporalFeatures: number[];
  }> {
    // Placeholder for actual feature extraction
    // In production, use libraries like:
    // - Meyda for audio feature extraction
    // - TensorFlow.js for ML-based features
    // - WebRTC VAD for voice activity detection

    // Simulate feature extraction
    const spectralFeatures = this.extractSpectralFeatures(audioBuffer, sampleRate);
    const temporalFeatures = this.extractTemporalFeatures(audioBuffer, sampleRate);

    return {
      pitch: this.calculatePitch(spectralFeatures),
      tone: this.calculateTone(spectralFeatures),
      cadence: this.calculateCadence(temporalFeatures),
      clarity: this.calculateClarity(spectralFeatures, temporalFeatures),
      backgroundNoise: this.estimateNoiseLevel(audioBuffer),
      spectralFeatures,
      temporalFeatures
    };
  }

  /**
   * Detect if voice is live (not recorded/replayed)
   */
  private async detectLiveness(
    audioBuffer: Buffer,
    features: {
      pitch: number;
      tone: number;
      cadence: number;
      clarity: number;
      backgroundNoise: number;
      spectralFeatures: number[];
      temporalFeatures: number[];
    }
  ): Promise<{ isLiveVoice: boolean; livenessScore: number }> {
    // Placeholder for liveness detection
    // In production, use techniques like:
    // - Challenge-response (ask user to say random phrase)
    // - Spectral analysis for playback detection
    // - Phase analysis for synthetic voice detection

    const livenessIndicators = [
      features.backgroundNoise < 0.3, // Low background noise
      features.clarity > 0.6, // Clear voice
      features.cadence > 0.4 && features.cadence < 0.9, // Natural cadence
      this.checkSpectralLiveness(features.spectralFeatures),
      this.checkTemporalConsistency(features.temporalFeatures)
    ];

    const livenessScore = livenessIndicators.filter(Boolean).length / livenessIndicators.length;

    return {
      isLiveVoice: livenessScore >= this.MIN_LIVENESS_SCORE,
      livenessScore
    };
  }

  /**
   * Generate voiceprint hash from features
   */
  private generateVoiceprintHash(features: {
    pitch: number;
    tone: number;
    cadence: number;
    clarity: number;
    spectralFeatures: number[];
    temporalFeatures: number[];
  }): string {
    // Create a normalized feature vector
    const featureVector = [
      features.pitch,
      features.tone,
      features.cadence,
      features.clarity,
      ...features.spectralFeatures.slice(0, 10),
      ...features.temporalFeatures.slice(0, 10)
    ];

    // Normalize and quantize features
    const normalizedFeatures = featureVector.map(f => Math.round(f * 1000) / 1000);
    
    // Generate hash
    const hashInput = normalizedFeatures.join(',');
    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  /**
   * Compare two voiceprints
   */
  private compareVoiceprints(
    enrolledHash: string,
    currentHash: string,
    features: {
      pitch: number;
      tone: number;
      cadence: number;
      clarity: number;
    }
  ): number {
    // Calculate hash similarity
    const hashSimilarity = this.calculateHashSimilarity(enrolledHash, currentHash);
    
    // Weight feature-based comparison
    const featureScore = (
      features.pitch * 0.25 +
      features.tone * 0.25 +
      features.cadence * 0.25 +
      features.clarity * 0.25
    );

    // Combine scores
    return (hashSimilarity * 0.6) + (featureScore * 0.4);
  }

  /**
   * Calculate hash similarity using Hamming distance
   */
  private calculateHashSimilarity(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) return 0;

    let matchingBits = 0;
    const totalBits = hash1.length * 4; // Hex to bits

    for (let i = 0; i < hash1.length; i++) {
      const bits1 = parseInt(hash1[i], 16);
      const bits2 = parseInt(hash2[i], 16);
      
      // Count matching bits
      for (let j = 0; j < 4; j++) {
        if (((bits1 >> j) & 1) === ((bits2 >> j) & 1)) {
          matchingBits++;
        }
      }
    }

    return matchingBits / totalBits;
  }

  /**
   * Calculate confidence score for enrollment
   */
  private calculateConfidenceScore(features: {
    clarity: number;
    backgroundNoise: number;
  }): number {
    const clarityWeight = 0.6;
    const noiseWeight = 0.4;

    const noiseScore = Math.max(0, 1 - features.backgroundNoise);
    
    return (features.clarity * clarityWeight) + (noiseScore * noiseWeight);
  }

  /**
   * Calculate verification confidence
   */
  private calculateVerificationConfidence(
    similarityScore: number,
    livenessScore: number,
    features: {
      clarity: number;
      backgroundNoise: number;
    }
  ): number {
    const similarityWeight = 0.5;
    const livenessWeight = 0.3;
    const qualityWeight = 0.2;

    const qualityScore = (features.clarity + (1 - features.backgroundNoise)) / 2;

    return (
      similarityScore * similarityWeight +
      livenessScore * livenessWeight +
      qualityScore * qualityWeight
    );
  }

  // Placeholder methods for feature extraction
  private extractSpectralFeatures(audioBuffer: Buffer, sampleRate: number): number[] {
    // In production: Use FFT, MFCC, etc.
    return Array.from({ length: 20 }, () => Math.random());
  }

  private extractTemporalFeatures(audioBuffer: Buffer, sampleRate: number): number[] {
    // In production: Use zero-crossing rate, energy, etc.
    return Array.from({ length: 10 }, () => Math.random());
  }

  private calculatePitch(spectralFeatures: number[]): number {
    return spectralFeatures[0] * 0.5 + 0.5;
  }

  private calculateTone(spectralFeatures: number[]): number {
    return spectralFeatures.reduce((a, b) => a + b, 0) / spectralFeatures.length;
  }

  private calculateCadence(temporalFeatures: number[]): number {
    return temporalFeatures.reduce((a, b) => a + b, 0) / temporalFeatures.length;
  }

  private calculateClarity(spectralFeatures: number[], temporalFeatures: number[]): number {
    const spectralClarity = Math.max(...spectralFeatures) - Math.min(...spectralFeatures);
    const temporalClarity = temporalFeatures[0];
    return (spectralClarity + temporalClarity) / 2;
  }

  private estimateNoiseLevel(audioBuffer: Buffer): number {
    // In production: Analyze silent segments
    return Math.random() * 0.3;
  }

  private checkSpectralLiveness(spectralFeatures: number[]): boolean {
    // Check for artifacts that indicate playback
    const variance = this.calculateVariance(spectralFeatures);
    return variance > 0.1;
  }

  private checkTemporalConsistency(temporalFeatures: number[]): boolean {
    // Check for unnatural pauses or patterns
    return temporalFeatures.every(f => f > 0.01);
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }
}

export default new VoiceBiometricsService();
