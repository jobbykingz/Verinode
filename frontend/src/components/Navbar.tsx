import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, FileText, CheckCircle, BarChart3, ShoppingBag, Search } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

const Navbar = () => {
  const { t } = useTranslation();
  return (
    <nav className="bg-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link to="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-800">Verinode</span>
          </Link>
          
          <div className="flex space-x-6">
            <Link
              to="/"
              className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <FileText className="h-4 w-4" />
              <span>{t('navigation.home')}</span>
            </Link>
            <Link
              to="/issue"
              className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Shield className="h-4 w-4" />
              <span>{t('navigation.issueProof')}</span>
            </Link>
            <Link
              to="/verify"
              className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <CheckCircle className="h-4 w-4" />
              <span>{t('navigation.verify')}</span>
            </Link>
            <Link
              to="/dashboard"
              className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <BarChart3 className="h-4 w-4" />
              <span>{t('navigation.dashboard')}</span>
            </Link>
            <Link
              to="/marketplace"
              className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>{t('navigation.marketplace')}</span>
            </Link>
            <Link
              to="/search"
              className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Search className="h-4 w-4" />
              <span>{t('navigation.search')}</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
