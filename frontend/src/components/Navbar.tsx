import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, FileText, CheckCircle, BarChart3, ShoppingBag, Search } from 'lucide-react';
import { trackEvent } from '../analytics/ga';

const Navbar = () => {
  const handleNavClick = (label: string) => {
    trackEvent({
      action: 'navigation_click',
      category: 'Navbar',
      label,
    });
  };

  return (
    <nav className="bg-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link to="/" onClick={() => handleNavClick('brand_home')} className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-800">Verinode</span>
          </Link>
          
          <div className="flex space-x-6">
            <Link
              to="/"
              onClick={() => handleNavClick('home')}
              className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <FileText className="h-4 w-4" />
              <span>Home</span>
            </Link>
            <Link
              to="/issue"
              onClick={() => handleNavClick('issue_proof')}
              className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Shield className="h-4 w-4" />
              <span>Issue Proof</span>
            </Link>
            <Link
              to="/verify"
              onClick={() => handleNavClick('verify_proof')}
              className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <CheckCircle className="h-4 w-4" />
              <span>Verify</span>
            </Link>
            <Link
              to="/dashboard"
              onClick={() => handleNavClick('dashboard')}
              className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <BarChart3 className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>
            <Link
              to="/marketplace"
              onClick={() => handleNavClick('marketplace')}
              className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>Marketplace</span>
            </Link>
            <Link
              to="/search"
              onClick={() => handleNavClick('search')}
              className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Search className="h-4 w-4" />
              <span>Search</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
