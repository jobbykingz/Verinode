import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import IssueProof from './pages/IssueProof';
import VerifyProof from './pages/VerifyProof';
import Dashboard from './pages/Dashboard';
import RBACDashboard from './pages/Admin/RBACDashboard';
import DashboardBuilder from './components/Dashboard/DashboardBuilder';
import './App.css';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-black">
          <Navbar />
          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/issue" element={<IssueProof />} />
              <Route path="/verify" element={<VerifyProof />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/admin/rbac" element={<RBACDashboard />} />
              <Route path="/dashboard/custom" element={<DashboardBuilder />} />
            </Routes>
          </main>
          <Toaster 
            position="top-right" 
            toastOptions={{
              className: 'bg-gray-900 text-white border border-gray-800 rounded-2xl p-4 shadow-2xl backdrop-blur-3xl'
            }}
          />
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
