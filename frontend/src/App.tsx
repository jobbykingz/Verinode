import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import IssueProof from './pages/IssueProof';
import VerifyProof from './pages/VerifyProof';
import Dashboard from './pages/Dashboard';
import Marketplace from './pages/Marketplace';
import Search from './pages/Search';
import RouteChangeTracker from './analytics/RouteChangeTracker';
import './App.css';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <RouteChangeTracker />
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/issue" element={<IssueProof />} />
              <Route path="/verify" element={<VerifyProof />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/search" element={<Search />} />
            </Routes>
          </main>
          <Toaster position="top-right" />
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
