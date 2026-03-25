import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { trackEvent } from '../analytics/ga';

const VerifyProof = () => {
  const [proofId, setProofId] = useState('');
  const [proof, setProof] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);

    trackEvent({
      action: 'form_submit',
      category: 'VerifyProof',
      label: 'search_proof',
    });

    try {
      // Mock API call - replace with actual Stellar integration
      const response = await fetch(`/api/proofs/${proofId}`);
      const data = await response.json();

      if (response.ok) {
        trackEvent({
          action: 'form_submit_success',
          category: 'VerifyProof',
          label: 'search_proof',
        });
        setProof(data.proof);
        toast.success('Proof retrieved successfully!');
      } else {
        trackEvent({
          action: 'form_submit_error',
          category: 'VerifyProof',
          label: `search_proof_http_${response.status}`,
        });
        toast.error('Proof not found');
      }
    } catch {
      trackEvent({
        action: 'form_submit_error',
        category: 'VerifyProof',
        label: 'search_proof_exception',
      });
      toast.error('Error verifying proof');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyOnChain = async () => {
    setIsVerifying(true);
    trackEvent({
      action: 'cta_click',
      category: 'VerifyProof',
      label: 'verify_on_chain',
    });
    try {
      // Mock on-chain verification
      const response = await fetch(`/api/proofs/verify/${proofId}`, {
        method: 'POST'
      });

      if (response.ok) {
        trackEvent({
          action: 'form_submit_success',
          category: 'VerifyProof',
          label: 'verify_on_chain',
        });
        toast.success('Proof verified on-chain!');
        setProof(prev => ({ ...prev, verified: true }));
      } else {
        trackEvent({
          action: 'form_submit_error',
          category: 'VerifyProof',
          label: `verify_on_chain_http_${response.status}`,
        });
        toast.error('Verification failed');
      }
    } catch {
      trackEvent({
        action: 'form_submit_error',
        category: 'VerifyProof',
        label: 'verify_on_chain_exception',
      });
      toast.error('Error during on-chain verification');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Verify Cryptographic Proof</h1>
      
      <div className="bg-white p-8 rounded-lg shadow-md mb-6">
        <form onSubmit={handleVerify} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Proof ID
            </label>
            <input
              type="text"
              value={proofId}
              onChange={(e) => setProofId(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter proof ID..."
              required
            />
          </div>

          <button
            type="submit"
            disabled={isVerifying}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isVerifying ? 'Searching...' : 'Search Proof'}
          </button>
        </form>
      </div>

      {proof && (
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Proof Details</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="font-medium">ID:</span>
              <span>{proof.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Issuer:</span>
              <span className="text-sm">{proof.issuer}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Status:</span>
              <span className={`px-2 py-1 rounded text-sm ${
                proof.verified 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {proof.verified ? 'Verified' : 'Pending'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Created:</span>
              <span>{new Date(proof.timestamp).toLocaleString()}</span>
            </div>
            <div>
              <span className="font-medium">Event Data:</span>
              <p className="mt-1 p-3 bg-gray-50 rounded text-sm">
                {proof.eventData}
              </p>
            </div>
            <div>
              <span className="font-medium">Hash:</span>
              <p className="mt-1 p-3 bg-gray-50 rounded text-sm font-mono">
                {proof.hash}
              </p>
            </div>
          </div>

          {!proof.verified && (
            <button
              onClick={handleVerifyOnChain}
              disabled={isVerifying}
              className="w-full mt-6 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isVerifying ? 'Verifying...' : 'Verify On-Chain'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default VerifyProof;
