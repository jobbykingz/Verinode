import React, { useState, useEffect } from 'react';

interface ZKProofForm {
  proofType: string;
  description: string;
  publicInputs: string;
  verificationKey: string;
  expiresAt: string;
}

interface ZKProof {
  id: string;
  proofType: string;
  description: string;
  createdAt: string;
  verified: boolean;
  expiresAt?: string;
}

export const ZKProofCreator: React.FC = () => {
  const [form, setForm] = useState<ZKProofForm>({
    proofType: 'identity',
    description: '',
    publicInputs: '',
    verificationKey: '',
    expiresAt: ''
  });

  const [loading, setLoading] = useState(false);
  const [proofs, setProofs] = useState<ZKProof[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchZKProofs();
  }, []);

  const fetchZKProofs = async () => {
    try {
      const response = await fetch('/api/zk-proofs');
      const data = await response.json();
      
      if (data.success) {
        setProofs(data.data);
      }
    } catch (err) {
      setError('Failed to fetch ZK-proofs');
    }
  };

  const handleInputChange = (field: keyof ZKProofForm, value: string) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
    setError(null);
  };

  const validateForm = (): boolean => {
    if (!form.proofType || !form.description || !form.publicInputs || !form.verificationKey) {
      setError('All fields are required');
      return false;
    }

    try {
      JSON.parse(form.publicInputs);
    } catch {
      setError('Public inputs must be valid JSON');
      return false;
    }

    if (form.expiresAt && new Date(form.expiresAt) <= new Date()) {
      setError('Expiration date must be in the future');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/zk-proofs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proofType: form.proofType,
          description: form.description,
          publicInputs: JSON.parse(form.publicInputs),
          verificationKey: form.verificationKey,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          metadata: {
            creator: 'current-user' // Would get from auth context
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        setForm({
          proofType: 'identity',
          description: '',
          publicInputs: '',
          verificationKey: '',
          expiresAt: ''
        });
        await fetchZKProofs();
      } else {
        setError(data.error || 'Failed to create ZK-proof');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const verifyProof = async (proofId: string) => {
    try {
      const response = await fetch(`/api/zk-proofs/${proofId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (data.success) {
        await fetchZKProofs();
      } else {
        setError(data.error || 'Verification failed');
      }
    } catch (err) {
      setError('Network error during verification');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="bg-white shadow-lg rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Create ZK-Proof</h2>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Proof Type
              </label>
              <select
                value={form.proofType}
                onChange={(e) => handleInputChange('proofType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="identity">Identity Proof</option>
                <option value="age">Age Proof</option>
                <option value="income">Income Proof</option>
                <option value="credential">Credential Proof</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Verification Key
              </label>
              <input
                type="text"
                value={form.verificationKey}
                onChange={(e) => handleInputChange('verificationKey', e.target.value)}
                placeholder="Enter verification key"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe what this proof verifies"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Public Inputs (JSON)
            </label>
            <textarea
              value={form.publicInputs}
              onChange={(e) => handleInputChange('publicInputs', e.target.value)}
              placeholder='{"name": "John Doe", "age": 25}'
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expiration Date (Optional)
            </label>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => handleInputChange('expiresAt', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create ZK-Proof'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white shadow-lg rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Your ZK-Proofs</h3>
        
        {proofs.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No ZK-proofs created yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {proofs.map((proof) => (
                  <tr key={proof.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {proof.id.substring(0, 12)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        {proof.proofType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {proof.description.substring(0, 50)}{proof.description.length > 50 ? '...' : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(proof.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {proof.verified ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                          Verified
                        </span>
                      ) : proof.expiresAt && new Date(proof.expiresAt) < new Date() ? (
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                          Expired
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {!proof.verified && (
                        <button
                          onClick={() => verifyProof(proof.id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Verify
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
