import React, { useState, useEffect } from 'react';

interface MobileVerificationProps {
  proofId: string;
  onComplete: (result: any) => void;
  onError: (error: string) => void;
}

export const MobileVerification: React.FC<MobileVerificationProps> = ({ 
  proofId, 
  onComplete, 
  onError 
}) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [verificationData, setVerificationData] = useState<any>({});
  const [errors, setErrors] = useState<string[]>([]);

  const totalSteps = 4;

  useEffect(() => {
    // Initialize mobile-specific verification
    initializeMobileVerification();
  }, []);

  const initializeMobileVerification = () => {
    // Check mobile capabilities
    if ('serviceWorker' in navigator) {
      // Register service worker for offline verification
      registerVerificationServiceWorker();
    }

    // Setup touch gestures
    setupTouchGestures();
  };

  const registerVerificationServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  };

  const setupTouchGestures = () => {
    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;

      // Swipe detection for navigation
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 50) {
          // Swipe right - next step
          if (step < totalSteps) {
            setStep(step + 1);
          }
        } else if (deltaX < -50) {
          // Swipe left - previous step
          if (step > 1) {
            setStep(step - 1);
          }
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
  };

  const handleStepSubmit = async () => {
    setLoading(true);
    setErrors([]);

    try {
      let stepData: any = {};

      switch (step) {
        case 1:
          // Input verification data
          if (!verificationData.proofType || !verificationData.credentials) {
            setErrors(['Please fill in all required fields']);
            return;
          }
          stepData = {
            proofType: verificationData.proofType,
            credentials: verificationData.credentials
          };
          break;

        case 2:
          // Document upload
          if (!verificationData.documents || verificationData.documents.length === 0) {
            setErrors(['Please upload at least one document']);
            return;
          }
          stepData = {
            documents: verificationData.documents,
            uploadedAt: new Date()
          };
          break;

        case 3:
          // Biometric verification
          if (!verificationData.biometricData) {
            setErrors(['Biometric verification is required']);
            return;
          }
          stepData = {
            biometricData: verificationData.biometricData,
            verifiedAt: new Date()
          };
          break;

        case 4:
          // Final confirmation
          stepData = {
            allData: verificationData,
            confirmedAt: new Date()
          };
          break;
      }

      // Update progress
      setProgress((step / totalSteps) * 100);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Merge step data
      setVerificationData(prev => ({ ...prev, ...stepData }));

      if (step < totalSteps) {
        setStep(step + 1);
      } else {
        // Complete verification
        onComplete(verificationData);
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Verification Type</h3>
            <div className="space-y-3">
              <select
                value={verificationData.proofType || ''}
                onChange={(e) => setVerificationData(prev => ({ ...prev, proofType: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-base"
              >
                <option value="">Select verification type</option>
                <option value="identity">Identity</option>
                <option value="age">Age Verification</option>
                <option value="address">Address Proof</option>
                <option value="education">Education</option>
              </select>

              <input
                type="text"
                placeholder="Enter your credentials"
                value={verificationData.credentials || ''}
                onChange={(e) => setVerificationData(prev => ({ ...prev, credentials: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-base"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Documents</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setVerificationData(prev => ({ ...prev, documents: files }));
                }}
                className="hidden"
                id="document-upload"
              />
              <label
                htmlFor="document-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 5 5 0 011.905.884A5 5 0 0117 16H7zm4 0v1a1 1 0 011 1h2a1 1 0 011-1V5a1 1 0 011-1H7a1 1 0 00-1 1v10a1 1 0 001 1h2a1 1 0 001-1V5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0v6a3 3 0 016 0h-2a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2V6a3 3 0 01-2-2z" />
                </svg>
                <span className="text-sm text-gray-600">Tap to upload documents</span>
                <span className="text-xs text-gray-500 mt-1">
                  {verificationData.documents?.length || 0} files selected
                </span>
              </label>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Biometric Verification</h3>
            <div className="text-center space-y-4">
              <div className="bg-blue-50 rounded-lg p-6">
                <svg className="w-16 h-16 text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009-6.512-6.512S5.483 0 12 11s6.512 6.512 6.512 6.512m0 0c0 3.517 1.009 6.512 6.512 6.512M12 14v7m0 0l6 7m-6-7v7m6 7v-7" />
                </svg>
                <p className="text-sm text-gray-700 mb-4">Place your finger on the sensor</p>
                <button
                  onClick={() => {
                    // Simulate biometric scan
                    setVerificationData(prev => ({ 
                      ...prev, 
                      biometricData: { 
                        scanned: true, 
                        timestamp: new Date(),
                        type: 'fingerprint'
                      } 
                    }));
                  }}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Start Scan
                </button>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirmation</h3>
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <svg className="w-8 h-8 text-green-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a2 2 0 012-2v-4a2 2 0 00-2 2m-6 9l2 2 4-4m6 2a2 2 0 012-2v-4a2 2 0 00-2 2" />
                </svg>
                <div>
                  <h4 className="text-lg font-medium text-green-800">Ready to Submit</h4>
                  <p className="text-sm text-green-600">All verification steps completed</p>
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Verification Type:</span>
                  <span className="font-medium">{verificationData.proofType || 'Not selected'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Documents:</span>
                  <span className="font-medium">{verificationData.documents?.length || 0} files</span>
                </div>
                <div className="flex justify-between">
                  <span>Biometric:</span>
                  <span className="font-medium">{verificationData.biometricData?.scanned ? 'Scanned' : 'Not scanned'}</span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Mobile header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
          className="p-2 rounded-md text-gray-400 hover:text-gray-600 disabled:opacity-50"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7 7" />
          </svg>
        </button>

        <h1 className="text-lg font-semibold text-gray-900">Mobile Verification</h1>
        
        <span className="text-sm text-gray-500">
          Step {step} of {totalSteps}
        </span>

        <button
          onClick={() => setStep(Math.min(totalSteps, step + 1))}
          disabled={step === totalSteps}
          className="p-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="bg-white px-4 py-2">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 px-4 py-6 overflow-y-auto">
        {errors.length > 0 && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            {errors.map((error, index) => (
              <p key={index} className="text-red-700 text-sm">{error}</p>
            ))}
          </div>
        )}

        {renderStepContent()}

        {/* Step action button */}
        <div className="mt-6">
          <button
            onClick={handleStepSubmit}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-lg"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4V6a6 6 0 00-6-6h2a2 2 0 002 2v2a2 2 0 002 2v2a2 2 0 002-2V6a2 2 0 00-2-2H4a6 6 0 00-6 6v8z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              step === totalSteps ? 'Submit Verification' : `Continue to Step ${step + 1}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
