import React, { useState, useEffect } from 'react';
import { Shield, Key, Eye, EyeOff, RefreshCw, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

interface EncryptionSettingsProps {
  proofId?: string;
  onEncryptionChange?: (settings: EncryptionConfig) => void;
}

interface EncryptionConfig {
  enabled: boolean;
  algorithm: 'AES-256-GCM' | 'RSA-4096';
  keyDerivation: 'scrypt' | 'pbkdf2';
  autoRotate: boolean;
  rotationInterval: number; // days
}

const EncryptionSettings: React.FC<EncryptionSettingsProps> = ({ 
  proofId, 
  onEncryptionChange 
}) => {
  const [config, setConfig] = useState<EncryptionConfig>({
    enabled: true,
    algorithm: 'AES-256-GCM',
    keyDerivation: 'scrypt',
    autoRotate: true,
    rotationInterval: 90
  });

  const [showPassword, setShowPassword] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);

  useEffect(() => {
    if (onEncryptionChange) {
      onEncryptionChange(config);
    }
  }, [config, onEncryptionChange]);

  const handleConfigChange = (key: keyof EncryptionConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleGenerateKeys = async () => {
    if (!masterPassword || masterPassword !== confirmPassword) {
      toast.error('Passwords do not match or are empty');
      return;
    }

    if (masterPassword.length < 12) {
      toast.error('Password must be at least 12 characters long');
      return;
    }

    setIsGeneratingKeys(true);
    try {
      // Simulate key generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success('Encryption keys generated successfully!');
      setMasterPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error('Failed to generate encryption keys');
    } finally {
      setIsGeneratingKeys(false);
    }
  };

  const handlePasswordStrength = (password: string): number => {
    let strength = 0;
    if (password.length >= 12) strength += 25;
    if (/[a-z]/.test(password)) strength += 15;
    if (/[A-Z]/.test(password)) strength += 15;
    if (/[0-9]/.test(password)) strength += 20;
    if (/[^A-Za-z0-9]/.test(password)) strength += 25;
    return strength;
  };

  const passwordStrength = handlePasswordStrength(masterPassword);
  const strengthColor = passwordStrength < 50 ? 'red' : passwordStrength < 80 ? 'yellow' : 'green';

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center mb-6">
        <Shield className="h-6 w-6 text-blue-600 mr-2" />
        <h2 className="text-xl font-semibold text-gray-900">Encryption Settings</h2>
      </div>

      <div className="space-y-6">
        {/* Encryption Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">Enable Encryption</h3>
            <p className="text-sm text-gray-500">
              Encrypt sensitive proof data for enhanced security
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => handleConfigChange('enabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {config.enabled && (
          <>
            {/* Algorithm Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Encryption Algorithm
              </label>
              <select
                value={config.algorithm}
                onChange={(e) => handleConfigChange('algorithm', e.target.value as any)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="AES-256-GCM">AES-256-GCM (Recommended)</option>
                <option value="RSA-4096">RSA-4096 (Asymmetric)</option>
              </select>
            </div>

            {/* Key Derivation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Key Derivation Function
              </label>
              <select
                value={config.keyDerivation}
                onChange={(e) => handleConfigChange('keyDerivation', e.target.value as any)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="scrypt">scrypt (Memory-hard, Recommended)</option>
                <option value="pbkdf2">PBKDF2 (Standard)</option>
              </select>
            </div>

            {/* Key Rotation */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Auto Key Rotation</h3>
                <p className="text-sm text-gray-500">
                  Automatically rotate encryption keys for enhanced security
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoRotate}
                  onChange={(e) => handleConfigChange('autoRotate', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {config.autoRotate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rotation Interval (days)
                </label>
                <input
                  type="number"
                  min="7"
                  max="365"
                  value={config.rotationInterval}
                  onChange={(e) => handleConfigChange('rotationInterval', parseInt(e.target.value))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            {/* Master Password Setup */}
            <div className="border-t pt-6">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center">
                <Key className="h-5 w-5 mr-2" />
                Master Password Setup
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Master Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={masterPassword}
                      onChange={(e) => setMasterPassword(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                      placeholder="Enter strong master password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  
                  {masterPassword && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            strengthColor === 'red' ? 'bg-red-500' : 
                            strengthColor === 'yellow' ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${passwordStrength}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Password strength: {passwordStrength}%
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 ${
                        confirmPassword && masterPassword !== confirmPassword 
                          ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Confirm master password"
                    />
                    {confirmPassword && masterPassword !== confirmPassword && (
                      <Lock className="absolute right-3 top-3 h-5 w-5 text-red-500" />
                    )}
                  </div>
                </div>

                <button
                  onClick={handleGenerateKeys}
                  disabled={isGeneratingKeys || !masterPassword || masterPassword !== confirmPassword}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isGeneratingKeys ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                      Generating Keys...
                    </>
                  ) : (
                    <>
                      <Key className="h-5 w-5 mr-2" />
                      Generate Encryption Keys
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EncryptionSettings;