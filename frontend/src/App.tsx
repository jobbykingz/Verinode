import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import PWAProvider from './components/PWA/PWAProvider';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import IssueProof from './pages/IssueProof';
import VerifyProof from './pages/VerifyProof';
import Dashboard from './pages/Dashboard';
import Marketplace from './pages/Marketplace';
import Search from './pages/Search';
import WalletDemo from './pages/WalletDemo';
import RouteChangeTracker from './analytics/RouteChangeTracker';
import { performanceMetrics, preloadCriticalResources } from './utils/performance';
// Import accessibility components
import { ScreenReader } from './components/Accessibility/ScreenReader';
import { KeyboardNavigation } from './components/Accessibility/KeyboardNavigation';
import { VoiceCommands } from './components/Accessibility/VoiceCommands';
import { HighContrast } from './components/Accessibility/HighContrast';
import { accessibilityService } from './services/accessibilityService';
import './App.css';

const queryClient = new QueryClient();

function App() {
  useEffect(() => {
    // Initialize performance optimizations
    preloadCriticalResources();
    performanceMetrics.lazyLoadImages();

    // Initialize accessibility service
    // The service is already initialized in its constructor

    // Measure page load performance
    const metrics = performanceMetrics.measurePageLoad();
    if (metrics) {
      console.log('[Performance] Page load metrics:', metrics);
    }

    // Monitor memory usage periodically
    const memoryInterval = setInterval(() => {
      const memory = performanceMetrics.getMemoryUsage();
      if (memory && memory.used / memory.total > 0.8) {
        console.warn('[Performance] High memory usage detected:', memory);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(memoryInterval);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <RouteChangeTracker />
        {/* Accessibility Components */}
        <ScreenReader />
        <KeyboardNavigation enableShortcuts={true} showHelp={true} />
        <VoiceCommands showIndicator={true} />
        <HighContrast showToggle={true} colorBlindSupport={true} />
        
        <div className="min-h-screen bg-gray-50">
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <Navbar />
          <main
            id="main-content"
            className="container mx-auto px-4 py-8"
            aria-label="Main content"
          >
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/issue" element={<IssueProof />} />
              <Route path="/verify" element={<VerifyProof />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/search" element={<Search />} />
              <Route path="/wallet-demo" element={<WalletDemo />} />
            </Routes>
          </main>
          <Toaster position="top-right" />
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
