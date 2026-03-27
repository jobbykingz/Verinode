import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, CheckCircle, Zap, Lock } from 'lucide-react';
import { trackEvent } from '../analytics/ga';

const Home = () => {
  const handleCtaClick = (label: string) => {
    trackEvent({
      action: 'cta_click',
      category: 'Home',
      label,
    });
  };

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-12">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Verinode
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Web3 infrastructure for issuing and verifying cryptographic proofs of real-world events on the Stellar blockchain
        </p>
        <div className="flex justify-center space-x-4">
          <Link
            to="/issue"
            onClick={() => handleCtaClick('hero_issue_proof')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Issue Proof
          </Link>
          <Link
            to="/verify"
            onClick={() => handleCtaClick('hero_verify_proof')}
            className="border border-blue-600 text-blue-600 px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Verify Proof
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <Shield className="h-12 w-12 text-blue-600 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Secure</h3>
          <p className="text-gray-600">
            Cryptographic proofs secured by Stellar blockchain technology
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <CheckCircle className="h-12 w-12 text-green-600 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Verifiable</h3>
          <p className="text-gray-600">
            On-chain verification ensures authenticity and integrity
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <Zap className="h-12 w-12 text-yellow-600 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Fast</h3>
          <p className="text-gray-600">
            Lightning-fast transactions on Stellar network
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <Lock className="h-12 w-12 text-red-600 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Decentralized</h3>
          <p className="text-gray-600">
            No single point of failure with distributed verification
          </p>
        </div>
      </section>

      {/* How it Works */}
      <section className="bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-3xl font-bold text-center mb-8">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-blue-600">1</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">Create Event</h3>
            <p className="text-gray-600">
              Document your real-world event with cryptographic proof
            </p>
          </div>
          <div className="text-center">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-blue-600">2</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">Issue Proof</h3>
            <p className="text-gray-600">
              Submit proof to Stellar blockchain for permanent record
            </p>
          </div>
          <div className="text-center">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-blue-600">3</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">Verify</h3>
            <p className="text-gray-600">
              Anyone can verify the authenticity of the proof on-chain
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
