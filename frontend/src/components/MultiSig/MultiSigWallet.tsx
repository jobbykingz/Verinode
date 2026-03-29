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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Shield, 
  Users, 
  Settings, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Lock,
  Unlock,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Download,
  Upload
} from 'lucide-react';
import { multiSigService } from '../../services/multiSigService';
import { toast } from 'react-hot-toast';

interface MultiSigWalletProps {
  walletId?: string;
  onWalletCreated?: (walletId: string) => void;
}

interface Wallet {
  walletId: string;
  name: string;
  description?: string;
  config: {
    threshold: number;
    signers: Array<{
      address: string;
      name: string;
      role: 'OWNER' | 'ADMIN' | 'SIGNER';
      weight: number;
      active: boolean;
      addedAt: string;
    }>;
    maxSigners: number;
  };
  state: {
    isActive: boolean;
    isFrozen: boolean;
    network: 'STELLAR' | 'ETHEREUM' | 'POLYGON';
    contractAddress?: string;
  };
  security: {
    dailyLimit: number;
    singleTransactionLimit: number;
    allowedOperations: string[];
  };
  stats: {
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    pendingSignatures: number;
  };
  metadata: {
    createdBy: string;
    createdAt: string;
    lastModified: string;
  };
}

export const MultiSigWallet: React.FC<MultiSigWalletProps> = ({ 
  walletId, 
  onWalletCreated 
}) => {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showCreateForm, setShowCreateForm] = useState(!walletId);
  const [showSecrets, setShowSecrets] = useState(false);

  // Form states for creating wallet
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    network: 'STELLAR' as 'STELLAR' | 'ETHEREUM' | 'POLYGON',
    threshold: 2,
    signers: [{ address: '', name: '', role: 'SIGNER' as const, weight: 1 }]
  });

  // Load wallet data
  useEffect(() => {
    if (walletId && !showCreateForm) {
      loadWallet(walletId);
    }
  }, [walletId, showCreateForm]);

  const loadWallet = async (id: string) => {
    try {
      setLoading(true);
      const data = await multiSigService.getWallet(id);
      setWallet(data);
    } catch (error) {
      toast.error('Failed to load wallet');
      console.error('Error loading wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWallet = async () => {
    try {
      setLoading(true);
      
      // Validate form
      if (!createForm.name || createForm.signers.length < 2) {
        toast.error('Please fill all required fields and add at least 2 signers');
        return;
      }

      if (createForm.threshold > createForm.signers.length) {
        toast.error('Threshold cannot exceed number of signers');
        return;
      }

      const newWallet = await multiSigService.createWallet({
        ...createForm,
        createdBy: 'current-user' // Replace with actual user ID
      });

      setWallet(newWallet);
      setShowCreateForm(false);
      onWalletCreated?.(newWallet.walletId);
      toast.success('Multi-signature wallet created successfully');

    } catch (error) {
      toast.error('Failed to create wallet');
      console.error('Error creating wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const addSigner = () => {
    setCreateForm(prev => ({
      ...prev,
      signers: [...prev.signers, { address: '', name: '', role: 'SIGNER', weight: 1 }]
    }));
  };

  const removeSigner = (index: number) => {
    setCreateForm(prev => ({
      ...prev,
      signers: prev.signers.filter((_, i) => i !== index)
    }));
  };

  const updateSigner = (index: number, field: string, value: any) => {
    setCreateForm(prev => ({
      ...prev,
      signers: prev.signers.map((signer, i) => 
        i === index ? { ...signer, [field]: value } : signer
      )
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (showCreateForm) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Create Multi-Signature Wallet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Wallet Name *</Label>
              <Input
                id="name"
                value={createForm.name}
                onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter wallet name"
              />
            </div>
            <div>
              <Label htmlFor="network">Network *</Label>
              <Select
                value={createForm.network}
                onValueChange={(value: 'STELLAR' | 'ETHEREUM' | 'POLYGON') =>
                  setCreateForm(prev => ({ ...prev, network: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STELLAR">Stellar</SelectItem>
                  <SelectItem value="ETHEREUM">Ethereum</SelectItem>
                  <SelectItem value="POLYGON">Polygon</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={createForm.description}
              onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description for this wallet"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="threshold">Signature Threshold *</Label>
              <Input
                id="threshold"
                type="number"
                min="1"
                max={createForm.signers.length}
                value={createForm.threshold}
                onChange={(e) => setCreateForm(prev => ({ 
                  ...prev, 
                  threshold: parseInt(e.target.value) || 1 
                }))}
              />
              <p className="text-sm text-gray-500 mt-1">
                {createForm.threshold} of {createForm.signers.length} signatures required
              </p>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={addSigner}
                variant="outline"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Signer
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <Label>Signers *</Label>
            {createForm.signers.map((signer, index) => (
              <Card key={index} className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor={`signer-address-${index}`}>Address *</Label>
                    <Input
                      id={`signer-address-${index}`}
                      value={signer.address}
                      onChange={(e) => updateSigner(index, 'address', e.target.value)}
                      placeholder="0x... or G..."
                    />
                  </div>
                  <div>
                    <Label htmlFor={`signer-name-${index}`}>Name *</Label>
                    <Input
                      id={`signer-name-${index}`}
                      value={signer.name}
                      onChange={(e) => updateSigner(index, 'name', e.target.value)}
                      placeholder="Signer name"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`signer-role-${index}`}>Role</Label>
                    <Select
                      value={signer.role}
                      onValueChange={(value: 'OWNER' | 'ADMIN' | 'SIGNER') =>
                        updateSigner(index, 'role', value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OWNER">Owner</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="SIGNER">Signer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Label htmlFor={`signer-weight-${index}`}>Weight</Label>
                      <Input
                        id={`signer-weight-${index}`}
                        type="number"
                        min="1"
                        value={signer.weight}
                        onChange={(e) => updateSigner(index, 'weight', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    {createForm.signers.length > 2 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeSigner(index)}
                        className="mt-6"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex gap-4">
            <Button 
              onClick={handleCreateWallet}
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Creating...' : 'Create Wallet'}
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

  if (!wallet) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Shield className="h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Wallet Selected</h3>
          <p className="text-gray-500 text-center mb-4">
            Select an existing wallet or create a new multi-signature wallet
          </p>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create New Wallet
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Wallet Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-blue-600" />
              <div>
                <CardTitle>{wallet.name}</CardTitle>
                <p className="text-sm text-gray-500">{wallet.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={wallet.state.isActive ? "default" : "secondary"}>
                {wallet.state.isActive ? 'Active' : 'Inactive'}
              </Badge>
              {wallet.state.isFrozen && (
                <Badge variant="destructive">
                  <Lock className="h-3 w-3 mr-1" />
                  Frozen
                </Badge>
              )}
              <Badge variant="outline">
                {wallet.state.network}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Wallet Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Transactions</p>
                <p className="text-2xl font-bold">{wallet.stats.totalTransactions}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Success Rate</p>
                <p className="text-2xl font-bold">
                  {wallet.stats.totalTransactions > 0 
                    ? Math.round((wallet.stats.successfulTransactions / wallet.stats.totalTransactions) * 100)
                    : 0}%
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending Signatures</p>
                <p className="text-2xl font-bold">{wallet.stats.pendingSignatures}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Threshold</p>
                <p className="text-2xl font-bold">{wallet.config.threshold}/{wallet.config.signers.length}</p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="signers">Signers</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Wallet Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Wallet ID</Label>
                  <div className="flex items-center gap-2">
                    <Input value={wallet.walletId} readOnly />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(wallet.walletId)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {wallet.state.contractAddress && (
                  <div>
                    <Label>Contract Address</Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        value={wallet.state.contractAddress} 
                        readOnly 
                        type={showSecrets ? "text" : "password"}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSecrets(!showSecrets)}
                      >
                        {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(wallet.state.contractAddress!)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Created By</Label>
                  <Input value={wallet.metadata.createdBy} readOnly />
                </div>
                <div>
                  <Label>Created At</Label>
                  <Input value={new Date(wallet.metadata.createdAt).toLocaleString()} readOnly />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signers" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Signers ({wallet.config.signers.length})</CardTitle>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Signer
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {wallet.config.signers.map((signer, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{signer.name}</h4>
                          <p className="text-sm text-gray-500">{signer.address}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={signer.active ? "default" : "secondary"}>
                          {signer.active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="outline">{signer.role}</Badge>
                        <Badge variant="outline">Weight: {signer.weight}</Badge>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Daily Limit</Label>
                  <Input 
                    value={wallet.security.dailyLimit.toString()} 
                    readOnly 
                  />
                </div>
                <div>
                  <Label>Single Transaction Limit</Label>
                  <Input 
                    value={wallet.security.singleTransactionLimit.toString()} 
                    readOnly 
                  />
                </div>
              </div>
              <div>
                <Label>Allowed Operations</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {wallet.security.allowedOperations.map((operation, index) => (
                    <Badge key={index} variant="outline">
                      {operation.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No recent activity</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
