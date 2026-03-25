import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, FileText, CheckCircle, BarChart3, ShieldCheck } from 'lucide-react';

const Navbar = () => {
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
              <span>Home</span>
            </Link>
            <Link
              to="/issue"
              className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Shield className="h-4 w-4" />
              <span>Issue Proof</span>
            </Link>
            <Link
              to="/verify"
              className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <CheckCircle className="h-4 w-4" />
              <span>Verify</span>
            </Link>
            <Link
              to="/dashboard"
              className="flex items-center space-x-1 text-gray-400 hover:text-blue-500 transition-colors"
            >
              <BarChart3 className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>
            <Link
              to="/admin/rbac"
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-blue-600/10 text-blue-500 hover:bg-blue-600/20 transition-all border border-blue-500/10"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="font-bold">Admin</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
