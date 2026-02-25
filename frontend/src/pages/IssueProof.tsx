import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { trackEvent } from '../analytics/ga';

const IssueProof = () => {
  const [eventData, setEventData] = useState('');
  const [hash, setHash] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    trackEvent({
      action: 'form_submit',
      category: 'IssueProof',
      label: 'issue_proof',
    });

    try {
      // Mock API call - replace with actual Stellar integration
      const response = await fetch('/api/proofs/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventData,
          hash,
          issuerAddress: 'mock-stellar-address'
        })
      });

      if (response.ok) {
        trackEvent({
          action: 'form_submit_success',
          category: 'IssueProof',
          label: 'issue_proof',
        });
        toast.success('Proof issued successfully!');
        setEventData('');
        setHash('');
      } else {
        trackEvent({
          action: 'form_submit_error',
          category: 'IssueProof',
          label: `issue_proof_http_${response.status}`,
        });
        toast.error('Failed to issue proof');
      }
    } catch {
      trackEvent({
        action: 'form_submit_error',
        category: 'IssueProof',
        label: 'issue_proof_exception',
      });
      toast.error('Error issuing proof');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Issue Cryptographic Proof</h1>
      
      <div className="bg-white p-8 rounded-lg shadow-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Data
            </label>
            <textarea
              value={eventData}
              onChange={(e) => setEventData(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              placeholder="Describe the event or provide relevant data..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cryptographic Hash
            </label>
            <input
              type="text"
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter SHA-256 hash..."
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Issuing...' : 'Issue Proof'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default IssueProof;
