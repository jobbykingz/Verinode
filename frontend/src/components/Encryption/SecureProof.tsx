import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Lock, Unlock, Eye, EyeOff, Shield, Clock, Users } from 'lucide-react';
import { encryptionService } from '@/services/encryptionService';
import { useAuth } from '@/hooks/useAuth';

interface SecureProofProps {
  proofId: string;
  onProofAction?: (action: string, proofId: string) => void;
}

interface EncryptedProofData {
  proofId: string;
  owner: string;
  encryptedData: string;
  metadata: {
    algorithm: string;
    keyVersion: string;
    dataSize: number;
    compressionUsed: boolean;
    checksum: string;
  };
  accessControl: {
    authorizedAddresses: string[];
    permissions: string[];
    maxAccessCount: number;
    accessCount: number;
    expirationTime?: number;
  };
  createdAt: number;
  updatedAt: number;
}

export const SecureProof: React.FC<SecureProofProps> = ({ proofId, onProofAction }) => {
  const { user } = useAuth();
  const [proof, setProof] = useState<EncryptedProofData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedData, setDecryptedData] = useState<string | null>(null);
  const [showDecrypted, setShowDecrypted] = useState(false);
  const [accessProgress, setAccessProgress] = useState(0);

  useEffect(() => {
    loadProof();
  }, [proofId]);

  const loadProof = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const proofData = await encryptionService.getEncryptedProof(proofId);
      setProof(proofData);

      // Calculate access progress
      const progress = (proofData.accessControl.accessCount / proofData.accessControl.maxAccessCount) * 100;
      setAccessProgress(progress);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proof');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecrypt = async () => {
    if (!proof) return;

    try {
      setIsDecrypting(true);
      setError(null);
      const decrypted = await encryptionService.decryptProof(proofId);
      setDecryptedData(decrypted);
      setShowDecrypted(true);
      onProofAction?.('decrypt', proofId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decrypt proof');
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleVerify = async () => {
    if (!proof) return;

    try {
      setError(null);
      await encryptionService.verifyProof(proofId);
      onProofAction?.('verify', proofId);
      // Reload proof to get updated data
      await loadProof();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify proof');
    }
  };

  const handleGrantAccess = async (address: string, permissions: string[]) => {
    if (!proof) return;

    try {
      setError(null);
      await encryptionService.grantAccess(proofId, address, permissions);
      onProofAction?.('grant_access', proofId);
      await loadProof();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grant access');
    }
  };

  const handleRevokeAccess = async (address: string) => {
    if (!proof) return;

    try {
      setError(null);
      await encryptionService.revokeAccess(proofId, address);
      onProofAction?.('revoke_access', proofId);
      await loadProof();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke access');
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const isOwner = proof && user?.address === proof.owner;
  const hasAccess = proof && (isOwner || proof.accessControl.authorizedAddresses.includes(user?.address || ''));
  const canCompute = proof && proof.accessControl.permissions.includes('compute');

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!proof) {
    return (
      <Alert>
        <AlertDescription>Proof not found</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Secure Proof #{proof.proofId}
          <Badge variant={hasAccess ? 'default' : 'secondary'}>
            {hasAccess ? 'Accessible' : 'Restricted'}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Algorithm</label>
            <p className="text-sm">{proof.metadata.algorithm}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Key Version</label>
            <p className="text-sm">{proof.metadata.keyVersion}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Data Size</label>
            <p className="text-sm">{proof.metadata.dataSize} bytes</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Compression</label>
            <p className="text-sm">{proof.metadata.compressionUsed ? 'Yes' : 'No'}</p>
          </div>
        </div>

        {/* Access Control */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="text-sm font-medium">Access Control</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Access Count</span>
              <span>{proof.accessControl.accessCount} / {proof.accessControl.maxAccessCount}</span>
            </div>
            <Progress value={accessProgress} className="h-2" />
          </div>
          {proof.accessControl.expirationTime && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />
              <span>Expires: {formatTimestamp(proof.accessControl.expirationTime)}</span>
            </div>
          )}
        </div>

        {/* Permissions */}
        <div>
          <label className="text-sm font-medium text-gray-500">Permissions</label>
          <div className="flex flex-wrap gap-1 mt-1">
            {proof.accessControl.permissions.map((permission, index) => (
              <Badge key={index} variant="outline">{permission}</Badge>
            ))}
          </div>
        </div>

        {/* Authorized Addresses */}
        {hasAccess && (
          <div>
            <label className="text-sm font-medium text-gray-500">Authorized Addresses</label>
            <div className="space-y-1 mt-1">
              {proof.accessControl.authorizedAddresses.map((address, index) => (
                <div key={index} className="text-xs font-mono bg-gray-100 p-2 rounded">
                  {address}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Encrypted Data */}
        <div>
          <label className="text-sm font-medium text-gray-500">Encrypted Data</label>
          <div className="mt-1 p-3 bg-gray-50 rounded font-mono text-xs break-all">
            {proof.encryptedData.substring(0, 100)}...
          </div>
        </div>

        {/* Decrypted Data */}
        {showDecrypted && decryptedData && (
          <div>
            <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Unlock className="h-4 w-4" />
              Decrypted Data
            </label>
            <div className="mt-1 p-3 bg-green-50 border border-green-200 rounded">
              <pre className="text-xs whitespace-pre-wrap">{decryptedData}</pre>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {hasAccess && !showDecrypted && (
            <Button
              onClick={handleDecrypt}
              disabled={isDecrypting}
              variant="outline"
              size="sm"
            >
              {isDecrypting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                  Decrypting...
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4 mr-2" />
                  Decrypt
                </>
              )}
            </Button>
          )}

          {canCompute && (
            <Button
              onClick={handleVerify}
              variant="outline"
              size="sm"
            >
              <Shield className="h-4 w-4 mr-2" />
              Verify
            </Button>
          )}

          {isOwner && (
            <>
              <Button
                onClick={() => {/* Open grant access modal */}}
                variant="outline"
                size="sm"
              >
                <Users className="h-4 w-4 mr-2" />
                Grant Access
              </Button>
              <Button
                onClick={() => {/* Open revoke access modal */}}
                variant="outline"
                size="sm"
              >
                <EyeOff className="h-4 w-4 mr-2" />
                Revoke Access
              </Button>
            </>
          )}
        </div>

        {/* Timestamps */}
        <div className="text-xs text-gray-500 space-y-1">
          <div>Created: {formatTimestamp(proof.createdAt)}</div>
          <div>Updated: {formatTimestamp(proof.updatedAt)}</div>
        </div>
      </CardContent>
    </Card>
  );
};