import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, CheckCircle, XCircle, Clock, Zap, TrendingUp } from 'lucide-react';
import { encryptionService } from '@/services/encryptionService';
import { useAuth } from '@/hooks/useAuth';

interface EncryptedVerificationProps {
  proofId: string;
  onVerificationComplete?: (result: boolean, confidence: number) => void;
}

interface VerificationResult {
  proofId: string;
  verifier: string;
  result: boolean;
  confidenceScore: number;
  verifiedAt: number;
  gasUsed: number;
}

interface VerificationStats {
  totalVerifications: number;
  successfulVerifications: number;
  averageConfidence: number;
  averageGasUsed: number;
  lastVerificationTime?: number;
}

export const EncryptedVerification: React.FC<EncryptedVerificationProps> = ({
  proofId,
  onVerificationComplete
}) => {
  const { user } = useAuth();
  const [verificationData, setVerificationData] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [verificationHistory, setVerificationHistory] = useState<VerificationResult[]>([]);
  const [stats, setStats] = useState<VerificationStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    loadVerificationHistory();
    loadVerificationStats();
  }, [proofId]);

  const loadVerificationHistory = async () => {
    try {
      setIsLoadingHistory(true);
      setError(null);
      const history = await encryptionService.getProofVerifications(proofId);
      setVerificationHistory(history);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load verification history');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadVerificationStats = async () => {
    try {
      const history = await encryptionService.getProofVerifications(proofId);
      if (history.length > 0) {
        const successful = history.filter(v => v.result).length;
        const averageConfidence = history.reduce((sum, v) => sum + v.confidenceScore, 0) / history.length;
        const averageGasUsed = history.reduce((sum, v) => sum + v.gasUsed, 0) / history.length;
        const lastVerification = Math.max(...history.map(v => v.verifiedAt));

        setStats({
          totalVerifications: history.length,
          successfulVerifications: successful,
          averageConfidence,
          averageGasUsed,
          lastVerificationTime: lastVerification,
        });
      }
    } catch (err) {
      // Silently fail for stats
    }
  };

  const handleVerify = async () => {
    if (!verificationData.trim()) {
      setError('Please provide verification data');
      return;
    }

    try {
      setIsVerifying(true);
      setError(null);
      setVerificationResult(null);

      const result = await encryptionService.verifyProof(proofId, verificationData);
      setVerificationResult(result);

      onVerificationComplete?.(result.result, result.confidenceScore);

      // Reload history and stats
      await loadVerificationHistory();
      await loadVerificationStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBatchVerify = async () => {
    // Implementation for batch verification
    setError('Batch verification not yet implemented');
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBadgeVariant = (confidence: number) => {
    if (confidence >= 90) return 'default';
    if (confidence >= 70) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-6">
      {/* Verification Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Encrypted Proof Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="verification-data">Verification Data</Label>
            <Textarea
              id="verification-data"
              placeholder="Enter verification data for homomorphic computation..."
              value={verificationData}
              onChange={(e) => setVerificationData(e.target.value)}
              rows={4}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              This data will be used in homomorphic computations to verify the proof without decryption.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleVerify}
              disabled={isVerifying || !verificationData.trim()}
              className="flex-1"
            >
              {isVerifying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Verifying...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Verify Proof
                </>
              )}
            </Button>
            <Button
              onClick={handleBatchVerify}
              variant="outline"
              disabled
            >
              <Zap className="h-4 w-4 mr-2" />
              Batch Verify
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Verification Result */}
      {verificationResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {verificationResult.result ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Verification Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Result</label>
                <div className="flex items-center gap-2 mt-1">
                  {verificationResult.result ? (
                    <Badge className="bg-green-100 text-green-800">Valid</Badge>
                  ) : (
                    <Badge variant="destructive">Invalid</Badge>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Confidence Score</label>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-lg font-bold ${getConfidenceColor(verificationResult.confidenceScore)}`}>
                    {verificationResult.confidenceScore}%
                  </span>
                  <Badge variant={getConfidenceBadgeVariant(verificationResult.confidenceScore)}>
                    {verificationResult.confidenceScore >= 90 ? 'High' :
                     verificationResult.confidenceScore >= 70 ? 'Medium' : 'Low'}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Gas Used</label>
                <p className="text-sm mt-1">{verificationResult.gasUsed.toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Verified At</label>
                <p className="text-sm mt-1">{formatTimestamp(verificationResult.verifiedAt)}</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">Verifier</label>
              <p className="text-xs font-mono bg-gray-100 p-2 rounded mt-1 break-all">
                {verificationResult.verifier}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verification Statistics */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Verification Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.totalVerifications}</div>
                <div className="text-sm text-gray-500">Total Verifications</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.successfulVerifications}</div>
                <div className="text-sm text-gray-500">Successful</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getConfidenceColor(stats.averageConfidence)}`}>
                  {stats.averageConfidence.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-500">Avg Confidence</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.averageGasUsed.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500">Avg Gas Used</div>
              </div>
            </div>

            {stats.lastVerificationTime && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  Last verification: {formatTimestamp(stats.lastVerificationTime)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Verification History */}
      <Card>
        <CardHeader>
          <CardTitle>Verification History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="animate-pulse space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          ) : verificationHistory.length > 0 ? (
            <div className="space-y-4">
              {verificationHistory.slice(0, 10).map((verification, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    {verification.result ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={verification.result ? 'default' : 'destructive'}>
                          {verification.result ? 'Valid' : 'Invalid'}
                        </Badge>
                        <span className={`text-sm font-medium ${getConfidenceColor(verification.confidenceScore)}`}>
                          {verification.confidenceScore}% confidence
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatTimestamp(verification.verifiedAt)} • Gas: {verification.gasUsed.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    {verification.verifier.substring(0, 8)}...
                  </div>
                </div>
              ))}
              {verificationHistory.length > 10 && (
                <div className="text-center text-sm text-gray-500">
                  And {verificationHistory.length - 10} more verifications...
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No verification history available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};