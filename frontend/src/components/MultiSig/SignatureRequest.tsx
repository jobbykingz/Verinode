import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription } from '../ui/alert';
import { Progress } from '../ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Users, 
  Eye,
  EyeOff,
  Copy,
  Send,
  RefreshCw,
  Download,
  Share2,
  Lock,
  Unlock,
  Timer,
  FileText,
  Shield,
  Activity
} from 'lucide-react';
import { multiSigService } from '../../services/multiSigService';
import { toast } from 'react-hot-toast';

interface SignatureRequestProps {
  requestId?: string;
  walletId?: string;
  onRequestCreated?: (requestId: string) => void;
}

interface SignatureRequestData {
  requestId: string;
  walletId: string;
  request: {
    type: 'PROOF_CREATION' | 'PROOF_VERIFICATION' | 'CONTRACT_INTERACTION' | 'TOKEN_TRANSFER' | 'CONFIG_CHANGE' | 'SIGNER_MANAGEMENT' | 'EMERGENCY_ACTIONS';
    title: string;
    description: string;
    payload: any;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    estimatedGas?: number;
    estimatedValue?: number;
  };
  signatures: Array<{
    signerAddress: string;
    signature: string;
    signedAt: string;
    weight: number;
    metadata?: {
      userAgent?: string;
      ipAddress?: string;
      deviceInfo?: string;
    };
  }>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'EXECUTED' | 'FAILED';
  timing: {
    createdAt: string;
    expiresAt: string;
    executedAt?: string;
    lastSignatureAt?: string;
    timeToExecution?: number;
  };
  threshold: {
    required: number;
    currentWeight: number;
    requiredWeight: number;
    isMet: boolean;
  };
  metadata: {
    createdBy: string;
    createdByName?: string;
    tags: string[];
    relatedProofId?: string;
    relatedContractAddress?: string;
  };
}

export const SignatureRequest: React.FC<SignatureRequestProps> = ({ 
  requestId, 
  walletId,
  onRequestCreated 
}) => {
  const [request, setRequest] = useState<SignatureRequestData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(!requestId);
  const [showPayload, setShowPayload] = useState(false);
  const [signingDialog, setSigningDialog] = useState(false);
  const [signerAddress, setSignerAddress] = useState('');
  const [signature, setSignature] = useState('');

  // Form states for creating request
  const [createForm, setCreateForm] = useState({
    walletId: walletId || '',
    type: 'PROOF_CREATION' as const,
    title: '',
    description: '',
    payload: '',
    priority: 'MEDIUM' as const,
    expiresIn: 24
  });

  // Load request data
  useEffect(() => {
    if (requestId && !showCreateForm) {
      loadRequest(requestId);
    }
  }, [requestId, showCreateForm]);

  const loadRequest = async (id: string) => {
    try {
      setLoading(true);
      const data = await multiSigService.getSignatureRequest(id);
      setRequest(data);
    } catch (error) {
      toast.error('Failed to load signature request');
      console.error('Error loading request:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async () => {
    try {
      setLoading(true);
      
      // Validate form
      if (!createForm.walletId || !createForm.title || !createForm.description || !createForm.payload) {
        toast.error('Please fill all required fields');
        return;
      }

      let parsedPayload;
      try {
        parsedPayload = JSON.parse(createForm.payload);
      } catch (e) {
        toast.error('Invalid JSON in payload field');
        return;
      }

      const newRequest = await multiSigService.createSignatureRequest({
        ...createForm,
        payload: parsedPayload,
        createdBy: 'current-user', // Replace with actual user ID
        ipAddress: '127.0.0.1', // Replace with actual IP
        userAgent: navigator.userAgent
      });

      setRequest(newRequest);
      setShowCreateForm(false);
      onRequestCreated?.(newRequest.requestId);
      toast.success('Signature request created successfully');

    } catch (error) {
      toast.error('Failed to create signature request');
      console.error('Error creating request:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSignature = async () => {
    try {
      setLoading(true);
      
      if (!signerAddress || !signature) {
        toast.error('Please provide signer address and signature');
        return;
      }

      await multiSigService.addSignature(request!.requestId, signerAddress, signature);
      
      // Reload request to get updated state
      await loadRequest(request!.requestId);
      
      setSigningDialog(false);
      setSignerAddress('');
      setSignature('');
      toast.success('Signature added successfully');

    } catch (error) {
      toast.error('Failed to add signature');
      console.error('Error adding signature:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteRequest = async () => {
    try {
      setLoading(true);
      
      const updatedRequest = await multiSigService.executeRequest(request!.requestId);
      setRequest(updatedRequest);
      
      toast.success('Request executed successfully');

    } catch (error) {
      toast.error('Failed to execute request');
      console.error('Error executing request:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'yellow';
      case 'APPROVED': return 'green';
      case 'REJECTED': return 'red';
      case 'EXPIRED': return 'gray';
      case 'EXECUTED': return 'blue';
      case 'FAILED': return 'red';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock className="h-4 w-4" />;
      case 'APPROVED': return <CheckCircle className="h-4 w-4" />;
      case 'REJECTED': return <XCircle className="h-4 w-4" />;
      case 'EXPIRED': return <Timer className="h-4 w-4" />;
      case 'EXECUTED': return <Shield className="h-4 w-4" />;
      case 'FAILED': return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'secondary';
      case 'MEDIUM': return 'default';
      case 'HIGH': return 'destructive';
      case 'CRITICAL': return 'destructive';
      default: return 'default';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  if (showCreateForm) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Create Signature Request
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="walletId">Wallet ID *</Label>
              <Input
                id="walletId"
                value={createForm.walletId}
                onChange={(e) => setCreateForm(prev => ({ ...prev, walletId: e.target.value }))}
                placeholder="Enter wallet ID"
              />
            </div>
            <div>
              <Label htmlFor="type">Request Type *</Label>
              <Select
                value={createForm.type}
                onValueChange={(value: any) =>
                  setCreateForm(prev => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROOF_CREATION">Proof Creation</SelectItem>
                  <SelectItem value="PROOF_VERIFICATION">Proof Verification</SelectItem>
                  <SelectItem value="CONTRACT_INTERACTION">Contract Interaction</SelectItem>
                  <SelectItem value="TOKEN_TRANSFER">Token Transfer</SelectItem>
                  <SelectItem value="CONFIG_CHANGE">Config Change</SelectItem>
                  <SelectItem value="SIGNER_MANAGEMENT">Signer Management</SelectItem>
                  <SelectItem value="EMERGENCY_ACTIONS">Emergency Actions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={createForm.title}
                onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter request title"
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={createForm.priority}
                onValueChange={(value: any) =>
                  setCreateForm(prev => ({ ...prev, priority: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={createForm.description}
              onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this request does"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="payload">Payload (JSON) *</Label>
            <Textarea
              id="payload"
              value={createForm.payload}
              onChange={(e) => setCreateForm(prev => ({ ...prev, payload: e.target.value }))}
              placeholder='{"key": "value"}'
              rows={6}
              className="font-mono"
            />
          </div>

          <div>
            <Label htmlFor="expiresIn">Expires In (hours)</Label>
            <Input
              id="expiresIn"
              type="number"
              min="1"
              max="168"
              value={createForm.expiresIn}
              onChange={(e) => setCreateForm(prev => ({ 
                ...prev, 
                expiresIn: parseInt(e.target.value) || 24 
              }))}
            />
          </div>

          <div className="flex gap-4">
            <Button 
              onClick={handleCreateRequest}
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Creating...' : 'Create Request'}
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowCreateForm(false)}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!request) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Request Selected</h3>
          <p className="text-gray-500 text-center mb-4">
            Select an existing request or create a new signature request
          </p>
          <Button onClick={() => setShowCreateForm(true)}>
            <FileText className="h-4 w-4 mr-2" />
            Create New Request
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Request Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-600" />
              <div>
                <CardTitle>{request.request.title}</CardTitle>
                <p className="text-sm text-gray-500">{request.request.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getPriorityColor(request.request.priority)}>
                {request.request.priority}
              </Badge>
              <Badge variant={getStatusColor(request.status)}>
                <span className="flex items-center gap-1">
                  {getStatusIcon(request.status)}
                  {request.status}
                </span>
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Progress and Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Signature Progress</span>
              <span className="text-sm text-gray-500">
                {request.threshold.currentWeight}/{request.threshold.requiredWeight}
              </span>
            </div>
            <Progress 
              value={(request.threshold.currentWeight / request.threshold.requiredWeight) * 100} 
              className="mb-2"
            />
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Users className="h-4 w-4" />
              {request.signatures.length} signatures collected
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Time Remaining</span>
              <Clock className="h-4 w-4 text-orange-600" />
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {formatTimeRemaining(request.timing.expiresAt)}
            </div>
            <div className="text-sm text-gray-500">
              Expires: {new Date(request.timing.expiresAt).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Request ID</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(request.requestId)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-sm font-mono truncate">
              {request.requestId}
            </div>
            <div className="text-sm text-gray-500">
              Type: {request.request.type.replace('_', ' ')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {request.status === 'PENDING' && (
              <Dialog open={signingDialog} onOpenChange={setSigningDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Lock className="h-4 w-4 mr-2" />
                    Add Signature
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Signature</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="signerAddress">Signer Address</Label>
                      <Input
                        id="signerAddress"
                        value={signerAddress}
                        onChange={(e) => setSignerAddress(e.target.value)}
                        placeholder="0x... or G..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="signature">Signature</Label>
                      <Textarea
                        id="signature"
                        value={signature}
                        onChange={(e) => setSignature(e.target.value)}
                        placeholder="Enter signature"
                        rows={3}
                        className="font-mono"
                      />
                    </div>
                    <div className="flex gap-4">
                      <Button 
                        onClick={handleAddSignature}
                        disabled={loading}
                        className="flex-1"
                      >
                        {loading ? 'Adding...' : 'Add Signature'}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setSigningDialog(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {request.status === 'APPROVED' && (
              <Button 
                onClick={handleExecuteRequest}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
              >
                <Activity className="h-4 w-4 mr-2" />
                Execute Request
              </Button>
            )}

            <Button variant="outline" onClick={() => copyToClipboard(request.requestId)}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>

            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Request Details */}
      <Card>
        <CardHeader>
          <CardTitle>Request Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Payload</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPayload(!showPayload)}
              >
                {showPayload ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {showPayload ? (
              <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-sm">
                {JSON.stringify(request.request.payload, null, 2)}
              </pre>
            ) : (
              <div className="bg-gray-100 p-4 rounded-md text-center text-gray-500">
                Payload hidden - click to reveal
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Created By</Label>
              <Input value={request.metadata.createdBy} readOnly />
            </div>
            <div>
              <Label>Created At</Label>
              <Input value={new Date(request.timing.createdAt).toLocaleString()} readOnly />
            </div>
          </div>

          {request.metadata.relatedProofId && (
            <div>
              <Label>Related Proof ID</Label>
              <Input value={request.metadata.relatedProofId} readOnly />
            </div>
          )}

          {request.metadata.relatedContractAddress && (
            <div>
              <Label>Related Contract Address</Label>
              <Input value={request.metadata.relatedContractAddress} readOnly />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signatures */}
      <Card>
        <CardHeader>
          <CardTitle>Signatures ({request.signatures.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {request.signatures.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No signatures yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {request.signatures.map((sig, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{sig.signerAddress}</h4>
                        <p className="text-sm text-gray-500">
                          Signed: {new Date(sig.signedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Weight: {sig.weight}</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(sig.signature)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
